do $$
declare
  v_existing_job_id bigint;
begin
  for v_existing_job_id in
    select j.jobid
    from cron.job j
    where j.jobname = 'shortpulse_rollup_prune_app_error_events_daily'
  loop
    perform cron.unschedule(v_existing_job_id);
  end loop;
end;
$$;

drop function if exists public.rollup_and_prune_app_error_event_telemetry(
  timestamptz,
  interval,
  interval
);

drop table if exists public.app_error_event_telemetry_daily_rollups;
