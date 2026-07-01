-- Unschedule generation control-plane worker run retention.
--
-- Rollback only removes the future daily cleanup job. Rows deleted by an
-- already-executed retention job cannot be restored by rollback SQL.

do $$
declare
  v_existing_job_id bigint;
begin
  for v_existing_job_id in
    select j.jobid
    from cron.job j
    where j.jobname = 'shortpulse_prune_worker_runs_daily'
  loop
    perform cron.unschedule(v_existing_job_id);
  end loop;
end;
$$;

select
  jobid,
  jobname,
  schedule,
  active
from cron.job
where jobname = 'shortpulse_prune_worker_runs_daily';
