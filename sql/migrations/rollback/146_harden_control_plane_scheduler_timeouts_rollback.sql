-- Roll back control-plane scheduler explicit timeout hardening.
-- Note: this restores the previous scheduler function bodies and leaves
-- agent-safety function grants as defined by prior canonical migrations.

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
    body := '{}'::jsonb
  )
    into v_request_id;

  if v_request_id is null then
    raise exception 'Failed to enqueue HTTP request for generation recovery scheduler.';
  end if;
end;
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
  v_vercel_protection_bypass_token text;
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

  select s.decrypted_secret
    into v_vercel_protection_bypass_token
  from vault.decrypted_secrets s
  where s.name = 'shortpulse_vercel_protection_bypass_token'
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
    raise exception 'Failed to enqueue HTTP request for user-health fleet scheduler.';
  end if;
end;
$$;
