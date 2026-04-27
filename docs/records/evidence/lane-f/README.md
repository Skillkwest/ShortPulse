# Lane F Evidence

Purpose: store retained execution evidence packets for the closed Lane F release and CI governance slices.

Moved from `docs/planning/evidence/lane-f/` during the retained-records migration on 2026-04-27. This namespace is no longer part of the active planning evidence surface.

## Required packet fields
1. `slice_id`
2. `date_utc`
3. `scope`
4. `commands_run`
5. `results`
6. `ci_inventory_before_after`
7. `required_check_delta`
8. `owner_identity_delta`
9. `environment_policy_delta`
10. `plan_tier_enforcement_state`
11. `rollback_note`
12. `linked_pr`

## Naming format
Use dated packet names:
- `YYYY-MM-DD-<slice-id>-<short-topic>.md`

Examples:
- `2026-03-16-f1-01-ci-inventory-parity-contract.md`
- `2026-03-16-f3-01-workflow-reliability-concurrency-policy.md`

## Linked docs
- `docs/archive/planning/lane-f-master-plan-2026-03-16.md`
- `docs/archive/planning/lane-f-tracker-spec-2026-03-16.md`
- `docs/archive/planning/lane-f-contact-map-2026-03-16.md`
- `docs/archive/planning/lane-f-execution-plan-2026-03-16.md`

## Current packets
- `docs/records/evidence/lane-f/2026-03-17-f0-01-baseline-lock.md`
- `docs/records/evidence/lane-f/2026-03-17-f1-01-ci-inventory-required-check-contract.md`
- `docs/records/evidence/lane-f/2026-03-17-f2-01-plan-limited-enforcement-model.md`
- `docs/records/evidence/lane-f/2026-03-17-f3-01-workflow-reliability-policy.md`
- `docs/records/evidence/lane-f/2026-03-17-f4-01-action-pinning-policy.md`
- `docs/records/evidence/lane-f/2026-03-17-f5-01-environment-protection-policy.md`
- `docs/records/evidence/lane-f/2026-03-17-f6-01-lane-f-convergence-cycle-1.md`
- `docs/records/evidence/lane-f/2026-03-17-f6-01-lane-f-convergence-cycle-2.md`
- `docs/records/evidence/lane-f/2026-03-17-f6-01-lane-f-closeout-review.md`
- `docs/records/evidence/lane-f/2026-04-09-f7-01-frontend-ci-split-compatibility-gate.md`
