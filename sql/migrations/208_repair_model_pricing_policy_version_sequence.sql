-- Repair model-pricing policy version identity sequence drift.
-- The policy apply RPC inserts version rows without specifying `id`, so the
-- identity sequence must remain ahead of the highest existing policy id.

do $$
declare
    v_sequence_name text;
    v_sequence_last_value bigint;
    v_sequence_is_called boolean;
    v_next_policy_id bigint;
    v_max_policy_id bigint;
    v_has_policy_versions boolean;
begin
    select pg_get_serial_sequence('public.model_pricing_policy_versions', 'id')
      into v_sequence_name;

    if v_sequence_name is null then
        raise exception 'public.model_pricing_policy_versions.id does not have an owned identity sequence';
    end if;

    execute format('select last_value, is_called from %s', v_sequence_name::regclass)
       into v_sequence_last_value, v_sequence_is_called;

    select coalesce(max(id), 0),
           count(*) > 0
      into v_max_policy_id,
           v_has_policy_versions
      from public.model_pricing_policy_versions;

    v_next_policy_id := case
        when v_sequence_is_called then v_sequence_last_value + 1
        else v_sequence_last_value
    end;

    if v_next_policy_id <= v_max_policy_id then
        perform setval(v_sequence_name::regclass, greatest(v_max_policy_id, 1), v_has_policy_versions);
    end if;
end;
$$;
