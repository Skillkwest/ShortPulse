# STG-05 Structural Debt Reduction

## Summary
Reduce oversized hotspot files by concern-oriented splits without feature behavior changes.

## Checklist
- [x] Prioritize hotspot files by churn and blast radius.
- [x] Split by concern (UI, state wiring, side effects, adapters).
- [x] Enforce file-size budget checks or documented exception.
- [x] Keep behavior stable and validate regressions.

## Verification
- `npm -C frontend run validate`
- `npm -C frontend run build`

## Owners and validators
- Owner: Engineering
- Validator: QA

## KPI
- Hotspot files under budget or explicitly exceptioned.

## Evidence
- `docs/records/evidence/architecture/`
- `docs/records/evidence/architecture/2026-02-21-phase-3-closeout-validation.md`
