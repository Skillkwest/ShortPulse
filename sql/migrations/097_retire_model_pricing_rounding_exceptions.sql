-- Retire deprecated model-pricing rounding exceptions.
-- Legacy policies that still carry global.exceptionRoundingModelIds are normalized
-- into standard per-model roundingIncrement=1 overrides so the admin panel remains
-- the sole place operators manage rounding behavior.

create or replace function public.__tmp_sanitize_model_pricing_policy_rounding_exceptions(
    p_policy jsonb
)
returns jsonb
language plpgsql
as $$
declare
    v_policy jsonb := coalesce(p_policy, '{}'::jsonb);
    v_global jsonb := coalesce(v_policy->'global', '{}'::jsonb);
    v_per_model jsonb := coalesce(v_policy->'perModel', '{}'::jsonb);
    v_exception_ids jsonb := v_global->'exceptionRoundingModelIds';
    v_model_id text;
    v_override jsonb;
begin
    if jsonb_typeof(v_exception_ids) <> 'array' then
        return v_policy;
    end if;

    for v_model_id in
        select distinct btrim(value #>> '{}')
        from jsonb_array_elements(v_exception_ids) as value
        where jsonb_typeof(value) = 'string'
          and btrim(value #>> '{}') <> ''
    loop
        v_override := coalesce(v_per_model -> v_model_id, '{}'::jsonb);
        if jsonb_typeof(v_override) <> 'object' then
            v_override := '{}'::jsonb;
        end if;

        if jsonb_typeof(v_override->'roundingIncrement') <> 'number' then
            v_per_model := jsonb_set(
                v_per_model,
                array[v_model_id],
                v_override || jsonb_build_object('roundingIncrement', 1),
                true
            );
        end if;
    end loop;

    v_global := v_global - 'exceptionRoundingModelIds';
    v_policy := jsonb_set(v_policy, '{global}', v_global, true);
    v_policy := jsonb_set(v_policy, '{perModel}', v_per_model, true);

    return v_policy;
end;
$$;

update public.model_pricing_policy_versions
set policy = public.__tmp_sanitize_model_pricing_policy_rounding_exceptions(policy)
where policy is distinct from public.__tmp_sanitize_model_pricing_policy_rounding_exceptions(policy);

drop function public.__tmp_sanitize_model_pricing_policy_rounding_exceptions(jsonb);
