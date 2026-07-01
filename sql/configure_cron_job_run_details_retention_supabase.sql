-- Configure pg_cron run-history retention.
-- Read-write hosted-Supabase maintenance script: prunes old ended scheduler
-- run-detail rows, compacts the pruned table, and installs a daily retention
-- job so cron.job_run_details does not grow without bound.
--
-- Purpose:
--   Keep Supabase Cron diagnostics useful while preventing accumulated
--   cron.job_run_details history from becoming a recurring Disk I/O hotspot.
--
-- Safety:
--   - Does not touch application tables, auth users, media, billing rows, or
--     storage objects.
--   - Preserves the most recent 7 days of run details.
--   - Preserves rows without end_time so active/running jobs are not pruned.
--   - Requires a hosted Supabase SQL role allowed to delete and VACUUM FULL
--     the Supabase-managed cron.job_run_details table.
--   - Uses VACUUM FULL after the one-time prune, which briefly takes an
--     exclusive lock on cron.job_run_details so the reclaimed pages actually
--     reduce future sequential-scan I/O.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
--     -f sql/configure_cron_job_run_details_retention_supabase.sql

create extension if not exists pg_cron;

select
  'before_prune' as phase,
  count(*)::bigint as total_rows,
  count(*) filter (
    where end_time is not null
      and end_time < now() - interval '7 days'
  )::bigint as ended_rows_older_than_7d,
  pg_size_pretty(pg_total_relation_size('cron.job_run_details')) as total_size
from cron.job_run_details;

delete from cron.job_run_details
where end_time is not null
  and end_time < now() - interval '7 days';

vacuum (full, analyze) cron.job_run_details;

do $$
declare
  v_existing_job_id bigint;
  v_new_job_id bigint;
begin
  for v_existing_job_id in
    select j.jobid
    from cron.job j
    where j.jobname = 'shortpulse_prune_cron_job_run_details_daily'
  loop
    perform cron.unschedule(v_existing_job_id);
  end loop;

  select cron.schedule(
    'shortpulse_prune_cron_job_run_details_daily',
    '5 3 * * *',
    $cron$
      delete from cron.job_run_details
      where end_time is not null
        and end_time < now() - interval '7 days'
    $cron$
  )
    into v_new_job_id;

  raise notice 'Scheduled job shortpulse_prune_cron_job_run_details_daily with jobid=%',
    v_new_job_id;
end;
$$;

select
  'after_prune' as phase,
  count(*)::bigint as total_rows,
  count(*) filter (
    where end_time is not null
      and end_time < now() - interval '7 days'
  )::bigint as ended_rows_older_than_7d,
  pg_size_pretty(pg_total_relation_size('cron.job_run_details')) as total_size
from cron.job_run_details;

select
  jobid,
  jobname,
  schedule,
  command,
  active
from cron.job
where jobname = 'shortpulse_prune_cron_job_run_details_daily';

-- Post-apply proof:
--   1. Run sql/check_scheduler_egress_activity.sql.
--   2. Run sql/check_control_plane_scheduler_health.sql.
--   3. EXPLAIN pg_cron's active status update shape and confirm it no longer
--      reads an excessive number of cron.job_run_details pages:
--
--        explain
--        update cron.job_run_details
--        set status = 'failed', return_message = 'explain-only'
--        where status in ('starting', 'running');
--
--   4. Re-check pg_stat_statements after a meaningful window and confirm
--      cron.job_run_details maintenance is no longer the top shared-block
--      read offender.
--
-- Optional owner-only follow-up:
--   Hosted Supabase owns cron.job_run_details as supabase_admin. If retention
--   alone does not reduce the active-status update scan enough, run this only
--   from a role that owns the cron table:
--
--     create index concurrently if not exists job_run_details_active_status_idx
--       on cron.job_run_details (status)
--       where status in ('starting', 'running');
