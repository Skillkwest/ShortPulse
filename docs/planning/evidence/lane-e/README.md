# Lane E Evidence

Purpose: store execution evidence packets for Lane E docs and ADR governance slices.

## Required packet fields
1. `slice_id`
2. `date_utc`
3. `scope`
4. `commands_run`
5. `results`
6. `drift_before_after`
7. `checker_policy_delta`
8. `allowlist_exceptions` (if any)
9. `rollback_note`
10. `linked_pr`

## Naming format
Use dated packet names:
- `YYYY-MM-DD-<slice-id>-<short-topic>.md`

Examples:
- `2026-03-16-e1-01-planning-index-parity-contract.md`
- `2026-03-16-e3-01-supabase-policy-surface-alignment.md`

## Linked docs
- `docs/planning/lane-e-master-plan-2026-03-16.md`
- `docs/planning/lane-e-tracker-spec-2026-03-16.md`
