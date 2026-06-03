-- Control-plane enforce gate checks.
--
-- Purpose:
-- Provide deterministic pass/fail checks for CI enforce mode.
--
-- Output:
-- 1) Detailed check rows: check_name | pass | detail
-- 2) Final single-row integer: failing_check_count
--
-- Implementation note:
-- Build checks once into a temp table, then emit both result sets.
-- This avoids duplicating a large CTE block while preserving output contract.
--
-- Pooler note:
-- Production hosted DB access commonly runs through the Supabase transaction
-- pooler, so the temp-table lifecycle must stay inside one explicit transaction.

begin;

drop table if exists control_plane_enforce_checks;

create temporary table control_plane_enforce_checks (
  check_name text not null,
  pass boolean not null,
  detail text not null
);

insert into control_plane_enforce_checks (check_name, pass, detail)
with scheduler as (
  select exists (
    select 1
    from pg_stat_activity
    where application_name ilike 'pg_cron scheduler%'
  ) as scheduler_alive
),
expected_jobs as (
  select *
  from (
    values
      ('shortpulse_generation_recovery_every_minute'::text, '* * * * *'::text, 3::integer, 600::integer),
      ('shortpulse_admin_user_health_fleet_hourly'::text, '0 * * * *'::text, 3::integer, 3600::integer)
  ) as t(jobname, expected_schedule, minimum_sample_runs, max_runtime_seconds)
),
job_health as (
  select
    e.jobname,
    e.expected_schedule,
    e.minimum_sample_runs,
    e.max_runtime_seconds,
    j.jobid,
    coalesce(j.active, false) as active,
    j.schedule as configured_schedule
  from expected_jobs e
  left join cron.job j on j.jobname = e.jobname
),
job_failures_6h as (
  select
    h.jobname,
    count(*) filter (where d.start_time is not null) as total_runs_6h,
    count(*) filter (where d.status = 'failed') as failed_runs_6h
  from job_health h
  left join cron.job_run_details d
    on d.jobid = h.jobid
   and d.start_time > now() - interval '6 hours'
  group by h.jobname
),
stalled_runs as (
  select count(*)::integer as stalled_count
  from job_health h
  join cron.job_run_details d on d.jobid = h.jobid
  where d.status = 'running'
    and d.end_time is null
    and now() - d.start_time > make_interval(secs => h.max_runtime_seconds)
),
runtime_sql as (
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
        ('public.create_agent_safety_policy_version(text,jsonb,text,text,uuid,text,boolean,text)'),
        ('public.activate_agent_safety_policy(text,text,uuid,text,boolean,text)'),
        ('public.rollback_agent_safety_policy(text,uuid,text,text,integer)')
    ) as f(signature)
  ),
  resolved as (
    select signature, to_regprocedure(signature) as regproc
    from expected_functions
  ),
  checks as (
    select (r.regproc is not null) as pass
    from resolved r

    union all

    select case
      when r.regproc is null then false
      else exists (select 1 from pg_proc p where p.oid = r.regproc and p.prosecdef is true)
    end as pass
    from resolved r

    union all

    select case
      when r.regproc is null then false
      else has_function_privilege('service_role', r.regproc, 'EXECUTE')
    end as pass
    from resolved r

    union all

    select case
      when r.regproc is null then false
      else not exists (
        select 1
        from pg_proc p
        join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl on true
        where p.oid = r.regproc
          and acl.grantee = 0
          and acl.privilege_type = 'EXECUTE'
      )
    end as pass
    from resolved r

    union all

    select case
      when r.regproc is null then false
      else not has_function_privilege('authenticated', r.regproc, 'EXECUTE')
    end as pass
    from resolved r

    union all

    select case
      when r.regproc is null then false
      else not has_function_privilege('anon', r.regproc, 'EXECUTE')
    end as pass
    from resolved r
  )
  select count(*) filter (where not pass)::integer as failing_checks
  from checks
),
settlement as (
  with released_success as (
    select
      r.user_id,
      r.provider_request_id,
      r.source_ref,
      lower(coalesce(r.metadata ->> 'release_finality', 'conditional')) as release_finality
    from public.ai_credit_reservations r
    join public.ai_generations g
      on g.user_id = r.user_id
     and g.request_id = r.provider_request_id
    where r.status = 'released'
      and g.status = 'success'
  ),
  non_waived as (
    select *
    from released_success
    where release_finality <> 'waived'
  ),
  missing_charge as (
    select count(*)::integer as missing_charge_count
    from non_waived n
    left join public.ai_credit_ledger l
      on l.user_id = n.user_id
     and l.source = 'generation_charge'
     and l.source_ref = n.source_ref
    where l.id is null
  ),
  duplicate_charge_keys as (
    select count(*)::integer as duplicate_count
    from (
      select l.user_id, l.source_ref
      from public.ai_credit_ledger l
      where l.source = 'generation_charge'
        and l.source_ref is not null
      group by l.user_id, l.source_ref
      having count(*) > 1
    ) dup
  )
  select
    (select missing_charge_count from missing_charge) as missing_charge_count,
    (select duplicate_count from duplicate_charge_keys) as duplicate_charge_key_count
),
unauthorized_recent as (
  select count(*)::integer as unauthorized_10m_count
  from net._http_response r
  where r.created > now() - interval '10 minutes'
    and r.status_code = 401
),
scheduler_function_contract as (
  with expected_contract as (
    select *
    from (
      values
        (
          'public.invoke_generation_recovery_scheduler()'::text,
          'shortpulse_vercel_protection_bypass_token'::text,
          'x-vercel-protection-bypass'::text,
          'timeout_milliseconds := 60000'::text
        ),
        (
          'public.invoke_media_derivative_scheduler()'::text,
          'shortpulse_vercel_protection_bypass_token'::text,
          'x-vercel-protection-bypass'::text,
          'timeout_milliseconds := 60000'::text
        ),
        (
          'public.invoke_admin_user_health_fleet_scheduler()'::text,
          'shortpulse_vercel_protection_bypass_token'::text,
          'x-vercel-protection-bypass'::text,
          'timeout_milliseconds := 60000'::text
        )
    ) as t(function_signature, required_secret_snippet, required_header_snippet, required_timeout_snippet)
  ),
  resolved as (
    select
      e.function_signature,
      e.required_secret_snippet,
      e.required_header_snippet,
      e.required_timeout_snippet,
      to_regprocedure(e.function_signature) as regproc
    from expected_contract e
  ),
  definitions as (
    select
      r.function_signature,
      r.required_secret_snippet,
      r.required_header_snippet,
      r.required_timeout_snippet,
      r.regproc,
      case
        when r.regproc is null then null
        else pg_get_functiondef(r.regproc)
      end as function_definition
    from resolved r
  )
  select count(*)::integer as failing_checks
  from definitions
  where regproc is null
     or function_definition not like '%' || required_secret_snippet || '%'
     or function_definition not like '%' || required_header_snippet || '%'
     or function_definition not like '%' || required_timeout_snippet || '%'
)
select
  'scheduler_alive'::text as check_name,
  (select scheduler_alive from scheduler) as pass,
  case
    when (select scheduler_alive from scheduler) then 'pg_cron scheduler present'
    else 'pg_cron scheduler missing'
  end as detail

