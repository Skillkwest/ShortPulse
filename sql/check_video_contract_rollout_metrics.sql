-- Video contract rollout metrics packet (read-only).
-- Purpose:
-- 1) Evaluate Phase 0/1/2 rollout health for canonical video submit contracts.
-- 2) Track ingress violations, alias normalization usage, and queue compatibility behavior.
-- 3) Confirm legacy queued payload backlog is draining before Phase 3 cleanup.
--
-- Usage:
-- 1) Run sections in Supabase SQL editor.
-- 2) Adjust the window in params CTEs as needed.
-- 3) Record outputs in rollout evidence notes.

-- -----------------------------------------------------------------------------
-- A) Telemetry volume by source in window
-- -----------------------------------------------------------------------------
with params as (
    select
        now() - interval '24 hours' as start_at,
        now() as end_at
)
select
    lower(coalesce(e.source, 'unknown')) as source,
    count(*)::bigint as events
from public.app_error_events e
cross join params p
where e.occurred_at >= p.start_at
  and e.occurred_at < p.end_at
  and lower(coalesce(e.source, '')) in (
      'api.fal_submit.video_contract_violation',
      'telemetry.api.fal_submit.video_alias_normalized',
      'telemetry.queue.dispatch.video_payload_normalized',
      'telemetry.queue.dispatch.exhausted'
  )
group by 1
order by events desc, source asc;

-- -----------------------------------------------------------------------------
-- B) Ingress contract violations by code + enforcement mode
-- -----------------------------------------------------------------------------
with params as (
    select
        now() - interval '24 hours' as start_at,
        now() as end_at
)
select
    coalesce(e.metadata->>'code', 'unknown') as violation_code,
    coalesce(e.metadata->>'enforce_mode', 'unknown') as enforce_mode,
    coalesce(e.metadata->>'model_id', 'unknown') as model_id,
    count(*)::bigint as events
from public.app_error_events e
cross join params p
where e.occurred_at >= p.start_at
  and e.occurred_at < p.end_at
  and lower(coalesce(e.source, '')) = 'api.fal_submit.video_contract_violation'
group by 1, 2, 3
order by events desc, violation_code asc, model_id asc;

-- -----------------------------------------------------------------------------
-- C) Alias + compatibility normalization telemetry detail
-- -----------------------------------------------------------------------------
with params as (
    select
        now() - interval '24 hours' as start_at,
        now() as end_at
),
queue_norm as (
    select
        e.metadata,
        e.occurred_at
    from public.app_error_events e
    cross join params p
    where e.occurred_at >= p.start_at
      and e.occurred_at < p.end_at
      and lower(coalesce(e.source, '')) = 'telemetry.queue.dispatch.video_payload_normalized'
)
select
    count(*)::bigint as queue_normalized_events,
    count(*) filter (
        where coalesce((metadata->>'compatibility_applied')::boolean, false)
    )::bigint as queue_compatibility_applied_events,
    count(*) filter (
        where jsonb_typeof(metadata->'alias_usage') = 'array'
          and jsonb_array_length(metadata->'alias_usage') > 0
    )::bigint as queue_alias_usage_events,
    count(*) filter (
        where coalesce((metadata->>'envelope_version')::integer, -1) = 2
    )::bigint as queue_envelope_v2_events
from queue_norm;

-- -----------------------------------------------------------------------------
-- D) Queue backlog compatibility snapshot (video-only)
-- -----------------------------------------------------------------------------
with video_queue as (
    select
        q.id,
        q.status,
        q.created_at,
        q.updated_at,
        q.model_id,
        q.last_error_code,
        case
            when coalesce(q.submit_payload->>'__contract', '') = 'video_submit_payload' then 'v2_envelope'
            else 'legacy_raw'
        end as payload_contract
    from public.ai_generation_submit_queue q
    join public.ai_generations g
      on g.id = q.generation_id
    where lower(coalesce(g.mode, '')) = 'video'
)
select
    payload_contract,
    status,
    count(*)::bigint as rows,
    min(created_at) as oldest_created_at,
    max(created_at) as newest_created_at
from video_queue
group by payload_contract, status
order by payload_contract asc, status asc;

-- -----------------------------------------------------------------------------
-- E) Queue exhaustions for video contract-related error codes
-- -----------------------------------------------------------------------------
with params as (
    select
        now() - interval '24 hours' as start_at,
        now() as end_at
)
select
    coalesce(q.last_error_code, 'unknown') as last_error_code,
    count(*)::bigint as exhausted_rows
from public.ai_generation_submit_queue q
join public.ai_generations g
  on g.id = q.generation_id
cross join params p
where lower(coalesce(g.mode, '')) = 'video'
  and q.status = 'exhausted'
  and q.updated_at >= p.start_at
  and q.updated_at < p.end_at
  and coalesce(q.last_error_code, '') in (
      'VIDEO_QUEUE_PAYLOAD_INVALID',
      'VIDEO_QUEUE_COMPAT_DISABLED',
      'VIDEO_CHARACTER_MEDIA_BLOCKED',
      'VIDEO_ALIAS_COLLISION',
      'QUEUE_PAYLOAD_CONTRACT_VIOLATION'
  )
group by 1
order by exhausted_rows desc, last_error_code asc;

-- -----------------------------------------------------------------------------
-- F) One-row rollout gate summary (defaults: no strict-mode violations, no compat-disabled exhaustions)
-- -----------------------------------------------------------------------------
with params as (
    select
        now() - interval '24 hours' as start_at,
        now() as end_at,
        0::bigint as strict_violation_threshold,
        0::bigint as compat_disabled_exhaust_threshold
),
strict_violations as (
    select count(*)::bigint as value
    from public.app_error_events e
    cross join params p
    where e.occurred_at >= p.start_at
      and e.occurred_at < p.end_at
      and lower(coalesce(e.source, '')) = 'api.fal_submit.video_contract_violation'
      and coalesce(e.metadata->>'enforce_mode', 'unknown') = 'on'
),
compat_disabled_exhaust as (
    select count(*)::bigint as value
    from public.ai_generation_submit_queue q
    join public.ai_generations g
      on g.id = q.generation_id
    cross join params p
    where lower(coalesce(g.mode, '')) = 'video'
      and q.status = 'exhausted'
      and q.updated_at >= p.start_at
      and q.updated_at < p.end_at
      and coalesce(q.last_error_code, '') = 'VIDEO_QUEUE_COMPAT_DISABLED'
)
select
    (select value from strict_violations) as strict_mode_contract_violations,
    (select value from compat_disabled_exhaust) as compat_disabled_exhaustions,
    case
        when (select value from strict_violations) <= (select strict_violation_threshold from params)
         and (select value from compat_disabled_exhaust) <= (select compat_disabled_exhaust_threshold from params)
            then 'PASS'
        else 'FAIL'
    end as rollout_gate;
