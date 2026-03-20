-- Configure optional Vercel deployment-protection bypass token for Supabase scheduler routes.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" \
--     -v ON_ERROR_STOP=1 \
--     -v bypass_token="<token>" \
--     -f sql/configure_control_plane_scheduler_bypass_secret_supabase.sql
--
-- Secret target in Vault:
--   shortpulse_vercel_protection_bypass_token
--
-- Notes:
-- - This secret is optional and should be set only when scheduler target URLs are protected.
-- - Scheduler SQL functions consume this secret as `x-vercel-protection-bypass`.

create extension if not exists supabase_vault;

do $$
declare
  v_secret_id uuid;
  v_bypass_token text := nullif(trim(:'bypass_token'), '');
begin
  if v_bypass_token is null then
    raise exception 'Missing required psql variable: bypass_token';
  end if;

  select ds.id
    into v_secret_id
  from vault.decrypted_secrets ds
  where ds.name = 'shortpulse_vercel_protection_bypass_token'
  order by ds.created_at desc
  limit 1;

  if v_secret_id is null then
    perform vault.create_secret(
      v_bypass_token,
      'shortpulse_vercel_protection_bypass_token',
      'ShortPulse scheduler Vercel protection bypass token'
    );
  else
    perform vault.update_secret(
      v_secret_id,
      v_bypass_token,
      'shortpulse_vercel_protection_bypass_token',
      'ShortPulse scheduler Vercel protection bypass token'
    );
  end if;
end;
$$;

-- Verification query:
-- select name, created_at
-- from vault.decrypted_secrets
-- where name = 'shortpulse_vercel_protection_bypass_token'
-- order by created_at desc
-- limit 5;
