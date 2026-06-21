-- Scheduler egress/activity profile.
-- Read-only diagnostic: no persistent schema or data changes.
--
-- Purpose:
--   Summarize ShortPulse Supabase Cron and pg_net activity so operator audits
--   can distinguish expected scheduler cadence from duplicated jobs or failing
--   HTTP retry patterns.
--
-- Notes:
--   - Does not print Vault values, URLs, headers, bodies, response content, user
--     ids, tokens, or secrets.
--   - Recent run windows are based on database server time.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
--     -f sql/check_scheduler_egress_activity.sql

select
    jobid,
    jobname,
    schedule,
    active
from cron.job
where jobname like 'shortpulse_%'
order by jobname;

with recent_runs as (
    select
        j.jobname,
        d.status,
        d.start_time,
        d.end_time
    from cron.job_run_details d
    join cron.job j
      on j.jobid = d.jobid
    where j.jobname like 'shortpulse_%'
      and d.start_time >= now() - interval '2 hours'
)
select
    jobname,
    status,
    count(*)::bigint as runs,
    min(start_time) as first_run,
    max(start_time) as last_run,
    round(avg(extract(epoch from (end_time - start_time)))::numeric, 3) as avg_seconds
from recent_runs
group by jobname, status
order by jobname, status;

with recent_responses as (
    select
        status_code,
        timed_out,
        case
            when coalesce(error_msg, '') = '' then 'none'
            else 'present'
        end as error_state,
        created
    from net._http_response
    where created >= now() - interval '2 hours'
)
select
    status_code,
    timed_out,
    error_state,
    count(*)::bigint as responses,
    min(created) as first_response,
    max(created) as last_response
from recent_responses
group by status_code, timed_out, error_state
order by responses desc, status_code asc nulls last;
