# Deployment Runbook

Purpose: provide a repeatable production deployment process for the Next.js + Supabase stack.

## Recommended platform

- Vercel (native support for Next.js pages router and API routes).

## Bundled media runtime contract

- Voice Changer video-to-audio extraction uses the vendored `ffmpeg-static` dependency inside
  `frontend/`.
- Do not rely on a host-provided `ffmpeg` binary or environment toggle for this lane.
- Local development and Vercel deployments are expected to use the same packaged extraction
  runtime after `frontend/npm install`.

## Canonical environment policy

Use these names as the only canonical GitHub Environment identifiers in active release/CI governance docs:

- `staging`
- `production`

Notes:
- Vercel scope labels such as `Production` and `Preview` are platform labels, not GitHub Environment names.
- Active docs should not introduce alternate GitHub Environment names such as `Production – short-pulse` or `Production – shortpulse`.
- Current active deploy posture in this repo:
  - `development` is the local `working-development` runtime and should resolve
    the dedicated working-development Supabase project
  - `preview` is the authoritative staging runtime
  - `production` is the live customer runtime on the dedicated production Supabase project
- Current branch-governance posture:
  - `production` is covered by active GitHub ruleset `Production` with required checks `frontend`, `security`, and `deadcode`
  - `staging-preview` is covered by active GitHub ruleset `Staging Preview` with required checks `Vercel` and `Supabase Preview`
- `staging` remains the canonical pre-production GitHub Environment and should retain environment-scoped secrets even if its required-check posture stays lighter than `production`

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
7. If production storage payloads are being migrated from staging, complete `docs/sops/sop_nuclo_supabase_storage_migration.md` before any production Vercel rewiring.

## Environment variables

Vercel project settings are the canonical source of truth for deployed environments.

