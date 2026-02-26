-- Queue/recovery blocker diagnostics + guarded remediation template.
-- Read-only diagnostics run by default. Remediation statements are commented out.
--
-- Usage:
-- 1) Run diagnostics sections first.
-- 2) Confirm candidate counts are stable and clearly stale.
-- 3) Only then run guarded remediation blocks with strict age filters.

-- -----------------------------------------------------------------------------
-- Diagnostics: provider-attached reserved holds by age bucket
-- -----------------------------------------------------------------------------
with provider_attached as (
    select
        r.user_id,
        r.model_id,
        r.provider_request_id,
        r.created_at,
        extract(epoch from (now() - r.created_at))::bigint as age_seconds
    from public.ai_credit_reservations r
    where r.status = 'reserved'
      and r.provider_request_id is not null
)
select
    case
        when age_seconds < 600 then '<10m'
        when age_seconds < 1800 then '10-30m'
        when age_seconds < 3600 then '30-60m'
        when age_seconds < 7200 then '1-2h'
        else '>2h'
    end as age_bucket,
    count(*)::bigint as reservations
from provider_attached
group by 1
order by 1;

-- -----------------------------------------------------------------------------
-- Diagnostics: queue depth by status + age
-- -----------------------------------------------------------------------------
select
    q.status,
    count(*)::bigint as rows,
    min(q.created_at) as oldest_created_at,
    max(q.created_at) as newest_created_at
from public.ai_generation_submit_queue q
group by q.status
order by q.status;

-- -----------------------------------------------------------------------------
-- Diagnostics: queue depth by user and model/tier hotspot visibility
-- -----------------------------------------------------------------------------
select
    q.user_id,
    q.model_id,
    q.status,
    count(*)::bigint as rows,
    min(q.created_at) as oldest_created_at,
    max(q.created_at) as newest_created_at
from public.ai_generation_submit_queue q
group by q.user_id, q.model_id, q.status
order by rows desc, oldest_created_at asc
limit 100;

-- -----------------------------------------------------------------------------
-- Diagnostics: recovery backlog and exhausted counts
-- -----------------------------------------------------------------------------
select
    g.recovery_state,
    g.status,
    count(*)::bigint as rows,
    min(g.created_at) as oldest_created_at,
    max(g.created_at) as newest_created_at
from public.ai_generations g
where lower(coalesce(g.provider, '')) like 'fal%'
group by g.recovery_state, g.status
order by rows desc;

-- -----------------------------------------------------------------------------
-- Diagnostics: potential blocking/stale generation candidates (read-only)
-- -----------------------------------------------------------------------------
select
    g.id,
    g.user_id,
    g.model_id,
    g.status,
    g.recovery_state,
    g.failure_reason_code,
    g.request_id,
    g.created_at,
    g.next_recovery_at
from public.ai_generations g
where lower(coalesce(g.provider, '')) like 'fal%'
  and g.request_id is not null
  and g.status in ('pending', 'submitted', 'running', 'fail')
  and coalesce(g.recovery_state, 'none') in ('queued', 'recovering')
  and g.created_at <= now() - interval '2 hours'
order by g.created_at asc
limit 200;

-- -----------------------------------------------------------------------------
-- Guarded remediation template (manual, optional)
-- -----------------------------------------------------------------------------
-- IMPORTANT:
-- - Keep strict age/state filters.
-- - Prefer running /api/internal/generation-recovery/run repeatedly first.
-- - Use this only for confirmed stuck blockers.
--
-- begin;
--
-- with stale_candidates as (
--     select g.id, g.user_id, g.request_id
--     from public.ai_generations g
--     where lower(coalesce(g.provider, '')) like 'fal%'
--       and g.request_id is not null
--       and g.status in ('pending', 'submitted', 'running')
--       and coalesce(g.recovery_state, 'none') in ('queued', 'recovering')
--       and g.created_at <= now() - interval '2 hours'
-- )
-- update public.ai_generations g
-- set
--     status = 'fail',
--     completed_at = now(),
--     recovery_state = 'exhausted',
--     next_recovery_at = null,
--     failure_reason_code = coalesce(g.failure_reason_code, 'manual_blocking_cleanup'),
--     error_message = coalesce(g.error_message, 'Manually failed after guarded stale-blocking cleanup.')
-- from stale_candidates c
-- where g.id = c.id
-- returning g.id, g.user_id, g.request_id, g.created_at;
--
-- -- Optional: release reservations for the same stale candidates by provider request id.
-- -- select public.release_generation_reservation_by_provider_request(
-- --   c.user_id,
-- --   c.request_id,
-- --   'Manual guarded cleanup release for stale provider-attached generation.',
-- --   jsonb_build_object('cleanup', 'manual_blocking_cleanup')
-- -- )
-- -- from stale_candidates c;
--
-- commit;
