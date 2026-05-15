-- Runtime SQL security audit (read-only)
-- Purpose:
-- 1) Verify critical runtime RPCs exist.
-- 2) Verify critical runtime RPCs are SECURITY DEFINER.
-- 3) Verify execute grants are restricted to service_role.
-- 4) Verify canary schema/table/sequence grants exist for app/runtime roles.

with expected_functions as (
    select *
    from (
        values
            ('public.admin_update_app_error_status(uuid,uuid,text,text,uuid,text)'),
            ('public.create_admin_kanban_item(text,text,uuid,text)'),
            ('public.update_admin_kanban_item(uuid,text,text,uuid,text)'),
            ('public.move_admin_kanban_item(uuid,text,uuid,text)'),
            ('public.archive_admin_kanban_item(uuid,uuid,text)'),
            ('public.reserve_generation_credits(uuid,text,text,integer,text,jsonb)'),
            ('public.mark_generation_reservation_submitted(uuid,text,text,jsonb)'),
            ('public.release_generation_reservation_by_source_ref(uuid,text,text,jsonb)'),
            ('public.release_generation_reservation_by_provider_request(uuid,text,text,jsonb)'),
            ('public.capture_generation_reservation_by_provider_request(uuid,text,text,jsonb)'),
            ('public.enqueue_generation_submit(uuid,text,text,text,text,text,integer,text,text,jsonb,integer,jsonb,text)'),
            ('public.claim_generation_submit_queue_batch(integer,integer,uuid)'),
            ('public.claim_generation_observation_inbox_batch(integer,integer)'),
            ('public.claim_generation_recovery_batch(integer,integer,integer,integer)'),
            ('public.admit_and_reserve_generation_credits(uuid,text,text,integer,text,jsonb,text,integer,text,integer,integer)'),
            ('public.release_stale_generation_reservations(integer,integer)'),
            ('public.release_stale_provider_attached_generation_reservations(integer,integer,integer)'),
            ('public.upsert_ai_agent_conversation_state(uuid,text,text,interval,integer)'),
            ('public.prune_ai_agent_conversation_state_expired(integer)'),
            ('public.upsert_ai_studio_session_snapshot(uuid,uuid,jsonb,integer,text,interval,integer)'),
            ('public.get_ai_studio_session_snapshot(uuid,uuid)'),
            ('public.list_ai_studio_sessions(uuid,integer,timestamptz,uuid)'),
            ('public.prune_ai_studio_sessions_expired(integer)'),
            ('public.claim_media_derivative_batch(integer,integer,integer)'),
            ('public.mark_media_derivative_ready(uuid,uuid,text,integer,integer)'),
            ('public.mark_media_derivative_failed(uuid,uuid,text,integer,boolean)'),
            ('public.list_admin_user_health_active_targets(integer,integer)'),
            ('public.prune_admin_user_health_history(integer)'),
            ('public.get_active_agent_safety_policy()'),
            ('public.activate_agent_safety_policy(text,text,uuid,text,boolean,text)'),
            ('public.rollback_agent_safety_policy(text,uuid,text,text,integer)')
    ) as f(signature)
),
resolved as (
    select
        f.signature,
        to_regprocedure(f.signature) as regproc
    from expected_functions f
),
function_checks(signature, check_name, check_pass, detail) as (
    select
        r.signature,
        'exists'::text as check_name,
        (r.regproc is not null) as check_pass,
        case
            when r.regproc is not null then 'function found'
            else 'function missing'
        end as detail
    from resolved r

    union all

    select
        r.signature,
        'security_definer'::text as check_name,
        case
            when r.regproc is null then false
            else exists (
                select 1
                from pg_proc p
                where p.oid = r.regproc
                  and p.prosecdef is true
            )
        end as check_pass,
        case
            when r.regproc is null then 'cannot verify (function missing)'
            else 'must be SECURITY DEFINER'
        end as detail
    from resolved r

    union all

    select
        r.signature,
        'execute_service_role'::text as check_name,
        case
            when r.regproc is null then false
            else has_function_privilege('service_role', r.regproc, 'EXECUTE')
        end as check_pass,
        'service_role must have EXECUTE' as detail
    from resolved r

    union all

    select
        r.signature,
        'execute_public'::text as check_name,
        case
            when r.regproc is null then false
            else not exists (
                select 1
                from pg_proc p
                join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl on true
                where p.oid = r.regproc
                  and acl.grantee = 0
                  and acl.privilege_type = 'EXECUTE'
            )
        end as check_pass,
        'public must not have EXECUTE' as detail
    from resolved r

    union all

    select
        r.signature,
        'execute_authenticated'::text as check_name,
        case
            when r.regproc is null then false
            else not has_function_privilege('authenticated', r.regproc, 'EXECUTE')
        end as check_pass,
        'authenticated must not have EXECUTE' as detail
    from resolved r

    union all

    select
        r.signature,
        'execute_anon'::text as check_name,
        case
            when r.regproc is null then false
            else not has_function_privilege('anon', r.regproc, 'EXECUTE')
        end as check_pass,
        'anon must not have EXECUTE' as detail
    from resolved r
),
expected_schema_grants as (
    select *
    from (
        values
            ('public'::text, 'anon'::text, 'USAGE'::text),
            ('public'::text, 'authenticated'::text, 'USAGE'::text),
            ('public'::text, 'service_role'::text, 'USAGE'::text)
    ) as t(schema_name, grantee, privilege_type)
),
schema_checks(signature, check_name, check_pass, detail) as (
    select
        format('schema %s -> %s', e.schema_name, e.grantee) as signature,
        format('schema_%s', lower(e.privilege_type)) as check_name,
        has_schema_privilege(e.grantee, e.schema_name, e.privilege_type) as check_pass,
        format('%s must have %s on schema %s', e.grantee, e.privilege_type, e.schema_name) as detail
    from expected_schema_grants e
),
expected_table_grants as (
    select *
    from (
        values
            ('public'::text, 'projects'::text, 'anon'::text, 'SELECT'::text),
            ('public'::text, 'projects'::text, 'anon'::text, 'INSERT'::text),
            ('public'::text, 'projects'::text, 'anon'::text, 'UPDATE'::text),
            ('public'::text, 'projects'::text, 'anon'::text, 'DELETE'::text),
            ('public'::text, 'project_workspace_states'::text, 'anon'::text, 'SELECT'::text),
            ('public'::text, 'project_workspace_states'::text, 'anon'::text, 'INSERT'::text),
            ('public'::text, 'project_workspace_states'::text, 'anon'::text, 'UPDATE'::text),
            ('public'::text, 'project_workspace_states'::text, 'anon'::text, 'DELETE'::text),
            ('public'::text, 'media_files'::text, 'anon'::text, 'SELECT'::text),
            ('public'::text, 'media_files'::text, 'anon'::text, 'INSERT'::text),
            ('public'::text, 'media_files'::text, 'anon'::text, 'UPDATE'::text),
            ('public'::text, 'media_files'::text, 'anon'::text, 'DELETE'::text),
            ('public'::text, 'projects'::text, 'authenticated'::text, 'SELECT'::text),
            ('public'::text, 'projects'::text, 'authenticated'::text, 'INSERT'::text),
            ('public'::text, 'projects'::text, 'authenticated'::text, 'UPDATE'::text),
            ('public'::text, 'projects'::text, 'authenticated'::text, 'DELETE'::text),
            ('public'::text, 'project_workspace_states'::text, 'authenticated'::text, 'SELECT'::text),
            ('public'::text, 'project_workspace_states'::text, 'authenticated'::text, 'INSERT'::text),
            ('public'::text, 'project_workspace_states'::text, 'authenticated'::text, 'UPDATE'::text),
            ('public'::text, 'project_workspace_states'::text, 'authenticated'::text, 'DELETE'::text),
            ('public'::text, 'media_files'::text, 'authenticated'::text, 'SELECT'::text),
            ('public'::text, 'media_files'::text, 'authenticated'::text, 'INSERT'::text),
            ('public'::text, 'media_files'::text, 'authenticated'::text, 'UPDATE'::text),
            ('public'::text, 'media_files'::text, 'authenticated'::text, 'DELETE'::text),
            ('public'::text, 'ai_generations'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'ai_generations'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'ai_generations'::text, 'service_role'::text, 'UPDATE'::text),
            ('public'::text, 'generation_attempts'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'generation_attempts'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'generation_attempts'::text, 'service_role'::text, 'UPDATE'::text),
            ('public'::text, 'generation_projection'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'generation_projection'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'generation_projection'::text, 'service_role'::text, 'UPDATE'::text),
            ('public'::text, 'media_files'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'media_files'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'media_files'::text, 'service_role'::text, 'UPDATE'::text),
            ('public'::text, 'billing_profiles'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'billing_profiles'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'billing_profiles'::text, 'service_role'::text, 'UPDATE'::text),
            ('public'::text, 'billing_subscription_contracts'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'billing_subscription_contracts'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'billing_subscription_contracts'::text, 'service_role'::text, 'UPDATE'::text),
            ('public'::text, 'ai_credit_balance'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'ai_credit_balance'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'ai_credit_balance'::text, 'service_role'::text, 'UPDATE'::text),
            ('public'::text, 'ai_credit_ledger'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'ai_credit_ledger'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'admin_user_health_scan_runs'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'admin_user_health_scan_runs'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'admin_user_health_snapshots'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'admin_user_health_snapshots'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'admin_user_health_snapshot_findings'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'admin_user_health_snapshot_findings'::text, 'service_role'::text, 'INSERT'::text)
    ) as t(schema_name, table_name, grantee, privilege_type)
),
table_checks(signature, check_name, check_pass, detail) as (
    select
        format('table %s.%s -> %s', e.schema_name, e.table_name, e.grantee) as signature,
        format('table_%s', lower(e.privilege_type)) as check_name,
        has_table_privilege(e.grantee, format('%I.%I', e.schema_name, e.table_name), e.privilege_type) as check_pass,
        format('%s must have %s on table %s.%s', e.grantee, e.privilege_type, e.schema_name, e.table_name) as detail
    from expected_table_grants e
),
expected_sequence_grants as (
    select *
    from (
        values
            ('public'::text, 'niches_id_seq'::text, 'service_role'::text, 'USAGE'::text),
            ('public'::text, 'niches_id_seq'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'niches_id_seq'::text, 'service_role'::text, 'UPDATE'::text)
    ) as t(schema_name, sequence_name, grantee, privilege_type)
),
sequence_checks(signature, check_name, check_pass, detail) as (
    select
        format('sequence %s.%s -> %s', e.schema_name, e.sequence_name, e.grantee) as signature,
        format('sequence_%s', lower(e.privilege_type)) as check_name,
        has_sequence_privilege(
            e.grantee,
            format('%I.%I', e.schema_name, e.sequence_name),
            e.privilege_type
        ) as check_pass,
        format('%s must have %s on sequence %s.%s', e.grantee, e.privilege_type, e.schema_name, e.sequence_name) as detail
    from expected_sequence_grants e
),
all_checks as (
    select * from function_checks
    union all
    select * from schema_checks
    union all
    select * from table_checks
    union all
    select * from sequence_checks
)
select *
into temp table runtime_sql_security_audit_checks
from all_checks;

select
    signature,
    check_name,
    check_pass as pass,
    detail
from runtime_sql_security_audit_checks
order by signature, check_name;

select
    count(*)::integer as total_checks,
    count(*) filter (where check_pass)::integer as passing_checks,
    count(*) filter (where not check_pass)::integer as failing_checks
from runtime_sql_security_audit_checks;

drop table runtime_sql_security_audit_checks;
