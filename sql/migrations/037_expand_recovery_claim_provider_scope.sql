-- Recovery claim hardening: include Fal provider aliases (fal, fal-*) in claim selection.
-- Prevents legacy provider labels (e.g., fal-seedream) from being skipped by reconciler claims.

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
        where lower(coalesce(g.provider, '')) like 'fal%'
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

revoke all on function public.claim_generation_recovery_batch(integer, integer, integer, integer) from public;
grant execute on function public.claim_generation_recovery_batch(integer, integer, integer, integer) to service_role;
