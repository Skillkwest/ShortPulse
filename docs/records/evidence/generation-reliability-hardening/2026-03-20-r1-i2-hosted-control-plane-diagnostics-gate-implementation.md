# Reliability Implementation Evidence Packet: R1-I2

- slice_id: R1-I2
- date_utc: 2026-03-20
- phase: R1
- workstream: WR-2
- status: Completed (implementation evidence)
- owner: Engineering

## Scope
- Objective: Add a hosted, environment-scoped control-plane diagnostics execution path that runs canonical reliability SQL checks via GitHub Actions.
- Non-goals: No scheduler cadence changes, no generation-runtime algorithm changes, and no migration/DDL changes.
- Related tracker row(s): R-M03, R-M04
- Related phase slice(s): R1-S1, R1-S2, R1-S3, R1-S4

## Commands Run
1. `gh auth status`
2. `supabase --version`
3. `npm -C frontend run docs:check`
4. `gh workflow run reliability-control-plane-diagnostics.yml -f target_environment=staging -f mode=warn`
5. `gh run watch 23358875723 --interval 5 --exit-status`
6. `gh run download 23358875723 -n reliability-control-plane-diagnostics -D /tmp/reliability-diagnostics-run-23358875723`

## Results
1. Added workflow: `.github/workflows/reliability-control-plane-diagnostics.yml`.
2. Added runner script: `scripts/reliability_control_plane_diagnostics.sh`.
3. Updated operator/governance docs to register the hosted fallback path and diagnostics gate policy:
   - `docs/deployment.md`
   - `docs/planning/ci-policy-checks.md`
   - `docs/sops/sop_sql_migration_operations.md`
   - `docs/sops/sop_generation_recovery_diagnostics.md`
4. Merged workflow/script to default branch via PR `#36` (`107c673651db29b3adebd996d30c574799f5b14d`), then merged missing control-plane SQL bundle via PR `#37` (`538b2408e55893453ba43fad32a07dbc90016ff4`).
5. Hosted staging diagnostics run completed successfully in warn mode:
   - run_id: `23358875723`
   - run_url: `https://github.com/sleepyseamonster/ShortPulse/actions/runs/23358875723`
   - artifact: `/tmp/reliability-diagnostics-run-23358875723/`
6. Baseline findings from run `23358875723`:
   - `check_control_plane_scheduler_health.sql`: `scheduler_alive = true`; `shortpulse_generation_recovery_every_minute` healthy (`360/360` succeeded over 6h); `shortpulse_admin_user_health_fleet_hourly` missing in staging control-plane.
   - `check_pg_net_failure_taxonomy.sql`: pending queue depth `0`; failure class summary `http_4xx = 360`, all sampled rows `401`.
   - `check_runtime_sql_security_audit.sql`: `156/156` checks passing, `0` failing.
   - `check_generation_settlement_integrity.sql`: `missing_charge_count = 0`; `duplicate_charge_key_count = 0`.

## Validation
- Targeted validation outcome: Pass. Workflow and runbook contract are internally aligned.
- Full-gate validation outcome (`npm -C frontend run docs:check`): Pass (2026-03-20).

## Risk And Rollback
- risk_class: Medium
- Risk delta: Reduced operator dependency on local DB credentials by adding a canonical hosted diagnostics run path.
- rollback_note: Revert workflow/script and associated runbook references if diagnostics execution policy changes.

## Task Contract Checklist
- [x] Reliability objective unchanged or explicitly amended
- [x] Alert/operator impact documented
- [x] Rollback trigger conditions explicit
- [x] Required docs/index updates included
- [x] Evidence links and pass/fail outcomes recorded

## Audit Findings
### blocking
1. Staging scheduler state is not aligned with the hourly policy: `shortpulse_admin_user_health_fleet_hourly` is missing in `cron.job`.
2. `pg_net` responses show sustained `401` for diagnostics dispatch path, so control-plane auth is not yet healthy in staging.

### non-blocking
1. Diagnostics are currently in `mode=warn`; enforce mode should remain disabled until blocking findings are resolved.

### deferred
1. Automated threshold extraction from diagnostics logs remains a later control-plane automation slice.

## Follow-up Actions
1. Apply the fleet scheduler cadence SQL in staging and verify `shortpulse_admin_user_health_fleet_hourly` exists/active in `cron.job`.
2. Fix scheduler auth path (cron secret alignment/rotation + endpoint verification) until `check_pg_net_failure_taxonomy.sql` no longer reports sustained `401`.
3. Re-run warn-mode diagnostics and promote to `mode=enforce` only after the above two blockers clear.

## Linked PR Or Commit
- linked_pr_or_commit: `107c673651db29b3adebd996d30c574799f5b14d`, `538b2408e55893453ba43fad32a07dbc90016ff4`

## References
1. `docs/planning/generation-reliability-hardening-phase-r1-execution-plan-2026-03-20.md`
2. `docs/planning/generation-reliability-hardening-master-tracker-2026-03-20.md`
3. `docs/planning/ci-policy-checks.md`
4. `docs/sops/sop_sql_migration_operations.md`
5. `docs/sops/sop_generation_recovery_diagnostics.md`
