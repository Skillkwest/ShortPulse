# Deployment Runbook

Purpose: provide a repeatable production deployment process for the Next.js + Supabase stack.

## Recommended platform

- Vercel (native support for Next.js pages router and API routes).

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

## Environment variables

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
  - `SUPABASE_DB_URL` (GitHub Environment secret for `staging` and `production`, used by `.github/workflows/media-storage-deploy-gate.yml`)
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
  - `OPENAI_DESCRIBE_ALLOWED_HOSTS` (optional hardening)
  - `OPENAI_DESCRIBE_REQUIRE_ALLOWED_HOSTS` (optional hardening)
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
  - `SHORTPULSE_FAL_RECONCILER_BATCH_SIZE`
  - `SHORTPULSE_FAL_RECONCILER_MAX_ATTEMPTS`
  - `SHORTPULSE_FAL_RECONCILER_MIN_AGE_SECONDS`
  - `SHORTPULSE_FAL_RECONCILER_LEASE_SECONDS`
  - `SHORTPULSE_FAL_CIRCUIT_BREAKER_ENABLED`
  - `SHORTPULSE_FAL_CIRCUIT_BREAKER_THRESHOLD_15M`
  - `SHORTPULSE_FAL_DIRECT_DEBIT_FALLBACK_ENABLED` (emergency only)

## Vercel setup

1. Import this repository into Vercel.
2. Set project root to `frontend/`.
3. Set build command: `npm run build`.
4. Set install command: `npm ci`.
5. Set output mode to Next.js default.
6. Add all required environment variables before first production deploy.

### Preview deployment throttle control (docs-only skip)

To reduce preview deployment churn and avoid quota/rate pressure during documentation-heavy work:

1. Keep `frontend/vercel.json` with `ignoreCommand`.
2. Keep `frontend/scripts/vercel-ignore-build.sh` executable.
3. Behavior:
   - `production` deployments always build (never skipped).
   - `preview` deployments are skipped when no files changed under `frontend/`.
4. Verification (from repo root):
   - `cd frontend && bash ./scripts/vercel-ignore-build.sh`

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
