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
- `docs/planning/lane-e-execution-plan-2026-03-16.md`

## Current packets
- `docs/planning/evidence/lane-e/2026-03-17-e0-01-governance-bootstrap-baseline.md`
- `docs/planning/evidence/lane-e/2026-03-17-e1-01-index-parity-contract.md`
- `docs/planning/evidence/lane-e/2026-03-17-e2-01-adr-integrity-contract.md`
- `docs/planning/evidence/lane-e/2026-03-17-e3-01-policy-surface-consistency.md`
- `docs/planning/evidence/lane-e/2026-03-17-e4-01-changelog-governance-hardening.md`
- `docs/planning/evidence/lane-e/2026-03-17-e5-01-governance-convergence.md`
- `docs/planning/evidence/lane-e/2026-03-17-e5-01-lane-e-convergence-gate-cycle-1.md`
- `docs/planning/evidence/lane-e/2026-03-17-e5-01-lane-e-convergence-gate-cycle-2.md`
- `docs/planning/evidence/lane-e/2026-03-17-e5-01-lane-e-closeout-review.md`
