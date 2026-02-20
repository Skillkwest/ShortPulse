-- Conversation-state hardening diagnostics for migration 028.
-- Purpose: machine-checkable verification for grants, constraints, definer posture,
-- and bounded retention behavior in upsert_ai_agent_conversation_state.
-- Safe to run repeatedly; wrapped in transaction and rolled back at end.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f sql/check_conversation_state_hardening_028.sql

begin;

create temporary table if not exists conversation_state_hardening_028_checks (
    check_name text primary key,
    passed boolean not null,
    detail text
) on commit drop;

truncate table conversation_state_hardening_028_checks;

create or replace function pg_temp.assert_check(
    p_check_name text,
    p_passed boolean,
    p_detail text default null
)
returns void
language plpgsql
as $$
begin
    insert into conversation_state_hardening_028_checks (check_name, passed, detail)
    values (p_check_name, p_passed, p_detail);
end;
$$;

-- Constraint and function hardening posture.
select pg_temp.assert_check(
    'conversation_id_length_constraint_validated',
    exists (
        select 1
          from pg_constraint c
         where c.conrelid = 'public.ai_agent_conversation_state'::regclass
           and c.conname = 'ai_agent_conversation_state_conversation_id_length_check'
           and c.convalidated
    ),
    'Expected validated check constraint ai_agent_conversation_state_conversation_id_length_check.'
);

select pg_temp.assert_check(
    'upsert_security_definer',
    coalesce((
        select p.prosecdef
          from pg_proc p
         where p.oid = 'public.upsert_ai_agent_conversation_state(uuid,text,text,interval,integer)'::regprocedure
    ), false),
    'upsert_ai_agent_conversation_state must be SECURITY DEFINER.'
);

select pg_temp.assert_check(
    'upsert_search_path_hardened',
    coalesce((
        select exists (
            select 1
              from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
             where cfg = 'search_path=public, pg_temp'
        )
          from pg_proc p
         where p.oid = 'public.upsert_ai_agent_conversation_state(uuid,text,text,interval,integer)'::regprocedure
    ), false),
    'upsert_ai_agent_conversation_state must set search_path=public, pg_temp.'
);

select pg_temp.assert_check(
    'prune_security_definer',
    coalesce((
        select p.prosecdef
          from pg_proc p
         where p.oid = 'public.prune_ai_agent_conversation_state_expired(integer)'::regprocedure
    ), false),
    'prune_ai_agent_conversation_state_expired must be SECURITY DEFINER.'
);

select pg_temp.assert_check(
    'prune_search_path_hardened',
    coalesce((
        select exists (
            select 1
              from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
             where cfg = 'search_path=public, pg_temp'
        )
          from pg_proc p
         where p.oid = 'public.prune_ai_agent_conversation_state_expired(integer)'::regprocedure
    ), false),
    'prune_ai_agent_conversation_state_expired must set search_path=public, pg_temp.'
);

-- Execute-grant posture.
select pg_temp.assert_check(
    'upsert_execute_service_role_granted',
    has_function_privilege(
        'service_role',
        'public.upsert_ai_agent_conversation_state(uuid,text,text,interval,integer)',
        'EXECUTE'
    ),
    'service_role must have EXECUTE on upsert_ai_agent_conversation_state.'
);

select pg_temp.assert_check(
    'upsert_execute_authenticated_revoked',
    not has_function_privilege(
        'authenticated',
        'public.upsert_ai_agent_conversation_state(uuid,text,text,interval,integer)',
        'EXECUTE'
    ),
    'authenticated must not have EXECUTE on upsert_ai_agent_conversation_state.'
);

select pg_temp.assert_check(
    'upsert_execute_public_revoked',
    not has_function_privilege(
        'public',
        'public.upsert_ai_agent_conversation_state(uuid,text,text,interval,integer)',
        'EXECUTE'
    ),
    'public must not have EXECUTE on upsert_ai_agent_conversation_state.'
);

select pg_temp.assert_check(
    'prune_execute_service_role_granted',
    has_function_privilege(
        'service_role',
        'public.prune_ai_agent_conversation_state_expired(integer)',
        'EXECUTE'
    ),
    'service_role must have EXECUTE on prune_ai_agent_conversation_state_expired.'
);

