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
            ('public.admin_update_app_error_status(uuid,uuid,text,text,uuid,text,boolean)', null),
            ('public.list_browser_crash_sessions_v2(integer,integer,text,text,text,timestamptz)', null),
            ('public.record_browser_crash_session_event_v1(text,uuid,text,text,text,text,text,text,text,text,text,jsonb,timestamptz,boolean)', null),
            ('public.create_admin_kanban_item(text,text,uuid,text,text,text,text,text,integer,text)', null),
            ('public.update_admin_kanban_item(uuid,text,text,uuid,text)', null),
            ('public.move_admin_kanban_item(uuid,text,uuid,text)', null),
            ('public.archive_admin_kanban_item(uuid,uuid,text)', null),
            ('public.activate_billing_plan_offer(text,text,text,text,integer,integer,bigint,integer,text,text,boolean)', null),
            ('public.activate_billing_storage_addon_offer(text,text,text,bigint,integer,text,text,boolean)', null),
            ('public.mark_generation_reservation_submitted(uuid,text,text,jsonb)', null),
            ('public.release_generation_reservation_by_source_ref(uuid,text,text,jsonb)', null),
            ('public.release_generation_reservation_by_provider_request(uuid,text,text,jsonb)', null),
            ('public.capture_generation_reservation_by_provider_request(uuid,text,text,jsonb)', null),
            ('public.enqueue_generation_submit(uuid,text,text,text,text,text,integer,text,text,jsonb,integer,jsonb,text)', null),
            ('public.claim_generation_submit_queue_batch(integer,integer,uuid)', null),
            ('public.claim_generation_observation_inbox_batch(integer,integer)', null),
            ('public.claim_generation_recovery_batch(integer,integer,integer,integer)', null),
            ('public.admit_and_reserve_generation_credits(uuid,text,text,integer,text,jsonb,text,integer,text,integer,integer)', null),
            ('public.release_stale_generation_reservations(integer,integer)', null),
            ('public.release_stale_provider_attached_generation_reservations(integer,integer,integer)', null),
            ('public.get_media_folder_item_counts(uuid,uuid[])', null),
            ('public.resolve_media_storage_object_by_basename(uuid,text)', null),
            ('public.resolve_media_storage_usage_bytes(uuid)', null),
            ('public.resolve_media_storage_base_limit_bytes(uuid)', null),
            ('public.resolve_media_storage_addon_limit_bytes(uuid)', null),
            ('public.upsert_ai_agent_conversation_state(uuid,text,text,interval,integer)', null),
            ('public.prune_ai_agent_conversation_state_expired(integer)', null),
            ('public.upsert_ai_studio_session_snapshot(uuid,uuid,jsonb,integer,text,interval,integer)', null),
            ('public.get_ai_studio_session_snapshot(uuid,uuid)', null),
            ('public.list_ai_studio_sessions(uuid,integer,timestamptz,uuid)', null),
            ('public.prune_ai_studio_sessions_expired(integer)', null),
            ('public.claim_media_derivative_batch(integer,integer,integer)', null),
            ('public.mark_media_derivative_ready(uuid,uuid,text,integer,integer)', null),
            ('public.mark_media_derivative_failed(uuid,uuid,text,integer,boolean)', null),
            ('public.get_media_storage_lifecycle_summary(integer)', null),
            ('public.get_account_storage_ownership_proof_details(integer,uuid,integer)', null),
            ('public.get_account_storage_ownership_proof_summary(integer)', null),
            ('public.list_admin_user_health_active_targets(integer,integer)', null),
            ('public.prune_admin_user_health_history(integer)', null),
            ('public.get_admin_global_stats_summary()', null),
            ('public.list_admin_model_usage_stats(integer)', null),
            ('public.get_admin_global_stats_v1()', null),
            ('public.get_admin_generation_breakdown_v1()', null),
            ('public.get_admin_growth_stats_v1()', null),
            ('public.get_admin_growth_cohorts_v1()', null),
            ('public.get_admin_first_value_funnel_v1()', null),
            ('public.get_admin_error_events_summary_v1(timestamptz,timestamptz,timestamptz)', null),
            ('public.publish_dashboard_announcement(text,text,uuid)', null),
            ('public.reorder_dashboard_tutorials(uuid[],uuid)', null),
            ('public.get_active_legal_policy(text)', null),
            ('public.publish_legal_policy(text,text,timestamptz,text,uuid,text,text)', null),
            ('public.get_active_agent_safety_policy()', null),
            ('public.create_agent_safety_policy_version(text,jsonb,text,text,uuid,text,boolean,text)', null),
            ('public.activate_agent_safety_policy(text,text,uuid,text,boolean,text)', null),
            ('public.rollback_agent_safety_policy(text,uuid,text,text,integer)', null),
            ('public.get_active_model_pricing_policy()', null),
            (
                'public.apply_model_pricing_policy(jsonb,jsonb,text,text,uuid,text,text)',
                'public.apply_model_pricing_policy(jsonb,text,text,uuid,text,text)'
            ),
            ('public.rollback_model_pricing_policy(text,uuid,text,text)', null),
            ('public.grant_account_credits(uuid,integer,text,text,text,text,timestamptz,jsonb,uuid)', null),
            ('public.debit_account_credits(uuid,integer,text,text,text,jsonb,uuid)', null),
            ('public.get_credit_grant_summary(uuid)', null),
            ('public.get_credit_grant_summaries(uuid[])', null),
            ('public.expire_credit_grants(integer)', null),
            ('public.release_generation_reservation_by_id(uuid,text,jsonb)', null),
            ('public.reserve_openai_internal_capacity_admission(uuid,text,text,text,bigint,integer,integer)', null),
            ('public.begin_openai_internal_capacity_attempt(uuid,uuid)', null),
            ('public.settle_openai_internal_capacity_admission(uuid,uuid,text,jsonb)', null),
            ('public.reserve_media_upload_intent(uuid,text,text,text,text,bigint,text,text,text,text,integer)', null),
            ('public.claim_media_upload_intent(uuid,uuid,text,text)', null),
            ('public.finalize_media_upload_intent(uuid,uuid,text,text,text,bigint,text)', null),
            ('public.reject_media_upload_intent(uuid,uuid,text,text,text,text,bigint,text)', null),
            ('public.expire_media_upload_intent(uuid,uuid)', null)
    ) as f(signature, alternate_signature)
),
resolved as (
    select
        f.signature,
        coalesce(to_regprocedure(f.signature), to_regprocedure(f.alternate_signature)) as regproc
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
        'owner_postgres'::text as check_name,
        case
            when r.regproc is null then false
            else exists (
                select 1
                from pg_proc p
                where p.oid = r.regproc
                  and pg_get_userbyid(p.proowner) = 'postgres'
            )
        end as check_pass,
        case
            when r.regproc is null then 'cannot verify (function missing)'
            else 'owner must be postgres'
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
expected_fixed_search_path_functions as (
    select *
    from (
        values
            ('public.list_browser_crash_sessions_v2(integer,integer,text,text,text,timestamptz)'::text),
            ('public.record_browser_crash_session_event_v1(text,uuid,text,text,text,text,text,text,text,text,text,jsonb,timestamptz,boolean)'::text)
    ) as f(signature)
),
function_search_path_checks(signature, check_name, check_pass, detail) as (
    select
        f.signature,
        'fixed_empty_search_path'::text as check_name,
        case
            when to_regprocedure(f.signature) is null then false
            else position(
                $needle$set search_path to ''$needle$
                in lower(pg_get_functiondef(to_regprocedure(f.signature)))
            ) > 0
        end as check_pass,
        'crash RPC must pin an empty search_path'::text as detail
    from expected_fixed_search_path_functions f
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
            ('public'::text, 'ai_credit_grants'::text, 'authenticated'::text, 'SELECT'::text),
            ('public'::text, 'ai_credit_grants'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'ai_credit_grants'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'ai_credit_grants'::text, 'service_role'::text, 'UPDATE'::text),
            ('public'::text, 'ai_credit_grant_allocations'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'ai_credit_grant_allocations'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'ai_credit_grant_allocations'::text, 'service_role'::text, 'UPDATE'::text),
            ('public'::text, 'admin_user_health_scan_runs'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'admin_user_health_scan_runs'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'admin_user_health_snapshots'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'admin_user_health_snapshots'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'admin_user_health_snapshot_findings'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'admin_user_health_snapshot_findings'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'openai_internal_capacity_admissions'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'openai_internal_capacity_admissions'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'openai_internal_capacity_admissions'::text, 'service_role'::text, 'UPDATE'::text),
            ('public'::text, 'openai_internal_capacity_admissions'::text, 'service_role'::text, 'DELETE'::text),
            ('public'::text, 'media_upload_intents'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'media_upload_intents'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'media_upload_intents'::text, 'service_role'::text, 'UPDATE'::text),
            ('public'::text, 'media_upload_intents'::text, 'service_role'::text, 'DELETE'::text)
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
browser_crash_table_checks(signature, check_name, check_pass, detail) as (
    select
        'table public.browser_crash_sessions'::text,
        'exists'::text,
        to_regclass('public.browser_crash_sessions') is not null,
        'browser crash evidence table must exist'::text

    union all

    select
        'table public.browser_crash_sessions'::text,
        'rls_enabled'::text,
        coalesce((
            select c.relrowsecurity
            from pg_class c
            where c.oid = to_regclass('public.browser_crash_sessions')
        ), false),
        'browser crash evidence table must have RLS enabled'::text

    union all

    select
        'table public.browser_crash_sessions -> service_role'::text,
        'table_all'::text,
        case
            when to_regclass('public.browser_crash_sessions') is null then false
            else has_table_privilege(
                'service_role',
                'public.browser_crash_sessions',
                'SELECT,INSERT,UPDATE,DELETE'
            )
        end,
        'service_role must have SELECT, INSERT, UPDATE, and DELETE'::text

    union all

    select
        'table public.browser_crash_sessions -> public'::text,
        'table_none'::text,
        case
            when to_regclass('public.browser_crash_sessions') is null then false
            else not exists (
                select 1
                from pg_class c
                join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl on true
                where c.oid = to_regclass('public.browser_crash_sessions')
                  and acl.grantee = 0
                  and acl.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
            )
        end,
        'public must not access browser crash evidence'::text

    union all

    select
        format('table public.browser_crash_sessions -> %s', role_name),
        'table_none'::text,
        case
            when to_regclass('public.browser_crash_sessions') is null then false
            else not has_table_privilege(
                role_name,
                'public.browser_crash_sessions',
                'SELECT,INSERT,UPDATE,DELETE'
            )
        end,
        format('%s must not access browser crash evidence', role_name)
    from (values ('anon'::text), ('authenticated'::text)) roles(role_name)
),
openai_capacity_table_checks(signature, check_name, check_pass, detail) as (
    select 'table public.openai_internal_capacity_admissions'::text,
           'rls_enabled'::text,
           coalesce((select c.relrowsecurity from pg_class c
                     where c.oid = to_regclass('public.openai_internal_capacity_admissions')), false),
           'OpenAI internal-capacity admissions must have RLS enabled'::text
    union all
    select 'table public.openai_internal_capacity_admissions'::text,
           'browser_policies_none'::text,
           to_regclass('public.openai_internal_capacity_admissions') is not null
           and not exists (
               select 1 from pg_policies p
               where p.schemaname = 'public'
                 and p.tablename = 'openai_internal_capacity_admissions'
           ),
           'OpenAI internal-capacity admissions must have no browser RLS policies'::text
    union all
    select format('table public.openai_internal_capacity_admissions -> %s', role_name),
           'table_none'::text,
           to_regclass('public.openai_internal_capacity_admissions') is not null
           and not has_table_privilege(
               role_name,
               'public.openai_internal_capacity_admissions',
               'SELECT,INSERT,UPDATE,DELETE'
           ),
           format('%s must not access OpenAI internal-capacity admissions', role_name)
    from (values ('anon'::text), ('authenticated'::text)) roles(role_name)
),
media_upload_intent_table_checks(signature, check_name, check_pass, detail) as (
    select 'table public.media_upload_intents'::text,
           'rls_enabled'::text,
           coalesce((select c.relrowsecurity from pg_class c
                     where c.oid = to_regclass('public.media_upload_intents')), false),
           'Media upload intents must have RLS enabled'::text
    union all
    select 'table public.media_upload_intents'::text,
           'browser_policies_none'::text,
           to_regclass('public.media_upload_intents') is not null
           and not exists (
               select 1 from pg_policies p
               where p.schemaname = 'public' and p.tablename = 'media_upload_intents'
           ),
           'Media upload intents must have no browser RLS policies'::text
    union all
    select format('table public.media_upload_intents -> %s', role_name),
           'table_none'::text,
           to_regclass('public.media_upload_intents') is not null
           and not has_table_privilege(
               role_name,
               'public.media_upload_intents',
               'SELECT,INSERT,UPDATE,DELETE'
           ),
           format('%s must not access media upload intents', role_name)
    from (values ('anon'::text), ('authenticated'::text)) roles(role_name)
    union all
    select 'bucket media_upload_staging'::text,
           'private_bounded_config'::text,
           exists (
               select 1 from storage.buckets b
               where b.id = 'media_upload_staging'
                 and b.name = 'media_upload_staging'
                 and b.public is false
                 and b.file_size_limit = 104857600
                 and b.allowed_mime_types @> array[
                     'image/jpeg', 'image/png', 'image/webp', 'image/gif',
                     'image/heic', 'image/heif', 'image/avif',
                     'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v',
                     'audio/aac', 'audio/flac', 'audio/m4a', 'audio/mp4', 'audio/mpeg',
                     'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-m4a', 'audio/x-wav'
                 ]::text[]
           ),
           'Media upload staging bucket must be private, 100 MiB, and media allowlisted'::text
    union all
    select 'bucket media_upload_staging'::text,
           'browser_policies_none'::text,
           not exists (
               select 1 from pg_policies p
               where p.schemaname = 'storage' and p.tablename = 'objects'
                 and (
                     coalesce(p.qual, '') like '%media_upload_staging%'
                     or coalesce(p.with_check, '') like '%media_upload_staging%'
                 )
           ),
           'Media upload staging bucket must have no anon/auth storage policies'::text
),
expected_generation_relational_tables(table_name, owner_constraint_name, trigger_name) as (
    values
        ('ai_generation_submit_queue'::text, 'ai_generation_submit_queue_generation_owner_fk'::text, 'trg_ai_generation_submit_queue_owner_immutable'::text),
        ('generation_attempts'::text, 'generation_attempts_generation_owner_fk'::text, 'trg_generation_attempts_owner_immutable'::text),
        ('generation_publications'::text, 'generation_publications_generation_owner_fk'::text, 'trg_generation_publications_owner_immutable'::text),
        ('generation_projection'::text, 'generation_projection_generation_owner_fk'::text, 'trg_generation_projection_owner_immutable'::text),
        ('ai_generation_outputs'::text, 'ai_generation_outputs_generation_owner_fk'::text, 'trg_ai_generation_outputs_owner_immutable'::text)
),
expected_generation_relational_constraints(table_name, constraint_name) as (
    values
        ('ai_generation_submit_queue'::text, 'ai_generation_submit_queue_generation_owner_fk'::text),
        ('generation_attempts'::text, 'generation_attempts_generation_owner_fk'::text),
        ('ai_generation_outputs'::text, 'ai_generation_outputs_generation_owner_fk'::text),
        ('ai_generation_outputs'::text, 'ai_generation_outputs_attempt_owner_fk'::text),
        ('ai_generation_outputs'::text, 'ai_generation_outputs_media_owner_fk'::text),
        ('generation_publications'::text, 'generation_publications_generation_owner_fk'::text),
        ('generation_publications'::text, 'generation_publications_attempt_owner_fk'::text),
        ('generation_publications'::text, 'generation_publications_output_owner_fk'::text),
        ('generation_publications'::text, 'generation_publications_media_owner_fk'::text),
        ('generation_projection'::text, 'generation_projection_generation_owner_fk'::text),
        ('generation_projection'::text, 'generation_projection_attempt_owner_fk'::text)
),
generation_relational_table_checks(signature, check_name, check_pass, detail) as (
    select format('table public.%s', e.table_name),
           'rls_enabled'::text,
           coalesce((select c.relrowsecurity from pg_class c
                     where c.oid = to_regclass(format('public.%I', e.table_name))), false),
           format('%s must have RLS enabled', e.table_name)
    from expected_generation_relational_tables e

    union all

    select format('table public.%s -> authenticated', e.table_name),
           'table_select'::text,
           to_regclass(format('public.%I', e.table_name)) is not null
           and has_table_privilege('authenticated', format('public.%I', e.table_name), 'SELECT'),
           format('authenticated must retain SELECT on %s', e.table_name)
    from expected_generation_relational_tables e

    union all

    select format('table public.%s -> authenticated', e.table_name),
           'table_mutation_none'::text,
           to_regclass(format('public.%I', e.table_name)) is not null
           and not has_table_privilege(
               'authenticated', format('public.%I', e.table_name),
               'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
           ),
           format('authenticated must not mutate server-owned %s', e.table_name)
    from expected_generation_relational_tables e

    union all

    select format('table public.%s -> anon', e.table_name),
           'table_none'::text,
           to_regclass(format('public.%I', e.table_name)) is not null
           and not has_table_privilege(
               'anon', format('public.%I', e.table_name),
               'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
           ),
           format('anon must not access server-owned %s', e.table_name)
    from expected_generation_relational_tables e

    union all

    select format('table public.%s -> service_role', e.table_name),
           'table_runtime_dml'::text,
           to_regclass(format('public.%I', e.table_name)) is not null
           and has_table_privilege(
               'service_role', format('public.%I', e.table_name),
               'SELECT,INSERT,UPDATE,DELETE'
           ),
           format('service_role must retain runtime DML on %s', e.table_name)
    from expected_generation_relational_tables e

    union all

    select format('table public.%s', e.table_name),
           'browser_modify_policies_none'::text,
           to_regclass(format('public.%I', e.table_name)) is not null
           and not exists (
               select 1 from pg_policies p
               where p.schemaname = 'public'
                 and p.tablename = e.table_name
                 and p.cmd <> 'SELECT'
           ),
           format('%s must have no browser mutation policy', e.table_name)
    from expected_generation_relational_tables e

    union all

    select format('trigger public.%s.%s', e.table_name, e.trigger_name),
           'owner_immutable'::text,
           exists (
               select 1
               from pg_trigger t
               where t.tgrelid = to_regclass(format('public.%I', e.table_name))
                 and t.tgname = e.trigger_name
                 and not t.tgisinternal
                 and t.tgenabled <> 'D'
           ),
           format('%s ownership columns must be immutable', e.table_name)
    from expected_generation_relational_tables e
),
generation_relational_constraint_checks(signature, check_name, check_pass, detail) as (
    select format('constraint public.%s.%s', e.table_name, e.constraint_name),
           'validated_foreign_key'::text,
           exists (
               select 1
               from pg_constraint c
               where c.conrelid = to_regclass(format('public.%I', e.table_name))
                 and c.conname = e.constraint_name
                 and c.contype = 'f'
                 and c.convalidated
           ),
           format('%s must exist as a validated ownership foreign key', e.constraint_name)
    from expected_generation_relational_constraints e
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
forbidden_runtime_functions as (
    select *
    from (
        values
            ('public.reserve_generation_credits(uuid,text,text,integer,text,jsonb)'::text)
    ) as f(signature)
),
forbidden_function_checks(signature, check_name, check_pass, detail) as (
    select
        f.signature,
        'retired_runtime_function_absent'::text as check_name,
        (to_regprocedure(f.signature) is null) as check_pass,
        'retired aggregate-balance reservation RPC must not exist'::text as detail
    from forbidden_runtime_functions f
),
expected_variable_conflict_functions as (
    select *
    from (
        values
            ('public.grant_account_credits(uuid,integer,text,text,text,text,timestamptz,jsonb,uuid)'::text),
            ('public.debit_account_credits(uuid,integer,text,text,text,jsonb,uuid)'::text),
            ('public.get_credit_grant_summary(uuid)'::text),
            ('public.get_credit_grant_summaries(uuid[])'::text),
            ('public.expire_credit_grants(integer)'::text),
            ('public.admit_and_reserve_generation_credits(uuid,text,text,integer,text,jsonb,text,integer,text,integer,integer)'::text),
            ('public.release_generation_reservation_by_source_ref(uuid,text,text,jsonb)'::text),
            ('public.release_generation_reservation_by_provider_request(uuid,text,text,jsonb)'::text),
            ('public.release_generation_reservation_by_id(uuid,text,jsonb)'::text),
            ('public.capture_generation_reservation_by_provider_request(uuid,text,text,jsonb)'::text)
    ) as f(signature)
),
function_body_checks(signature, check_name, check_pass, detail) as (
    select
        f.signature,
        'variable_conflict_use_column'::text as check_name,
        case
            when to_regprocedure(f.signature) is null then false
            else position(
                '#variable_conflict use_column'
                in lower(pg_get_functiondef(to_regprocedure(f.signature)))
            ) > 0
        end as check_pass,
        'grant-lot credit/reservation RPCs must prefer column names to avoid PL/pgSQL ambiguity'::text as detail
    from expected_variable_conflict_functions f
),
all_checks as (
    select * from function_checks
    union all
    select * from function_search_path_checks
    union all
    select * from schema_checks
    union all
    select * from table_checks
    union all
    select * from browser_crash_table_checks
    union all
    select * from openai_capacity_table_checks
    union all
    select * from media_upload_intent_table_checks
    union all
    select * from generation_relational_table_checks
    union all
    select * from generation_relational_constraint_checks
    union all
    select * from sequence_checks
    union all
    select * from forbidden_function_checks
    union all
    select * from function_body_checks
)
select
    signature,
    check_name,
    check_pass as pass,
    detail
from all_checks
order by signature, check_name;

with expected_functions as (
    select *
    from (
        values
            ('public.admin_update_app_error_status(uuid,uuid,text,text,uuid,text,boolean)', null),
            ('public.list_browser_crash_sessions_v2(integer,integer,text,text,text,timestamptz)', null),
            ('public.record_browser_crash_session_event_v1(text,uuid,text,text,text,text,text,text,text,text,text,jsonb,timestamptz,boolean)', null),
            ('public.create_admin_kanban_item(text,text,uuid,text,text,text,text,text,integer,text)', null),
            ('public.update_admin_kanban_item(uuid,text,text,uuid,text)', null),
            ('public.move_admin_kanban_item(uuid,text,uuid,text)', null),
            ('public.archive_admin_kanban_item(uuid,uuid,text)', null),
            ('public.activate_billing_plan_offer(text,text,text,text,integer,integer,bigint,integer,text,text,boolean)', null),
            ('public.activate_billing_storage_addon_offer(text,text,text,bigint,integer,text,text,boolean)', null),
            ('public.mark_generation_reservation_submitted(uuid,text,text,jsonb)', null),
            ('public.release_generation_reservation_by_source_ref(uuid,text,text,jsonb)', null),
            ('public.release_generation_reservation_by_provider_request(uuid,text,text,jsonb)', null),
            ('public.capture_generation_reservation_by_provider_request(uuid,text,text,jsonb)', null),
            ('public.enqueue_generation_submit(uuid,text,text,text,text,text,integer,text,text,jsonb,integer,jsonb,text)', null),
            ('public.claim_generation_submit_queue_batch(integer,integer,uuid)', null),
            ('public.claim_generation_observation_inbox_batch(integer,integer)', null),
            ('public.claim_generation_recovery_batch(integer,integer,integer,integer)', null),
            ('public.admit_and_reserve_generation_credits(uuid,text,text,integer,text,jsonb,text,integer,text,integer,integer)', null),
            ('public.release_stale_generation_reservations(integer,integer)', null),
            ('public.release_stale_provider_attached_generation_reservations(integer,integer,integer)', null),
            ('public.get_media_folder_item_counts(uuid,uuid[])', null),
            ('public.resolve_media_storage_object_by_basename(uuid,text)', null),
            ('public.resolve_media_storage_usage_bytes(uuid)', null),
            ('public.resolve_media_storage_base_limit_bytes(uuid)', null),
            ('public.resolve_media_storage_addon_limit_bytes(uuid)', null),
            ('public.upsert_ai_agent_conversation_state(uuid,text,text,interval,integer)', null),
            ('public.prune_ai_agent_conversation_state_expired(integer)', null),
            ('public.upsert_ai_studio_session_snapshot(uuid,uuid,jsonb,integer,text,interval,integer)', null),
            ('public.get_ai_studio_session_snapshot(uuid,uuid)', null),
            ('public.list_ai_studio_sessions(uuid,integer,timestamptz,uuid)', null),
            ('public.prune_ai_studio_sessions_expired(integer)', null),
            ('public.claim_media_derivative_batch(integer,integer,integer)', null),
            ('public.mark_media_derivative_ready(uuid,uuid,text,integer,integer)', null),
            ('public.mark_media_derivative_failed(uuid,uuid,text,integer,boolean)', null),
            ('public.get_media_storage_lifecycle_summary(integer)', null),
            ('public.get_account_storage_ownership_proof_details(integer,uuid,integer)', null),
            ('public.get_account_storage_ownership_proof_summary(integer)', null),
            ('public.list_admin_user_health_active_targets(integer,integer)', null),
            ('public.prune_admin_user_health_history(integer)', null),
            ('public.get_admin_global_stats_summary()', null),
            ('public.list_admin_model_usage_stats(integer)', null),
            ('public.get_admin_global_stats_v1()', null),
            ('public.get_admin_generation_breakdown_v1()', null),
            ('public.get_admin_growth_stats_v1()', null),
            ('public.get_admin_growth_cohorts_v1()', null),
            ('public.get_admin_first_value_funnel_v1()', null),
            ('public.get_admin_error_events_summary_v1(timestamptz,timestamptz,timestamptz)', null),
            ('public.publish_dashboard_announcement(text,text,uuid)', null),
            ('public.reorder_dashboard_tutorials(uuid[],uuid)', null),
            ('public.get_active_legal_policy(text)', null),
            ('public.publish_legal_policy(text,text,timestamptz,text,uuid,text,text)', null),
            ('public.get_active_agent_safety_policy()', null),
            ('public.create_agent_safety_policy_version(text,jsonb,text,text,uuid,text,boolean,text)', null),
            ('public.activate_agent_safety_policy(text,text,uuid,text,boolean,text)', null),
            ('public.rollback_agent_safety_policy(text,uuid,text,text,integer)', null),
            ('public.get_active_model_pricing_policy()', null),
            (
                'public.apply_model_pricing_policy(jsonb,jsonb,text,text,uuid,text,text)',
                'public.apply_model_pricing_policy(jsonb,text,text,uuid,text,text)'
            ),
            ('public.rollback_model_pricing_policy(text,uuid,text,text)', null),
            ('public.grant_account_credits(uuid,integer,text,text,text,text,timestamptz,jsonb,uuid)', null),
            ('public.debit_account_credits(uuid,integer,text,text,text,jsonb,uuid)', null),
            ('public.get_credit_grant_summary(uuid)', null),
            ('public.get_credit_grant_summaries(uuid[])', null),
            ('public.expire_credit_grants(integer)', null),
            ('public.release_generation_reservation_by_id(uuid,text,jsonb)', null),
            ('public.reserve_openai_internal_capacity_admission(uuid,text,text,text,bigint,integer,integer)', null),
            ('public.begin_openai_internal_capacity_attempt(uuid,uuid)', null),
            ('public.settle_openai_internal_capacity_admission(uuid,uuid,text,jsonb)', null),
            ('public.reserve_media_upload_intent(uuid,text,text,text,text,bigint,text,text,text,text,integer)', null),
            ('public.claim_media_upload_intent(uuid,uuid,text,text)', null),
            ('public.finalize_media_upload_intent(uuid,uuid,text,text,text,bigint,text)', null),
            ('public.reject_media_upload_intent(uuid,uuid,text,text,text,text,bigint,text)', null),
            ('public.expire_media_upload_intent(uuid,uuid)', null)
    ) as f(signature, alternate_signature)
),
resolved as (
    select
        f.signature,
        coalesce(to_regprocedure(f.signature), to_regprocedure(f.alternate_signature)) as regproc
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
        'owner_postgres'::text as check_name,
        case
            when r.regproc is null then false
            else exists (
                select 1
                from pg_proc p
                where p.oid = r.regproc
                  and pg_get_userbyid(p.proowner) = 'postgres'
            )
        end as check_pass,
        case
            when r.regproc is null then 'cannot verify (function missing)'
            else 'owner must be postgres'
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
expected_fixed_search_path_functions as (
    select *
    from (
        values
            ('public.list_browser_crash_sessions_v2(integer,integer,text,text,text,timestamptz)'::text),
            ('public.record_browser_crash_session_event_v1(text,uuid,text,text,text,text,text,text,text,text,text,jsonb,timestamptz,boolean)'::text)
    ) as f(signature)
),
function_search_path_checks(signature, check_name, check_pass, detail) as (
    select
        f.signature,
        'fixed_empty_search_path'::text as check_name,
        case
            when to_regprocedure(f.signature) is null then false
            else position(
                $needle$set search_path to ''$needle$
                in lower(pg_get_functiondef(to_regprocedure(f.signature)))
            ) > 0
        end as check_pass,
        'crash RPC must pin an empty search_path'::text as detail
    from expected_fixed_search_path_functions f
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
            ('public'::text, 'ai_credit_grants'::text, 'authenticated'::text, 'SELECT'::text),
            ('public'::text, 'ai_credit_grants'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'ai_credit_grants'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'ai_credit_grants'::text, 'service_role'::text, 'UPDATE'::text),
            ('public'::text, 'ai_credit_grant_allocations'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'ai_credit_grant_allocations'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'ai_credit_grant_allocations'::text, 'service_role'::text, 'UPDATE'::text),
            ('public'::text, 'admin_user_health_scan_runs'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'admin_user_health_scan_runs'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'admin_user_health_snapshots'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'admin_user_health_snapshots'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'admin_user_health_snapshot_findings'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'admin_user_health_snapshot_findings'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'openai_internal_capacity_admissions'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'openai_internal_capacity_admissions'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'openai_internal_capacity_admissions'::text, 'service_role'::text, 'UPDATE'::text),
            ('public'::text, 'openai_internal_capacity_admissions'::text, 'service_role'::text, 'DELETE'::text),
            ('public'::text, 'media_upload_intents'::text, 'service_role'::text, 'SELECT'::text),
            ('public'::text, 'media_upload_intents'::text, 'service_role'::text, 'INSERT'::text),
            ('public'::text, 'media_upload_intents'::text, 'service_role'::text, 'UPDATE'::text),
            ('public'::text, 'media_upload_intents'::text, 'service_role'::text, 'DELETE'::text)
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
browser_crash_table_checks(signature, check_name, check_pass, detail) as (
    select
        'table public.browser_crash_sessions'::text,
        'exists'::text,
        to_regclass('public.browser_crash_sessions') is not null,
        'browser crash evidence table must exist'::text

    union all

    select
        'table public.browser_crash_sessions'::text,
        'rls_enabled'::text,
        coalesce((
            select c.relrowsecurity
            from pg_class c
            where c.oid = to_regclass('public.browser_crash_sessions')
        ), false),
        'browser crash evidence table must have RLS enabled'::text

    union all

    select
        'table public.browser_crash_sessions -> service_role'::text,
        'table_all'::text,
        case
            when to_regclass('public.browser_crash_sessions') is null then false
            else has_table_privilege(
                'service_role',
                'public.browser_crash_sessions',
                'SELECT,INSERT,UPDATE,DELETE'
            )
        end,
        'service_role must have SELECT, INSERT, UPDATE, and DELETE'::text

    union all

    select
        'table public.browser_crash_sessions -> public'::text,
        'table_none'::text,
        case
            when to_regclass('public.browser_crash_sessions') is null then false
            else not exists (
                select 1
                from pg_class c
                join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl on true
                where c.oid = to_regclass('public.browser_crash_sessions')
                  and acl.grantee = 0
                  and acl.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
            )
        end,
        'public must not access browser crash evidence'::text

    union all

    select
        format('table public.browser_crash_sessions -> %s', role_name),
        'table_none'::text,
        case
            when to_regclass('public.browser_crash_sessions') is null then false
            else not has_table_privilege(
                role_name,
                'public.browser_crash_sessions',
                'SELECT,INSERT,UPDATE,DELETE'
            )
        end,
        format('%s must not access browser crash evidence', role_name)
    from (values ('anon'::text), ('authenticated'::text)) roles(role_name)
),
openai_capacity_table_checks(signature, check_name, check_pass, detail) as (
    select 'table public.openai_internal_capacity_admissions'::text,
           'rls_enabled'::text,
           coalesce((select c.relrowsecurity from pg_class c
                     where c.oid = to_regclass('public.openai_internal_capacity_admissions')), false),
           'OpenAI internal-capacity admissions must have RLS enabled'::text
    union all
    select 'table public.openai_internal_capacity_admissions'::text,
           'browser_policies_none'::text,
           to_regclass('public.openai_internal_capacity_admissions') is not null
           and not exists (
               select 1 from pg_policies p
               where p.schemaname = 'public'
                 and p.tablename = 'openai_internal_capacity_admissions'
           ),
           'OpenAI internal-capacity admissions must have no browser RLS policies'::text
    union all
    select format('table public.openai_internal_capacity_admissions -> %s', role_name),
           'table_none'::text,
           to_regclass('public.openai_internal_capacity_admissions') is not null
           and not has_table_privilege(
               role_name,
               'public.openai_internal_capacity_admissions',
               'SELECT,INSERT,UPDATE,DELETE'
           ),
           format('%s must not access OpenAI internal-capacity admissions', role_name)
    from (values ('anon'::text), ('authenticated'::text)) roles(role_name)
),
media_upload_intent_table_checks(signature, check_name, check_pass, detail) as (
    select 'table public.media_upload_intents'::text,
           'rls_enabled'::text,
           coalesce((select c.relrowsecurity from pg_class c
                     where c.oid = to_regclass('public.media_upload_intents')), false),
           'Media upload intents must have RLS enabled'::text
    union all
    select 'table public.media_upload_intents'::text,
           'browser_policies_none'::text,
           to_regclass('public.media_upload_intents') is not null
           and not exists (
               select 1 from pg_policies p
               where p.schemaname = 'public' and p.tablename = 'media_upload_intents'
           ),
           'Media upload intents must have no browser RLS policies'::text
    union all
    select format('table public.media_upload_intents -> %s', role_name),
           'table_none'::text,
           to_regclass('public.media_upload_intents') is not null
           and not has_table_privilege(
               role_name,
               'public.media_upload_intents',
               'SELECT,INSERT,UPDATE,DELETE'
           ),
           format('%s must not access media upload intents', role_name)
    from (values ('anon'::text), ('authenticated'::text)) roles(role_name)
    union all
    select 'bucket media_upload_staging'::text,
           'private_bounded_config'::text,
           exists (
               select 1 from storage.buckets b
               where b.id = 'media_upload_staging'
                 and b.name = 'media_upload_staging'
                 and b.public is false
                 and b.file_size_limit = 104857600
                 and b.allowed_mime_types @> array[
                     'image/jpeg', 'image/png', 'image/webp', 'image/gif',
                     'image/heic', 'image/heif', 'image/avif',
                     'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v',
                     'audio/aac', 'audio/flac', 'audio/m4a', 'audio/mp4', 'audio/mpeg',
                     'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-m4a', 'audio/x-wav'
                 ]::text[]
           ),
           'Media upload staging bucket must be private, 100 MiB, and media allowlisted'::text
    union all
    select 'bucket media_upload_staging'::text,
           'browser_policies_none'::text,
           not exists (
               select 1 from pg_policies p
               where p.schemaname = 'storage' and p.tablename = 'objects'
                 and (
                     coalesce(p.qual, '') like '%media_upload_staging%'
                     or coalesce(p.with_check, '') like '%media_upload_staging%'
                 )
           ),
           'Media upload staging bucket must have no anon/auth storage policies'::text
),
expected_generation_relational_tables(table_name, owner_constraint_name, trigger_name) as (
    values
        ('ai_generation_submit_queue'::text, 'ai_generation_submit_queue_generation_owner_fk'::text, 'trg_ai_generation_submit_queue_owner_immutable'::text),
        ('generation_attempts'::text, 'generation_attempts_generation_owner_fk'::text, 'trg_generation_attempts_owner_immutable'::text),
        ('generation_publications'::text, 'generation_publications_generation_owner_fk'::text, 'trg_generation_publications_owner_immutable'::text),
        ('generation_projection'::text, 'generation_projection_generation_owner_fk'::text, 'trg_generation_projection_owner_immutable'::text),
        ('ai_generation_outputs'::text, 'ai_generation_outputs_generation_owner_fk'::text, 'trg_ai_generation_outputs_owner_immutable'::text)
),
expected_generation_relational_constraints(table_name, constraint_name) as (
    values
        ('ai_generation_submit_queue'::text, 'ai_generation_submit_queue_generation_owner_fk'::text),
        ('generation_attempts'::text, 'generation_attempts_generation_owner_fk'::text),
        ('ai_generation_outputs'::text, 'ai_generation_outputs_generation_owner_fk'::text),
        ('ai_generation_outputs'::text, 'ai_generation_outputs_attempt_owner_fk'::text),
        ('ai_generation_outputs'::text, 'ai_generation_outputs_media_owner_fk'::text),
        ('generation_publications'::text, 'generation_publications_generation_owner_fk'::text),
        ('generation_publications'::text, 'generation_publications_attempt_owner_fk'::text),
        ('generation_publications'::text, 'generation_publications_output_owner_fk'::text),
        ('generation_publications'::text, 'generation_publications_media_owner_fk'::text),
        ('generation_projection'::text, 'generation_projection_generation_owner_fk'::text),
        ('generation_projection'::text, 'generation_projection_attempt_owner_fk'::text)
),
generation_relational_table_checks(signature, check_name, check_pass, detail) as (
    select format('table public.%s', e.table_name),
           'rls_enabled'::text,
           coalesce((select c.relrowsecurity from pg_class c
                     where c.oid = to_regclass(format('public.%I', e.table_name))), false),
           format('%s must have RLS enabled', e.table_name)
    from expected_generation_relational_tables e
    union all
    select format('table public.%s -> authenticated', e.table_name),
           'table_select'::text,
           to_regclass(format('public.%I', e.table_name)) is not null
           and has_table_privilege('authenticated', format('public.%I', e.table_name), 'SELECT'),
           format('authenticated must retain SELECT on %s', e.table_name)
    from expected_generation_relational_tables e
    union all
    select format('table public.%s -> authenticated', e.table_name),
           'table_mutation_none'::text,
           to_regclass(format('public.%I', e.table_name)) is not null
           and not has_table_privilege('authenticated', format('public.%I', e.table_name), 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
           format('authenticated must not mutate server-owned %s', e.table_name)
    from expected_generation_relational_tables e
    union all
    select format('table public.%s -> anon', e.table_name),
           'table_none'::text,
           to_regclass(format('public.%I', e.table_name)) is not null
           and not has_table_privilege('anon', format('public.%I', e.table_name), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
           format('anon must not access server-owned %s', e.table_name)
    from expected_generation_relational_tables e
    union all
    select format('table public.%s -> service_role', e.table_name),
           'table_runtime_dml'::text,
           to_regclass(format('public.%I', e.table_name)) is not null
           and has_table_privilege('service_role', format('public.%I', e.table_name), 'SELECT,INSERT,UPDATE,DELETE'),
           format('service_role must retain runtime DML on %s', e.table_name)
    from expected_generation_relational_tables e
    union all
    select format('table public.%s', e.table_name),
           'browser_modify_policies_none'::text,
           to_regclass(format('public.%I', e.table_name)) is not null
           and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=e.table_name and p.cmd <> 'SELECT'),
           format('%s must have no browser mutation policy', e.table_name)
    from expected_generation_relational_tables e
    union all
    select format('trigger public.%s.%s', e.table_name, e.trigger_name),
           'owner_immutable'::text,
           exists (select 1 from pg_trigger t where t.tgrelid=to_regclass(format('public.%I', e.table_name)) and t.tgname=e.trigger_name and not t.tgisinternal and t.tgenabled <> 'D'),
           format('%s ownership columns must be immutable', e.table_name)
    from expected_generation_relational_tables e
),
generation_relational_constraint_checks(signature, check_name, check_pass, detail) as (
    select format('constraint public.%s.%s', e.table_name, e.constraint_name),
           'validated_foreign_key'::text,
           exists (select 1 from pg_constraint c where c.conrelid=to_regclass(format('public.%I', e.table_name)) and c.conname=e.constraint_name and c.contype='f' and c.convalidated),
           format('%s must exist as a validated ownership foreign key', e.constraint_name)
    from expected_generation_relational_constraints e
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
forbidden_runtime_functions as (
    select *
    from (
        values
            ('public.reserve_generation_credits(uuid,text,text,integer,text,jsonb)'::text)
    ) as f(signature)
),
forbidden_function_checks(signature, check_name, check_pass, detail) as (
    select
        f.signature,
        'retired_runtime_function_absent'::text as check_name,
        (to_regprocedure(f.signature) is null) as check_pass,
        'retired aggregate-balance reservation RPC must not exist'::text as detail
    from forbidden_runtime_functions f
),
expected_variable_conflict_functions as (
    select *
    from (
        values
            ('public.grant_account_credits(uuid,integer,text,text,text,text,timestamptz,jsonb,uuid)'::text),
            ('public.debit_account_credits(uuid,integer,text,text,text,jsonb,uuid)'::text),
            ('public.get_credit_grant_summary(uuid)'::text),
            ('public.get_credit_grant_summaries(uuid[])'::text),
            ('public.expire_credit_grants(integer)'::text),
            ('public.admit_and_reserve_generation_credits(uuid,text,text,integer,text,jsonb,text,integer,text,integer,integer)'::text),
            ('public.release_generation_reservation_by_source_ref(uuid,text,text,jsonb)'::text),
            ('public.release_generation_reservation_by_provider_request(uuid,text,text,jsonb)'::text),
            ('public.release_generation_reservation_by_id(uuid,text,jsonb)'::text),
            ('public.capture_generation_reservation_by_provider_request(uuid,text,text,jsonb)'::text)
    ) as f(signature)
),
function_body_checks(signature, check_name, check_pass, detail) as (
    select
        f.signature,
        'variable_conflict_use_column'::text as check_name,
        case
            when to_regprocedure(f.signature) is null then false
            else position(
                '#variable_conflict use_column'
                in lower(pg_get_functiondef(to_regprocedure(f.signature)))
            ) > 0
        end as check_pass,
        'grant-lot credit/reservation RPCs must prefer column names to avoid PL/pgSQL ambiguity'::text as detail
    from expected_variable_conflict_functions f
),
all_checks as (
    select * from function_checks
    union all
    select * from function_search_path_checks
    union all
    select * from schema_checks
    union all
    select * from table_checks
    union all
    select * from browser_crash_table_checks
    union all
    select * from openai_capacity_table_checks
    union all
    select * from media_upload_intent_table_checks
    union all
    select * from generation_relational_table_checks
    union all
    select * from generation_relational_constraint_checks
    union all
    select * from sequence_checks
    union all
    select * from forbidden_function_checks
    union all
    select * from function_body_checks
)
select
    count(*)::integer as total_checks,
    count(*) filter (where check_pass)::integer as passing_checks,
    count(*) filter (where not check_pass)::integer as failing_checks
from all_checks;
