-- Runtime SQL security audit (read-only)
-- Purpose:
-- 1) Verify critical runtime RPCs exist.
-- 2) Verify critical runtime RPCs are SECURITY DEFINER.
-- 3) Verify execute grants are restricted to service_role.

with expected_functions as (
    select *
    from (
        values
            ('public.admin_update_app_error_status(uuid,uuid,text,text,uuid,text)'),
            ('public.reserve_generation_credits(uuid,text,text,integer,text,jsonb)'),
            ('public.mark_generation_reservation_submitted(uuid,text,text,jsonb)'),
            ('public.release_generation_reservation_by_source_ref(uuid,text,text,jsonb)'),
            ('public.release_generation_reservation_by_provider_request(uuid,text,text,jsonb)'),
            ('public.capture_generation_reservation_by_provider_request(uuid,text,text,jsonb)'),
            ('public.enqueue_generation_submit(uuid,text,text,text,text,text,integer,text,text,jsonb,integer,jsonb)'),
            ('public.claim_generation_submit_queue_batch(integer,integer,uuid)'),
            ('public.claim_generation_recovery_batch(integer,integer,integer,integer)'),
            ('public.admit_and_reserve_generation_credits(uuid,text,text,integer,text,jsonb,text,integer,text,integer,integer)'),
            ('public.release_stale_generation_reservations(integer,integer)'),
            ('public.upsert_ai_agent_conversation_state(uuid,text,text,interval,integer)'),
            ('public.prune_ai_agent_conversation_state_expired(integer)'),
            ('public.upsert_ai_studio_session_snapshot(uuid,uuid,jsonb,integer,text,interval,integer)'),
            ('public.get_ai_studio_session_snapshot(uuid,uuid)'),
            ('public.list_ai_studio_sessions(uuid,integer,timestamptz,uuid)'),
            ('public.prune_ai_studio_sessions_expired(integer)')
    ) as f(signature)
),
resolved as (
    select
        f.signature,
        to_regprocedure(f.signature) as regproc
    from expected_functions f
),
checks(signature, check_name, check_pass, detail) as (
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
)
select
    signature,
    check_name,
    check_pass as pass,
    detail
from checks
order by signature, check_name;

with expected_functions as (
    select *
    from (
        values
            ('public.admin_update_app_error_status(uuid,uuid,text,text,uuid,text)'),
            ('public.reserve_generation_credits(uuid,text,text,integer,text,jsonb)'),
            ('public.mark_generation_reservation_submitted(uuid,text,text,jsonb)'),
            ('public.release_generation_reservation_by_source_ref(uuid,text,text,jsonb)'),
            ('public.release_generation_reservation_by_provider_request(uuid,text,text,jsonb)'),
            ('public.capture_generation_reservation_by_provider_request(uuid,text,text,jsonb)'),
            ('public.enqueue_generation_submit(uuid,text,text,text,text,text,integer,text,text,jsonb,integer,jsonb)'),
            ('public.claim_generation_submit_queue_batch(integer,integer,uuid)'),
            ('public.claim_generation_recovery_batch(integer,integer,integer,integer)'),
            ('public.admit_and_reserve_generation_credits(uuid,text,text,integer,text,jsonb,text,integer,text,integer,integer)'),
            ('public.release_stale_generation_reservations(integer,integer)'),
            ('public.upsert_ai_agent_conversation_state(uuid,text,text,interval,integer)'),
            ('public.prune_ai_agent_conversation_state_expired(integer)'),
            ('public.upsert_ai_studio_session_snapshot(uuid,uuid,jsonb,integer,text,interval,integer)'),
            ('public.get_ai_studio_session_snapshot(uuid,uuid)'),
            ('public.list_ai_studio_sessions(uuid,integer,timestamptz,uuid)'),
            ('public.prune_ai_studio_sessions_expired(integer)')
    ) as f(signature)
),
resolved as (
    select
        f.signature,
        to_regprocedure(f.signature) as regproc
    from expected_functions f
),
checks(check_pass) as (
    select (r.regproc is not null) as check_pass from resolved r
    union all
    select
        case
            when r.regproc is null then false
            else exists (
                select 1
                from pg_proc p
                where p.oid = r.regproc
                  and p.prosecdef is true
            )
        end as check_pass
    from resolved r
    union all
    select
        case
            when r.regproc is null then false
            else has_function_privilege('service_role', r.regproc, 'EXECUTE')
        end as check_pass
    from resolved r
    union all
    select
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
        end as check_pass
    from resolved r
    union all
    select
        case
            when r.regproc is null then false
            else not has_function_privilege('authenticated', r.regproc, 'EXECUTE')
        end as check_pass
    from resolved r
    union all
    select
        case
            when r.regproc is null then false
            else not has_function_privilege('anon', r.regproc, 'EXECUTE')
        end as check_pass
    from resolved r
)
select
    count(*)::integer as total_checks,
    count(*) filter (where checks.check_pass)::integer as passing_checks,
    count(*) filter (where not checks.check_pass)::integer as failing_checks
from checks;
