# SOP: Admin User Health Fleet Staging Walkthrough (Simple)

Purpose: provide a plain-language, click-by-click setup for enabling hourly fleet health scans in the staging environment.

## Who this is for
- Operators who are not sure where each value lives.
- Anyone configuring Supabase Cron + Vault for `/api/internal/admin-user-health-fleet/run`.

## What you are configuring (simple map)
- `Staging Vercel`:
  - hosts the API route URL.
  - stores route runtime env vars (`SHORTPULSE_USER_HEALTH_FLEET_*`).
- `Staging Supabase`:
  - stores Vault secrets used by Supabase Cron.
  - runs the cron job that calls the Vercel URL hourly.

Never mix environments. Staging Supabase must call staging Vercel.

## Before you start
- Confirm migration `067_add_admin_user_health_fleet_automation.sql` is already applied in staging.
- Confirm you can open:
  - Staging Vercel project settings.
  - Staging Supabase SQL Editor.

## Step 1: Get the two real values
You need exactly two values.

1. `Fleet run URL`
   - Format:
     - `https://<staging-domain>/api/internal/admin-user-health-fleet/run`
   - Example:
     - `https://shortpulse-git-staging-preview-kirk-artmans-projects.vercel.app/api/internal/admin-user-health-fleet/run`
   - Use the staging deployment host, not an unrelated app page.

2. `Fleet cron secret`
   - Use a real secret from staging Vercel:
     - `SHORTPULSE_USER_HEALTH_FLEET_CRON_SECRET` (preferred)
     - or fallback `CRON_SECRET` if you intentionally use one shared secret.
   - Do not leave placeholder text (for example `REPLACE_WITH_...`).

## Step 2: Configure staging Vercel env vars
In Vercel -> Project -> Settings -> Environment Variables (staging/preview scope):

1. Set:
   - `SHORTPULSE_USER_HEALTH_FLEET_ENABLED=true`
2. Set:
   - `SHORTPULSE_USER_HEALTH_FLEET_CRON_SECRET=<your real secret>`
3. Optional runtime controls:
   - `SHORTPULSE_USER_HEALTH_FLEET_LOOKBACK_DAYS=30`
   - `SHORTPULSE_USER_HEALTH_FLEET_ACTIVE_WINDOW_DAYS=30`
   - `SHORTPULSE_USER_HEALTH_FLEET_RETENTION_DAYS=90`
   - `SHORTPULSE_USER_HEALTH_FLEET_MAX_USERS_PER_RUN=1000`
   - `SHORTPULSE_USER_HEALTH_FLEET_PAGE_SIZE=100`
   - `SHORTPULSE_USER_HEALTH_FLEET_TIME_BUDGET_MS=300000`

If you changed env vars, redeploy staging so route runtime sees the new values.

## Step 3: Configure staging Supabase Vault secrets
Open Supabase SQL Editor for staging and run this block.

Replace only:
- `<REAL_FLEET_URL>`
- `<REAL_FLEET_CRON_SECRET>`

```sql
do $$
declare
  v_run_id uuid;
  v_secret_id uuid;
begin
  select id into v_run_id
  from vault.decrypted_secrets
  where name = 'shortpulse_user_health_fleet_run_url'
  order by created_at desc
  limit 1;

  if v_run_id is null then
    perform vault.create_secret(
      '<REAL_FLEET_URL>',
      'shortpulse_user_health_fleet_run_url',
      'ShortPulse admin user-health fleet endpoint URL'
    );
  else
    perform vault.update_secret(
      v_run_id,
      '<REAL_FLEET_URL>',
      'shortpulse_user_health_fleet_run_url',
      'ShortPulse admin user-health fleet endpoint URL'
    );
  end if;

  select id into v_secret_id
  from vault.decrypted_secrets
  where name = 'shortpulse_user_health_fleet_cron_secret'
  order by created_at desc
  limit 1;

  if v_secret_id is null then
    perform vault.create_secret(
      '<REAL_FLEET_CRON_SECRET>',
      'shortpulse_user_health_fleet_cron_secret',
      'ShortPulse admin user-health fleet cron bearer secret'
    );
  else
    perform vault.update_secret(
      v_secret_id,
      '<REAL_FLEET_CRON_SECRET>',
      'shortpulse_user_health_fleet_cron_secret',
      'ShortPulse admin user-health fleet cron bearer secret'
    );
  end if;
end $$;
```

## Step 4: Ensure URL is reachable by Supabase
Supabase must reach the URL without interactive login walls.

If your URL shows a Vercel protection page (`Authentication Required`), cron cannot reach it.

Fix options:
1. Use an unprotected staging alias/domain for cron.
2. Or set a Vault bypass secret used by scheduler functions:
   - `shortpulse_vercel_protection_bypass_token`
   - value must match Vercel deployment-protection bypass token.
3. Or adjust Vercel protection so this route is reachable non-interactively.

## Step 5: Trigger one manual scheduler dispatch
In staging Supabase SQL Editor:

```sql
select public.invoke_admin_user_health_fleet_scheduler();
```

Expected: success (void return).

## Step 6: Verify HTTP dispatch result
```sql
select id, status_code, error_msg, created
from net._http_response
order by created desc
limit 20;
```

Interpretation:
- `status_code = 200`: route reached and accepted.
- `status_code = 401`: secret mismatch or edge auth/protection block.
- `status_code = 404`: route missing or feature gate disabled.
- network/timeout errors: URL unreachable.

## Step 7: Verify fleet run persisted
```sql
select id, status, trigger_source, started_at, finished_at
from public.admin_user_health_scan_runs
order by started_at desc
limit 20;
```

Success criteria:
- A new row appears after scheduler dispatch.
- `status` is usually `completed` or `partial`.

## Step 8: Verify cron job exists and is active
```sql
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'shortpulse_admin_user_health_fleet_hourly';
```

Expected:
- `active = true`
- `schedule = '0 * * * *'` (hourly at minute 0 UTC).

## Step 9: Verify cron history after scheduled tick
```sql
select jobid, status, start_time, end_time, return_message
from cron.job_run_details
where jobid = (
  select jobid from cron.job
  where jobname = 'shortpulse_admin_user_health_fleet_hourly'
)
order by start_time desc
limit 20;
```

Note:
- `job_run_details` can be empty until first scheduled execution.

## Quick troubleshooting
- Symptom: no new rows in `admin_user_health_scan_runs`.
  - Check `net._http_response` for 401/404/timeout.
- Symptom: 401 in `net._http_response`.
  - Verify Vault secret equals Vercel secret exactly.
  - If deployment protection is enabled, verify Vault includes `shortpulse_vercel_protection_bypass_token`.
  - Verify no Vercel protection page is blocking route access.
- Symptom: 404 in `net._http_response`.
  - Verify route exists in deployed build and `SHORTPULSE_USER_HEALTH_FLEET_ENABLED=true`.

## Security note
- If secrets are posted in chat/screenshots, rotate them immediately:
  - Supabase DB/password or service credentials.
  - Vercel cron secrets.
  - Any copied GitHub Actions secrets.
