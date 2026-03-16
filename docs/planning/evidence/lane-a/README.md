# Lane A Evidence

Purpose: store execution evidence packets for Lane A gate recovery and governance hardening slices.

## Required packet fields
1. `slice_id`
2. `date_utc`
3. `scope`
4. `commands_run`
5. `results`
6. `baseline_or_delta`
7. `rollback_note`
8. `linked_pr`

## Naming format
Use dated packet names:
- `YYYY-MM-DD-<slice-id>-<short-topic>.md`

Examples:
- `2026-03-16-a0-01-baseline-lock.md`
- `2026-03-16-a1-01-naming-gate-recovery.md`

## Linked docs
- `docs/planning/lane-a-master-plan-2026-03-16.md`
- `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`
