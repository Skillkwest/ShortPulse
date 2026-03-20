# Reliability Implementation Evidence Packet: R2-I1

- slice_id: R2-I1
- date_utc: 2026-03-20
- phase: R2
- workstream: WR-3
- status: Completed (implementation evidence)
- owner: Engineering

## Scope
- Objective: Implement hourly admin user-health fleet scheduler cadence with safe legacy-job cleanup and preserved daily rollback baseline.
- Non-goals: No changes to generation-recovery minutely scheduler cadence and no queue-state mutation logic changes.
- Related tracker row(s): R-M05, R-M06
- Related phase slice(s): R2-S1, R2-S2, R2-S3, R2-S4

## Commands Run
1. rg -n "shortpulse_admin_user_health_fleet_daily|0 4 \* \* \*|admin-user-health-fleet" sql docs
2. npm -C frontend run docs:check
3. npm -C frontend run test -- internal-admin-user-health-fleet-run.test.ts

## Results
1. `sql/configure_admin_user_health_fleet_scheduler_supabase.sql` now schedules `shortpulse_admin_user_health_fleet_hourly` at `0 * * * *` and unschedules both legacy daily and hourly job names before re-scheduling.
2. Ops docs (`deployment`, `SOP`, staging walkthrough, operator map, cadence contract) now reflect hourly as current state and daily as rollback baseline.
3. Validation gates passed for docs integrity and targeted route auth/control-flow tests.

## Validation
- Targeted validation outcome: Pass. Hourly scheduler contract and linked docs are aligned.
- Full-gate validation outcome (npm -C frontend run docs:check): Pass (2026-03-20).
- Route test outcome (npm -C frontend run test -- internal-admin-user-health-fleet-run.test.ts): Pass (2026-03-20).

## Risk And Rollback
- risk_class: High
- Risk delta: Reduced stale-health visibility window from 24h to 1h while preserving deterministic rollback to daily cadence.
- rollback_note: Re-run scheduler config with daily cadence (`shortpulse_admin_user_health_fleet_daily`, `0 4 * * *`) if hourly overlap/failure thresholds are exceeded.

## Task Contract Checklist
- [x] Reliability objective unchanged or explicitly amended
- [x] Alert/operator impact documented
- [x] Rollback trigger conditions explicit
- [x] Required docs/index updates included
- [x] Evidence links and pass/fail outcomes recorded

## Audit Findings
### blocking
1. None in this implementation slice.

### non-blocking
1. Runtime monitoring of `cron.job_run_details` should confirm hourly p95 runtime remains below one hour.

### deferred
1. Additional control-plane automation (missing/inactive/failing/stalled SQL bundle execution automation) remains for the next implementation slice.

## Follow-up Actions
1. Run the SQL verification queries from `sql/configure_admin_user_health_fleet_scheduler_supabase.sql` in target environments after apply.
2. Execute next slice for R1 control-plane diagnostics automation and alert thresholds.

## Linked PR Or Commit
- linked_pr_or_commit: working-tree (pending commit)

## References
1. docs/planning/generation-reliability-hardening-phase-r2-execution-plan-2026-03-20.md
2. docs/planning/generation-reliability-hardening-fleet-cadence-contract-2026-03-20.md
3. docs/deployment.md
4. docs/sops/sop_admin_user_health_fleet_operations.md
