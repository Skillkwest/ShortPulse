# AI Studio Reference Grid Reliability Evidence

Purpose: store evidence packets for the AI Studio Reference Grid reliability program (`P0` through `P4`).

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

## Linked docs
1. `docs/planning/ai-studio-reference-grid-reliability-master-plan-2026-03-21.md`
2. `docs/planning/ai-studio-reference-grid-reliability-master-roadmap-2026-03-21.md`
3. `docs/planning/ai-studio-reference-grid-reliability-master-tracker-2026-03-21.md`
4. `docs/planning/ai-studio-reference-grid-reliability-tracker-spec-2026-03-21.md`
5. `docs/planning/ai-studio-reference-grid-reliability-evidence-packet-template-2026-03-21.md`

## Seed packets
1. `docs/planning/evidence/ai-studio-reference-grid-reliability/2026-03-21-rgr-m01-top-priority-defect-inventory.md`
2. `docs/planning/evidence/ai-studio-reference-grid-reliability/2026-03-21-p0-entry-baseline-packet.md`
