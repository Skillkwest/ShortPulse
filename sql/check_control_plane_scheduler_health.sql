-- Control-plane scheduler health diagnostics (read-only)
--
-- Purpose:
-- 1) Verify pg_cron scheduler liveness.
-- 2) Verify required scheduler jobs exist, are active, and match expected schedules.
-- 3) Surface recent failure ratios and currently stalled runs.
--
-- Required extensions/tables:
-- - pg_cron extension (`cron.job`, `cron.job_run_details`)
--
-- Usage:
-- Run this script in Supabase SQL editor or via a SQL client with read access.

-- 1) Scheduler worker liveness (`false` means cron worker is missing/unhealthy).
select
  exists (
    select 1
    from pg_stat_activity
    where application_name ilike 'pg_cron scheduler%'
  ) as scheduler_alive;

-- 2) Required job registration and schedule posture.
with expected_jobs as (
  select *
  from (
    values
      ('shortpulse_generation_recovery_every_minute'::text, '* * * * *'::text, 600::integer),
      ('shortpulse_media_derivatives_every_minute'::text, '* * * * *'::text, 600::integer),
      ('shortpulse_admin_user_health_fleet_hourly'::text, '0 * * * *'::text, 3600::integer),
      ('shortpulse_internal_billing_renewals_hourly'::text, '15 * * * *'::text, 3600::integer),
      ('shortpulse_credit_expirations_hourly'::text, '35 * * * *'::text, 3600::integer),
      ('shortpulse_prune_cron_job_run_details_daily'::text, '5 3 * * *'::text, 3600::integer),
      ('shortpulse_prune_worker_runs_daily'::text, '15 3 * * *'::text, 3600::integer)
  ) as t(jobname, expected_schedule, max_runtime_seconds)
)
select
  e.jobname,
  e.expected_schedule,
  e.max_runtime_seconds,
  j.jobid,
  j.schedule as configured_schedule,
  coalesce(j.active, false) as active,
  case
    when j.jobid is null then 'missing'
    when coalesce(j.active, false) = false then 'inactive'
    when j.schedule is distinct from e.expected_schedule then 'schedule_mismatch'
    else 'ok'
  end as health_status
from expected_jobs e
left join cron.job j on j.jobname = e.jobname
order by e.jobname;

-- 3) Recent 6h run outcomes and failure-ratio breach signal.
with expected_jobs as (
  select *
  from (
    values
      ('shortpulse_generation_recovery_every_minute'::text, 3::integer),
      ('shortpulse_media_derivatives_every_minute'::text, 3::integer),
      ('shortpulse_admin_user_health_fleet_hourly'::text, 1::integer),
      ('shortpulse_internal_billing_renewals_hourly'::text, 1::integer),
      ('shortpulse_credit_expirations_hourly'::text, 1::integer),
      ('shortpulse_prune_cron_job_run_details_daily'::text, 0::integer),
      ('shortpulse_prune_worker_runs_daily'::text, 0::integer)
  ) as t(jobname, minimum_sample_runs)
),
runs as (
  select
    e.jobname,
    d.status,
    d.start_time
  from expected_jobs e
  left join cron.job j on j.jobname = e.jobname
  left join cron.job_run_details d
    on d.jobid = j.jobid
   and d.start_time > now() - interval '6 hours'
),
summary as (
  select
    jobname,
    count(*) filter (where start_time is not null) as total_runs_6h,
    count(*) filter (where status = 'succeeded') as succeeded_runs_6h,
    count(*) filter (where status = 'failed') as failed_runs_6h,
    count(*) filter (where status = 'running') as running_rows_6h
  from runs
  group by jobname
)
select
  e.jobname,
  s.total_runs_6h,
  s.succeeded_runs_6h,
  s.failed_runs_6h,
  s.running_rows_6h,
  case
    when coalesce(s.total_runs_6h, 0) = 0 then 0
    else round((s.failed_runs_6h::numeric / s.total_runs_6h::numeric) * 100, 2)
  end as failed_ratio_pct_6h,
  case
    when coalesce(s.total_runs_6h, 0) < e.minimum_sample_runs then false
    when coalesce(s.failed_runs_6h, 0) >= 2 then true
    when coalesce(s.total_runs_6h, 0) > 0
      and (s.failed_runs_6h::numeric / s.total_runs_6h::numeric) >= 0.5 then true
    else false
  end as failure_threshold_breached
from expected_jobs e
left join summary s on s.jobname = e.jobname
order by e.jobname;

