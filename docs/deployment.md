# Deployment Runbook

Purpose: provide a repeatable production deployment process for the Next.js + Supabase stack.

## Recommended platform

- Vercel (native support for Next.js pages router and API routes).

## Canonical environment policy

Use these names as the only canonical GitHub Environment identifiers in active release/CI governance docs:

- `staging`
- `production`

Notes:
- Vercel scope labels such as `Production` and `Preview` are platform labels, not GitHub Environment names.
- Active docs should not introduce alternate GitHub Environment names such as `Production – short-pulse` or `Production – shortpulse`.
- Current active deploy posture in this repo: `preview` is the only authoritative deployed runtime and is treated as staging.
- `production` remains reserved for future cutover and should not be treated as an active source of truth until production credentials and release posture are explicitly introduced.
- Current protection posture is still open:
  - `staging`: no required reviewers, no deployment branch policy
  - `production`: no required reviewers, no deployment branch policy
- Planned production-readiness posture:
  - `production` must gain required reviewers and deployment branch restrictions before production-readiness signoff
  - `staging` remains the canonical pre-production environment and should retain environment-scoped secrets even if reviewer protection stays lighter than production

## Pre-deploy checklist

1. Run validation locally:
   ```bash
   cd frontend
   npm run validate
   npm run build
   ```
2. Confirm no secrets are committed (`frontend/.env.local` must stay untracked).
3. Run GitHub Actions workflow `Media Storage Deploy Gate` for the target environment (`staging`/`production`) and require `PASS` before deploy.
4. Confirm Supabase schema/policies are up to date for production.
5. Confirm Stripe webhook secret and admin allow-list values are prepared for production.
6. Confirm deployment/release notes still distinguish current environment protection state from planned production-readiness protection state.

## Environment variables

Vercel project settings are the canonical source of truth for deployed environments.

