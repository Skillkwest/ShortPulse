-- Roll back to the previous global nearest-5 defaults.
-- This restores old policy metadata only; per-model overrides are left intact.

update public.model_pricing_policy_versions
set policy = jsonb_set(
    jsonb_set(
        policy,
        '{global,defaultRoundingMode}',
        to_jsonb('nearest-5'::text),
        true
    ),
    '{global,defaultRoundingIncrement}',
    to_jsonb(5),
    true
);
