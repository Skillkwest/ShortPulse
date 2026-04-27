# Supabase Production Cutover Handoff (2026-03-13)

Status: draft
Owner context: Supabase + Vercel + GitHub environment cutover to a new production Supabase project.

## Scope And Goal

This handoff captures the complete state of the production Supabase credential integration and production environment wiring effort as of **March 13, 2026**.

Primary goal:
- Keep staging/preview behavior unchanged.
- Move production runtime to the new Supabase production project.
- Apply required schema to the new production DB.
- Keep local safety posture pinned to staging by default.

## Resume In 5 Minutes

If you are returning later, start here:

1. Read this doc fully once.
2. Confirm runtime env mapping still holds:
   - Vercel `production` -> Supabase project ref `tvqxdhrulfqslfcgyher`
   - Vercel `preview` -> Supabase project ref `jwmcytzyhcvacjwqtynn`
3. Confirm production app smoke:
   - `/api/billing/credit-packages` returns `200` with valid production bearer token.
   - `POST /api/media/list` returns `200` with valid production bearer token.
4. Confirm guardrails:
   - `npm run db:migrate` remains blocked by `scripts/db_migrate_guardrail.mjs`.
   - local linked Supabase project remains staging (`supabase/.temp/project-ref`).
5. Continue with open items in **Remaining Work Plan**.

## Environment Topology (Current Target Model)

### Runtime Mapping

| Surface | Environment | Supabase Target |
|---|---|---|
| Vercel | `Development` | Local/staging workflows as configured by local env |
| Vercel | `Preview` | `jwmcytzyhcvacjwqtynn` (staging) |
| Vercel | `Production` | `tvqxdhrulfqslfcgyher` (production) |

### CI Secret Mapping

| Platform | Environment | Secret |
|---|---|---|
| GitHub Actions | `staging` | `SUPABASE_DB_URL` (staging DB URL) |
| GitHub Actions | `production` | `SUPABASE_DB_URL` (production DB URL) |

### Local Safety Posture

- Local Supabase link stays on staging by default (`supabase/.temp/project-ref`).
- Production one-off CLI operations must be explicitly pinned with `--project-ref tvqxdhrulfqslfcgyher`.
- Hosted promotion through `npm run db:migrate` is intentionally blocked until migration authority is unified.

## What Was Completed

## 1) Environment Wiring

- Vercel production environment variables were updated to production Supabase values:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Vercel preview environment remained on staging values.
- GitHub Actions environment secret `SUPABASE_DB_URL` was set for `production`.
- GitHub Actions environment secret `SUPABASE_DB_URL` remained intact for `staging`.

## 2) Runtime Deployment Alignment

- A production redeploy + promote flow was executed so `shortpulse.vercel.app` would use the updated production environment snapshot.
- Post-promotion, production runtime behavior aligned with the new Supabase target.

## 3) Production DB Initialization

The new production DB initially had no `public` tables.
Applied, in order:

Bootstrap SQL:
- `sql/storage_policies.sql`
- `sql/create_saved_creators_table.sql`
- `sql/create_media_library_tables.sql`
- `sql/create_billing_credit_tables.sql`
- `sql/create_user_preferences_table.sql`
- `sql/create_app_error_logs_table.sql`

Ordered migrations at cutover time:
- `sql/migrations/001_add_studio_10000_credit_package.sql`
- through
- `sql/migrations/066_add_media_derivative_processing_rpcs.sql`

Current repository baseline now extends through:
- `sql/migrations/067_add_admin_user_health_fleet_automation.sql`
- `sql/migrations/068_add_character_media_assets_isolation.sql`
- `sql/migrations/069_harden_provider_attached_stale_cleanup_execute_grants.sql`

Result:
- Production schema now contains required runtime tables/functions for billing/media/AI Studio flows.

## 4) Production Runtime Validation

Smoke validation was run against production after cutover:

- Auth create/sign-in/sign-out flow: pass.
- Protected billing endpoint `/api/billing/credit-packages`: pass (`200`).
- Protected media operation `POST /api/media/list`: pass (`200`).

Isolation validation:
- Production-issued token against production: `200`.
- Same production-issued token against preview deployment: `401`.
- This confirms preview remains isolated to staging auth/database context.

## 5) Security Audit + Drift/Gate Validation

