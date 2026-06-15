-- Generation queue dispatch latency telemetry diagnostics.
--
-- Purpose:
-- Measure how long queued generations take to move from queue admission to
-- provider dispatch using telemetry events written to `app_error_events`.
--
-- Source:
-- `telemetry.queue.dispatch.submitted` events with `queue_latency_ms`
-- metadata emitted by the generation submit queue dispatch path.

-- -----------------------------------------------------------------------------
-- Last 60m summary by window
-- -----------------------------------------------------------------------------
with dispatch_events as (
    select
        e.occurred_at,
        nullif(e.metadata->>'model_id', '') as model_id,
        nullif(e.metadata->>'provider', '') as provider,
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
from dispatch_events
where queue_latency_ms is not null
group by 1
order by 1;

-- -----------------------------------------------------------------------------
-- Hottest model/provider buckets by p95 over the last 60m
-- -----------------------------------------------------------------------------
with dispatch_events as (
    select
        coalesce(nullif(e.metadata->>'model_id', ''), 'unknown') as model_id,
        coalesce(nullif(e.metadata->>'provider', ''), 'unknown') as provider,
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
    provider,
    count(*)::bigint as dispatched_rows,
    round(avg(queue_latency_ms))::bigint as avg_queue_latency_ms,
    round(percentile_cont(0.5) within group (order by queue_latency_ms))::bigint as p50_queue_latency_ms,
    round(percentile_cont(0.95) within group (order by queue_latency_ms))::bigint as p95_queue_latency_ms,
    round(max(queue_latency_ms))::bigint as max_queue_latency_ms
from dispatch_events
where queue_latency_ms is not null
group by model_id, provider
order by p95_queue_latency_ms desc nulls last, dispatched_rows desc, model_id asc, provider asc
limit 25;

-- -----------------------------------------------------------------------------
-- Recent worst-case rows for spot checks
-- -----------------------------------------------------------------------------
select
    e.occurred_at,
    e.user_id,
    coalesce(nullif(e.metadata->>'model_id', ''), 'unknown') as model_id,
    coalesce(nullif(e.metadata->>'provider', ''), 'unknown') as provider,
    e.metadata->>'generation_id' as generation_id,
    e.metadata->>'provider_request_id' as provider_request_id,
    e.metadata->>'source_ref' as source_ref,
    case
        when jsonb_typeof(e.metadata->'queue_latency_ms') = 'number'
            then round((e.metadata->>'queue_latency_ms')::numeric)::bigint
        else null
    end as queue_latency_ms,
    e.metadata->>'queue_enqueued_at' as queue_enqueued_at,
    e.metadata->>'queue_dispatched_at' as queue_dispatched_at,
    e.metadata->'dispatch_stage_timings_ms' as dispatch_stage_timings_ms
from public.app_error_events e
where e.source = 'telemetry.queue.dispatch.submitted'
  and e.occurred_at >= now() - interval '60 minutes'
order by queue_latency_ms desc nulls last, e.occurred_at desc
limit 50;
