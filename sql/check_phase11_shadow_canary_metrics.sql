-- Phase 11 shadow/canary metrics packet (read-only).
-- Purpose:
-- 1) Capture baseline and observation-window metrics for Fal -> Kie migration decisions.
-- 2) Provide deterministic checks for duplicate settlement/persistence and recovery health.
-- 3) Feed values directly into:
--    docs/planning/evidence/unified-buildout/phase-11/
--    2026-02-27-phase-11-slice-a-shadow-canary-readiness-and-threshold-template.md
--
-- Usage:
-- 1) Run each section in Supabase SQL editor.
-- 2) Adjust params CTE values (time window + thresholds) if needed.
-- 3) Record outputs in the Phase 11 evidence template.

-- -----------------------------------------------------------------------------
-- A) Cohort volume by provider in window
-- -----------------------------------------------------------------------------
with params as (
    select
        now() - interval '24 hours' as start_at,
        now() as end_at
)
select
    lower(coalesce(g.provider, 'unknown')) as provider,
    count(*)::bigint as generations,
    count(*) filter (where lower(coalesce(g.status, '')) = 'success')::bigint as success_count,
    count(*) filter (where lower(coalesce(g.status, '')) = 'fail')::bigint as fail_count
from public.ai_generations g
cross join params p
where g.created_at >= p.start_at
  and g.created_at < p.end_at
group by 1
order by generations desc;

-- -----------------------------------------------------------------------------
-- B) Duplicate settlement guard checks
-- -----------------------------------------------------------------------------
-- B1) Captured reservations should be unique per (user_id, provider_request_id).
with params as (
    select
        now() - interval '24 hours' as start_at,
        now() as end_at
),
captured as (
    select
        r.user_id,
        r.provider_request_id,
        count(*)::bigint as row_count
    from public.ai_credit_reservations r
    cross join params p
    where r.status = 'captured'
      and r.provider_request_id is not null
      and r.captured_at is not null
      and r.captured_at >= p.start_at
      and r.captured_at < p.end_at
    group by r.user_id, r.provider_request_id
)
select
    count(*)::bigint as duplicate_captured_reservation_keys
from captured
where row_count > 1;

-- B2) Ledger rows should not duplicate by (user_id, source, source_ref).
with params as (
    select
        now() - interval '24 hours' as start_at,
        now() as end_at
),
ledger_dupes as (
    select
        l.user_id,
        l.source,
        l.source_ref,
        count(*)::bigint as row_count
    from public.ai_credit_ledger l
    cross join params p
    where l.source_ref is not null
      and l.created_at >= p.start_at
      and l.created_at < p.end_at
    group by l.user_id, l.source, l.source_ref
)
select
    count(*)::bigint as duplicate_ledger_keys
from ledger_dupes
where row_count > 1;

-- -----------------------------------------------------------------------------
-- C) Duplicate media persistence guard check
-- -----------------------------------------------------------------------------
-- Expected unique key for AI Studio outputs:
-- (source_ref, metadata->>'generation_output_index') where source='ai_studio'
with params as (
    select
        now() - interval '24 hours' as start_at,
        now() as end_at
),
ai_media as (
    select
        m.source_ref,
        coalesce(m.metadata->>'generation_output_index', '(null)') as generation_output_index,
        count(*)::bigint as row_count
    from public.media_files m
    join public.ai_generations g
      on g.id = m.source_ref
    cross join params p
    where m.source = 'ai_studio'
      and m.source_ref is not null
      and g.created_at >= p.start_at
      and g.created_at < p.end_at
    group by m.source_ref, coalesce(m.metadata->>'generation_output_index', '(null)')
)
select
    count(*)::bigint as duplicate_media_output_keys
from ai_media
where row_count > 1;

-- -----------------------------------------------------------------------------
-- D) Stuck-running backlog snapshot
-- -----------------------------------------------------------------------------
with params as (
    select
        now() - interval '24 hours' as start_at,
        now() as end_at,
        45::integer as running_stale_minutes
),
running_rows as (
    select
        extract(epoch from (now() - g.created_at))::bigint as age_seconds
    from public.ai_generations g
    cross join params p
    where g.created_at >= p.start_at
      and g.created_at < p.end_at
      and lower(coalesce(g.status, '')) = 'running'
)
select
    count(*)::bigint as running_count,
    count(*) filter (where age_seconds >= (select running_stale_minutes * 60 from params))::bigint
      as stale_running_count,
    coalesce(percentile_cont(0.95) within group (order by age_seconds), 0)::bigint
      as running_age_p95_seconds
from running_rows;