Media storage drift/constraint checks:
- `media_files.storage_path_empty=0`
- `media_files.storage_path_not_user_scoped=0`
- `media_files.storage_path_leading_slash=0`
- `media_files.storage_path_traversal_segment=0`
- `media_files.storage_path_backslash=0`
- `media_files.variant_hint_invalid_shape=0`
- `media_asset_variants.storage_path_invalid_shape=0`
- required constraints present + validated.

Runtime SQL security audit:
- Initial result after migration application: `failing_checks=2`.
- Failure source:
  - `public.release_stale_provider_attached_generation_reservations(integer,integer,integer)`
  - `anon` and `authenticated` execute privileges still present.
- Remediation applied directly in production:
  - `revoke all ... from anon;`
  - `revoke all ... from authenticated;`
  - `grant execute ... to service_role;`
- Final result: `failing_checks=0`.

## 6) Repo Policy/Documentation Guardrails

Previously implemented in-repo and now part of this handoff context:

- `frontend/package.json`
  - `db:migrate` now routes to `scripts/db_migrate_guardrail.mjs` (fail-closed).
- `scripts/db_migrate_guardrail.mjs`
  - explicit hosted migration block until authority unification.
- `docs/database-migrations.md`
  - hosted promotion policy + explicit production target pin guidance.
- `docs/deployment.md`
  - production/preview Supabase env wiring + verification steps.

## Current Known Gaps / Important Notes

## A) CI Workflow Gap

- `.github/workflows/media-storage-deploy-gate.yml` exists locally in this branch/worktree.
- `gh workflow run media-storage-deploy-gate.yml -f target_environment=production` returned 404 for default branch.
- This indicates the workflow file is currently not present (or not discoverable) on the remote default branch.

Impact:
- Required deploy-gate workflow cannot be dispatched remotely right now.
- Equivalent gate checks were run directly against production DB and passed.

## B) Migration History Governance Gap

- Direct production SQL fix was applied outside migration history for the execute grant hardening on `release_stale_provider_attached_generation_reservations(...)`.

Impact:
- Environments can drift unless this is codified as a new migration.

Required follow-up:
- Add a new migration (recommended `067_*`) that codifies the grant posture.

## C) Toolchain Variance Observed

- `psql` was unavailable locally in this session environment.
- `docker` was unavailable locally in this session environment.
- Production SQL operations were executed via temporary isolated `node + pg` runner.

Impact:
- Reproducibility is lower than a standardized `psql`/Supabase CLI runbook.

Recommended:
- Restore standard operator tooling for future runs (`psql` available, or dedicated CI SQL runner).

## D) Secret Hygiene Policy

- No credentials are stored in this document.
- Runtime credentials must remain in Vercel/GitHub secret stores only.
- Do not commit secrets into repo files or docs.

## Remaining Work Plan (To Finish Cleanly)

## Phase 1 - Codify DB Grant Remediation In Migration History

Goal:
- Eliminate out-of-band SQL drift risk.

Actions:
1. Verify migration `sql/migrations/069_harden_provider_attached_stale_cleanup_execute_grants.sql` is applied in staging and production.
2. Ensure migration includes:
   - revoke from `public`, `anon`, `authenticated`.
   - grant execute to `service_role`.
3. If any additional grant hardening is needed, add a new migration number greater than `069` (do not mutate applied migration history).
4. Add/update rollback SQL under `sql/migrations/rollback/` for any new migration.
5. Update migration docs/runbooks and changelog.

Exit criteria:
- Migration exists, is reviewed, and applied in staging then production.

## Phase 2 - Restore CI Deploy Gate Workflow Availability

Goal:
- Make `Media Storage Deploy Gate` dispatchable on default branch.

Actions:
1. Ensure `.github/workflows/media-storage-deploy-gate.yml` is committed on default branch.
2. Run:
   - `gh workflow run media-storage-deploy-gate.yml -f target_environment=staging`
   - `gh workflow run media-storage-deploy-gate.yml -f target_environment=production`
3. Record run IDs and results in this doc and changelog.

Exit criteria:
- Both environment dispatches succeed and report pass/fail deterministically.

## Phase 3 - Stabilize Operational Runbook

Goal:
- Ensure future operator sessions do not need ad hoc SQL runners.

