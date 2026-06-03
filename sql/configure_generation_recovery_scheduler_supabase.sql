-- Configure Supabase Cron for AI Studio queue/recovery scheduler.
-- This is an environment-level ops script (not a schema migration).
--
-- Secrets expected in Supabase Vault:
--   1) shortpulse_recovery_run_url
--      Example value: https://<deployment-domain>/api/internal/generation-recovery/run
--   2) shortpulse_reconciler_cron_secret
--      Example value: <same secret as SHORTPULSE_FAL_RECONCILER_CRON_SECRET>
-- Optional:
--   3) shortpulse_vercel_protection_bypass_token
--      Used only when target deployment is protected by Vercel auth.
--
-- Idempotent Vault setup (run separately with real values):
-- do $$
-- declare
--   v_id uuid;
-- begin
--   select ds.id into v_id
--   from vault.decrypted_secrets ds
--   where ds.name = 'shortpulse_recovery_run_url'
--   order by ds.created_at desc
--   limit 1;
--
--   if v_id is null then
--     perform vault.create_secret(
--       'https://<deployment-domain>/api/internal/generation-recovery/run',
--       'shortpulse_recovery_run_url',
--       'ShortPulse generation recovery endpoint URL'
--     );
--   else
--     perform vault.update_secret(
--       v_id,
--       'https://<deployment-domain>/api/internal/generation-recovery/run',
--       'shortpulse_recovery_run_url',
--       'ShortPulse generation recovery endpoint URL'
--     );
--   end if;
-- end
-- $$;
--
-- do $$
-- declare
--   v_id uuid;
-- begin
--   select ds.id into v_id
--   from vault.decrypted_secrets ds
--   where ds.name = 'shortpulse_reconciler_cron_secret'
--   order by ds.created_at desc
--   limit 1;
--
--   if v_id is null then
--     perform vault.create_secret(
--       '<reconciler-secret>',
--       'shortpulse_reconciler_cron_secret',
--       'ShortPulse generation recovery cron bearer secret'
--     );
--   else
--     perform vault.update_secret(
--       v_id,
--       '<reconciler-secret>',
--       'shortpulse_reconciler_cron_secret',
--       'ShortPulse generation recovery cron bearer secret'
--     );
--   end if;
-- end
-- $$;

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create or replace function public.invoke_generation_recovery_scheduler()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recovery_run_url text;
  v_reconciler_secret text;
  v_vercel_protection_bypass_token text;
  v_request_id bigint;
begin
  select s.decrypted_secret
    into v_recovery_run_url
  from vault.decrypted_secrets s
  where s.name = 'shortpulse_recovery_run_url'
  order by s.created_at desc
  limit 1;

  select s.decrypted_secret
    into v_reconciler_secret
  from vault.decrypted_secrets s
  where s.name = 'shortpulse_reconciler_cron_secret'
  order by s.created_at desc
  limit 1;

  select s.decrypted_secret
    into v_vercel_protection_bypass_token
  from vault.decrypted_secrets s
  where s.name = 'shortpulse_vercel_protection_bypass_token'
  order by s.created_at desc
  limit 1;

  if coalesce(trim(v_recovery_run_url), '') = '' then
    raise exception 'Missing Vault secret: shortpulse_recovery_run_url';
  end if;

  if coalesce(trim(v_reconciler_secret), '') = '' then
    raise exception 'Missing Vault secret: shortpulse_reconciler_cron_secret';
  end if;

  if v_recovery_run_url !~* '^https?://' then
    raise exception 'Invalid shortpulse_recovery_run_url (must be http/https URL).';
  end if;

  select net.http_post(
    url := trim(v_recovery_run_url),
    headers := jsonb_strip_nulls(
      jsonb_build_object(
        'content-type', 'application/json',
        'authorization', format('Bearer %s', trim(v_reconciler_secret)),
        'x-vercel-protection-bypass', nullif(trim(coalesce(v_vercel_protection_bypass_token, '')), '')
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
    into v_request_id;

  if v_request_id is null then
    raise exception 'Failed to enqueue HTTP request for generation recovery scheduler.';
  end if;
end;
$$;

comment on function public.invoke_generation_recovery_scheduler()
is 'Supabase cron entrypoint for /api/internal/generation-recovery/run. Reads URL + secret from Vault.';

revoke all on function public.invoke_generation_recovery_scheduler() from public;

do $$
declare
  v_existing_job_id bigint;
  v_new_job_id bigint;
begin
  select j.jobid
    into v_existing_job_id
  from cron.job j
  where j.jobname = 'shortpulse_generation_recovery_every_minute'
  limit 1;

  if v_existing_job_id is not null then
    perform cron.unschedule(v_existing_job_id);
  end if;

  select cron.schedule(
    'shortpulse_generation_recovery_every_minute',
    '* * * * *',
    'select public.invoke_generation_recovery_scheduler();'
  )
    into v_new_job_id;

  raise notice 'Scheduled job shortpulse_generation_recovery_every_minute with jobid=%', v_new_job_id;
end;
$$;

-- Verification queries:
-- select jobid, jobname, schedule, command, active
-- from cron.job
-- where jobname = 'shortpulse_generation_recovery_every_minute';
--
-- select jobid, status, start_time, end_time, return_message
-- from cron.job_run_details
-- where jobid = (
--   select jobid from cron.job where jobname = 'shortpulse_generation_recovery_every_minute'
-- )
-- order by start_time desc
-- limit 20;

-- Disable block (run manually when needed):
-- do $$
-- declare
--   v_job_id bigint;
-- begin
--   select jobid into v_job_id
--   from cron.job
--   where jobname = 'shortpulse_generation_recovery_every_minute'
--   limit 1;
--
--   if v_job_id is not null then
--     perform cron.unschedule(v_job_id);
--   end if;
-- end;
-- $$;
