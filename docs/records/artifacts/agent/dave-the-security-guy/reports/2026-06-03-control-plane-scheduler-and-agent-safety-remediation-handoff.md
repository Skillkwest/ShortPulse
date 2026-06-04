# Control-Plane Scheduler And Agent-Safety Remediation Handoff

Owner: Dave the Security Guy
Prepared by: Nuclo
Date: 2026-06-03
Scope: handoff packet for continued launch-readiness security review after Nuclo completed the production Supabase control-plane remediation lane.

## Decision

Nuclo already completed the production Supabase mutation for this lane. Dave should treat the database/control-plane remediation as done and continue with security review from the non-Supabase side unless a fresh repo-backed threat or hosted regression appears.

## What Nuclo Changed

Nuclo fixed the two confirmed production DB/control-plane issues in the canonical source and in hosted production:

1. Added explicit `timeout_milliseconds := 60000` to the canonical Supabase scheduler HTTP calls for:
   - `public.invoke_generation_recovery_scheduler()`
   - `public.invoke_admin_user_health_fleet_scheduler()`
2. Restored missing `service_role` execute on:
   - `public.create_agent_safety_policy_version(text,jsonb,text,text,uuid,text,boolean,text)`

Nuclo applied the hosted production mutation through:

- `sql/migrations/146_harden_control_plane_scheduler_timeouts.sql`

Nuclo also hardened the repo proof path so future hosted checks do not misfire through the Supabase transaction pooler:

- `sql/check_control_plane_scheduler_health.sql`
- `sql/check_control_plane_enforce_gate.sql`
- `sql/check_agent_safety_policy_control_plane.sql`
- `sql/check_runtime_sql_security_audit.sql`
- `sql/check_media_storage_scope_drift.sql`

## Why This Mattered

### 1. Scheduler timeout seam

- Boundary: Supabase `pg_cron` -> `pg_net` -> internal protected Vercel control-plane routes
- Prior problem: recovery/admin scheduler functions were using default `pg_net` timeout behavior instead of the explicit `60000ms` contract already used by the media-derivative scheduler
- Security/reliability implication: the generation recovery lane could silently time out while `cron.job_run_details` still looked green, weakening the authoritative server-side recovery path

### 2. Agent-safety RPC grant drift

- Boundary: service-role admin control plane -> security policy version creation RPC
- Prior problem: production was missing `service_role` execute on `create_agent_safety_policy_version(...)`
- Security implication: security-policy version creation posture in production had drifted from canonical migration intent, and the old checker summary could hide that drift

## Production Proof After Remediation

Nuclo validated the live production database after apply.

### Hosted function/grant state

- `invoke_generation_recovery_scheduler()` -> `timeout_milliseconds := 60000` present
- `invoke_admin_user_health_fleet_scheduler()` -> `timeout_milliseconds := 60000` present
- `invoke_media_derivative_scheduler()` -> still has `timeout_milliseconds := 60000`
- `create_agent_safety_policy_version(...)` -> `service_role` execute present

### Hosted SQL proofs

- `supabase db lint --db-url "$SHORTPULSE_PRODUCTION_DB_URL" --schema public --fail-on warning` -> passed
- `sql/check_control_plane_enforce_gate.sql` -> `failing_check_count = 0`
- `sql/check_agent_safety_policy_control_plane.sql` -> `24/24` passing
- `sql/check_runtime_sql_security_audit.sql` -> `346/346` passing
- `sql/audit_billing_credit_rls.sql` -> clean
- `sql/check_media_storage_scope_drift.sql` -> all audited counts `0`

### Live route/runtime proof

Nuclo checked the protected internal routes at the production URL:

- `/api/internal/generation-recovery/run`
  - unauthenticated -> `401`
  - authenticated -> `200`
- `/api/internal/admin-user-health-fleet/run`
  - unauthenticated -> `401`
  - authenticated -> `200`

One first-pass user-health probe returned `409` with “already running” while a fleet scan was in flight. A second probe returned the expected `200`. Treat that `409` as a concurrency guard, not as auth failure or route breakage.

### `pg_net` observation

- Immediately after the fix, direct scheduler invocation produced fresh `200` responses with `0` fresh timeouts
- Later recheck at `2026-06-03 22:22:48 UTC` showed:
  - `pending_http_request_count = 0`
  - last 6 hours failure summary = `0`
  - recent responses all `200`
  - no fresh `401`s
  - the earlier June 3 timeout rows had aged out of the retained window cleanly

## What Dave Does Not Need To Re-Run

Dave does **not** need to:

- apply any Supabase SQL for this lane
- rerun the production migration
- re-prove the control-plane timeout remediation from scratch in Supabase
- re-open the agent-safety `service_role` grant repair in Supabase

The hosted mutation and hosted DB proof for this exact lane are already complete.

## What Dave Can Continue Checking

High-ROI next security checks that do **not** require Dave to rerun Supabase for this lane:

1. Continue app/API boundary review around the recovery/admin control-plane routes:
   - auth fail-closed behavior
   - cron secret handling
   - route response hygiene
   - concurrency semantics around fleet scans
2. Continue security review of adjacent launch boundaries that depend on these routes but are not the same Supabase mutation lane:
   - internal cron route protection
   - provider/webhook trust boundaries
   - admin/service-role behavior outside this already-fixed grant
3. Use the now-hardened SQL proof scripts as evidence sources if a broader security pass needs them, but do not treat that as a reason to mutate Supabase again.

## Source Files Touched In Repo

- `sql/configure_generation_recovery_scheduler_supabase.sql`
- `sql/configure_admin_user_health_fleet_scheduler_supabase.sql`
- `sql/check_control_plane_scheduler_health.sql`
- `sql/check_control_plane_enforce_gate.sql`
- `sql/check_agent_safety_policy_control_plane.sql`
- `sql/check_runtime_sql_security_audit.sql`
- `sql/check_media_storage_scope_drift.sql`
- `sql/migrations/146_harden_control_plane_scheduler_timeouts.sql`
- `sql/migrations/rollback/146_harden_control_plane_scheduler_timeouts_rollback.sql`
- `docs/database-migrations.md`
- `docs/sops/sop_generation_recovery_diagnostics.md`

## Lane Boundary

This handoff covers only:

- the production Supabase scheduler-timeout remediation
- the production agent-safety version-RPC grant remediation
- the proof-script hardening needed to make hosted verification trustworthy

It does **not** claim that all ShortPulse security work is complete. It only means Dave should not spend more time reopening this specific Supabase remediation lane unless fresh evidence says it regressed.
