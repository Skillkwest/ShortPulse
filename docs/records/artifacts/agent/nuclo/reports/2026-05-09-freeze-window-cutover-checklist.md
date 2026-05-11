# Freeze-Window Cutover Checklist

Date: 2026-05-09
Owner: Nuclo
Status: ready for execution

## Purpose

Provide the exact freeze-window checklist required to move ShortPulse production from the staging-backed Supabase project to the dedicated production Supabase project without leaving live-write drift behind.

This checklist assumes:

- `working-development` and `staging-preview` will continue using the staging Supabase project for now.
- the dedicated production Supabase project already has schema, auth, and storage payload parity close enough for a final freeze-window sync.
- billing cutover is not part of this checklist unless explicitly added later.

## Critical Scope

Until the Vercel production switch happens, every runtime still pointing at the staging Supabase project is in scope for the freeze.

That includes:

- the current live `https://www.shortpulse.ai` runtime
- the staging preview deployment
- any other hosted runtime or local operator session still configured against the staging Supabase project

The freeze is not just a `staging-preview` concern. It is a staging-database write-stop concern.

## Current Hard Constraint

There is no single canonical runtime flag in this repo that stops all new generation submits across:

- Fal-backed submit routes
- direct OpenAI image routes
- user media uploads

That means the cutover requires a deliberate front-door write freeze, not just a background-worker pause.

## Required Tools

- `bash scripts/ops/vercel_env_audit.sh`
- `bash scripts/ops/github_env_audit.sh`
- `bash scripts/ops/supabase_public_schema_parity.sh --source-label staging --target-label production`
- `bash scripts/ops/supabase_rowcount_diff.sh --schema public --schema auth --schema storage --source-label staging --target-label production`
- `bash scripts/ops/supabase_storage_parity.sh --bucket media_library --source-label staging --target-label production`
- `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode copy`
- `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode check --size-only`
- `bash scripts/ops/supabase_hot_table_delta_sync.sh`
- `bash scripts/ops/supabase_media_generation_delta_sync.sh`
- `node scripts/verify_deployment_route_parity.mjs --base-url <url>`

## Freeze Strategy

### Required freeze method

Use a short operator-declared maintenance window and stop all customer and operator traffic that can still write to the staging Supabase project.

This is mandatory, not optional. Route flags alone are not sufficient because the staging-backed runtime can still receive writes from:

- general customer traffic on the live `https://www.shortpulse.ai` deployment while it still points at staging
- Stripe checkout/portal/webhook traffic
- Fal webhook terminal-state writes
- public growth telemetry
- authenticated admin/operator activity

### Supplemental runtime gates

After the maintenance window starts, temporarily disable the highest-volume write lanes at the runtime/operator layer as a second layer of protection. Because the repo has no single canonical global write-stop flag, that means:

- disable media uploads with the documented upload gate
- disable internal schedulers/workers that are not needed for the final drain
- optionally remove or invalidate provider submit credentials on the staging-backed runtime only after accepted jobs are drained to near zero

Do not use provider-key invalidation as the first move if accepted jobs are still mid-flight, because reconciler/provider polling may still need those keys. Also do not treat provider-key invalidation as a substitute for the maintenance window; it does not stop telemetry, billing, or other non-provider write surfaces.

## Phase 0: Preflight

- [ ] Confirm the branch/release intent is unchanged:
  - `working-development` remains dev
  - `staging-preview` remains staging
  - `production` will move to the dedicated production Supabase project
- [ ] Confirm operator credentials are available in local-only env state.
- [ ] Run:
  - `bash scripts/ops/vercel_env_audit.sh`
  - `bash scripts/ops/github_env_audit.sh`
- [ ] Confirm the dedicated production project still passes:
  - schema parity
  - storage parity
  - route-parity prerequisites for the production deployment target
- [ ] Confirm there is a rollback packet for the current production Vercel env values and GitHub `production` `SUPABASE_DB_URL`.

## Phase 1: Freeze Preparation

- [ ] Announce the freeze window.
- [ ] Put the current live `https://www.shortpulse.ai` runtime into a customer-visible maintenance window before final sync work begins.
- [ ] Stop any local development sessions that still write to the staging Supabase project.
- [ ] Make sure no operator is manually replaying generation recovery, media derivatives, or billing renewal jobs during the cutover.
- [ ] Prepare the current production-domain runtime for a write freeze by identifying the exact Vercel envs that will be temporarily changed.
- [ ] Confirm no customer billing action or admin workflow is expected during the freeze window.
- [ ] Confirm no operator is using the current live production deployment for admin reads that could trigger side-effect writes.

## Phase 2: Stop New Writes

Apply these gates on every hosted runtime still targeting the staging Supabase project.

Important:

- if both Vercel `Production` and `Preview` still resolve to staging Supabase, apply the freeze-state env changes to both scopes
- branch-specific preview overrides must also be reviewed if `staging-preview` has override records

### Immediate low-risk gates

- [ ] Set `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED=false`
- [ ] Set `NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED=false`
- [ ] Set `SHORTPULSE_MEDIA_DERIVATIVES_ENABLED=false`
- [ ] Set `SHORTPULSE_USER_HEALTH_FLEET_ENABLED=false`
- [ ] Set `SHORTPULSE_INTERNAL_BILLING_RENEWALS_ENABLED=false`
- [ ] Do not rely on `SHORTPULSE_FAL_ADMISSION_MODE=enforce` as a freeze control. It cannot guarantee zero submits and must not be treated as the cutover stop mechanism.

### Front-door submit freeze

