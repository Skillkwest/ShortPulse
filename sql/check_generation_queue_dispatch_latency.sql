-- Queue dispatch latency telemetry diagnostics.
--
-- Purpose:
-- Measure how long queued generations take to move from enqueue to successful
-- provider dispatch using telemetry events written to `app_error_events`.
--
-- Source:
-- `telemetry.queue.dispatch.submitted` emitted by
-- `frontend/lib/server/api/generationQueue/dispatch.ts`

-- -----------------------------------------------------------------------------
-- Last 60m summary by window
-- -----------------------------------------------------------------------------
with latency_events as (
    select
        e.occurred_at,
        nullif(e.metadata->>'model_id', '') as model_id,
        nullif(e.metadata->>'queue_id', '') as queue_id,
        nullif(e.metadata->>'generation_id', '') as generation_id,
        nullif(e.metadata->>'provider_request_id', '') as provider_request_id,
        case
            when jsonb_typeof(e.metadata->'queue_latency_ms') = 'number'
                then (e.metadata->>'queue_latency_ms')::numeric
            else null
        end as queue_latency_ms
    from public.app_error_events e
    where e.source = 'telemetry.queue.dispatch.submitted'
      and e.occurred_at >= now() - interval '60 minutes'
)
select
    case
        when occurred_at >= now() - interval '15 minutes' then 'last_15m'
        else 'last_60m'
    end as window_bucket,
    count(*)::bigint as dispatched_rows,
    round(avg(queue_latency_ms))::bigint as avg_queue_latency_ms,
    round(percentile_cont(0.5) within group (order by queue_latency_ms))::bigint as p50_queue_latency_ms,
    round(percentile_cont(0.95) within group (order by queue_latency_ms))::bigint as p95_queue_latency_ms,
    round(max(queue_latency_ms))::bigint as max_queue_latency_ms
from latency_events
where queue_latency_ms is not null
group by 1
order by 1;

-- -----------------------------------------------------------------------------
-- Hottest models by p95 queue latency over the last 60m
-- -----------------------------------------------------------------------------
with latency_events as (
    select
        coalesce(nullif(e.metadata->>'model_id', ''), 'unknown') as model_id,
        case
            when jsonb_typeof(e.metadata->'queue_latency_ms') = 'number'
                then (e.metadata->>'queue_latency_ms')::numeric
            else null
        end as queue_latency_ms
    from public.app_error_events e
    where e.source = 'telemetry.queue.dispatch.submitted'
      and e.occurred_at >= now() - interval '60 minutes'
)
select
    model_id,
    count(*)::bigint as dispatched_rows,
    round(avg(queue_latency_ms))::bigint as avg_queue_latency_ms,
    round(percentile_cont(0.5) within group (order by queue_latency_ms))::bigint as p50_queue_latency_ms,
    round(percentile_cont(0.95) within group (order by queue_latency_ms))::bigint as p95_queue_latency_ms,
    round(max(queue_latency_ms))::bigint as max_queue_latency_ms
from latency_events
where queue_latency_ms is not null
group by model_id
order by p95_queue_latency_ms desc nulls last, dispatched_rows desc, model_id asc
limit 25;

-- -----------------------------------------------------------------------------
-- Recent worst-case rows for spot checks
-- -----------------------------------------------------------------------------
select
    e.occurred_at,
    e.user_id,
    coalesce(nullif(e.metadata->>'model_id', ''), 'unknown') as model_id,
    e.metadata->>'queue_id' as queue_id,
    e.metadata->>'generation_id' as generation_id,
    e.metadata->>'provider_request_id' as provider_request_id,
    case
        when jsonb_typeof(e.metadata->'queue_latency_ms') = 'number'
            then round((e.metadata->>'queue_latency_ms')::numeric)::bigint
        else null
    end as queue_latency_ms
from public.app_error_events e
where e.source = 'telemetry.queue.dispatch.submitted'
  and e.occurred_at >= now() - interval '60 minutes'
order by queue_latency_ms desc nulls last, e.occurred_at desc
limit 50;