select pg_temp.assert_check(
    'prune_execute_authenticated_revoked',
    not has_function_privilege(
        'authenticated',
        'public.prune_ai_agent_conversation_state_expired(integer)',
        'EXECUTE'
    ),
    'authenticated must not have EXECUTE on prune_ai_agent_conversation_state_expired.'
);

select pg_temp.assert_check(
    'prune_execute_public_revoked',
    not has_function_privilege(
        'public',
        'public.prune_ai_agent_conversation_state_expired(integer)',
        'EXECUTE'
    ),
    'public must not have EXECUTE on prune_ai_agent_conversation_state_expired.'
);

select pg_temp.assert_check(
    'default_function_acl_no_public_execute',
    not exists (
        select 1
          from pg_default_acl d
          cross join unnest(coalesce(d.defaclacl, '{}'::aclitem[])) acl
         where d.defaclnamespace = 'public'::regnamespace
           and d.defaclobjtype = 'f'
           and acl::text ~ '^=[^/]*X[^/]*/'
    ),
    'Default function ACL in public schema should not grant EXECUTE to PUBLIC.'
);

-- Runtime behavior checks (all data mutations rolled back).
do $$
declare
    v_user_upper uuid := '11111111-1111-1111-1111-111111111111';
    v_user_lower uuid := '22222222-2222-2222-2222-222222222222';
    v_user_cap uuid := '33333333-3333-3333-3333-333333333333';
    v_user_tie uuid := '44444444-4444-4444-4444-444444444444';
    v_user_expire uuid := '55555555-5555-5555-5555-555555555555';
    v_user_prune uuid := '66666666-6666-6666-6666-666666666666';
    v_now timestamptz;
    v_row record;
    v_count integer;
    v_deleted integer;
    v_denied boolean;
