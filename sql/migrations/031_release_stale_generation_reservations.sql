-- Release stale pre-submit generation reservations to prevent admission and spendable balance blockage.
-- Conservative phase-1 rule: only rows that are still reserved and never received provider_request_id.

create or replace function public.release_stale_generation_reservations(
    p_limit integer default 200,
    p_min_age_seconds integer default 900
)
returns table (
    scanned_count integer,
    released_count integer,
    error_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_limit integer := greatest(coalesce(p_limit, 1), 1);
    v_min_age_seconds integer := greatest(coalesce(p_min_age_seconds, 0), 0);
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized';
    end if;

    return query
    with candidates as (
        select r.id
        from public.ai_credit_reservations r
        where r.status = 'reserved'
          and r.provider_request_id is null
          and r.created_at <= now() - make_interval(secs => v_min_age_seconds)
        order by r.created_at asc
        for update skip locked
        limit v_limit
    ),
    released as (
        update public.ai_credit_reservations r
        set
            status = 'released',
            released_at = now(),
            updated_at = now(),
            metadata = coalesce(r.metadata, '{}'::jsonb)
              || jsonb_build_object(
                  'release_reason', 'stale_pre_submit_reservation_cleanup',
                  'released_by', 'generation_recovery_run',
                  'released_at', now()
              )
        from candidates c
        where r.id = c.id
        returning r.id
    )
    select
        (select count(*)::integer from candidates) as scanned_count,
        (select count(*)::integer from released) as released_count,
        0::integer as error_count;
end;
$$;

revoke all on function public.release_stale_generation_reservations(integer, integer) from public;
grant execute on function public.release_stale_generation_reservations(integer, integer) to service_role;
