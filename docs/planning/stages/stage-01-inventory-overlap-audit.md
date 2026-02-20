# STG-01 Inventory And Overlap Audit

## Summary
Capture plan sources and resolve overlap/conflict risks with explicit traceability.

## Checklist
- [x] Source register defined with Source IDs.
- [x] Risk register created with severity and resolution.
- [x] Conflict resolutions mapped to future stages.

## Verification
- `test -f docs/planning/overlap-audit.md`
- `rg -n "R-00" docs/planning/overlap-audit.md`

## Owners and validators
- Owner: Engineering
- Validator: Security + Docs governance

## KPI
- Every conflict has a locked resolution and target stage.

## Evidence
- `docs/planning/_inventory.md`
- `docs/planning/overlap-audit.md`