Rules:
- Use Vercel envs for deployed `development`, `preview`, and `production` behavior.
- Use `vercel env pull frontend/.env.local --environment development` to materialize local runtime values after the repo is linked.
- Do not treat `frontend/.env.local`, `.env.agent.local`, `/tmp` exports, or ad-hoc text snapshots as authoritative for deployed values.
- Current active posture is the lean Fal direct-submit path. Do not add deprecated pre-provider queue env overrides such as `SHORTPULSE_FAL_QUEUE_ENABLED` back into active Vercel environments. Reconciler and admission settings should only govern accepted-job recovery and overload control.
- Keep tooling-only keys out of Vercel project envs. This includes staging probe helpers and Vercel operator tokens such as `SHORTPULSE_STAGING_BASE_URL`, `SHORTPULSE_STAGING_BEARER_TOKEN`, `SHORTPULSE_VERCEL_API_TOKEN`, `SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN`, `VERCEL_API_TOKEN`, and `VERCEL_AUTOMATION_BYPASS_TOKEN`.
- Environment-specific deploy keys such as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_BASE_URL`, and `SHORTPULSE_PUBLIC_API_BASE_URL` must not be stored as one shared Vercel record spanning `development`, `preview`, and `production`.

Set these in Vercel project settings (`Development`, `Preview`, and `Production`
as applicable):

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
  - `SHORTPULSE_VERCEL_API_TOKEN` (optional for `scripts/verify_deployment_route_parity.mjs`; when absent, the script now falls back to the authenticated `vercel` CLI session, and still accepts `VERCEL_API_TOKEN` as an alternate token source)
- Optional agent/runtime toggles:
  - `NEXT_PUBLIC_ENABLE_STUDIO_AGENT`
  - AI Studio legacy `sid` session persistence is retired; do not configure the old `NEXT_PUBLIC_AI_STUDIO_SESSION_*` or `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED` flags.
  - `SHORTPULSE_RELEASE` (optional explicit release/build tag for incident logs)
  - `NEXT_PUBLIC_SHORTPULSE_RELEASE` (optional client bundle release tag for incident logs)
  - `STUDIO_AGENT_ENABLED`
  - `STUDIO_AGENT_SYSTEM`
  - `STUDIO_AGENT_THINKER`
  - `STUDIO_AGENT_FORMATTER`
  - `OPENAI_API_KEY`
  - `KIE_API_KEY` or `SHORTPULSE_KIE_API_KEY` (only needed when Kie routes are enabled)
  - `OPENAI_API_BASE`
  - `OPENAI_MODEL`
  - `OPENAI_VISION_MODEL`
  - `STUDIO_AGENT_THINKER_MODEL` (optional override; defaults to `OPENAI_MODEL`)
  - `STUDIO_AGENT_FORMATTER_MODEL` (optional override; defaults to thinker model)
  - `OPENAI_VISION_FALLBACK_MODEL`
  - `SHORTPULSE_OPENAI_RESPONSES_ENABLED` (optional; enables Responses API compatibility mode)
  - `SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED` (optional; defaults to `true`)
  - `OPENAI_DESCRIBE_ALLOWED_HOSTS` (comma-separated trusted hosts for legacy or compatibility remote-image URL intake; non-allowlisted external hosts stay blocked by default)
  - `SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS` (optional server-side trusted direct-preview hosts; extends built-in trusted provider result hosts such as `tempfile.aiquickdraw.com`)
  - `SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS` (defaults to `false`)
  - `NEXT_PUBLIC_MEDIA_DIRECT_URL_ALLOWED_HOSTS` (optional client-side trusted direct-preview hosts; keep aligned with server value)
  - `NEXT_PUBLIC_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS` (defaults to `false`; keep aligned with server value)
  - `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED` (defaults to `true`; server-authoritative Media Library upload route gate)
  - `NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED` (defaults to `true`; client upload-controller migration gate)
  - Media Library route/modal/panel now ship with one canonical list runtime: `/api/media/list` plus the default virtualization, video-budget, sign-prefetch, and gesture behaviors.
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES` (comma-separated adaptive preview surfaces such as `reference-grid,quick-slot,media-library-grid,media-library-modal-grid,media-library-panel-grid,character-grid,detail-modal`)
  - `SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED` (defaults to `false`; server half of dual-flag signed-transform policy)
  - `NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED` (defaults to `false`; client half of dual-flag signed-transform policy)
  - AI Studio legacy `sid` session-persistence env flags are retired and should not be configured. `sid` remains runtime identity only, and durable restore authority now belongs to project workspace persistence.
  - `OPENAI_PROMPT_SYSTEM`
  - `SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST` (comma-separated model IDs or prefixes like `fal-ai/bytedance/*`)
  - `SHORTPULSE_PUBLIC_API_BASE_URL` (or `APP_BASE_URL` fallback) for Fal `fal_webhook` submit registration
  - `SHORTPULSE_FAL_RECONCILER_ENABLED`
  - `SHORTPULSE_FAL_RECONCILER_CRON_SECRET`
  - `CRON_SECRET` (optional manual invocation bearer secret; keep aligned with reconciler secret when used)
  - `SHORTPULSE_FAL_RECONCILER_BATCH_SIZE`
  - `SHORTPULSE_FAL_RECONCILER_MAX_ATTEMPTS`
  - `SHORTPULSE_FAL_RECONCILER_MIN_AGE_SECONDS`
  - `SHORTPULSE_FAL_RECONCILER_LEASE_SECONDS`
  - `SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED`
  - `SHORTPULSE_FAL_NO_MEDIA_EXHAUST_MIN_AGE_SECONDS`
  - `SHORTPULSE_FAL_RUNNING_EXHAUST_MIN_AGE_SECONDS`
  - `SHORTPULSE_FAL_RUNNING_HARD_TIMEOUT_SECONDS` (`0` disables hard-timeout failover)
  - `SHORTPULSE_FAL_TRUSTED_HOSTS` (optional comma-separated trusted Fal outbound hosts; defaults to Fal-owned hosts)
  - `SHORTPULSE_FAL_RESERVATION_CLEANUP_ENABLED`
  - `SHORTPULSE_FAL_RESERVATION_CLEANUP_MIN_AGE_SECONDS`
  - `SHORTPULSE_FAL_RESERVATION_CLEANUP_BATCH_SIZE`
  - `SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_ENABLED` (defaults to `false`; enables shared Fal-account admission alongside per-user caps)
  - `SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_GLOBAL_MAX` (defaults to `SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX`; shared-provider active-generation ceiling)

### Production Supabase credential wiring (required)

Set the following values in Vercel `Production` (only):
- `NEXT_PUBLIC_SUPABASE_URL=https://<production-project-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<production-client-key>`
- `SUPABASE_SERVICE_ROLE_KEY=<production-server-key>`

Keep Vercel `Preview` mapped to staging Supabase values.
Keep Vercel `Development` mapped to the dedicated `working-development`
Supabase project values.

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
- Use a profile aligned to the current live runtime contract rather than old queue/shadow rollout windows.

### Live Vercel env contract parity (required)

Before deploy, alias cutover, or scheduler URL updates, validate live Vercel env state against the shared contract for the active deployed environment:

```bash
node scripts/check_vercel_env_contract.mjs
```