begin
    perform set_config('request.jwt.claim.role', 'service_role', true);

    delete from public.ai_agent_conversation_state
     where user_id in (v_user_upper, v_user_lower, v_user_cap, v_user_tie, v_user_expire, v_user_prune);

    -- TTL upper clamp (90d) and cap upper clamp (200).
    v_now := clock_timestamp();
    select * into v_row
      from public.upsert_ai_agent_conversation_state(
          v_user_upper,
          'ttl-upper',
          'prompt',
          interval '365 days',
          5000
      );
    perform pg_temp.assert_check(
        'ttl_upper_clamped_to_90_days',
        v_row.expires_at between v_now + interval '89 days' and v_now + interval '91 days',
        'TTL should clamp to 90 days.'
    );

    -- TTL lower clamp (1d).
    v_now := clock_timestamp();
    select * into v_row
      from public.upsert_ai_agent_conversation_state(
          v_user_lower,
          'ttl-lower',
          'prompt',
          interval '1 hour',
          200
      );
    perform pg_temp.assert_check(
        'ttl_lower_clamped_to_1_day',
        v_row.expires_at between v_now + interval '23 hours' and v_now + interval '25 hours',
        'TTL should clamp to 1 day.'
    );

    -- conversation_id max-length guard.
    v_denied := false;
    begin
        perform public.upsert_ai_agent_conversation_state(
            v_user_upper,
            repeat('a', 192),
            'prompt',
            interval '30 days',
            200
        );
    exception when others then
        v_denied := position('length exceeds max of 191' in sqlerrm) > 0;
    end;
    perform pg_temp.assert_check(
        'conversation_id_length_guard_enforced',
        v_denied,
        'Expected >191 conversation_id to be rejected.'
    );

    -- cap lower clamp to 1 and keep-current-row behavior.
    perform public.upsert_ai_agent_conversation_state(v_user_cap, 'cap-old', 'prompt-a', interval '30 days', 200);
    perform public.upsert_ai_agent_conversation_state(v_user_cap, 'cap-new', 'prompt-b', interval '30 days', 0);
    select count(*) into v_count
      from public.ai_agent_conversation_state
     where user_id = v_user_cap;
    perform pg_temp.assert_check(
        'cap_lower_clamped_to_1_row',
        v_count = 1,
        'Expected clamped row-cap to retain exactly one row.'
    );
    perform pg_temp.assert_check(
        'keep_current_row_when_pruning',
        exists (
            select 1
              from public.ai_agent_conversation_state
             where user_id = v_user_cap
               and conversation_id = 'cap-new'
        ),
        'Current conversation row should remain after pruning.'
    );

    -- Deterministic tie-break pruning under identical updated_at values.
    insert into public.ai_agent_conversation_state (
        user_id,
        conversation_id,
        canonical_prompt,
        updated_at,
        expires_at,
        turn_count
    ) values
        (v_user_tie, 'tie-a', 'p', now() - interval '2 days', now() + interval '30 days', 1),
        (v_user_tie, 'tie-b', 'p', now() - interval '2 days', now() + interval '30 days', 1),
        (v_user_tie, 'tie-c', 'p', now() - interval '2 days', now() + interval '30 days', 1);

    perform public.upsert_ai_agent_conversation_state(v_user_tie, 'tie-current', 'p', interval '30 days', 3);

    perform pg_temp.assert_check(
        'deterministic_tie_break_prune',
        exists (
            select 1
              from public.ai_agent_conversation_state
             where user_id = v_user_tie
               and conversation_id = 'tie-b'
        ) and exists (
            select 1
              from public.ai_agent_conversation_state
             where user_id = v_user_tie
               and conversation_id = 'tie-c'
        ) and not exists (
            select 1
              from public.ai_agent_conversation_state
             where user_id = v_user_tie
               and conversation_id = 'tie-a'
        ),
        'Expected tie-a to be pruned first (conversation_id desc tie-break).'
    );

    -- Expired rows are pruned during write cycle.
    insert into public.ai_agent_conversation_state (
        user_id,
        conversation_id,
        canonical_prompt,
        updated_at,
        expires_at,
        turn_count
    ) values (
        v_user_expire,
        'expired-old',
        'old',
        now() - interval '5 days',
        now() - interval '1 day',
        1
    );
    perform public.upsert_ai_agent_conversation_state(
        v_user_expire,
        'expired-new',
        'new',
        interval '30 days',
        200
    );
    perform pg_temp.assert_check(
        'write_cycle_prunes_expired_rows',
        not exists (
            select 1
              from public.ai_agent_conversation_state
             where user_id = v_user_expire
               and conversation_id = 'expired-old'
        ),
        'Expired rows for user should be removed during upsert.'
    );

    -- Stale cleanup function removes expired rows and returns deleted count.
    insert into public.ai_agent_conversation_state (
        user_id,
        conversation_id,
        canonical_prompt,
        updated_at,
        expires_at,
        turn_count
    ) values
        (v_user_prune, 'prune-old-1', 'p', now() - interval '10 days', now() - interval '2 days', 1),
        (v_user_prune, 'prune-old-2', 'p', now() - interval '9 days', now() - interval '2 days', 1);

    select public.prune_ai_agent_conversation_state_expired(50000) into v_deleted;
    perform pg_temp.assert_check(
        'cleanup_function_deletes_expired_rows',
        v_deleted >= 2 and not exists (
            select 1
              from public.ai_agent_conversation_state
             where user_id = v_user_prune
               and conversation_id in ('prune-old-1', 'prune-old-2')
        ),
        'Cleanup function should delete expired rows and report deleted count.'
    );

    -- Non-service-role claim should be blocked.
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    v_denied := false;
    begin
        perform public.upsert_ai_agent_conversation_state(
            v_user_upper,
            'auth-denied',
            'prompt',
            interval '30 days',
            200
        );
    exception when others then
        v_denied := position('Only service_role can upsert conversation state' in sqlerrm) > 0;
    end;
    perform pg_temp.assert_check(
        'authenticated_claim_rejected',
        v_denied,
        'Expected authenticated claim to be blocked by service_role guard.'
    );
end;
$$;

select check_name, passed, detail
from conversation_state_hardening_028_checks
order by check_name;

do $$
begin
    if exists (
        select 1
          from conversation_state_hardening_028_checks
         where not passed
    ) then
        raise exception 'Conversation-state hardening validation failed.';
    end if;
end;
$$;

rollback;