Actions:
1. Standardize one approved SQL execution path for hosted targets.
2. If `psql` is standard, document prerequisites in `docs/deployment.md` and `docs/sops/sop_sql_migration_operations.md`.
3. Keep `db:migrate` guardrail until migration authority unification is complete.

Exit criteria:
- One canonical hosted SQL path documented and validated.

## Phase 4 - Closeout Verification Packet

Goal:
- Produce a complete auditable closeout state.

Actions:
1. Capture final proofs:
   - production + preview env mapping
   - deploy gate workflow runs
   - runtime SQL audit summary (`failing_checks=0`)
   - production smoke test pass
   - preview isolation pass (`prod token -> preview 401`)
2. Add final closeout note in `docs/change_log.md`.

Exit criteria:
- No unresolved blockers remain for this cutover track.

## Resume Command Cookbook (No Secrets Included)

Use these with secure env variables already exported from your secret manager.

### Validate Vercel env export files

```bash
node scripts/check_vercel_env_file.mjs --file /tmp/vercel_prod.env --profile core
node scripts/check_vercel_env_file.mjs --file /tmp/vercel_preview.env --profile core
```

### Confirm local Supabase link safety

```bash
cat supabase/.temp/project-ref
```

Expected:
- staging project ref, not production.

### Dispatch media storage gate (after workflow restored on default branch)

```bash
gh workflow run media-storage-deploy-gate.yml -f target_environment=staging
gh workflow run media-storage-deploy-gate.yml -f target_environment=production
```

### Check environment-scoped GitHub secrets exist

```bash
gh secret list --env staging
gh secret list --env production
```

### Production runtime smoke (pattern)

1. Create temporary confirmed user via Supabase Admin API.
2. Sign in via `/auth/v1/token?grant_type=password`.
3. Call protected endpoints:
   - `GET /api/billing/credit-packages`
   - `POST /api/media/list` with JSON body
4. Logout and delete temporary user.

### Production/preview isolation check

1. Mint production token.
2. Call production protected endpoint -> expect success.
3. Call preview protected endpoint with same token -> expect `401`.

## Evidence Snapshot (As Of 2026-03-13)

- Production runtime smoke: pass (`billing=200`, `media=200`, `logout=204`).
- Preview isolation with production token: pass (`preview=401`).
- Media drift checks: all zero.
- Required media constraints: present + validated.
- Runtime SQL audit: `total=144`, `passing=144`, `failing=0`.
- Staging local-link safety: confirmed (`supabase/.temp/project-ref` points to staging ref).

## Decisions Locked

1. Keep multi-environment separation strict:
   - preview/staging and production never share Supabase project credentials.
2. Keep local default Supabase link on staging.
3. Keep hosted migration guardrail (`db:migrate` blocked) until migration authority is unified.
4. Require explicit target pinning for any production Supabase CLI one-offs.

## Risk Register

1. Risk: CI deploy gate file not active on default branch.
   - Impact: no remote pass/fail gate at deploy time.
   - Mitigation: restore workflow in default branch and require dispatch pass.

2. Risk: out-of-band DB fix not codified in migration history.
   - Impact: environment drift over time.
   - Mitigation: add/apply migration `067_*` immediately.

3. Risk: operator tooling inconsistency (`psql`/docker absent in some environments).
   - Impact: ad hoc execution paths.
   - Mitigation: standardize and document one hosted SQL execution approach.

## Files Most Relevant For Continuation

- `docs/deployment.md`
- `docs/database-migrations.md`
- `docs/sops/sop_sql_migration_operations.md`
- `scripts/db_migrate_guardrail.mjs`
- `frontend/package.json`
- `sql/migrations/065_add_media_derivative_processing_fields.sql`
- `sql/migrations/066_add_media_derivative_processing_rpcs.sql`
- `sql/migrations/067_add_admin_user_health_fleet_automation.sql`
- `sql/migrations/068_add_character_media_assets_isolation.sql`
- `sql/migrations/069_harden_provider_attached_stale_cleanup_execute_grants.sql`
- `sql/check_runtime_sql_security_audit.sql`
- `sql/check_media_storage_scope_drift.sql`

## Handoff Close Statement

The cutover is functional and safe to pause.
Production is wired to the new Supabase project and core protected runtime checks pass.
Resume should focus on governance hardening and reproducibility: migration codification verification (`069`), CI gate restoration, and final closeout evidence packaging.
