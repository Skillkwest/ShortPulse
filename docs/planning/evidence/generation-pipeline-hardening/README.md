# Generation Pipeline Hardening Evidence

Purpose: store execution evidence packets for Track P1 generation-pipeline hardening slices.

## Required packet fields
1. `slice_id`
2. `date_utc`
3. `phase`
4. `surface`
5. `commands_run`
6. `results`
7. `failure_codes_asserted`
8. `contract_parity_delta`
9. `rollback_note`
10. `linked_pr`
11. `task_contract_checklist` (DoD, required gates, docs/tracker/evidence parity)
12. `audit_findings` (`blocking`, `non-blocking`, `deferred`)
13. `parity_check` (`pass`/`fail` + notes)
14. `changelog_decision` (`updated` or `deferred` with owner/date)

## Audit budget rule
- If more than 2 non-blocking findings are discovered in one slice, stop scope expansion and open a follow-up slice.
- Cross-domain findings are logged for follow-up unless they are release blockers for the current slice.

## Naming format
Use dated packet names:
- `YYYY-MM-DD-<slice-id>-<short-topic>.md`

Examples:
- `2026-03-16-p1-01-shared-contract-gate.md`
- `2026-03-16-p3-02-dispatch-hardening.md`

## Linked docs
- `docs/planning/generation-pipeline-hardening-master-plan-2026-03-16.md`
- `docs/planning/generation-pipeline-hardening-tracker-spec-2026-03-16.md`
- `docs/planning/generation-pipeline-hardening-contact-map-2026-03-16.md`
- `docs/planning/generation-pipeline-hardening-execution-plan-2026-03-16.md`
