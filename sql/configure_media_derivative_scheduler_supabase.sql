-- Configure Supabase Cron for Media Library image derivative processing.
-- Current default schedule in this script is every minute.
-- This is an environment-level ops script (not a schema migration).
--
-- Secrets expected in Supabase Vault after setup:
--   1) shortpulse_media_derivatives_run_url
--      Example: https://<deployment-domain>/api/internal/media-derivatives/run
--   2) shortpulse_media_derivatives_cron_secret
--      Example: same value as SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET
-- Optional:
--   3) shortpulse_vercel_protection_bypass_token
--      Used only when target deployment is protected by Vercel auth.
--
-- This script auto-provisions the two derivative Vault secrets using existing
-- recovery scheduler Vault secrets when available:
--   - shortpulse_recovery_run_url
--   - shortpulse_reconciler_cron_secret
--
-- URL derivation rule:
--   /api/internal/generation-recovery/run -> /api/internal/media-derivatives/run
--
-- If recovery secrets are missing, create derivative secrets manually first or
-- run the generation scheduler setup script (`sql/configure_generation_recovery_scheduler_supabase.sql`).

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

do $$
declare
  v_derivative_run_url_id uuid;
  v_derivative_secret_id uuid;
  v_derivative_run_url text;
  v_derivative_secret text;
  v_recovery_run_url text;
  v_recovery_secret text;
  v_target_run_url text;
  v_target_secret text;
begin
  select ds.id, ds.decrypted_secret
    into v_derivative_run_url_id, v_derivative_run_url
  from vault.decrypted_secrets ds
  where ds.name = 'shortpulse_media_derivatives_run_url'
  order by ds.created_at desc
  limit 1;

  select ds.id, ds.decrypted_secret
    into v_derivative_secret_id, v_derivative_secret
  from vault.decrypted_secrets ds
  where ds.name = 'shortpulse_media_derivatives_cron_secret'
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

  v_target_run_url := nullif(trim(coalesce(v_derivative_run_url, '')), '');
  if v_target_run_url is null then
    if nullif(trim(coalesce(v_recovery_run_url, '')), '') is null then
      raise exception
        'Missing Vault seed URL. Set shortpulse_media_derivatives_run_url directly, or set shortpulse_recovery_run_url first.';
    end if;
    v_target_run_url := regexp_replace(
      trim(v_recovery_run_url),
      '/api/internal/generation-recovery/run/?$',
      '/api/internal/media-derivatives/run'
    );
  end if;

  v_target_secret := coalesce(
    nullif(trim(coalesce(v_derivative_secret, '')), ''),
    nullif(trim(coalesce(v_recovery_secret, '')), '')
  );

  if v_target_secret is null then
    raise exception
      'Missing Vault seed secret. Set shortpulse_media_derivatives_cron_secret directly, or set shortpulse_reconciler_cron_secret first.';
  end if;

  if v_derivative_run_url_id is null then
    perform vault.create_secret(
      v_target_run_url,
      'shortpulse_media_derivatives_run_url',
      'ShortPulse media derivatives endpoint URL'
    );
  else
    perform vault.update_secret(
      v_derivative_run_url_id,
      v_target_run_url,
      'shortpulse_media_derivatives_run_url',
      'ShortPulse media derivatives endpoint URL'
    );
  end if;

  if v_derivative_secret_id is null then
    perform vault.create_secret(
      v_target_secret,
      'shortpulse_media_derivatives_cron_secret',
      'ShortPulse media derivatives cron bearer secret'
    );
  else
    perform vault.update_secret(
      v_derivative_secret_id,
      v_target_secret,
      'shortpulse_media_derivatives_cron_secret',
      'ShortPulse media derivatives cron bearer secret'
    );
  end if;
end
$$;

create or replace function public.invoke_media_derivative_scheduler()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run_url text;
  v_secret text;
  v_vercel_protection_bypass_token text;
  v_request_id bigint;
begin
  select s.decrypted_secret
    into v_run_url
  from vault.decrypted_secrets s
  where s.name = 'shortpulse_media_derivatives_run_url'
  order by s.created_at desc
  limit 1;

  select s.decrypted_secret
    into v_secret
  from vault.decrypted_secrets s
  where s.name = 'shortpulse_media_derivatives_cron_secret'
  order by s.created_at desc
  limit 1;

  select s.decrypted_secret
    into v_vercel_protection_bypass_token
  from vault.decrypted_secrets s
  where s.name = 'shortpulse_vercel_protection_bypass_token'
  order by s.created_at desc
  limit 1;

  if coalesce(trim(v_run_url), '') = '' then
    raise exception 'Missing Vault secret: shortpulse_media_derivatives_run_url';
  end if;

  if coalesce(trim(v_secret), '') = '' then
    raise exception 'Missing Vault secret: shortpulse_media_derivatives_cron_secret';
  end if;

  if v_run_url !~* '^https?://' then
    raise exception 'Invalid shortpulse_media_derivatives_run_url (must be http/https URL).';
  end if;

  select net.http_post(
    url := trim(v_run_url),
    headers := jsonb_strip_nulls(
      jsonb_build_object(
        'content-type', 'application/json',
        'authorization', format('Bearer %s', trim(v_secret)),
        'x-vercel-protection-bypass', nullif(trim(coalesce(v_vercel_protection_bypass_token, '')), '')
      )
    ),
    body := '{}'::jsonb
  )
    into v_request_id;

  if v_request_id is null then
    raise exception 'Failed to enqueue HTTP request for media derivative scheduler.';
  end if;
end;
$$;

comment on function public.invoke_media_derivative_scheduler()
is 'Supabase cron entrypoint for /api/internal/media-derivatives/run.';

revoke all on function public.invoke_media_derivative_scheduler() from public;

do $$
declare
  v_existing_job_id bigint;
  v_new_job_id bigint;
begin
  for v_existing_job_id in
    select j.jobid
    from cron.job j
    where j.jobname in (
      'shortpulse_media_derivatives_every_minute',
      'shortpulse_media_derivative_every_minute'
    )
  loop
    perform cron.unschedule(v_existing_job_id);
  end loop;

  select cron.schedule(
    'shortpulse_media_derivatives_every_minute',
    '* * * * *',
    'select public.invoke_media_derivative_scheduler();'
  )
    into v_new_job_id;

  raise notice 'Scheduled job shortpulse_media_derivatives_every_minute with jobid=%', v_new_job_id;
end;
$$;

-- Verification queries:
-- select name, created_at
-- from vault.decrypted_secrets
-- where name in (
--   'shortpulse_media_derivatives_run_url',
--   'shortpulse_media_derivatives_cron_secret'
-- )
-- order by name, created_at desc;
--
-- select jobid, jobname, schedule, command, active
-- from cron.job
-- where jobname = 'shortpulse_media_derivatives_every_minute';
--
-- select jobid, status, start_time, end_time, return_message
-- from cron.job_run_details
-- where jobid = (
--   select jobid from cron.job where jobname = 'shortpulse_media_derivatives_every_minute'
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
--     'shortpulse_media_derivatives_every_minute',
--     'shortpulse_media_derivative_every_minute'
--   )
--   limit 1;
--
--   if v_job_id is not null then
--     perform cron.unschedule(v_job_id);
--   end if;
-- end;
-- $$;
