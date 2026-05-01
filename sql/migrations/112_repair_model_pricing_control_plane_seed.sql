-- Repair missing model-pricing control-plane seed rows.
-- Some hosted environments can have the policy tables/functions present while
-- missing the singleton runtime pointer. Without that row, admin pricing edits
-- cannot become the active policy.

insert into public.model_pricing_policy_versions (
    version,
    policy,
    note,
    created_by_email
)
select
    1,
    jsonb_build_object(
        'schemaVersion', 1,
        'global', jsonb_build_object(
            'creditUsdScale', 100,
            'defaultRoundingMode', 'ceil',
            'defaultRoundingIncrement', 1
        ),
        'perModel', jsonb_build_object()
    ),
    'baseline_seed_v1',
    'system_seed'
where not exists (
    select 1
    from public.model_pricing_policy_versions
);

with latest_policy_version as (
    select id
    from public.model_pricing_policy_versions
    order by version desc, id desc
    limit 1
)
insert into public.model_pricing_policy_runtime (
    singleton,
    active_policy_version_id,
    last_known_safe_policy_version_id,
    updated_by_email
)
select
    true,
    latest_policy_version.id,
    latest_policy_version.id,
    'system_seed'
from latest_policy_version
where not exists (
    select 1
    from public.model_pricing_policy_runtime
    where singleton = true
);
