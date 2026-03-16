# Lane C Evidence

Purpose: store execution evidence packets for Lane C regression armor slices.

## Required packet fields
1. `slice_id`
2. `date_utc`
3. `scope`
4. `commands_run`
5. `results`
6. `characterization_inputs` (when applicable)
7. `failure_modes_asserted`
8. `rollback_note`
9. `linked_pr`

## Naming format
Use dated packet names:
- `YYYY-MM-DD-<slice-id>-<short-topic>.md`

Examples:
- `2026-03-16-c1-01-style-drop-characterization.md`
- `2026-03-16-c2-01-generation-contract-bundle.md`

## Linked docs
- `docs/planning/lane-c-master-plan-2026-03-16.md`
- `docs/planning/lane-c-execution-plan-2026-03-16.md`
- `docs/planning/lane-c-tracker-spec-2026-03-16.md`
