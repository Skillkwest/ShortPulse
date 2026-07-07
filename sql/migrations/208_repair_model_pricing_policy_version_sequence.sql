-- Repair model-pricing control-plane identity sequence drift.
-- The policy apply RPC inserts policy-version and event rows without specifying
-- `id`, so both identity sequences must remain ahead of their highest rows.

do $$
declare
    v_target record;
    v_sequence_name text;
    v_sequence_last_value bigint;
    v_sequence_is_called boolean;
    v_next_id bigint;
    v_max_id bigint;
    v_has_rows boolean;
begin
    for v_target in
        select 'public.model_pricing_policy_versions'::text as table_name, 'id'::text as column_name
        union all
        select 'public.model_pricing_policy_events'::text as table_name, 'id'::text as column_name
    loop
        select pg_get_serial_sequence(v_target.table_name, v_target.column_name)
          into v_sequence_name;

        if v_sequence_name is null then
            raise exception '%.% does not have an owned identity sequence',
                v_target.table_name,
                v_target.column_name;
        end if;

        execute format('select last_value, is_called from %s', v_sequence_name::regclass)
           into v_sequence_last_value, v_sequence_is_called;

        execute format(
            'select coalesce(max(%I), 0), count(*) > 0 from %s',
            v_target.column_name,
            v_target.table_name::regclass
        )
           into v_max_id, v_has_rows;

        v_next_id := case
            when v_sequence_is_called then v_sequence_last_value + 1
            else v_sequence_last_value
        end;

        if v_next_id <= v_max_id then
            perform setval(v_sequence_name::regclass, greatest(v_max_id, 1), v_has_rows);
        end if;
    end loop;
end;
$$;
