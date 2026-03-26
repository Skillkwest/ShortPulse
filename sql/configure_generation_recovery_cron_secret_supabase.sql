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

\set reconciler_cron_secret_value ''
select nullif(trim(:'reconciler_cron_secret'), '') as reconciler_cron_secret_value \gset

\if :{?reconciler_cron_secret_value}
\else
  \echo 'Missing required psql variable: reconciler_cron_secret'
  \quit 1
\endif

with existing_secret as (
  select ds.id
  from vault.decrypted_secrets ds
  where ds.name = 'shortpulse_reconciler_cron_secret'
  order by ds.created_at desc
  limit 1
)
select id as existing_secret_id
from existing_secret \gset

\if :{?existing_secret_id}
select vault.update_secret(
  :'existing_secret_id',
  :'reconciler_cron_secret_value',
  'shortpulse_reconciler_cron_secret',
  'ShortPulse generation recovery cron bearer secret'
);
\else
select vault.create_secret(
  :'reconciler_cron_secret_value',
  'shortpulse_reconciler_cron_secret',
  'ShortPulse generation recovery cron bearer secret'
);
\endif

-- Verification query:
-- select name, created_at
-- from vault.decrypted_secrets
-- where name = 'shortpulse_reconciler_cron_secret'
-- order by created_at desc
-- limit 5;
