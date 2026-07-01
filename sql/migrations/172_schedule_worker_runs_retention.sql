-- Schedule retention for the generation control-plane worker run ledger.
--
-- This installs future daily cleanup only. It intentionally does not delete
-- historical rows during migration apply, so one-time production cleanup can
-- remain an explicit operator decision with before/after proof.

create extension if not exists pg_cron;

do $$
declare
  v_existing_job_id bigint;
  v_new_job_id bigint;
begin
  for v_existing_job_id in
    select j.jobid
    from cron.job j
    where j.jobname = 'shortpulse_prune_worker_runs_daily'
  loop
    perform cron.unschedule(v_existing_job_id);
  end loop;

  select cron.schedule(
    'shortpulse_prune_worker_runs_daily',
    '15 3 * * *',
    $cron$
      delete from public.worker_runs
      where status = 'ok'
        and completed_at is not null
        and completed_at < now() - interval '30 days'
    $cron$
  )
    into v_new_job_id;

  raise notice 'Scheduled job shortpulse_prune_worker_runs_daily with jobid=%',
    v_new_job_id;
end;
$$;

select
  jobid,
  jobname,
  schedule,
  active
from cron.job
where jobname = 'shortpulse_prune_worker_runs_daily';
