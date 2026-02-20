# STG-04 KEI Compatibility Decommission

## Summary
Retire KEI safely using compatibility hold, coverage replacement, and phased deletion.

## Checklist
- [x] Phase A: remove runtime KEI callers while keeping `/api/kei/*` tombstones.
- [x] Phase B: replace auth/ownership coverage before KEI test deletion.
- [x] Phase C: remove KEI API/client/tests after one release hold window.

## Verification
- `npm -C frontend run lint`
- `npm -C frontend run type-check`
- `npm -C frontend run test`
- `npm -C frontend run build`

## Owners and validators
- Owner: Engineering
- Validator: Security + QA

## KPI
- Zero runtime KEI references after Phase C, with no auth-boundary coverage regressions.

## Evidence
- `docs/planning/evidence/kei/`
- `docs/planning/evidence/kei/2026-02-20-phase-a-runtime-caller-removal.md`
- `docs/planning/evidence/kei/2026-02-20-phase-b-coverage-replacement-and-fast-lane-update.md`
- `docs/planning/evidence/kei/2026-02-20-phase-c-kei-surface-deletion.md`
