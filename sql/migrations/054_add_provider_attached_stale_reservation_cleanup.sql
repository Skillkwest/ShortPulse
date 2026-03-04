-- Release stale provider-attached reserved generation holds that are no longer active.
-- This complements pre-submit stale cleanup and prevents long-lived provider-attached rows
-- from blocking admission/queue capacity indefinitely.

create or replace function public.release_stale_provider_attached_generation_reservations(
    p_limit integer default 200,
    p_min_age_seconds integer default 7200,
    p_orphan_min_age_seconds integer default 86400
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
    v_orphan_min_age_seconds integer := greatest(coalesce(p_orphan_min_age_seconds, 0), 0);
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized';
    end if;

    return query
    with candidates as (
        select r.id
        from public.ai_credit_reservations r
        left join public.ai_generations g
          on g.user_id = r.user_id
         and g.request_id = r.provider_request_id
        where r.status = 'reserved'
          and r.provider_request_id is not null
          and r.created_at <= now() - make_interval(secs => v_min_age_seconds)
          and not exists (
              select 1
              from public.ai_generation_submit_queue q
              where q.user_id = r.user_id
                and q.source_ref = r.source_ref
                and q.status in ('queued', 'dispatching')
          )
          and (
              (
                  g.id is not null
                  and (
                      g.status in ('fail', 'success')
                      or coalesce(g.recovery_state, 'none') = 'exhausted'
                  )
              )
              or (
                  g.id is null
                  and r.created_at <= now() - make_interval(secs => v_orphan_min_age_seconds)
              )
          )
        order by r.created_at asc
        for update of r skip locked
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
                  'release_reason', 'stale_provider_attached_reservation_cleanup',
                  'released_by', 'generation_recovery_run',
                  'released_at', now(),
                  'release_finality', 'conditional'
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

revoke all on function public.release_stale_provider_attached_generation_reservations(integer, integer, integer) from public;
grant execute on function public.release_stale_provider_attached_generation_reservations(integer, integer, integer) to service_role;
