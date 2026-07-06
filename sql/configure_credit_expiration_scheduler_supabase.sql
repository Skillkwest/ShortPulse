-- Configure Supabase Cron for subscription credit expiration.
-- Current default schedule is hourly at minute 35 UTC.
--
-- Secrets expected in Supabase Vault after setup:
--   1) shortpulse_credit_expirations_run_url
--      Example: https://<deployment-domain>/api/internal/credit-expirations/run
--   2) shortpulse_credit_expirations_cron_secret
--      Example: same value as SHORTPULSE_CREDIT_EXPIRATIONS_CRON_SECRET
-- Optional:
--   3) shortpulse_vercel_protection_bypass_token
--      Used only when target deployment is protected by Vercel auth.
--
-- This is an environment-level ops script, not a schema migration.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create or replace function public.invoke_credit_expirations_scheduler()
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
  where s.name = 'shortpulse_credit_expirations_run_url'
  order by s.created_at desc
  limit 1;

  select s.decrypted_secret
    into v_secret
  from vault.decrypted_secrets s
  where s.name = 'shortpulse_credit_expirations_cron_secret'
  order by s.created_at desc
  limit 1;

  select s.decrypted_secret
    into v_vercel_protection_bypass_token
  from vault.decrypted_secrets s
  where s.name = 'shortpulse_vercel_protection_bypass_token'
  order by s.created_at desc
  limit 1;

  if coalesce(trim(v_run_url), '') = '' then
    raise exception 'Missing Vault secret: shortpulse_credit_expirations_run_url';
  end if;

  if coalesce(trim(v_secret), '') = '' then
    raise exception 'Missing Vault secret: shortpulse_credit_expirations_cron_secret';
  end if;

  if v_run_url !~* '^https://' then
    raise exception
      'Invalid shortpulse_credit_expirations_run_url (must be an https URL).';
  end if;

  if position('/api/internal/credit-expirations/run' in trim(v_run_url)) = 0 then
    raise exception
      'Invalid shortpulse_credit_expirations_run_url (must target /api/internal/credit-expirations/run).';
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
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
    into v_request_id;

  if v_request_id is null then
    raise exception 'Failed to enqueue HTTP request for credit expiration scheduler.';
  end if;

  raise notice 'Credit expiration scheduler enqueued pg_net request_id=%', v_request_id;
end;
$$;

comment on function public.invoke_credit_expirations_scheduler()
is 'Supabase cron entrypoint for /api/internal/credit-expirations/run.';

revoke all on function public.invoke_credit_expirations_scheduler() from public;

do $$
declare
  v_existing_job_id bigint;
  v_new_job_id bigint;
begin
  for v_existing_job_id in
    select j.jobid
    from cron.job j
    where j.jobname = 'shortpulse_credit_expirations_hourly'
  loop
    perform cron.unschedule(v_existing_job_id);
  end loop;

  select cron.schedule(
    'shortpulse_credit_expirations_hourly',
    '35 * * * *',
    'select public.invoke_credit_expirations_scheduler();'
  )
    into v_new_job_id;

  raise notice 'Scheduled job shortpulse_credit_expirations_hourly with jobid=%', v_new_job_id;
end;
$$;
