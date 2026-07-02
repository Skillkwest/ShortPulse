-- Generation queue dispatch latency row-detail diagnostics.
--
-- Purpose:
-- Break-glass spot checks for high-latency queue dispatch rows. This query
-- emits private operational identifiers and must not run in default artifact
-- output.

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