-- -----------------------------------------------------------------------------
-- E) terminal_success_no_media unresolved + recovery success snapshot
-- -----------------------------------------------------------------------------
with params as (
    select
        now() - interval '24 hours' as start_at,
        now() as end_at,
        30::integer as unresolved_min_age_minutes
),
no_media_rows as (
    select
        g.id,
        lower(coalesce(g.status, '')) as status_lower,
        lower(coalesce(g.recovery_state, 'none')) as recovery_state_lower,
        extract(epoch from (now() - g.created_at))::bigint as age_seconds
    from public.ai_generations g
    cross join params p
    where g.created_at >= p.start_at
      and g.created_at < p.end_at
      and lower(coalesce(g.failure_reason_code, '')) = 'terminal_success_no_media'
),
eligible as (
    select *
    from no_media_rows
    where age_seconds >= (select unresolved_min_age_minutes * 60 from params)
)
select
    count(*)::bigint as eligible_no_media_rows,
    count(*) filter (
        where status_lower <> 'success'
           or recovery_state_lower in ('queued', 'recovering', 'exhausted')
    )::bigint as unresolved_no_media_rows,
    coalesce(
        (
            count(*) filter (
                where status_lower <> 'success'
                   or recovery_state_lower in ('queued', 'recovering', 'exhausted')
            )::numeric
            / nullif(count(*), 0)::numeric
        ) * 100,
        0
    ) as unresolved_no_media_percent,
    count(*) filter (
        where status_lower = 'success'
          and recovery_state_lower = 'recovered'
    )::bigint as recovered_success_rows,
    coalesce(
        (
            count(*) filter (
                where status_lower = 'success'
                  and recovery_state_lower = 'recovered'
            )::numeric
            / nullif(count(*), 0)::numeric
        ) * 100,
        0
    ) as recovery_success_percent
from eligible;

-- -----------------------------------------------------------------------------
-- F) Queue depth + queue-dispatch error telemetry in window
-- -----------------------------------------------------------------------------
with params as (
    select
        now() - interval '24 hours' as start_at,
        now() as end_at
)
select
    q.status,
    count(*)::bigint as rows,
    min(q.created_at) as oldest_created_at,
    max(q.created_at) as newest_created_at
from public.ai_generation_submit_queue q
group by q.status
order by q.status;

with params as (
    select
        now() - interval '24 hours' as start_at,
        now() as end_at
)
select
    count(*)::bigint as queue_dispatch_error_events
from public.app_error_events e
cross join params p
where e.occurred_at >= p.start_at
  and e.occurred_at < p.end_at
  and lower(coalesce(e.source, '')) like 'telemetry.queue.dispatch.%';

-- -----------------------------------------------------------------------------
-- G) One-row gate summary (uses defaults from this script)
-- -----------------------------------------------------------------------------
with params as (
    select
        now() - interval '24 hours' as start_at,
        now() as end_at,
        30::integer as unresolved_min_age_minutes,
        0.1::numeric as unresolved_percent_threshold,
        99::numeric as recovery_success_threshold
),
captured_dupes as (
    select count(*)::bigint as value
    from (
        select r.user_id, r.provider_request_id, count(*)::bigint as row_count
        from public.ai_credit_reservations r
        cross join params p
        where r.status = 'captured'
          and r.provider_request_id is not null
          and r.captured_at is not null
          and r.captured_at >= p.start_at
          and r.captured_at < p.end_at
        group by r.user_id, r.provider_request_id
        having count(*) > 1
    ) s
),
media_dupes as (
    select count(*)::bigint as value
    from (
        select
            m.source_ref,
            coalesce(m.metadata->>'generation_output_index', '(null)') as output_index,
            count(*)::bigint as row_count
        from public.media_files m
        join public.ai_generations g
          on g.id = m.source_ref
        cross join params p
        where m.source = 'ai_studio'
          and m.source_ref is not null
          and g.created_at >= p.start_at
          and g.created_at < p.end_at
        group by m.source_ref, coalesce(m.metadata->>'generation_output_index', '(null)')
        having count(*) > 1
    ) s
),
no_media as (
    select
        count(*)::bigint as eligible_rows,
        count(*) filter (
            where lower(coalesce(g.status, '')) <> 'success'
               or lower(coalesce(g.recovery_state, 'none')) in ('queued', 'recovering', 'exhausted')
        )::bigint as unresolved_rows,
        count(*) filter (
            where lower(coalesce(g.status, '')) = 'success'
              and lower(coalesce(g.recovery_state, 'none')) = 'recovered'
        )::bigint as recovered_rows
    from public.ai_generations g
    cross join params p
    where g.created_at >= p.start_at
      and g.created_at < p.end_at
      and lower(coalesce(g.failure_reason_code, '')) = 'terminal_success_no_media'
      and extract(epoch from (now() - g.created_at))::bigint >= p.unresolved_min_age_minutes * 60
)
select
    p.start_at,
    p.end_at,
    cd.value as duplicate_settlement_count,
    (cd.value = 0) as duplicate_settlement_pass,
    md.value as duplicate_media_persistence_count,
    (md.value = 0) as duplicate_media_persistence_pass,
    nm.eligible_rows as recovery_success_sample_size,
    coalesce((nm.unresolved_rows::numeric / nullif(nm.eligible_rows, 0)::numeric) * 100, 0)
      as unresolved_no_media_percent,
    (
        coalesce((nm.unresolved_rows::numeric / nullif(nm.eligible_rows, 0)::numeric) * 100, 0)
        < p.unresolved_percent_threshold
    ) as unresolved_no_media_pass,
    coalesce((nm.recovered_rows::numeric / nullif(nm.eligible_rows, 0)::numeric) * 100, 0)
      as recovery_success_percent,
    (
        case
            when nm.eligible_rows = 0 then null
            else coalesce((nm.recovered_rows::numeric / nullif(nm.eligible_rows, 0)::numeric) * 100, 0)
                 >= p.recovery_success_threshold
        end
    ) as recovery_success_pass
from params p
cross join captured_dupes cd
cross join media_dupes md
cross join no_media nm;
