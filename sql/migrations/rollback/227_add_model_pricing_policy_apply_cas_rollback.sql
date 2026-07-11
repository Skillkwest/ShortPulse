-- Remove only the CAS overload. The pre-existing apply signature remains available.
drop function if exists public.apply_model_pricing_policy(
    jsonb,
    bigint,
    jsonb,
    text,
    text,
    uuid,
    text,
    text
);
