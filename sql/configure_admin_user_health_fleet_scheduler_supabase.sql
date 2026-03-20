-- Configure Supabase Cron for admin user-health fleet scans.
-- Current default schedule in this script is hourly.
-- Cadence contract authority:
-- docs/planning/generation-reliability-hardening-fleet-cadence-contract-2026-03-20.md
-- This is an environment-level ops script (not a schema migration).
--
-- Secrets expected in Supabase Vault after setup:
--   1) shortpulse_user_health_fleet_run_url
--      Example: https://<deployment-domain>/api/internal/admin-user-health-fleet/run
--   2) shortpulse_user_health_fleet_cron_secret
--      Example: same value as SHORTPULSE_USER_HEALTH_FLEET_CRON_SECRET
--
-- This script auto-provisions the two fleet Vault secrets using existing recovery
-- scheduler Vault secrets when available:
--   - shortpulse_recovery_run_url              (source URL)
--   - shortpulse_reconciler_cron_secret        (source secret)
--
-- URL derivation rule:
--   /api/internal/generation-recovery/run -> /api/internal/admin-user-health-fleet/run
--
-- If recovery secrets are missing, create fleet secrets manually first or run the
-- generation scheduler setup script (`sql/configure_generation_recovery_scheduler_supabase.sql`).

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

do $$
declare
  v_fleet_run_url_id uuid;
  v_fleet_secret_id uuid;
  v_fleet_run_url text;
  v_fleet_secret text;
  v_recovery_run_url text;
  v_recovery_secret text;
  v_target_run_url text;
  v_target_secret text;
begin
  select ds.id, ds.decrypted_secret
    into v_fleet_run_url_id, v_fleet_run_url
  from vault.decrypted_secrets ds
  where ds.name = 'shortpulse_user_health_fleet_run_url'
  order by ds.created_at desc
  limit 1;

  select ds.id, ds.decrypted_secret
    into v_fleet_secret_id, v_fleet_secret
  from vault.decrypted_secrets ds
  where ds.name = 'shortpulse_user_health_fleet_cron_secret'
  order by ds.created_at desc
  limit 1;

  select ds.decrypted_secret
    into v_recovery_run_url
  from vault.decrypted_secrets ds
  where ds.name = 'shortpulse_recovery_run_url'
  order by ds.created_at desc
  limit 1;

  select ds.decrypted_secret
    into v_recovery_secret
  from vault.decrypted_secrets ds
  where ds.name = 'shortpulse_reconciler_cron_secret'
  order by ds.created_at desc
  limit 1;

  v_target_run_url := nullif(trim(coalesce(v_fleet_run_url, '')), '');
  if v_target_run_url is null then
    if nullif(trim(coalesce(v_recovery_run_url, '')), '') is null then
      raise exception
        'Missing Vault seed URL. Set shortpulse_user_health_fleet_run_url directly, or set shortpulse_recovery_run_url first.';
    end if;
    v_target_run_url := regexp_replace(
      trim(v_recovery_run_url),
      '/api/internal/generation-recovery/run/?$',
      '/api/internal/admin-user-health-fleet/run'
    );
  end if;

  v_target_secret := coalesce(
    nullif(trim(coalesce(v_fleet_secret, '')), ''),
    nullif(trim(coalesce(v_recovery_secret, '')), '')
  );

  if v_target_secret is null then
    raise exception
      'Missing Vault seed secret. Set shortpulse_user_health_fleet_cron_secret directly, or set shortpulse_reconciler_cron_secret first.';
  end if;

  if v_fleet_run_url_id is null then
    perform vault.create_secret(
      v_target_run_url,
      'shortpulse_user_health_fleet_run_url',
      'ShortPulse admin user-health fleet endpoint URL'
    );
  else
    perform vault.update_secret(
      v_fleet_run_url_id,
      v_target_run_url,
      'shortpulse_user_health_fleet_run_url',
      'ShortPulse admin user-health fleet endpoint URL'
    );
  end if;

  if v_fleet_secret_id is null then
    perform vault.create_secret(
      v_target_secret,
      'shortpulse_user_health_fleet_cron_secret',
      'ShortPulse admin user-health fleet cron bearer secret'
    );
  else
    perform vault.update_secret(
      v_fleet_secret_id,
      v_target_secret,
      'shortpulse_user_health_fleet_cron_secret',
      'ShortPulse admin user-health fleet cron bearer secret'
    );
  end if;
