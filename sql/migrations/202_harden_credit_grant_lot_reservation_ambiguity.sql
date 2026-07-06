-- Hotfix: preserve grant-lot reservation semantics while hardening PL/pgSQL
-- name resolution after migration 200 redefined the functions without the
-- reservation RPC ambiguity guard.

do $$
declare
    target_function record;
    function_sql text;
    patched_sql text;
begin
    for target_function in
        select *
        from (
            values
                ('public.admit_and_reserve_generation_credits(uuid,text,text,integer,text,jsonb,text,integer,text,integer,integer)'::text),
                ('public.release_generation_reservation_by_source_ref(uuid,text,text,jsonb)'::text),
                ('public.release_generation_reservation_by_provider_request(uuid,text,text,jsonb)'::text),
                ('public.release_generation_reservation_by_id(uuid,text,jsonb)'::text),
                ('public.capture_generation_reservation_by_provider_request(uuid,text,text,jsonb)'::text)
        ) as f(signature)
    loop
        if to_regprocedure(target_function.signature) is null then
            raise exception 'Required reservation RPC is missing: %', target_function.signature;
        end if;

        function_sql := pg_get_functiondef(to_regprocedure(target_function.signature));
        if position('#variable_conflict use_column' in lower(function_sql)) > 0 then
            continue;
        end if;

        patched_sql := regexp_replace(
            function_sql,
            '(AS[[:space:]]+\$function\$[[:space:]]*)(declare)',
            E'\\1#variable_conflict use_column\n\\2',
            'i'
        );

        if patched_sql = function_sql then
            raise exception 'Unable to patch reservation RPC ambiguity guard: %', target_function.signature;
        end if;

        execute patched_sql;
    end loop;
end;
$$;

-- Retire the pre-grant-lot aggregate-balance reservation authority. Runtime
-- reservations must allocate against ai_credit_grants through
-- admit_and_reserve_generation_credits so every hold has grant allocations.
drop function if exists public.reserve_generation_credits(uuid, text, text, integer, text, jsonb);
