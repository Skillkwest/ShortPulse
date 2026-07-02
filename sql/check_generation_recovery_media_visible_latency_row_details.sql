-- Generation recovery media visibility row-detail diagnostics.
--
-- Purpose:
-- Break-glass spot checks for slow recovered-generation media visibility rows.
-- This query emits private operational identifiers and must not run in default
-- artifact output.

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
