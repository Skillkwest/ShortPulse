# STG-04 KEI Compatibility Decommission

## Summary
Retire KEI safely using compatibility hold, coverage replacement, and phased deletion.

## Checklist
- [x] Phase A: remove runtime KEI callers while keeping `/api/kei/*` tombstones.
- [x] Phase B: replace auth/ownership coverage before KEI test deletion.
- [x] Phase C: remove KEI API/client/tests after one release hold window.

## Phase C quantified hold-window gate
Phase C is allowed only when all are true:
- [x] At least one production release occurred after Phase B completion (`2026-02-20` baseline).
- [x] KEI tombstone traffic is zero for trailing 14 days (`app_error_logs` where `source='api.kei_route_disabled'`, threshold `count=0`).
- [x] Fast-lane auth/ownership suites are green on the last two base-branch runs.
- [x] Non-zero KEI tombstone traffic resets the 14-day clock (enforced as stage rule).

Evidence requirement:
- `docs/records/evidence/kei/2026-02-20-phase-c-hold-window-validation.md`

Decision note:
- Product/engineering decision lock on `2026-02-20` treated KEI traffic as zero and approved Phase C execution.

## Verification
- `npm -C frontend run lint`
- `npm -C frontend run type-check`
- `npm -C frontend run test`
- `npm -C frontend run build`
- `npm -C frontend run docs:check`

## Owners and validators
- Owner: Engineering
- Validator: Security + QA

## KPI
- Zero runtime KEI references after Phase C, with no auth-boundary coverage regressions.

## Evidence
- `docs/records/evidence/kei/`
- `docs/records/evidence/kei/2026-02-20-phase-a-runtime-caller-removal.md`
- `docs/records/evidence/kei/2026-02-20-phase-b-coverage-replacement-and-fast-lane-update.md`
- `docs/records/evidence/kei/2026-02-20-phase-c-hold-window-validation.md`
- `docs/records/evidence/kei/2026-02-20-phase-c-kei-surface-deletion.md`
