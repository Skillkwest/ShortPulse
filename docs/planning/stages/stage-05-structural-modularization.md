# STG-05 Structural Debt Reduction

## Summary
Reduce oversized hotspot files by concern-oriented splits without feature behavior changes.

## Checklist
- [ ] Prioritize hotspot files by churn and blast radius.
- [ ] Split by concern (UI, state wiring, side effects, adapters).
- [ ] Enforce file-size budget checks or documented exception.
- [ ] Keep behavior stable and validate regressions.

## Verification
- `npm -C frontend run validate`
- `npm -C frontend run build`

## Owners and validators
- Owner: Engineering
- Validator: QA

## KPI
- Hotspot files under budget or explicitly exceptioned.

## Evidence
- `docs/planning/evidence/architecture/`
