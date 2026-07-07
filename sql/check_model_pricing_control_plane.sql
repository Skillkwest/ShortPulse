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
),
policy_stats as (
    select
        count(*) as policy_version_count,
        max(id) as max_policy_id,
        max(version) as max_policy_version
    from public.model_pricing_policy_versions
),
policy_id_sequence as (
    select
        pg_get_serial_sequence('public.model_pricing_policy_versions', 'id') as sequence_name,
        sequence_state.last_value,
        sequence_state.is_called,
        case
            when sequence_state.is_called then sequence_state.last_value + 1
            else sequence_state.last_value
        end as next_policy_id
    from public.model_pricing_policy_versions_id_seq sequence_state
)
select
    exists(select 1 from runtime) as has_runtime_row,
    policy_stats.policy_version_count,
    policy_stats.max_policy_id,
    policy_stats.max_policy_version,
    policy_id_sequence.sequence_name as policy_id_sequence_name,
    policy_id_sequence.last_value as policy_id_sequence_last_value,
    policy_id_sequence.is_called as policy_id_sequence_is_called,
    policy_id_sequence.next_policy_id as policy_id_sequence_next_policy_id,
    policy_id_sequence.next_policy_id > coalesce(policy_stats.max_policy_id, 0) as policy_id_sequence_ready,
    active_policy.version as active_policy_version,
    active_policy.policy #>> '{global,creditUsdScale}' as active_credit_usd_scale,
    runtime.updated_at as runtime_updated_at,
    runtime.updated_by_email as runtime_updated_by_email,
    active_policy.created_at as active_policy_created_at,
    active_policy.created_by_email as active_policy_created_by_email
from runtime
left join active_policy on true
cross join policy_stats
cross join policy_id_sequence;
