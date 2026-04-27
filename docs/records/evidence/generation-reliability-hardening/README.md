# Generation Reliability Hardening Evidence

Purpose: store evidence packets for generation reliability hardening planning and execution slices (`R0` through `R6`).

## Required packet fields
1. `slice_id`
2. `date_utc`
3. `phase`
4. `workstream`
5. `commands_run`
6. `results`
7. `risk_class`
8. `rollback_note`
9. `linked_pr_or_commit`
10. `task_contract_checklist`
11. `audit_findings` (`blocking`, `non-blocking`, `deferred`)
12. `follow_up_actions`

## Naming format
Use dated packet names:
1. `YYYY-MM-DD-<slice-id>-<short-topic>.md`

Examples:
1. `2026-03-20-r0-s2-sli-scorecard-lock.md`
2. `2026-03-21-r1-s1-pg-cron-query-bundle.md`

## Linked docs
1. `docs/planning/generation-reliability-hardening-master-plan-2026-03-20.md`
2. `docs/planning/generation-reliability-hardening-master-roadmap-2026-03-20.md`
3. `docs/planning/generation-reliability-hardening-master-tracker-2026-03-20.md`
4. `docs/planning/generation-reliability-hardening-tracker-spec-2026-03-20.md`
5. `docs/planning/generation-reliability-hardening-phase-r0-execution-plan-2026-03-20.md`
6. `docs/planning/generation-reliability-hardening-phase-r1-execution-plan-2026-03-20.md`
7. `docs/planning/generation-reliability-hardening-phase-r2-execution-plan-2026-03-20.md`
8. `docs/planning/generation-reliability-hardening-phase-r3-execution-plan-2026-03-20.md`
9. `docs/planning/generation-reliability-hardening-phase-r4-execution-plan-2026-03-20.md`
10. `docs/planning/generation-reliability-hardening-phase-r5-execution-plan-2026-03-20.md`
11. `docs/planning/generation-reliability-hardening-phase-r6-execution-plan-2026-03-20.md`
12. `docs/planning/generation-reliability-hardening-evidence-packet-template.md`
