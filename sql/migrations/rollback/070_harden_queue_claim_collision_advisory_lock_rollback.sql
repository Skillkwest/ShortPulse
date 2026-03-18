-- Roll back migration 070 by restoring the pre-advisory-lock claim RPC body.

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
#variable_conflict use_column
declare
    v_limit integer := greatest(coalesce(p_limit, 1), 1);
    v_lease_seconds integer := greatest(coalesce(p_lease_seconds, 1), 1);
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized';
    end if;

    return query
    with lockable as (
        select
            q.id,
            q.user_id,
            q.created_at
        from public.ai_generation_submit_queue q
        where (
                (q.status = 'queued' and q.next_attempt_at <= now())
             or (q.status = 'dispatching' and coalesce(q.lease_until, now()) <= now())
        )
          and (p_user_id is null or q.user_id = p_user_id)
          and q.status <> 'exhausted'
          and not exists (
              select 1
              from public.ai_generation_submit_queue active_q
              where active_q.user_id = q.user_id
                and active_q.status = 'dispatching'
                and coalesce(active_q.lease_until, now()) > now()
                and active_q.id <> q.id
          )
        order by q.created_at asc, q.id asc
        for update skip locked
    ),
    per_user as (
        select distinct on (l.user_id)
            l.id,
            l.user_id,
            l.created_at
        from lockable l
        order by l.user_id, l.created_at asc, l.id asc
    ),
    picked as (
        select p.id
        from per_user p
        order by p.created_at asc, p.id asc
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