union all

select
  'required_jobs_registered_active_schedule'::text,
  not exists (
    select 1
    from job_health h
    where h.jobid is null
       or h.active is false
       or h.configured_schedule is distinct from h.expected_schedule
  ) as pass,
  'all required scheduler jobs must exist, be active, and match expected schedule' as detail

union all

select
  'scheduler_failure_thresholds_6h'::text,
  not exists (
    select 1
    from job_failures_6h f
    join job_health h on h.jobname = f.jobname
    where f.total_runs_6h >= h.minimum_sample_runs
      and (
        f.failed_runs_6h >= 2
        or (
          f.total_runs_6h > 0
          and (f.failed_runs_6h::numeric / f.total_runs_6h::numeric) >= 0.5
        )
      )
  ) as pass,
  'no scheduler job may breach failure thresholds in last 6 hours' as detail

union all

select
  'no_stalled_scheduler_runs'::text,
  ((select stalled_count from stalled_runs) = 0) as pass,
  'no required scheduler run may be stalled beyond max runtime' as detail

union all

select
  'runtime_sql_security_audit'::text,
  ((select failing_checks from runtime_sql) = 0) as pass,
  'runtime SQL audit must report failing_checks = 0' as detail

union all

select
  'settlement_integrity'::text,
  (
    (select missing_charge_count from settlement) = 0
    and (select duplicate_charge_key_count from settlement) = 0
  ) as pass,
  'settlement integrity requires zero missing/duplicate generation charge keys' as detail

union all

select
  'no_recent_unauthorized_pg_net_401'::text,
  ((select unauthorized_10m_count from unauthorized_recent) = 0) as pass,
  'no HTTP 401 responses in net._http_response over the last 10 minutes' as detail

union all

select
  'scheduler_function_contract_parity'::text,
  ((select failing_checks from scheduler_function_contract) = 0) as pass,
  'scheduler functions must read bypass token secret, send x-vercel-protection-bypass, and set timeout_milliseconds := 60000' as detail;

select
  check_name,
  pass,
  detail
from pg_temp.control_plane_enforce_checks
order by check_name;

select count(*)::integer as failing_check_count
from control_plane_enforce_checks
where pass is false;

commit;
