-- Agent safety control-plane diagnostics (read-only)
-- Purpose:
-- 1) Verify core tables/functions exist.
-- 2) Verify runtime singleton is initialized.
-- 3) Verify execute posture is service-role-only for control-plane RPCs.

with expected_tables as (
    select *
    from (
        values
            ('public.agent_safety_policy_versions'),
            ('public.agent_safety_policy_runtime'),
            ('public.agent_safety_policy_events')
    ) as t(table_name)
),
table_checks as (
    select
        table_name,
        to_regclass(table_name) is not null as pass,
        'exists'::text as check_name
    from expected_tables
),
expected_functions as (
    select *
    from (
        values
            ('public.get_active_agent_safety_policy()'),
            ('public.activate_agent_safety_policy(text,text,uuid,text,boolean,text)'),
            ('public.rollback_agent_safety_policy(text,uuid,text,text,integer)')
    ) as f(signature)
),
resolved_functions as (
    select
        signature,
        to_regprocedure(signature) as regproc
    from expected_functions
),
function_checks as (
    select
        signature as item,
        'exists'::text as check_name,
        regproc is not null as pass
    from resolved_functions
    union all
    select
        signature as item,
        'security_definer'::text as check_name,
        case
            when regproc is null then false
            else exists (
                select 1
                from pg_proc p
                where p.oid = regproc
                  and p.prosecdef is true
            )
        end as pass
    from resolved_functions
    union all
    select
        signature as item,
        'execute_service_role'::text as check_name,
        case
            when regproc is null then false
            else has_function_privilege('service_role', regproc, 'EXECUTE')
        end as pass
    from resolved_functions
    union all
    select
        signature as item,
        'execute_authenticated'::text as check_name,
        case
            when regproc is null then false
            else not has_function_privilege('authenticated', regproc, 'EXECUTE')
        end as pass
    from resolved_functions
    union all
    select
        signature as item,
        'execute_anon'::text as check_name,
        case
            when regproc is null then false
            else not has_function_privilege('anon', regproc, 'EXECUTE')
        end as pass
    from resolved_functions
),
runtime_check as (
    select
        'public.agent_safety_policy_runtime'::text as item,
        'singleton_initialized'::text as check_name,
        exists (
            select 1
            from public.agent_safety_policy_runtime runtime
            where runtime.singleton = true
        ) as pass
)
select
    item,
    check_name,
    pass
from (
    select table_name as item, check_name, pass from table_checks
    union all
    select item, check_name, pass from function_checks
    union all
    select item, check_name, pass from runtime_check
) checks
order by item, check_name;

with checks as (
    select pass from (
        select to_regclass(table_name) is not null as pass
        from (
            values
                ('public.agent_safety_policy_versions'),
                ('public.agent_safety_policy_runtime'),
                ('public.agent_safety_policy_events')
        ) as t(table_name)

        union all

        select
            case
                when to_regprocedure(signature) is null then false
                else true
            end as pass
        from (
            values
                ('public.get_active_agent_safety_policy()'),
                ('public.activate_agent_safety_policy(text,text,uuid,text,boolean,text)'),
                ('public.rollback_agent_safety_policy(text,uuid,text,text,integer)')
        ) as f(signature)

        union all

        select exists (
            select 1
            from public.agent_safety_policy_runtime runtime
            where runtime.singleton = true
        ) as pass
    ) inner_checks
)
select
    count(*)::integer as total_checks,
    count(*) filter (where pass)::integer as passing_checks,
    count(*) filter (where not pass)::integer as failing_checks
from checks;