end
$$;

create or replace function public.invoke_admin_user_health_fleet_scheduler()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run_url text;
  v_secret text;
  v_request_id bigint;
begin
  select s.decrypted_secret
    into v_run_url
  from vault.decrypted_secrets s
  where s.name = 'shortpulse_user_health_fleet_run_url'
  order by s.created_at desc
  limit 1;

  select s.decrypted_secret
    into v_secret
  from vault.decrypted_secrets s
  where s.name = 'shortpulse_user_health_fleet_cron_secret'
  order by s.created_at desc
  limit 1;

  if coalesce(trim(v_run_url), '') = '' then
    raise exception 'Missing Vault secret: shortpulse_user_health_fleet_run_url';
  end if;

  if coalesce(trim(v_secret), '') = '' then
    raise exception 'Missing Vault secret: shortpulse_user_health_fleet_cron_secret';
  end if;

  if v_run_url !~* '^https?://' then
    raise exception 'Invalid shortpulse_user_health_fleet_run_url (must be http/https URL).';
  end if;

  select net.http_post(
    url := trim(v_run_url),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', format('Bearer %s', trim(v_secret))
    ),
    body := '{}'::jsonb
  )
    into v_request_id;

  if v_request_id is null then
    raise exception 'Failed to enqueue HTTP request for user-health fleet scheduler.';
  end if;
end;
$$;

comment on function public.invoke_admin_user_health_fleet_scheduler()
is 'Supabase cron entrypoint for /api/internal/admin-user-health-fleet/run.';

revoke all on function public.invoke_admin_user_health_fleet_scheduler() from public;

do $$
declare
  v_existing_job_id bigint;
  v_new_job_id bigint;
begin
  -- Unschedule any legacy fleet jobs to avoid duplicates during cadence transition.
  for v_existing_job_id in
    select j.jobid
    from cron.job j
    where j.jobname in (
      'shortpulse_admin_user_health_fleet_daily',
      'shortpulse_admin_user_health_fleet_hourly'
    )
  loop
    perform cron.unschedule(v_existing_job_id);
  end loop;

  -- Hourly at minute 0 UTC.
  select cron.schedule(
    'shortpulse_admin_user_health_fleet_hourly',
    '0 * * * *',
    'select public.invoke_admin_user_health_fleet_scheduler();'
  )
    into v_new_job_id;

  raise notice 'Scheduled job shortpulse_admin_user_health_fleet_hourly with jobid=%', v_new_job_id;
end;
$$;

-- Verification queries:
-- select name, created_at
-- from vault.decrypted_secrets
-- where name in (
--   'shortpulse_user_health_fleet_run_url',
--   'shortpulse_user_health_fleet_cron_secret'
-- )
-- order by name, created_at desc;
--
-- select jobid, jobname, schedule, command, active
-- from cron.job
-- where jobname = 'shortpulse_admin_user_health_fleet_hourly';
--
-- select jobid, status, start_time, end_time, return_message
-- from cron.job_run_details
-- where jobid = (
--   select jobid from cron.job where jobname = 'shortpulse_admin_user_health_fleet_hourly'
-- )
-- order by start_time desc
-- limit 20;
--
-- Disable block (run manually when needed):
-- do $$
-- declare
--   v_job_id bigint;
-- begin
--   select jobid into v_job_id
--   from cron.job
--   where jobname in (
--     'shortpulse_admin_user_health_fleet_hourly',
--     'shortpulse_admin_user_health_fleet_daily'
--   )
--   limit 1;
--
--   if v_job_id is not null then
--     perform cron.unschedule(v_job_id);
--   end if;
-- end;
-- $$;
