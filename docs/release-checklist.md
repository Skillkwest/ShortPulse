# Release Checklist

Use this checklist before merging to `main` (and before any deploy/release process you adopt).

## Engineering checks

- `npm -C frontend run lint`
- `npm -C frontend run test`
- `npm -C frontend run type-check`
- `npm -C frontend run build`
- `npm -C frontend run docs:check`
- `npm -C frontend run deadcode:check`
- When a PR touches Lane D runtime-safety seams, run `npm -C frontend run validate:lane-d-runtime`
- When that Lane D PR also touches adaptive/reference-grid/canvas protected surfaces, also run `npm -C frontend run test:adaptive-v2-gate`
- No secrets added/changed (`.env*` stays uncommitted; only `.env.example` changes are acceptable)
- Optional (post-format-baseline): `npm -C frontend run format:check`
- Optional dead-code audit report (non-blocking): `npm -C frontend run deadcode:check:full`

## Manual product smoke

- Auth: sign in/out works; protected routes redirect to `/auth` when unauthenticated
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

- `node scripts/verify_deployment_route_parity.mjs --base-url https://<target-alias-or-url> --token <SHORTPULSE_VERCEL_API_TOKEN>`
- Verify command output reports `PASS` and includes resolved deployment URL + creation timestamp.
- Run against each target environment URL (`staging` and `production`) before updating cron/scheduler endpoints or running drain/recovery operations.

## Documentation (when behavior changes)

- Update `README.md` and relevant `docs/sops/sop_*.md`
- If it’s a durable architectural decision, write an ADR in `docs/adr/`

## Post‑MVP checks (run when these surfaces are enabled)

- Saved Creators: add/edit/remove a handle; data is user-scoped
- Performance: demo refresh/filter workflow works; charts/cards render; no console errors

## Rollout safety (cleanup/refactor PRs)

- Keep dead-code cleanup PRs isolated from feature work.
- Require PR review plus all status checks before merge.
- After deploy, watch `/admin` incident/event feeds for a short canary window before the next cleanup batch.