- [ ] Confirm the maintenance/traffic stop is active before changing any final-sync state.
- [ ] If maintenance/traffic stop is active and you still want an extra hard stop for submit lanes, apply it only to the staging-backed runtime:
  - pause or invalidate Fal/OpenAI/Kie submit capability on the staging-backed runtime only
  - do not touch webhook verification secrets
  - do not change the dedicated production project credentials during this step

### Drain accepted work

- [ ] Keep `SHORTPULSE_FAL_RECONCILER_ENABLED=true` during the drain phase.
- [ ] Watch accepted-job recovery until active accepted work is zero or operator-acceptable residual count.
- [ ] Allow Fal webhooks to continue settling terminal jobs during the drain.

### Pause recurring schedulers after drain

Once the accepted-job drain is effectively complete:

- [ ] pause Supabase Cron job `shortpulse_generation_recovery_every_minute` on the staging project
- [ ] pause Supabase Cron job `shortpulse_media_derivatives_every_minute` on the staging project
- [ ] pause Supabase Cron job `shortpulse_admin_user_health_fleet_hourly` on the staging project
- [ ] pause Supabase Cron job `shortpulse_internal_billing_renewals_hourly` on the staging project if it exists there

Recommended verification query:

```sql
select jobid, jobname, active
from cron.job
where jobname in (
  'shortpulse_generation_recovery_every_minute',
  'shortpulse_media_derivatives_every_minute',
  'shortpulse_admin_user_health_fleet_hourly',
  'shortpulse_internal_billing_renewals_hourly'
)
order by jobname;
```

## Phase 3: Lock the Staging-Backed Runtime

Once accepted jobs are drained:

- [ ] Set `SHORTPULSE_FAL_RECONCILER_ENABLED=false` on the staging-backed runtime.
- [ ] Verify no manual replay or cron-triggered recovery pass is still in flight.
- [ ] Confirm the paused cron jobs remain inactive before final sync begins.
- [ ] Do not reopen the front door after this point unless the cutover is aborted.

## Phase 4: Final Sync

Run these commands in order:

1. `bash scripts/ops/supabase_hot_table_delta_sync.sh`
2. `bash scripts/ops/supabase_media_generation_delta_sync.sh`
3. `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode copy`
4. `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode check --size-only`
5. `bash scripts/ops/supabase_storage_parity.sh --bucket media_library --source-label staging --target-label production`
6. `bash scripts/ops/supabase_rowcount_diff.sh --schema public --schema auth --schema storage --source-label staging --target-label production`

Expected result:

- no storage differences
- no shared-table count drift
- no new drift appearing between repeated parity runs

If drift remains:

- [ ] rerun steps 1 through 6 once
- [ ] if drift is still moving, the freeze failed and the cutover must stop

## Phase 5: Production Rewire

Only start this phase after parity is clean.

### Vercel production env updates

- [ ] In Vercel `Production`, set:
  - `NEXT_PUBLIC_SUPABASE_URL` -> dedicated production Supabase URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` -> dedicated production client key
  - `SUPABASE_SERVICE_ROLE_KEY` -> dedicated production server key
  - `APP_BASE_URL=https://www.shortpulse.ai`
  - `SHORTPULSE_PUBLIC_API_BASE_URL=https://www.shortpulse.ai`

### GitHub production environment update

- [ ] Update GitHub Environment `production` `SUPABASE_DB_URL` to the dedicated production database URL.

### Deploy

- [ ] Trigger a fresh production deploy after the env changes land.
- [ ] Re-run the live Vercel env contract audit for `production` before public validation if operator time allows.

## Phase 6: Immediate Validation

- [ ] Run route parity against the live production alias:
  - `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai`
- [ ] Confirm the live production runtime no longer resolves staging Supabase/base-URL values.
- [ ] Confirm production auth works.
- [ ] Confirm a representative signed media path works.
- [ ] Confirm representative generation recovery/admin routes exist.
- [ ] Confirm no new production runtime errors spike immediately after deploy.

## Phase 7: Post-Switch Stabilization

After the live production runtime is confirmed healthy:

- [ ] Keep the staging-backed runtime frozen until production smoke tests are complete.
- [ ] Re-enable or resume staging-side Supabase Cron jobs only after the staging-backed runtime is intentionally returned to dev/staging use.
- [ ] Re-enable staging-only non-production gates only after production is stable and the staging DB is again safe to use for dev/staging work.
- [ ] Decide whether the staging-backed runtime should immediately regain:
  - `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED=true`
  - `SHORTPULSE_FAL_RECONCILER_ENABLED=true`
  - `SHORTPULSE_MEDIA_DERIVATIVES_ENABLED=true`
  - `SHORTPULSE_USER_HEALTH_FLEET_ENABLED=true`
  - `SHORTPULSE_INTERNAL_BILLING_RENEWALS_ENABLED=<intended staging value>`

## Rollback Triggers

Abort or roll back if any of the following happen after Phase 5 begins:

- production route parity fails
- auth fails on `https://www.shortpulse.ai`
- representative media access fails
- major runtime errors spike immediately after deploy
- the production runtime is still resolving staging Supabase values

## Rollback Steps

1. Restore the previous known-good Vercel `Production` env values.
2. Redeploy the previous known-good production deployment.
3. Restore GitHub `production` `SUPABASE_DB_URL` only if workflow behavior depends on it.
4. Keep the staging-backed runtime frozen until the rollback target is verified healthy.
5. Resume paused staging-side cron jobs only after the rollback target is confirmed stable.
6. Log the failure cause before attempting another cutover.

## Explicit Non-Goals

This checklist does not include:

- creating a separate dev Supabase project
- rotating all exposed credentials
- enabling live production Stripe/webhook billing if that work remains deferred

Those are follow-up phases after the database/runtime cutover itself is stable.
