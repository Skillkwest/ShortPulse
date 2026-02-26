-- Durable server-authoritative submit queue for over-cap generation requests.

create table if not exists public.ai_generation_submit_queue (
    id uuid primary key default gen_random_uuid(),
    generation_id uuid not null references public.ai_generations(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    model_id text not null,
    source_ref text not null,
    submit_route text not null,
    submit_payload jsonb not null default '{}'::jsonb,
    timeout_ms integer not null default 20000,
    status text not null default 'queued',
    attempts integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    lease_until timestamptz,
    last_error text,
    last_error_code text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ai_generation_submit_queue_status_check
      check (status in ('queued', 'dispatching', 'exhausted')),
    constraint ai_generation_submit_queue_attempts_non_negative_check
      check (attempts >= 0),
    constraint ai_generation_submit_queue_timeout_min_check
      check (timeout_ms >= 1000)
);

create unique index if not exists ux_ai_generation_submit_queue_user_source_ref
    on public.ai_generation_submit_queue (user_id, source_ref);
create unique index if not exists ux_ai_generation_submit_queue_generation
    on public.ai_generation_submit_queue (generation_id);
create index if not exists ix_ai_generation_submit_queue_dispatch_scan
    on public.ai_generation_submit_queue (status, next_attempt_at, created_at);
create index if not exists ix_ai_generation_submit_queue_user_status_created
    on public.ai_generation_submit_queue (user_id, status, created_at);
create unique index if not exists ux_ai_generation_submit_queue_dispatching_user
    on public.ai_generation_submit_queue (user_id)
    where status = 'dispatching';

alter table public.ai_generation_submit_queue enable row level security;

drop policy if exists select_ai_generation_submit_queue_isolation on public.ai_generation_submit_queue;
create policy select_ai_generation_submit_queue_isolation
    on public.ai_generation_submit_queue
    for select
    using (user_id = auth.uid());

drop policy if exists modify_ai_generation_submit_queue_isolation on public.ai_generation_submit_queue;
create policy modify_ai_generation_submit_queue_isolation
    on public.ai_generation_submit_queue
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create or replace function public.enqueue_generation_submit(
    p_user_id uuid,
    p_source_ref text,
    p_model_id text,
    p_prompt_text text,
    p_mode text,
    p_aspect text default null,
    p_duration_seconds integer default null,
    p_resolution text default null,
    p_submit_route text default '/api/fal/submit',
    p_submit_payload jsonb default '{}'::jsonb,
    p_timeout_ms integer default 20000,
    p_metadata jsonb default '{}'::jsonb
)
returns table(
    status text,
    generation_id uuid,
    source_ref text,
    queue_status text,
    message text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    v_mode text := lower(coalesce(p_mode, 'image'));
    v_generation_id uuid;
    v_queue_status text;
    v_timeout_ms integer := greatest(coalesce(p_timeout_ms, 20000), 1000);
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;
    if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Caller is not authorized for this user id';
    end if;

    if coalesce(nullif(trim(p_source_ref), ''), null) is null then
        raise exception 'source_ref is required';
    end if;

    if v_mode not in ('image', 'video') then
        v_mode := 'image';
    end if;

    perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_source_ref));

    select q.generation_id, q.status
      into v_generation_id, v_queue_status
      from public.ai_generation_submit_queue q
     where q.user_id = p_user_id
       and q.source_ref = p_source_ref
     limit 1;

    if v_generation_id is not null then
        return query select
            'already_queued'::text,
            v_generation_id,
            p_source_ref,
            coalesce(v_queue_status, 'queued')::text,
            null::text;
        return;
    end if;

    insert into public.ai_generations (
        user_id,
        mode,
        provider,
        model_id,
        prompt_text,
        aspect,
        duration_seconds,
        resolution,
        request_id,
        status,
        recovery_state,
        metadata
    )
    values (
        p_user_id,
        v_mode,
        'fal',
        p_model_id,
        coalesce(nullif(trim(p_prompt_text), ''), 'Queued generation'),
        p_aspect,
        p_duration_seconds,
        p_resolution,
        null,
        'pending',
        'none',
        coalesce(p_metadata, '{}'::jsonb)
          || jsonb_build_object(
              'source_ref', p_source_ref,
              'queue_enqueued_at', now(),
              'queue_submit_route', p_submit_route
          )
    )
    returning id
    into v_generation_id;

    insert into public.ai_generation_submit_queue (
        generation_id,
        user_id,
        model_id,
        source_ref,
        submit_route,
        submit_payload,
        timeout_ms,
        status,
        attempts,
        next_attempt_at,
        lease_until,
        last_error,
        last_error_code,
        updated_at
    )
    values (
        v_generation_id,
        p_user_id,
        p_model_id,
        p_source_ref,
        coalesce(nullif(trim(p_submit_route), ''), '/api/fal/submit'),
        coalesce(p_submit_payload, '{}'::jsonb),
        v_timeout_ms,
        'queued',
        0,
        now(),
        null,
        null,
        null,
        now()
    );

    return query select
        'queued'::text,
        v_generation_id,
        p_source_ref,
        'queued'::text,
        null::text;
