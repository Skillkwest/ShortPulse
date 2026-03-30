-- Admission-limiter telemetry diagnostics.
--
-- Purpose:
-- Break down recent generation admission pressure by scope, reason, tier, and model so
-- operators can distinguish shared-provider saturation from per-user throttling.

-- -----------------------------------------------------------------------------
-- Last 24h admission-limited events by time window and scope
-- -----------------------------------------------------------------------------
with admission_events as (
    select
        e.occurred_at,
        coalesce(nullif(lower(e.metadata->>'admission_scope'), ''), 'unknown') as admission_scope,
        coalesce(nullif(lower(e.metadata->>'reason'), ''), 'unknown') as admission_reason,
        coalesce(nullif(lower(e.metadata->>'tier'), ''), 'unknown') as admission_tier,
        coalesce(nullif(e.metadata->>'model_id', ''), 'unknown') as model_id
    from public.app_error_events e
    where e.source = 'telemetry.api.fal_submit.admission_limited'
      and e.occurred_at >= now() - interval '24 hours'
)
select
    window_bucket,
    admission_scope,
    count(*)::bigint as events
from (
    select
        case
            when occurred_at >= now() - interval '15 minutes' then 'last_15m'
            when occurred_at >= now() - interval '1 hour' then 'last_hour'
            else 'last_24h'
        end as window_bucket,
        admission_scope
    from admission_events
) scoped
group by window_bucket, admission_scope
order by window_bucket, admission_scope;

-- -----------------------------------------------------------------------------
-- Last 24h admission-limited events by reason and tier
-- -----------------------------------------------------------------------------
with admission_events as (
    select
        coalesce(nullif(lower(e.metadata->>'admission_scope'), ''), 'unknown') as admission_scope,
        coalesce(nullif(lower(e.metadata->>'reason'), ''), 'unknown') as admission_reason,
        coalesce(nullif(lower(e.metadata->>'tier'), ''), 'unknown') as admission_tier
    from public.app_error_events e
    where e.source = 'telemetry.api.fal_submit.admission_limited'
      and e.occurred_at >= now() - interval '24 hours'
)
select
    admission_scope,
    admission_reason,
    admission_tier,
    count(*)::bigint as events
from admission_events
group by admission_scope, admission_reason, admission_tier
order by events desc, admission_scope asc, admission_reason asc, admission_tier asc;

-- -----------------------------------------------------------------------------
-- Last hour hottest models for admission-limited events
-- -----------------------------------------------------------------------------
with admission_events as (
    select
        coalesce(nullif(lower(e.metadata->>'admission_scope'), ''), 'unknown') as admission_scope,
        coalesce(nullif(e.metadata->>'model_id', ''), 'unknown') as model_id
    from public.app_error_events e
    where e.source = 'telemetry.api.fal_submit.admission_limited'
      and e.occurred_at >= now() - interval '1 hour'
)
select
    admission_scope,
    model_id,
    count(*)::bigint as events
from admission_events
group by admission_scope, model_id
order by events desc, admission_scope asc, model_id asc
limit 50;
