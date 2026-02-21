# STG-08 Final Validation And Signoff

## Summary
Confirm all controls, compatibility windows, and evidence are complete before closeout.

## Checklist
- [x] Validate no migration ordering conflicts.
- [x] Validate no enforcement before compatibility windows.
- [x] Validate no CI job collisions.
- [x] Validate machine-checkable evidence for all controls.
- [ ] Capture engineering, security, and operations signoff.

## Verification
- `npm -C frontend run docs:check`
- `npm -C frontend run validate`
- `npm -C frontend run build`

## Owners and validators
- Owner: Engineering
- Validator: Engineering + Security + Operations

## KPI
- All required checks green with signed evidence links.

## Evidence
- `docs/planning/final-validation-summary.md`
- `docs/planning/evidence/docs/2026-02-21-stg-08-precloseout-validation.md`
