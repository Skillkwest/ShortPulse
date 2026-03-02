-- Extend queued-submit provider persistence + recovery claims to Fal/Kie provider families.
-- This keeps queue/recovery behavior provider-family aware instead of hard-coded to Fal.

drop function if exists public.enqueue_generation_submit(
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
);

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
    p_metadata jsonb default '{}'::jsonb,
    p_provider text default null
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
    v_provider_raw text := lower(coalesce(nullif(trim(p_provider), ''), ''));
    v_provider text := case
        when v_provider_raw like 'kie%' then v_provider_raw
        when v_provider_raw like 'fal%' then v_provider_raw
        when lower(coalesce(p_model_id, '')) like 'kie%' then 'kie'
        else 'fal'
    end;
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
        v_provider,
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
              'queue_submit_route', p_submit_route,
              'queue_provider', v_provider
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
    jsonb,
    text
) from public;
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
    jsonb,
    text
) from anon;
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
    jsonb,
    text
) from authenticated;
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
    jsonb,
    text
) to service_role;

create or replace function public.claim_generation_recovery_batch(
    p_limit integer default 25,
    p_max_attempts integer default 5,
    p_min_age_seconds integer default 120,
    p_lease_seconds integer default 120
)
returns table (
    id uuid,
    user_id uuid,
    request_id text,
    model_id text,
    status text,
    recovery_state text,
    recovery_attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_limit integer := greatest(coalesce(p_limit, 1), 1);
    v_max_attempts integer := greatest(coalesce(p_max_attempts, 1), 1);
    v_min_age_seconds integer := greatest(coalesce(p_min_age_seconds, 0), 0);
    v_lease_seconds integer := greatest(coalesce(p_lease_seconds, 1), 1);
begin
    return query
    with candidates as (
        select g.id
        from public.ai_generations g
        where (
                lower(coalesce(g.provider, '')) like 'fal%'
             or lower(coalesce(g.provider, '')) like 'kie%'
              )
          and g.recovery_state in ('queued', 'recovering')
          and coalesce(g.recovery_attempts, 0) < v_max_attempts
          and g.created_at <= now() - make_interval(secs => v_min_age_seconds)
          and (g.next_recovery_at is null or g.next_recovery_at <= now())
        order by coalesce(g.next_recovery_at, g.created_at), g.created_at
        for update skip locked
        limit v_limit
    ),
    claimed as (
        update public.ai_generations g
        set
            recovery_state = 'recovering',
            recovery_attempts = coalesce(g.recovery_attempts, 0) + 1,
            last_recovery_at = now(),
            next_recovery_at = now() + make_interval(secs => v_lease_seconds)
        from candidates c
        where g.id = c.id
        returning g.id, g.user_id, g.request_id, g.model_id, g.status, g.recovery_state, g.recovery_attempts
    )
    select * from claimed;
end;
$$;

revoke all on function public.claim_generation_recovery_batch(
    integer,
    integer,
    integer,
    integer
) from public;
revoke all on function public.claim_generation_recovery_batch(
    integer,
    integer,
    integer,
    integer
) from anon;
revoke all on function public.claim_generation_recovery_batch(
    integer,
    integer,
    integer,
    integer
) from authenticated;
grant execute on function public.claim_generation_recovery_batch(
    integer,
    integer,
    integer,
    integer
) to service_role;
