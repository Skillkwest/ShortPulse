# Generation Reliability Hardening Fleet Cadence Contract (2026-03-20)

Last updated: 2026-03-20  
Status: active  
Program anchor: docs/planning/generation-reliability-hardening-master-plan-2026-03-20.md

## Purpose
Define one canonical implemented-state and rollback contract for admin fleet scheduler cadence so hourly operation remains explicit and reversible.

## Cadence States
Current state (authoritative runtime today):
1. Job name: shortpulse_admin_user_health_fleet_hourly
2. Schedule: 0 * * * * (hourly at minute 0 UTC)
3. Script authority: sql/configure_admin_user_health_fleet_scheduler_supabase.sql
4. Ops docs: docs/deployment.md, docs/sops/sop_admin_user_health_fleet_operations.md, docs/monitoring.md, docs/operator-map.md

Rollback baseline (if hourly is rolled back):
1. Job name: shortpulse_admin_user_health_fleet_daily
2. Schedule: 0 4 * * * (daily at 04:00 UTC)
3. Scheduler ownership remains Supabase pg_cron + Vault.
4. Recovery scheduler remains high-frequency (every minute) and is explicitly non-regressing in this program.

## Implementation Preconditions (Historical Gate For Rollout)
All were required before cadence promotion to hourly:
1. R1 control-plane diagnostics contract is completed with canonical missing/inactive/failing/stalled checks.
2. R2 scheduler policy slices R2-S1 through R2-S4 are completed or waived with risk rationale.
3. Route parity check passes for the target deployment alias.
4. Secret rotation contract is verified for cron auth paths.
5. Baseline evidence packet includes pre-change run health and runtime duration percentiles.

## Promote/Hold/Rollback Contract
Promote to hourly only when:
1. Scheduler health checks are green for at least 7 daily runs.
2. Fleet run duration p95 is safely below one hour with configured time budget.
3. No unresolved critical incidents in ops.user_health_fleet source over the last 72 hours.

Hold at daily when:
1. Route parity gate is unstable.
2. Scheduler failures exceed threshold in cron.job_run_details.
3. Fleet scan lock/contention is unresolved.

Rollback from hourly to daily when any occurs:
1. Two or more consecutive failed hourly runs.
2. Sustained running lock indicating overlap starvation.
3. Degraded read health that blocks operator triage.

## Validation And Evidence
Required evidence packet for cadence transition:
1. docs/planning/evidence/generation-reliability-hardening/2026-03-20-r2-s1-fleet-hourly-cadence-policy.md
2. docs/planning/evidence/generation-reliability-hardening/2026-03-20-r2-s2-recovery-cadence-guardrail.md
3. docs/planning/evidence/generation-reliability-hardening/2026-03-20-r2-s3-scheduler-secret-rotation-contract.md
4. docs/planning/evidence/generation-reliability-hardening/2026-03-20-r2-s4-route-parity-precondition.md
5. docs/planning/evidence/generation-reliability-hardening/2026-03-20-r2-i1-hourly-fleet-cadence-implementation.md

Validation gates:
1. npm -C frontend run docs:check
2. Route parity verification command in docs/deployment.md
3. Scheduler health SQL checks in docs/deployment.md

## References
1. docs/planning/generation-reliability-hardening-phase-r2-execution-plan-2026-03-20.md
2. docs/planning/generation-reliability-hardening-implementation-entry-checklist-2026-03-20.md
3. docs/deployment.md
4. docs/sops/sop_admin_user_health_fleet_operations.md
5. docs/monitoring.md
6. docs/operator-map.md