Current default behavior:
- audits `development`, `preview`, and `production` by default so branch-to-environment drift is caught across the full 3-project ladder.
- still allows narrower targeted audits when a task only needs one environment.

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
- When both `development` and `preview` are audited, hard-fails when they resolve
  the same values for the Supabase/base-URL keys that must remain
  environment-specific.
- When both `preview` and `production` are audited, hard-fails when they resolve the same values for the Supabase/base-URL keys that must remain environment-specific.
- Hard-fails when mirrored client/server live runtime flags diverge.

### Deployment route parity gate (required)

Before any scheduler URL updates, manual drain/recovery operations, or post-deploy production checks, verify that the target alias/URL resolves to a deployment containing the required internal routes.

Default required routes:
- `/api/internal/admin-user-health-fleet/run`
- `/api/internal/generation-recovery/run`
- `/api/internal/media-derivatives/run`

Command examples:

```bash
node scripts/verify_deployment_route_parity.mjs \
  --base-url https://<staging-or-prod-alias>
```

```bash
node scripts/verify_deployment_route_parity.mjs \
  --base-url https://<staging-or-prod-alias> \
  --required-route /api/internal/admin-user-health-fleet/run \
  --required-route /api/internal/generation-recovery/run \
  --required-route /api/internal/media-derivatives/run
```

Optional token-auth override:

```bash
node scripts/verify_deployment_route_parity.mjs \
  --base-url https://<staging-or-prod-alias> \
  --token <SHORTPULSE_VERCEL_API_TOKEN>
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

Use Supabase Cron as the primary scheduler for accepted-job generation recovery.

Route-parity gate is mandatory before setting or updating `shortpulse_recovery_run_url` for any environment.

1. Set `SHORTPULSE_FAL_RECONCILER_ENABLED=true`.
2. Set `SHORTPULSE_FAL_RECONCILER_CRON_SECRET` in Vercel (`Production` and `Preview` as needed).
3. In Supabase Vault for each environment, create:
   - `shortpulse_recovery_run_url` = full endpoint URL (for example `https://<deployment-domain>/api/internal/generation-recovery/run`)
   - `shortpulse_reconciler_cron_secret` = same value as `SHORTPULSE_FAL_RECONCILER_CRON_SECRET`
   - optional when deployment protection is enabled: `shortpulse_vercel_protection_bypass_token` = Vercel protection bypass token
   - Preferred repeatable path: use `.github/workflows/apply-control-plane-ops-sql.yml` with `operation=configure_generation_recovery_cron_secret` to sync `SHORTPULSE_FAL_RECONCILER_CRON_SECRET` into Vault before applying the scheduler SQL.
   - If the target deployment is Vercel-protected, also use `operation=configure_bypass_secret` to sync `SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN` into Vault.
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
- If `sql/check_pg_net_failure_taxonomy.sql` shows recurring `401` responses while `sql/check_control_plane_scheduler_health.sql` shows the cron job itself succeeding, treat that as scheduler auth drift first: resync `shortpulse_reconciler_cron_secret` and, for preview/protected targets, `shortpulse_vercel_protection_bypass_token`.

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
7. Verify route + auth posture against the target deployment before declaring the derivative lane healthy:
   - Dummy secret returns `401`, not `404`:
     ```bash
     curl -i -X POST \
       -H "x-shortpulse-cron-secret: definitely-wrong" \
       https://<deployment-domain>/api/internal/media-derivatives/run
     ```
   - Real secret returns `200` with worker metrics:
     ```bash
     curl -i -X POST \
       -H "x-shortpulse-cron-secret: <real-secret>" \
       https://<deployment-domain>/api/internal/media-derivatives/run
     ```
   - `sql/check_media_derivative_processing_backlog.sql` shows no growing `pending` queue after scheduler replay/steady-state observation.

Notes:
- Vercel Cron is not required for this route.
- Keep scheduler ownership in Supabase (`pg_cron` + Vault secrets) for consistency with the other internal operators.
- If scheduler target URL is Vercel-protected (`Authentication Required`), set Vault secret `shortpulse_vercel_protection_bypass_token`.
- Treat `404` from the hosted derivative route as deployment-target drift or `SHORTPULSE_MEDIA_DERIVATIVES_ENABLED=false`, not as “scheduler missing.” The recurring incident pattern was: cron healthy, `pg_net` enqueue healthy, hosted worker disabled, backlog silently accumulated.
- Keep `shortpulse_media_derivatives_run_url` pointed at a deployment class that is intentionally maintained for derivative operations. Do not rely on a stale preview alias without re-running the route-parity and auth checks above.
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