exception
    when unique_violation then
        select q.generation_id, q.status
          into v_generation_id, v_queue_status
          from public.ai_generation_submit_queue q
         where q.user_id = p_user_id
           and q.source_ref = p_source_ref
         limit 1;

        if v_generation_id is not null then
            return query select
                'already_queued'::text,
                v_generation_id,
                p_source_ref,
                coalesce(v_queue_status, 'queued')::text,
                null::text;
            return;
        end if;

        return query select
            'failed'::text,
            null::uuid,
            p_source_ref,
            'queued'::text,
            'Queue enqueue failed due to unique constraint race.'::text;
end;
$$;

revoke all on function public.enqueue_generation_submit(
    uuid,
    text,
    text,
    text,
    text,
    text,
    integer,
    text,
    text,
    jsonb,
    integer,
    jsonb
) from public;
grant execute on function public.enqueue_generation_submit(
    uuid,
    text,
    text,
    text,
    text,
    text,
    integer,
    text,
    text,
    jsonb,
    integer,
    jsonb
) to service_role;

create or replace function public.claim_generation_submit_queue_batch(
    p_limit integer default 25,
    p_lease_seconds integer default 30,
    p_user_id uuid default null
)
returns table(
    queue_id uuid,
    generation_id uuid,
    user_id uuid,
    model_id text,
    source_ref text,
    submit_route text,
    submit_payload jsonb,
    timeout_ms integer,
    attempts integer,
    status text,
    next_attempt_at timestamptz,
    lease_until timestamptz,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_limit integer := greatest(coalesce(p_limit, 1), 1);
    v_lease_seconds integer := greatest(coalesce(p_lease_seconds, 1), 1);
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized';
    end if;

    return query
    with due_rows as (
        select
            q.id,
            q.user_id,
            q.created_at,
            row_number() over (
                partition by q.user_id
                order by q.created_at asc, q.id asc
            ) as user_rank
        from public.ai_generation_submit_queue q
        where (
                (q.status = 'queued' and q.next_attempt_at <= now())
             or (q.status = 'dispatching' and coalesce(q.lease_until, now()) <= now())
        )
          and (p_user_id is null or q.user_id = p_user_id)
          and q.status <> 'exhausted'
        order by q.created_at asc, q.id asc
        for update skip locked
    ),
    picked as (
        select d.id
        from due_rows d
        where d.user_rank = 1
        order by d.created_at asc, d.id asc
        limit v_limit
    ),
    claimed as (
        update public.ai_generation_submit_queue q
        set
            status = 'dispatching',
            lease_until = now() + make_interval(secs => v_lease_seconds),
            updated_at = now()
        from picked p
        where q.id = p.id
        returning
            q.id,
            q.generation_id,
            q.user_id,
            q.model_id,
            q.source_ref,
            q.submit_route,
            q.submit_payload,
            q.timeout_ms,
            q.attempts,
            q.status,
            q.next_attempt_at,
            q.lease_until,
            q.created_at
    )
    select
        c.id as queue_id,
        c.generation_id,
        c.user_id,
        c.model_id,
        c.source_ref,
        c.submit_route,
        c.submit_payload,
        c.timeout_ms,
        c.attempts,
        c.status,
        c.next_attempt_at,
        c.lease_until,
        c.created_at
    from claimed c
    order by c.created_at asc, c.id asc;
end;
$$;

revoke all on function public.claim_generation_submit_queue_batch(integer, integer, uuid) from public;
grant execute on function public.claim_generation_submit_queue_batch(integer, integer, uuid) to service_role;
