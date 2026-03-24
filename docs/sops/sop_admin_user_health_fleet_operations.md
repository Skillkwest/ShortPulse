# SOP: Admin User Health Fleet Operations

Purpose: operate the fleet-level user health scan safely, triage findings efficiently, and escalate incidents without automated billing mutations.

## Scope
- Active-user fleet scan execution (current hourly cadence).
- Fleet run/snapshot/finding diagnostics.
- Operator triage workflow from fleet to per-user deep diagnostics.
- Report-only incident escalation posture.

## Source Of Truth
- Internal runner: `frontend/pages/api/internal/admin-user-health-fleet/run.ts`
- Fleet service: `frontend/lib/server/adminUserHealth/fleet.ts`
- Shared policy: `frontend/lib/server/adminUserHealth/policy.ts`
- Admin read API: `frontend/pages/api/admin/user-health-fleet.ts`
- Admin page: `frontend/pages/admin/user-health-fleet.tsx`
- Persistence migration: `sql/migrations/067_add_admin_user_health_fleet_automation.sql`
- Scheduler config: `sql/configure_admin_user_health_fleet_scheduler_supabase.sql`

## Prerequisites
- Migration `067` applied in target environment.
- Cron secret configured:
  - `SHORTPULSE_USER_HEALTH_FLEET_CRON_SECRET` (or fallback `CRON_SECRET`).
- Fleet feature gate enabled for execution:
  - `SHORTPULSE_USER_HEALTH_FLEET_ENABLED=true`
- Admin/operator access to:
  - `/admin/user-health-fleet`
  - `/admin/user-health`
  - `/admin/generation-trace`

## Runtime Controls
- `SHORTPULSE_USER_HEALTH_FLEET_ENABLED`: hard kill switch.
- `SHORTPULSE_USER_HEALTH_FLEET_LOOKBACK_DAYS`: leakage/failure lookback window.
- `SHORTPULSE_USER_HEALTH_FLEET_ACTIVE_WINDOW_DAYS`: active-user target cohort.
- `SHORTPULSE_USER_HEALTH_FLEET_MAX_USERS_PER_RUN`: hard run cap.
- `SHORTPULSE_USER_HEALTH_FLEET_PAGE_SIZE`: batch size.
- `SHORTPULSE_USER_HEALTH_FLEET_TIME_BUDGET_MS`: max run duration.
- `SHORTPULSE_USER_HEALTH_FLEET_RETENTION_DAYS`: history retention for snapshots/findings.
- `SHORTPULSE_USER_HEALTH_FLEET_INCIDENTS_ENABLED`: report-only escalation emission.

Threshold tuning:
- `SHORTPULSE_ADMIN_ALERT_USER_HEALTH_FLEET_CRITICAL_RISK`
- `SHORTPULSE_ADMIN_ALERT_USER_HEALTH_FLEET_WARNING_COST_WITHOUT_SUCCESS_CENTS`

## Triggering A Run
Manual trigger (local/protected env):
```bash
curl -X POST \
  -H "x-shortpulse-cron-secret: <SHORTPULSE_USER_HEALTH_FLEET_CRON_SECRET>" \
  -H "x-shortpulse-trigger-source: manual" \
  http://localhost:3000/api/internal/admin-user-health-fleet/run
```

Notes:
- The route is `POST`-only.
- Scheduler-owned runs default to `triggerSource=scheduled`.
- Use `x-shortpulse-trigger-source: manual` only for explicit operator-triggered replays when you want the persisted run metadata labeled as manual.

Scheduler trigger:
- Use `sql/configure_admin_user_health_fleet_scheduler_supabase.sql` (current hourly cadence).
- Do not use Vercel Cron for this workflow; scheduler ownership stays in Supabase Cron + Vault.
- Hourly cadence is implemented under reliability phase `R2` and governed by the cadence contract:
  - `docs/planning/generation-reliability-hardening-fleet-cadence-contract-2026-03-20.md`
- Canonical control-plane diagnostics before/after scheduler changes:
  - `sql/check_control_plane_scheduler_health.sql`
  - `sql/check_pg_net_failure_taxonomy.sql`

## Interpreting Run Results
Primary fields:
- `status`: `completed|partial|failed|running`
- `targeted`, `processed`, `failed`, `partial`
- `criticalUsers`, `warningUsers`
- `totalCostWithoutSuccessCents`
- `drainage`: compatibility summary `{ enabled, scanned, released, errors }` and remains `off` in steady state
- `drainageTrend`: latest-run delta object (present for latest-run reads): `{ previousRunId, scannedDelta, releasedDelta, errorsDelta }`
- `errors[]` (partial/failure reason summary)

Operational rules:
1. `completed` with low/expected findings: continue routine monitoring.
2. `partial`: inspect `errors[]`, confirm partial reason, rerun if needed.
3. `failed`: verify schema/env/auth and rerun after remediation.
4. repeated `running` without completion: investigate run-lock contention before manual replay.

## Triage Workflow
1. Open `/admin/user-health-fleet`.
2. Filter by severity/risk/finding code.
3. Prioritize:
   - `critical` rows,
   - high `riskScore`,
   - large `costWithoutSuccessCents`.
4. Drill into `/admin/user-health` for selected user (`lookup=email|userId`).
5. Use `/admin/generation-trace` for affected `source_ref`/`request_id` evidence.
6. If customer-impacting leakage is confirmed, coordinate manual credit adjustments through standard billing SOP.

## Incident Escalation Policy
- Escalation source: `ops.user_health_fleet`.
- Policy is report-only:
  - incidents are logged for operator visibility,
  - no auto-refunds,
  - no automated state mutation beyond scan persistence.

## Degraded/Partial Handling
Common causes:
- compatibility fallback (legacy schema),
- time budget reached,
- run cap limits reached.

Operator actions:
1. Capture `errors[]` and run metadata.
2. Confirm migration/schema parity.
3. Reduce cohort scope or raise time budget carefully.
4. Re-run and compare deltas.

## Retention
- Default: keep 90 days of history.
- Prune path: `prune_admin_user_health_history(p_retention_days)` is invoked by runner.
- Do not manually delete snapshot rows during active incident analysis.

## Guardrails
- Never bulk-run deep `/api/admin/user-health` for all users.
- Keep findings storage compact (no raw payload dump expansion).
- Keep admin fleet triage separate from `/admin` monolith UI.
- Keep execute grants service-role-only for fleet helper functions.
