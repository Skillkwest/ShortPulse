-- Remove deprecated global round-nearest defaults from persisted model-pricing policies.
-- Runtime billing now uses credit ceiling by default; only per-model roundingIncrement
-- overrides can request round-nearest behavior.

update public.model_pricing_policy_versions
set policy = jsonb_set(
    jsonb_set(
        policy,
        '{global,defaultRoundingMode}',
        to_jsonb('ceil'::text),
        true
    ),
    '{global,defaultRoundingIncrement}',
    to_jsonb(1),
    true
)
where coalesce(policy #>> '{global,defaultRoundingMode}', '') <> 'ceil'
   or coalesce(policy #>> '{global,defaultRoundingIncrement}', '') <> '1';