-- 4) Stalled running runs beyond expected max runtime windows.
with expected_jobs as (
  select *
  from (
    values
      ('shortpulse_generation_recovery_every_minute'::text, 600::integer),
      ('shortpulse_media_derivatives_every_minute'::text, 600::integer),
      ('shortpulse_admin_user_health_fleet_hourly'::text, 3600::integer),
      ('shortpulse_internal_billing_renewals_hourly'::text, 3600::integer),
      ('shortpulse_credit_expirations_hourly'::text, 3600::integer),
      ('shortpulse_prune_cron_job_run_details_daily'::text, 3600::integer),
      ('shortpulse_prune_worker_runs_daily'::text, 3600::integer)
  ) as t(jobname, max_runtime_seconds)
)
select
  e.jobname,
  d.runid,
  d.start_time,
  now() - d.start_time as running_for,
  e.max_runtime_seconds
from expected_jobs e
join cron.job j on j.jobname = e.jobname
join cron.job_run_details d on d.jobid = j.jobid
where d.status = 'running'
  and d.end_time is null
  and now() - d.start_time > make_interval(secs => e.max_runtime_seconds)
order by d.start_time asc;

-- 5) Last run snapshot per required job (quick operator view).
with expected_jobs as (
  select *
  from (
    values
      ('shortpulse_generation_recovery_every_minute'::text),
      ('shortpulse_media_derivatives_every_minute'::text),
      ('shortpulse_admin_user_health_fleet_hourly'::text),
      ('shortpulse_internal_billing_renewals_hourly'::text),
      ('shortpulse_credit_expirations_hourly'::text),
      ('shortpulse_prune_cron_job_run_details_daily'::text),
      ('shortpulse_prune_worker_runs_daily'::text)
  ) as t(jobname)
),
latest as (
  select
    j.jobname,
    d.runid,
    d.status,
    d.start_time,
    d.end_time,
    d.return_message,
    row_number() over (partition by j.jobname order by d.start_time desc) as rn
  from expected_jobs e
  join cron.job j on j.jobname = e.jobname
  left join cron.job_run_details d on d.jobid = j.jobid
)
select
  jobname,
  runid,
  status,
  start_time,
  end_time,
  return_message
from latest
where rn = 1
order by jobname;

-- 6) Scheduler function contract parity (catches stale live SQL bodies).
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
      ),
      (
        'public.invoke_internal_billing_renewals_scheduler()'::text,
        'shortpulse_vercel_protection_bypass_token'::text,
        'x-vercel-protection-bypass'::text,
        'timeout_milliseconds := 60000'::text
      ),
      (
        'public.invoke_credit_expirations_scheduler()'::text,
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
select
  function_signature,
  (regproc is not null) as function_present,
  (function_definition like '%' || required_secret_snippet || '%') as has_required_secret_read,
  (function_definition like '%' || required_header_snippet || '%') as has_required_bypass_header,
  (function_definition like '%' || required_timeout_snippet || '%') as has_required_timeout,
  case
    when regproc is null then 'missing_function'
    when function_definition not like '%' || required_secret_snippet || '%'
      and function_definition not like '%' || required_header_snippet || '%'
      and function_definition not like '%' || required_timeout_snippet || '%'
      then 'missing_secret_header_and_timeout'
    when function_definition not like '%' || required_secret_snippet || '%'
      then 'missing_secret_read'
    when function_definition not like '%' || required_header_snippet || '%'
      then 'missing_bypass_header'
    when function_definition not like '%' || required_timeout_snippet || '%'
      then 'missing_timeout'
    else 'ok'
  end as contract_status
from definitions
order by function_signature;

-- 7) Credit expiration scheduler HTTP response proof (pg_net).
-- Cron success only proves the request was enqueued. This ties recent credit
-- expiration cron runs to pg_net response rows when the scheduler notice
-- exposes the request id, without printing URLs, headers, or response bodies.
with recent_credit_expiration_runs as (
  select
    d.runid,
    d.status as cron_status,
    d.start_time,
    d.end_time,
    substring(
      coalesce(d.return_message, '')
      from 'request_id=([0-9]+)'
    )::bigint as pg_net_request_id
  from cron.job j
  join cron.job_run_details d on d.jobid = j.jobid
  where j.jobname = 'shortpulse_credit_expirations_hourly'
    and d.start_time > now() - interval '6 hours'
  order by d.start_time desc
  limit 20
)
select
  r.runid,
  r.cron_status,
  r.start_time,
  r.end_time,
  r.pg_net_request_id,
  n.created as http_response_created_at,
  n.status_code as http_status_code,
  (coalesce(n.error_msg, '') <> '') as has_http_error,
  case
    when r.pg_net_request_id is null then 'missing_pg_net_request_id'
    when n.id is null then 'missing_pg_net_response'
    when n.status_code between 200 and 299 then 'ok'
    else 'http_failure'
  end as http_response_status
from recent_credit_expiration_runs r
left join net._http_response n on n.id = r.pg_net_request_id
order by r.start_time desc;
