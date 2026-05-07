> Archived on 2026-05-06. Retained as implementation-complete planning history after the fleet health routes, UI, SQL, tests, and SOPs became the active source of truth.

# Admin User Health Fleet Implementation Plan (2026-03-14)

Status: draft

## Goal
Add daily fleet-level triage for active users that complements existing per-user `/api/admin/user-health` diagnostics without introducing deep-analyzer bulk fan-out, runtime bloat, or contract regressions.

## Scope (V1)
- Keep `/api/admin/user-health` behavior/contract stable.
- Add lightweight set-based fleet metrics path for active users (last 30 days by default).
- Persist compact run/snapshot/finding records (no large raw payload storage).
- Add internal runner route and admin read route.
- Add dedicated admin page `/admin/user-health-fleet`.
- Add report-only incident escalation (`source=ops.user_health_fleet`), no automated refunds/remediation mutations.

## Out Of Scope (V1)
- Bulk calling deep per-user analyzer.
- Automatic credit adjustments/refunds.
- Slack/pager integrations.
- Arbitrary historical backfill beyond configured retention windows.

## Architecture
1. `frontend/lib/server/adminUserHealth/deep.ts`
- Shared deep-route compatibility/parsing helpers extracted from `/api/admin/user-health`.

2. `frontend/lib/server/adminUserHealth/fleet.ts`
- Set-based active-user fleet scan.
- Bounded batching and time-budget partial completion.
- Persistence to fleet run/snapshot/finding tables.
- Optional incident emission and retention prune.

3. `frontend/lib/server/adminUserHealth/policy.ts`
- Shared findings + risk score + risk band policy mapping.

4. `frontend/lib/server/adminUserHealth/runtime.ts`
- Env-driven fleet runtime flags and thresholds.

## Data Model
Migration `067_add_admin_user_health_fleet_automation.sql` introduces:
- `admin_user_health_scan_runs`
- `admin_user_health_snapshots`
- `admin_user_health_snapshot_findings`
- `list_admin_user_health_active_targets(p_active_days, p_limit)`
- `prune_admin_user_health_history(p_retention_days)`

Security posture:
- `SECURITY DEFINER` functions.
- Execute grants limited to `service_role`.
- `anon`/`authenticated`/`public` execute revoked.
- Runtime audit coverage updated in `sql/check_runtime_sql_security_audit.sql`.

## Public Interfaces
- Internal trigger route:
  - `POST|GET /api/internal/admin-user-health-fleet/run`
  - Auth: `x-shortpulse-cron-secret` or bearer secret.
- Admin read route:
  - `GET /api/admin/user-health-fleet`
  - Filters: `runId`, `page`, `perPage`, `severity`, `riskBand`, `findingCode`, `search`.
- Admin UI route:
  - `/admin/user-health-fleet`

## Runtime Defaults
- `SHORTPULSE_USER_HEALTH_FLEET_ENABLED=false`
- `SHORTPULSE_USER_HEALTH_FLEET_LOOKBACK_DAYS=30`
- `SHORTPULSE_USER_HEALTH_FLEET_ACTIVE_WINDOW_DAYS=30`
- `SHORTPULSE_USER_HEALTH_FLEET_RETENTION_DAYS=90`
- `SHORTPULSE_USER_HEALTH_FLEET_MAX_USERS_PER_RUN=1000`
- `SHORTPULSE_USER_HEALTH_FLEET_PAGE_SIZE=100`
- `SHORTPULSE_USER_HEALTH_FLEET_TIME_BUDGET_MS=300000`
- `SHORTPULSE_USER_HEALTH_FLEET_INCIDENTS_ENABLED=false`
- `SHORTPULSE_ADMIN_ALERT_USER_HEALTH_FLEET_CRITICAL_RISK=80`
- `SHORTPULSE_ADMIN_ALERT_USER_HEALTH_FLEET_WARNING_COST_WITHOUT_SUCCESS_CENTS=2000`

## Done State
- Internal fleet run route works with secret auth and bounded execution.
- Fleet persistence tables/functions are migrated with rollback script.
- `/api/admin/user-health-fleet` returns latest run summary + paginated filtered snapshots.
- `/admin/user-health-fleet` supports filter/search/drill-down and degraded-state messaging.
- `/api/admin/user-health` contract remains stable after helper extraction.
- Runtime SQL security audit script includes new fleet functions.
- New tests pass for:
  - internal route auth/control flow,
  - admin read route behavior,
  - policy regression semantics,
  - internal route inventory regression.
- Docs/SOP/indexes updated and discoverable.

## Validation Gates
From `frontend/`:
1. `npm run lint`
2. `npm run build`
3. `npm run test -- internal-admin-user-health-fleet-run admin-user-health-fleet internal-route-inventory-regression admin-user-health-policy runtime-sql-security-audit-script`
4. `npm run docs:check`

## Rollout Sequence
1. Apply migration `067` to staging.
2. Configure secrets + scheduler URL using `sql/configure_admin_user_health_fleet_scheduler_supabase.sql`.
3. Enable route with `SHORTPULSE_USER_HEALTH_FLEET_ENABLED=true` (incidents still OFF).
4. Manually trigger a scan and verify `/admin/user-health-fleet`.
5. Enable report-only incidents if desired.
6. Promote to production using same sequence.
