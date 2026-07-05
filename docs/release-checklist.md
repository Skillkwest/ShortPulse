# Release Checklist

Use this checklist before promoting code toward `production` (and before any deploy/release process you adopt).

`npm -C frontend run validate` is only a local source-validation checkpoint.
Do not treat it as release confidence by itself; combine the relevant checks
below with current launch authority and production evidence for release or
launch-readiness claims.

## Engineering checks

- `npm -C frontend run lint`
- `npm -C frontend run test`
- `npm -C frontend run type-check`
- `npm -C frontend run build`
- `npm -C frontend run docs:check`
- `npm -C frontend run deadcode:check`
- When a PR touches CI/release governance surfaces in Lane F, preserve the documented workflow concurrency/trigger posture in `docs/planning/ci-policy-checks.md`
- When a PR touches frontend CI split surfaces, preserve `frontend` as the compatibility aggregator until required-check mapping is deliberately migrated in the same governance lane
- When a PR touches environment/release-governance surfaces in Lane F, preserve canonical GitHub Environment names (`staging`, `production`) and keep current-vs-planned protection posture explicit in `docs/deployment.md`
- When closing or converging Lane F governance, run `npm -C frontend run validate:lane-f-governance`
- When a PR touches Lane D runtime-safety seams, run `npm -C frontend run validate:lane-d-runtime`
- When that Lane D PR also touches adaptive/reference-grid/canvas protected surfaces, also run `npm -C frontend run test:adaptive-media-runtime`
- No secrets added/changed (`.env*` stays uncommitted; only `.env.example` changes are acceptable)
- Optional (post-format-baseline): `npm -C frontend run format:check`
- Optional dead-code audit report (non-blocking): `npm -C frontend run deadcode:check:full`

## Manual product smoke

- Auth: sign in/out works; protected routes redirect to `/log-in` when unauthenticated
- Auth public signup gate: for account-first signup launch, `sql/migrations/164_add_paid_signup_intent_gate.sql`, `sql/migrations/165_account_first_signup_intent_gate.sql`, `sql/migrations/166_grant_signup_hook_schema_usage.sql`, and `sql/migrations/167_add_google_ip_signup_intent.sql` are applied, Supabase Auth's Before User Created hook calls `public.hook_shortpulse_signup_intent(event jsonb)`, Supabase Auth public signup is enabled only after hook proof, and `NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED` is unset or set to `true` in production. Set it to `false` only for an emergency app-level signup close.
- Suspicious accounts: any unknown non-Stripe Auth users found before launch have a redacted `auth:audit-non-stripe-accounts` footprint classification before deletion or retention.
- Auth non-production dry run: if one is used, `/api/auth/callback-url?flow=recovery&next=%2Fdashboard` resolves to the one exact allowlisted dry-run host, and fresh signup/reset/email-change emails use that same host under [`docs/sops/sop_auth_recovery_trust_smoke.md`](./sops/sop_auth_recovery_trust_smoke.md)
- Auth email callbacks: `/api/auth/callback-url?flow=recovery&next=%2Fdashboard` resolves to `https://www.shortpulse.ai/auth/callback?...` in production, reset/email-change emails use the `https://www.shortpulse.ai` host, and signup-confirmation email smoke runs only when public signup is intentionally opened for account-first launch verification under [`docs/sops/sop_auth_recovery_trust_smoke.md`](./sops/sop_auth_recovery_trust_smoke.md)
- Auth SMTP: Supabase custom SMTP is enabled, the sender identity is correct for the active environment, and the project-wide auth-email rate limit is raised above the default custom-SMTP baseline before public launch
- Auth SMTP provider compatibility: if Google Workspace is the active provider, preview and production smoke tests both pass under the procedure in [`docs/sops/sop_supabase_auth_email_operations.md`](./sops/sop_supabase_auth_email_operations.md)
- Media Library: upload/list/download/delete/rename; storage paths are user-scoped
- AI Studio: core workflow renders; drag/drop surfaces behave as expected (per current UI)
- Dashboard + Profile: core layout, settings/billing sections, and logout flow behave as expected
- Credits & pricing: model cost display matches selected model, and debits are recorded for generation runs
- Credits & admin ops: `/admin` can apply one positive and one negative adjustment, and a failed provider submit path records an auto-refund ledger row

## Supabase safety (when schema/policies change)

- GitHub Actions `Media Storage Deploy Gate` run against target environment and returns `PASS`
- RLS enabled and policies enforce `user_id = auth.uid()` for user-owned tables
- Storage bucket private; policies require `auth.uid()` path prefixes
- Verify with two test users (cross-user isolation)

## Deployment target parity (required before scheduler/ops cutover)

- `node scripts/check_vercel_env_contract.mjs`
- Verify command output reports `PASS` for `preview` before deploy, alias cutover, or scheduler URL updates.
- When production cutover work begins, switch to `node scripts/check_vercel_env_contract.mjs --environment preview --environment production` and require `PASS` for both.
- Require the env contract check to fail if `APP_BASE_URL` or `SHORTPULSE_PUBLIC_API_BASE_URL` is loopback, non-HTTPS, or not `https://www.shortpulse.ai` in `production`.
- Require the env contract check to fail if `APP_BASE_URL` and `SHORTPULSE_PUBLIC_API_BASE_URL` differ in deployed envs.
- `node scripts/verify_deployment_route_parity.mjs --base-url https://<target-alias-or-url>`
- Verify command output reports `PASS` and includes resolved deployment URL + creation timestamp.
- Run against each target environment URL (`staging` and `production`) before updating cron/scheduler endpoints or running drain/recovery operations.
- `node scripts/verify_internal_route_runtime.mjs --base-url https://<target-alias-or-url>`
- Verify command output reports `PASS` for both unauthenticated `401` posture and authenticated `200` operator runtime on each internal worker route.
- Run against each target environment URL (`staging` and `production`) before scheduler/worker signoff or secret-rotation closeout.

## Documentation (when behavior changes)

- Update `README.md` and relevant `docs/sops/sop_*.md`
- If it’s a durable architectural decision, write an ADR in `docs/adr/`

## Post‑MVP checks (run when these surfaces are enabled)

- Performance: demo refresh/filter workflow works; charts/cards render; no console errors

## Rollout safety (cleanup/refactor PRs)

- Keep dead-code cleanup PRs isolated from feature work.
- Require PR review plus all status checks before merge.
- After deploy, watch `/admin` incident/event feeds for a short canary window before the next cleanup batch.
