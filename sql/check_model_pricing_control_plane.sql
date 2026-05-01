-- Read-only diagnostic for the model-pricing control plane.
-- Expected: has_runtime_row = true and active policy fields match the latest
-- admin-saved credit conversion and per-model overrides after `/admin/pricing` applies a policy.

with runtime as (
    select
        active_policy_version_id,
        last_known_safe_policy_version_id,
        updated_at,
        updated_by_email
    from public.model_pricing_policy_runtime
    where singleton = true
    limit 1
),
active_policy as (
    select
        versions.id,
        versions.version,
        versions.policy,
        versions.created_at,
        versions.created_by_email
    from runtime
    join public.model_pricing_policy_versions versions
      on versions.id = runtime.active_policy_version_id
)
select
    exists(select 1 from runtime) as has_runtime_row,
    (select count(*) from public.model_pricing_policy_versions) as policy_version_count,
    active_policy.version as active_policy_version,
    active_policy.policy #>> '{global,creditUsdScale}' as active_credit_usd_scale,
    runtime.updated_at as runtime_updated_at,
    runtime.updated_by_email as runtime_updated_by_email,
    active_policy.created_at as active_policy_created_at,
    active_policy.created_by_email as active_policy_created_by_email
from runtime
left join active_policy on true;
