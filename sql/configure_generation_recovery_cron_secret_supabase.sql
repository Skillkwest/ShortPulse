-- Configure the generation recovery scheduler bearer secret in Supabase Vault.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" \
--     -v ON_ERROR_STOP=1 \
--     -v reconciler_cron_secret="<secret>" \
--     -f sql/configure_generation_recovery_cron_secret_supabase.sql
--
-- Secret target in Vault:
--   shortpulse_reconciler_cron_secret
--
-- Notes:
-- - This is an environment-level ops script, not a schema migration.
-- - Keep this secret aligned with Vercel env var SHORTPULSE_FAL_RECONCILER_CRON_SECRET.

create extension if not exists supabase_vault;

do $$
declare
  v_secret_id uuid;
  v_reconciler_cron_secret text := nullif(trim(:'reconciler_cron_secret'), '');
begin
  if v_reconciler_cron_secret is null then
    raise exception 'Missing required psql variable: reconciler_cron_secret';
  end if;

  select ds.id
    into v_secret_id
  from vault.decrypted_secrets ds
  where ds.name = 'shortpulse_reconciler_cron_secret'
  order by ds.created_at desc
  limit 1;

  if v_secret_id is null then
    perform vault.create_secret(
      v_reconciler_cron_secret,
      'shortpulse_reconciler_cron_secret',
      'ShortPulse generation recovery cron bearer secret'
    );
  else
    perform vault.update_secret(
      v_secret_id,
      v_reconciler_cron_secret,
      'shortpulse_reconciler_cron_secret',
      'ShortPulse generation recovery cron bearer secret'
    );
  end if;
end;
$$;

-- Verification query:
-- select name, created_at
-- from vault.decrypted_secrets
-- where name = 'shortpulse_reconciler_cron_secret'
-- order by created_at desc
-- limit 5;