Rules:
- Use Vercel envs for deployed `development`, `preview`, and `production` behavior.
- Use `vercel env pull frontend/.env.local --environment development` to materialize local runtime values after the repo is linked.
- Do not treat `frontend/.env.local`, `.env.agent.local`, `/tmp` exports, or ad-hoc text snapshots as authoritative for deployed values.
- Keep tooling-only keys out of Vercel project envs. This includes staging probe helpers and Vercel operator tokens such as `SHORTPULSE_STAGING_BASE_URL`, `SHORTPULSE_STAGING_BEARER_TOKEN`, `SHORTPULSE_VERCEL_API_TOKEN`, `SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN`, `VERCEL_API_TOKEN`, and `VERCEL_AUTOMATION_BYPASS_TOKEN`.
- Environment-specific deploy keys such as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_BASE_URL`, and `SHORTPULSE_PUBLIC_API_BASE_URL` must not be stored as one shared Vercel record spanning `development`, `preview`, and `production`.

Set these in Vercel project settings (`Production` + `Preview` as applicable):

- Core:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `FAL_KEY`
- Admin / security:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SHORTPULSE_ADMIN_EMAILS`
- Billing:
  - `APP_BASE_URL`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_WEBHOOK_TOLERANCE_SECONDS` (optional override; default `300`)
- CI/CD deploy gate:
  - `SUPABASE_DB_URL` (GitHub Environment secret for `staging` and `production`, used by `.github/workflows/media-storage-deploy-gate.yml`, `.github/workflows/reliability-control-plane-diagnostics.yml`)
  - `SHORTPULSE_VERCEL_API_TOKEN` (required by `scripts/verify_deployment_route_parity.mjs`; fallback supports `VERCEL_API_TOKEN`)
- Optional agent/runtime toggles:
  - `NEXT_PUBLIC_ENABLE_STUDIO_AGENT`
  - `NEXT_PUBLIC_AGENT_V2`
  - `SHORTPULSE_RELEASE` (optional explicit release/build tag for incident logs)
  - `NEXT_PUBLIC_SHORTPULSE_RELEASE` (optional client bundle release tag for incident logs)
  - `STUDIO_AGENT_ENABLED`
  - `STUDIO_AGENT_SYSTEM`
  - `STUDIO_AGENT_THINKER`
  - `STUDIO_AGENT_FORMATTER`
  - `OPENAI_API_KEY`
  - `OPENAI_API_BASE`
  - `OPENAI_MODEL`
  - `OPENAI_VISION_MODEL`
  - `STUDIO_AGENT_THINKER_MODEL` (optional override; defaults to `OPENAI_MODEL`)
  - `STUDIO_AGENT_FORMATTER_MODEL` (optional override; defaults to thinker model)
  - `OPENAI_VISION_FALLBACK_MODEL`
  - `SHORTPULSE_OPENAI_RESPONSES_ENABLED` (optional; enables Responses API compatibility mode)
  - `SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED` (optional; defaults to `true`)
  - `OPENAI_DESCRIBE_ALLOWED_HOSTS` (comma-separated trusted hosts for describe-image external URL intake; non-allowlisted external hosts are blocked by default)
  - `SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS` (optional server-side trusted direct-preview hosts)
  - `SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS` (defaults to `false`)
  - `NEXT_PUBLIC_MEDIA_DIRECT_URL_ALLOWED_HOSTS` (optional client-side trusted direct-preview hosts; keep aligned with server value)
  - `NEXT_PUBLIC_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS` (defaults to `false`; keep aligned with server value)
  - `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED` (defaults to `true`; server-authoritative Media Library upload route gate)
  - `NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED` (defaults to `true`; client upload-controller migration gate)
  - `SHORTPULSE_MEDIA_LIST_API_ENABLED` (defaults to `true`; server-authoritative Media Library list route gate)
  - `NEXT_PUBLIC_MEDIA_LIST_API_ENABLED` (defaults to `true`; client list-controller migration gate)
  - `NEXT_PUBLIC_MEDIA_LIBRARY_VIRTUALIZATION_ENABLED` (defaults to `true`; route/modal virtualization gate)
  - `NEXT_PUBLIC_MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED` (defaults to `true`; route/modal autoplay budget gate)
  - `NEXT_PUBLIC_MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED` (defaults to `true`; route/modal sign-prefetch gate)
  - `SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED` (defaults to `false`; server half of dual-flag signed-transform policy)
  - `NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED` (defaults to `false`; client half of dual-flag signed-transform policy)
  - `OPENAI_PROMPT_SYSTEM`
  - `SHORTPULSE_FAL_INTEGRATION_MODE` (`legacy|shadow|on`)
  - `SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST` (comma-separated model IDs or prefixes like `fal-ai/bytedance/*`)
  - `SHORTPULSE_FAL_WEBHOOK_ENABLED`
  - `SHORTPULSE_FAL_WEBHOOK_VERIFY_MODE` (`dual|fal_only|hmac_only`)
  - `SHORTPULSE_FAL_WEBHOOK_JWKS_URL`
  - `SHORTPULSE_FAL_WEBHOOK_SECRET` (legacy dual-mode fallback only; target deprecation after cutover)
  - `SHORTPULSE_FAL_WEBHOOK_TOLERANCE_SECONDS`
  - `SHORTPULSE_PUBLIC_API_BASE_URL` (or `APP_BASE_URL` fallback) for Fal `fal_webhook` submit registration
  - `SHORTPULSE_FAL_RECONCILER_ENABLED`
  - `SHORTPULSE_FAL_RECONCILER_CRON_SECRET`
  - `CRON_SECRET` (optional manual invocation fallback; keep aligned with reconciler secret when used)
  - `SHORTPULSE_FAL_RECONCILER_BATCH_SIZE`
  - `SHORTPULSE_FAL_RECONCILER_MAX_ATTEMPTS`
  - `SHORTPULSE_FAL_RECONCILER_MIN_AGE_SECONDS`
  - `SHORTPULSE_FAL_RECONCILER_LEASE_SECONDS`
  - `SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED`
  - `SHORTPULSE_FAL_QUEUE_ENABLED`
  - `SHORTPULSE_FAL_QUEUE_MAX_PER_USER`
  - `SHORTPULSE_FAL_QUEUE_DISPATCH_BATCH_SIZE`
  - `SHORTPULSE_FAL_QUEUE_LEASE_SECONDS`
  - `SHORTPULSE_FAL_QUEUE_MAX_ATTEMPTS`
  - `SHORTPULSE_FAL_QUEUE_BASE_BACKOFF_SECONDS`
  - `SHORTPULSE_FAL_QUEUE_MAX_WAIT_SECONDS`
  - `SHORTPULSE_FAL_NO_MEDIA_EXHAUST_MIN_AGE_SECONDS`
  - `SHORTPULSE_FAL_RUNNING_EXHAUST_MIN_AGE_SECONDS`
  - `SHORTPULSE_FAL_RUNNING_HARD_TIMEOUT_SECONDS` (`0` disables hard-timeout failover)
  - `SHORTPULSE_FAL_TRUSTED_HOSTS` (optional comma-separated trusted Fal outbound hosts; defaults to Fal-owned hosts)
  - `SHORTPULSE_FAL_RESERVATION_CLEANUP_ENABLED`
  - `SHORTPULSE_FAL_RESERVATION_CLEANUP_MIN_AGE_SECONDS`
  - `SHORTPULSE_FAL_RESERVATION_CLEANUP_BATCH_SIZE`
  - `SHORTPULSE_FAL_CIRCUIT_BREAKER_ENABLED`
  - `SHORTPULSE_FAL_CIRCUIT_BREAKER_THRESHOLD_15M`
  - `SHORTPULSE_FAL_DIRECT_DEBIT_FALLBACK_ENABLED` (emergency only)

### Production Supabase credential wiring (required)

Set the following values in Vercel `Production` (only):
- `NEXT_PUBLIC_SUPABASE_URL=https://<production-project-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<production-client-key>`
- `SUPABASE_SERVICE_ROLE_KEY=<production-server-key>`

Keep Vercel `Preview` mapped to staging Supabase values.

GitHub Environment naming rule:
- use only `production` and `staging` for GitHub Environment secrets and workflow inputs
- do not create or document alternate production-environment labels in active governance surfaces

Set GitHub Environment secret `SUPABASE_DB_URL` for:
- `production` -> `postgresql://postgres:<password>@db.<production-project-ref>.supabase.co:5432/postgres?sslmode=require`
- `staging` -> staging database URL (unchanged)

Verification:
- `gh secret list --env production` includes `SUPABASE_DB_URL`.
- `gh secret list --env staging` includes `SUPABASE_DB_URL` and remains staging-scoped.
- `Media Storage Deploy Gate` runs cleanly for `target_environment=production`.

### Staging env parity check (recommended)

Before deploying from a staged env export file, validate required keys:

```bash
node scripts/check_vercel_env_file.mjs \
  --file /tmp/vercel_staging_env_YYYYMMDD_HHMMSS.txt \
  --profile phase04 \
  --environment preview
```

Notes:
- `core` profile validates baseline deploy keys.
- `phase04` adds queue/reconciler/read-only rollout keys used by current program phase.

### Live Vercel env contract parity (required)

Before deploy, alias cutover, or scheduler URL updates, validate live Vercel env state against the shared contract for the active deployed environment:

```bash
node scripts/check_vercel_env_contract.mjs
```

Current default behavior:
- audits `preview` only, because staging is the only active deployed environment in this repo today.
- keeps `production` checks available for future cutover work.

Optional production-inclusive audit:

```bash
node scripts/check_vercel_env_contract.mjs --environment preview --environment production
```

Optional branch-specific preview audit:

```bash
node scripts/check_vercel_env_contract.mjs --environment preview --git-branch <branch-name>
```

Behavior:
- Hard-fails when required deploy keys are missing in the audited environment(s).
- Hard-fails when local/tooling-only keys are stored in Vercel project envs.
- Hard-fails when environment-specific deploy keys are shared across `development`, `preview`, and `production`.
- When both `preview` and `production` are audited, hard-fails when they resolve the same values for the Supabase/base-URL keys that must remain environment-specific.
- Hard-fails when mirrored client/server rollout flags diverge.

### Deployment route parity gate (required)

Before any scheduler URL updates, manual drain/recovery operations, or post-deploy production checks, verify that the target alias/URL resolves to a deployment containing the required internal routes.

Default required routes:
- `/api/internal/admin-user-health-fleet/run`
- `/api/internal/generation-recovery/run`
- `/api/internal/media-derivatives/run`

Command examples:

```bash
node scripts/verify_deployment_route_parity.mjs \
  --base-url https://<staging-or-prod-alias> \
  --token <SHORTPULSE_VERCEL_API_TOKEN>
```

```bash
node scripts/verify_deployment_route_parity.mjs \
  --base-url https://<staging-or-prod-alias> \
  --required-route /api/internal/admin-user-health-fleet/run \
  --required-route /api/internal/generation-recovery/run \
  --required-route /api/internal/media-derivatives/run
```

Behavior:
- Hard-fails (non-zero exit) if any required route is missing from deployment build output.
- Prints resolved deployment URL and deployment creation timestamp to prevent alias/deployment drift mistakes.
- Supports env fallbacks:
  - base URL: `SHORTPULSE_STAGING_BASE_URL`, then `APP_BASE_URL`
  - token: `SHORTPULSE_VERCEL_API_TOKEN`, then `VERCEL_API_TOKEN`

## Vercel setup

1. Import this repository into Vercel.
2. Set project root to `frontend/`.
3. Set build command: `npm run build`.
4. Set install command: `npm ci`.
5. Set output mode to Next.js default.
6. Add all required environment variables before first production deploy.
7. Keep API routes on Node runtime for derivative processing (`sharp` is used by `/api/internal/media-derivatives/run`).

### Preview deployment throttle control (docs-only skip)

To reduce preview deployment churn and avoid quota/rate pressure during documentation-heavy work:

1. Keep `frontend/vercel.json` with `ignoreCommand`.
2. Keep `frontend/scripts/vercel-ignore-build.sh` executable.
3. Behavior:
   - `production` deployments always build (never skipped).
   - `preview` deployments are skipped when no files changed under `frontend/`.
4. Verification (from repo root):
   - `cd frontend && bash ./scripts/vercel-ignore-build.sh`

## Recovery scheduler (Supabase Cron)

Use Supabase Cron as the primary scheduler for generation queue dispatch + recovery.

Route-parity gate is mandatory before setting or updating `shortpulse_recovery_run_url` for any environment.

1. Set `SHORTPULSE_FAL_RECONCILER_ENABLED=true`.
2. Set `SHORTPULSE_FAL_RECONCILER_CRON_SECRET` in Vercel (`Production` and `Preview` as needed).
3. In Supabase Vault for each environment, create:
   - `shortpulse_recovery_run_url` = full endpoint URL (for example `https://<deployment-domain>/api/internal/generation-recovery/run`)
   - `shortpulse_reconciler_cron_secret` = same value as `SHORTPULSE_FAL_RECONCILER_CRON_SECRET`
   - optional when deployment protection is enabled: `shortpulse_vercel_protection_bypass_token` = Vercel protection bypass token
   - Use idempotent SQL to create-or-update (safe on reruns):
   ```sql
   do $$
   declare
     v_id uuid;
   begin
     select ds.id into v_id
     from vault.decrypted_secrets ds
     where ds.name = 'shortpulse_recovery_run_url'
     order by ds.created_at desc
     limit 1;

     if v_id is null then
       perform vault.create_secret(
         'https://<deployment-domain>/api/internal/generation-recovery/run',
         'shortpulse_recovery_run_url',
         'ShortPulse generation recovery endpoint URL'
       );
     else
       perform vault.update_secret(
         v_id,
         'https://<deployment-domain>/api/internal/generation-recovery/run',
         'shortpulse_recovery_run_url',
         'ShortPulse generation recovery endpoint URL'
       );
     end if;
   end
   $$;

   do $$
   declare
     v_id uuid;
   begin
     select ds.id into v_id
     from vault.decrypted_secrets ds
     where ds.name = 'shortpulse_reconciler_cron_secret'
     order by ds.created_at desc
     limit 1;

     if v_id is null then
       perform vault.create_secret(
         '<reconciler-secret>',
         'shortpulse_reconciler_cron_secret',
         'ShortPulse generation recovery cron bearer secret'
       );
     else
       perform vault.update_secret(
         v_id,
         '<reconciler-secret>',
         'shortpulse_reconciler_cron_secret',
         'ShortPulse generation recovery cron bearer secret'
       );
     end if;
   end
   $$;
   ```
4. Run `sql/configure_generation_recovery_scheduler_supabase.sql` in the target Supabase project.
5. Verify scheduler state:
   ```sql
   select jobid, jobname, schedule, command, active
   from cron.job
   where jobname = 'shortpulse_generation_recovery_every_minute';
   ```
6. Verify recent execution outcomes:
   ```sql
   select jobid, status, start_time, end_time, return_message
   from cron.job_run_details
   where jobid = (
     select jobid
     from cron.job
     where jobname = 'shortpulse_generation_recovery_every_minute'
   )
   order by start_time desc
   limit 20;
   ```
7. Run canonical control-plane diagnostics:
   - `sql/check_control_plane_scheduler_health.sql`
   - `sql/check_pg_net_failure_taxonomy.sql`

Notes:
- Vercel cron is not required for this route.
- `CRON_SECRET` remains optional for manual cURL/bearer invocation and non-Supabase fallback workflows.
- If scheduler target URL is Vercel-protected (`Authentication Required`), set Vault secret `shortpulse_vercel_protection_bypass_token`.

## Media derivative scheduler (Supabase Cron)

Use Supabase Cron for the Media Library image derivative worker route.

Route-parity gate is mandatory before setting or updating `shortpulse_media_derivatives_run_url` for any environment.

1. Set `SHORTPULSE_MEDIA_DERIVATIVES_ENABLED=true` and configure:
   - `SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET`
2. In Supabase Vault for each environment, create:
   - `shortpulse_media_derivatives_run_url` = full endpoint URL (for example `https://<deployment-domain>/api/internal/media-derivatives/run`)
   - `shortpulse_media_derivatives_cron_secret` = same value as `SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET`
   - optional when deployment protection is enabled: `shortpulse_vercel_protection_bypass_token` = Vercel protection bypass token
3. Run `sql/configure_media_derivative_scheduler_supabase.sql` in the target Supabase project.
4. Verify scheduler state:
   ```sql
   select jobid, jobname, schedule, command, active
   from cron.job
   where jobname = 'shortpulse_media_derivatives_every_minute';
   ```
5. Verify recent execution outcomes:
   ```sql
   select jobid, status, start_time, end_time, return_message
   from cron.job_run_details
   where jobid = (
     select jobid
     from cron.job
     where jobname = 'shortpulse_media_derivatives_every_minute'
   )
   order by start_time desc
   limit 20;
   ```
6. Run canonical control-plane diagnostics:
   - `sql/check_control_plane_scheduler_health.sql`
   - `sql/check_pg_net_failure_taxonomy.sql`
   - `sql/check_media_derivative_processing_backlog.sql`

Notes:
- Vercel Cron is not required for this route.
- Keep scheduler ownership in Supabase (`pg_cron` + Vault secrets) for consistency with the other internal operators.
- If scheduler target URL is Vercel-protected (`Authentication Required`), set Vault secret `shortpulse_vercel_protection_bypass_token`.
## Admin fleet scheduler (Supabase Cron)

Use Supabase Cron for the admin fleet-health scan route.
Current state: hourly cadence (implemented).  
Prior baseline: daily cadence (`0 4 * * *`) retained as rollback target.

1. Set `SHORTPULSE_USER_HEALTH_FLEET_ENABLED=true` and configure:
   - `SHORTPULSE_USER_HEALTH_FLEET_CRON_SECRET`
2. In Supabase Vault for each environment, create:
   - `shortpulse_user_health_fleet_run_url` = full endpoint URL (for example `https://<deployment-domain>/api/internal/admin-user-health-fleet/run`)
   - `shortpulse_user_health_fleet_cron_secret` = same value as `SHORTPULSE_USER_HEALTH_FLEET_CRON_SECRET`
   - optional when deployment protection is enabled: `shortpulse_vercel_protection_bypass_token` = Vercel protection bypass token
3. Run `sql/configure_admin_user_health_fleet_scheduler_supabase.sql` in the target Supabase project.
4. Verify scheduler state:
   ```sql
   select jobid, jobname, schedule, command, active
   from cron.job
   where jobname = 'shortpulse_admin_user_health_fleet_hourly';
   ```
5. Verify recent execution outcomes:
   ```sql
   select jobid, status, start_time, end_time, return_message
   from cron.job_run_details
   where jobid = (
     select jobid
     from cron.job
     where jobname = 'shortpulse_admin_user_health_fleet_hourly'
   )
   order by start_time desc
   limit 20;
   ```
6. Run canonical control-plane diagnostics:
   - `sql/check_control_plane_scheduler_health.sql`
   - `sql/check_pg_net_failure_taxonomy.sql`

Notes:
- Vercel Cron is not required for this route.
- Keep scheduler ownership in Supabase (`pg_cron` + Vault secrets) for consistency with generation-recovery operations.
- If scheduler target URL is Vercel-protected (`Authentication Required`), set Vault secret `shortpulse_vercel_protection_bypass_token`.
- Cadence contract authority:
  - current: `0 * * * *` (hourly),
  - rollback baseline: `0 4 * * *` (daily),
  - see `docs/planning/generation-reliability-hardening-fleet-cadence-contract-2026-03-20.md`.

### Methodical drain cycle (operations)

After enabling production reliability fixes, run a controlled all-user drain cycle:

```bash
node scripts/run_generation_drain_cycle.mjs \
  --base-url https://<deployment-domain> \
  --secret <SHORTPULSE_FAL_RECONCILER_CRON_SECRET> \
  --interval-ms 60000 \
  --max-runs 120 \
  --converged-runs 3 \
  --max-consecutive-errors 3
```

Then verify:
- `sql/check_generation_queue_blockers.sql`
- `sql/check_generation_settlement_integrity.sql`

Use `/api/admin/generation-recovery/replay` only for residual outlier IDs after the drain converges.

## Supabase production configuration

1. Keep RLS enabled on user-owned tables.
2. Keep `media_library` storage bucket private and scoped by `auth.uid()` folder policies.
3. Ensure billing tables are user-scoped and ledger underflow protections are active.
4. Apply schema updates with versioned migrations before deploying app code that depends on them.

## Database migration deployment process

1. Prepare SQL migration files under `sql/migrations/` (see `docs/database-migrations.md`).
2. Run migrations in staging and validate app flows.
3. Apply to production during a controlled deploy window.
4. Deploy app code after migration success is confirmed.

Guardrail:
- Do not use implicit local `supabase db push` for hosted promotion.
- Use environment-pinned SQL apply execution for staging/production.
- Do not use Docker-based local Supabase workflows (`supabase start/stop`, `supabase db reset --local`, `supabase db lint --local`, or direct `docker` commands) for hosted operations.
- For any production-targeted Supabase CLI one-off, require explicit `--project-ref <production-ref>`.

## Domain + TLS

1. Add custom domain in Vercel.
2. Update DNS records to Vercel targets.
3. Verify certificate provisioning and HTTPS redirect behavior.

## Rollback procedure

1. Re-deploy the previous successful Vercel deployment.
2. If a schema migration caused breakage, execute the matching rollback SQL (or manual corrective SQL) immediately.
3. Re-verify auth, AI Studio generation, media library, billing, and admin dashboards.
4. Capture an incident note in project docs before the next attempt.

## Post-deploy verification

1. Sign in/out and confirm protected-route redirects.
2. Submit one AI Studio generation and verify credit debit behavior.
3. Upload + rename + delete one media item in Media Library.
4. Verify `/api/admin/users` access for authorized admins only.
5. Trigger a known-safe client error event and verify it appears in admin incident logs.
