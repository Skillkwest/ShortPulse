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

\set bypass_token_value ''
select nullif(trim(:'bypass_token'), '') as bypass_token_value \gset

\if :{?bypass_token_value}
\else
  \echo 'Missing required psql variable: bypass_token'
  \quit 1
\endif

select
  coalesce((
    select ds.id::text
    from vault.decrypted_secrets ds
    where ds.name = 'shortpulse_vercel_protection_bypass_token'
    order by ds.created_at desc
    limit 1
  ), '') as existing_secret_id,
  exists(
    select 1
    from vault.decrypted_secrets ds
    where ds.name = 'shortpulse_vercel_protection_bypass_token'
  ) as has_existing_secret \gset

\if :has_existing_secret
select vault.update_secret(
  :'existing_secret_id',
  :'bypass_token_value',
  'shortpulse_vercel_protection_bypass_token',
  'ShortPulse scheduler Vercel protection bypass token'
);
\else
select vault.create_secret(
  :'bypass_token_value',
  'shortpulse_vercel_protection_bypass_token',
  'ShortPulse scheduler Vercel protection bypass token'
);
\endif

-- Verification query:
-- select name, created_at
-- from vault.decrypted_secrets
-- where name = 'shortpulse_vercel_protection_bypass_token'
-- order by created_at desc
-- limit 5;
