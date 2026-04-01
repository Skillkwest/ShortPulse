-- Generation recovery media visibility telemetry diagnostics.
--
-- Purpose:
-- Measure how long recovered generations take to move from provider-terminal
-- observation to persisted media visibility using telemetry events written to
-- `app_error_events`.
--
-- Source:
-- `telemetry.generation.recovery.media_visible` emitted by
-- `frontend/lib/server/falIntegration/recoveryExecution.ts`

-- -----------------------------------------------------------------------------
-- Last 60m summary by window
-- -----------------------------------------------------------------------------
with visibility_events as (
    select
        e.occurred_at,
        nullif(e.metadata->>'model_id', '') as model_id,
        nullif(e.metadata->>'provider', '') as provider,
        nullif(e.metadata->>'recovery_actor', '') as recovery_actor,
        nullif(e.metadata->>'generation_id', '') as generation_id,
        nullif(e.metadata->>'provider_request_id', '') as provider_request_id,
        case
            when jsonb_typeof(e.metadata->'provider_terminal_to_media_visible_ms') = 'number'
                then (e.metadata->>'provider_terminal_to_media_visible_ms')::numeric
            else null
        end as provider_terminal_to_media_visible_ms
    from public.app_error_events e
    where e.source = 'telemetry.generation.recovery.media_visible'
      and e.occurred_at >= now() - interval '60 minutes'
)
select
    case
        when occurred_at >= now() - interval '15 minutes' then 'last_15m'
        else 'last_60m'
    end as window_bucket,
    count(*)::bigint as visible_rows,
    round(avg(provider_terminal_to_media_visible_ms))::bigint as avg_provider_terminal_to_media_visible_ms,
    round(percentile_cont(0.5) within group (order by provider_terminal_to_media_visible_ms))::bigint as p50_provider_terminal_to_media_visible_ms,
    round(percentile_cont(0.95) within group (order by provider_terminal_to_media_visible_ms))::bigint as p95_provider_terminal_to_media_visible_ms,
    round(max(provider_terminal_to_media_visible_ms))::bigint as max_provider_terminal_to_media_visible_ms
from visibility_events
where provider_terminal_to_media_visible_ms is not null
group by 1
order by 1;

-- -----------------------------------------------------------------------------
-- Hottest model/provider/actor buckets by p95 over the last 60m
-- -----------------------------------------------------------------------------
with visibility_events as (
    select
        coalesce(nullif(e.metadata->>'model_id', ''), 'unknown') as model_id,
        coalesce(nullif(e.metadata->>'provider', ''), 'unknown') as provider,
        coalesce(nullif(e.metadata->>'recovery_actor', ''), 'unknown') as recovery_actor,
        case
            when jsonb_typeof(e.metadata->'provider_terminal_to_media_visible_ms') = 'number'
                then (e.metadata->>'provider_terminal_to_media_visible_ms')::numeric
            else null
        end as provider_terminal_to_media_visible_ms
    from public.app_error_events e
    where e.source = 'telemetry.generation.recovery.media_visible'
      and e.occurred_at >= now() - interval '60 minutes'
)
select
    model_id,
    provider,
    recovery_actor,
    count(*)::bigint as visible_rows,
    round(avg(provider_terminal_to_media_visible_ms))::bigint as avg_provider_terminal_to_media_visible_ms,
    round(percentile_cont(0.5) within group (order by provider_terminal_to_media_visible_ms))::bigint as p50_provider_terminal_to_media_visible_ms,
    round(percentile_cont(0.95) within group (order by provider_terminal_to_media_visible_ms))::bigint as p95_provider_terminal_to_media_visible_ms,
    round(max(provider_terminal_to_media_visible_ms))::bigint as max_provider_terminal_to_media_visible_ms
from visibility_events
where provider_terminal_to_media_visible_ms is not null
group by model_id, provider, recovery_actor
order by p95_provider_terminal_to_media_visible_ms desc nulls last, visible_rows desc, model_id asc, provider asc, recovery_actor asc
limit 25;

-- -----------------------------------------------------------------------------
-- Recent worst-case rows for spot checks
-- -----------------------------------------------------------------------------
select
    e.occurred_at,
    e.user_id,
    coalesce(nullif(e.metadata->>'model_id', ''), 'unknown') as model_id,
    coalesce(nullif(e.metadata->>'provider', ''), 'unknown') as provider,
    coalesce(nullif(e.metadata->>'recovery_actor', ''), 'unknown') as recovery_actor,
    e.metadata->>'generation_id' as generation_id,
    e.metadata->>'provider_request_id' as provider_request_id,
    case
        when jsonb_typeof(e.metadata->'provider_terminal_to_media_visible_ms') = 'number'
            then round((e.metadata->>'provider_terminal_to_media_visible_ms')::numeric)::bigint
        else null
    end as provider_terminal_to_media_visible_ms,
    case
        when jsonb_typeof(e.metadata->'generation_age_ms') = 'number'
            then round((e.metadata->>'generation_age_ms')::numeric)::bigint
        else null
    end as generation_age_ms,
    case
        when jsonb_typeof(e.metadata->'media_file_count') = 'number'
            then (e.metadata->>'media_file_count')::bigint
        else null
    end as media_file_count,
    case
        when jsonb_typeof(e.metadata->'result_url_count') = 'number'
            then (e.metadata->>'result_url_count')::bigint
        else null
    end as result_url_count,
    e.metadata->>'provider_terminal_observed_at' as provider_terminal_observed_at,
    e.metadata->>'media_visible_at' as media_visible_at
from public.app_error_events e
where e.source = 'telemetry.generation.recovery.media_visible'
  and e.occurred_at >= now() - interval '60 minutes'
order by provider_terminal_to_media_visible_ms desc nulls last, e.occurred_at desc
limit 50;
