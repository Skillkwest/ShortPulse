-- Hotfix: harden grant-lot credit RPCs against PL/pgSQL name ambiguity.
--
-- Migration 200 introduced RETURNS TABLE output names such as ledger_id and
-- grant_id on the credit RPC family. Those names can collide with table column
-- names inside SQL statements, causing runtime 42702 ambiguity failures during
-- Stripe-backed subscription credit grants. Preserve the existing function
-- bodies and security posture while adding the same name-resolution guard used
-- by the grant-lot reservation RPCs.

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
                ('public.grant_account_credits(uuid,integer,text,text,text,text,timestamptz,jsonb,uuid)'::text),
                ('public.debit_account_credits(uuid,integer,text,text,text,jsonb,uuid)'::text),
                ('public.get_credit_grant_summary(uuid)'::text),
                ('public.expire_credit_grants(integer)'::text)
        ) as f(signature)
    loop
        if to_regprocedure(target_function.signature) is null then
            raise exception 'Required credit grant-lot RPC is missing: %', target_function.signature;
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
            raise exception 'Unable to patch credit grant-lot RPC ambiguity guard: %',
                target_function.signature;
        end if;

        execute patched_sql;
    end loop;
end;
$$;
