# Lane B Evidence Packet: B2-01 Expert Edit Seam 15

date_utc: 2026-03-17  
slice_id: B2-01  
track: B-Core  
owner: Engineering  
linked_pr: n/a (local execution slice)

## Scope
1. Extract owned-layer image URL collection and stale-owned-URL diff logic from `ExpertEditPanelView` into `expertEditLayerSessionUtils`.
2. Keep owned object-URL revoke behavior unchanged for layer replacement/removal and unmount cleanup.
3. Keep B2-01 scoped to Expert Edit seam extraction only.

## Files Updated
1. `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
2. `frontend/features/ai-studio/components/edit/expertEditLayerSessionUtils.ts`
3. `docs/records/evidence/lane-b/README.md`
4. `docs/records/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-15.md`
5. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`

## Commands Run
1. `npm -C frontend run test -- features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run build`
5. `npm -C frontend run check:architecture-boundary`
6. `npm -C frontend run check:size-budget`
7. `npm -C frontend run docs:check`

## Results
| command | exit_code | result |
| --- | --- | --- |
| `test -- ExpertEditPanelView.test.tsx` | 0 | pass (`1` file, `142` tests) |
| `type-check` | 0 | pass |
| `lint` | 0 | pass (`7` warnings, no new errors) |
| `build` | 0 | pass |
| `check:architecture-boundary` | 0 | pass |
| `check:size-budget` | 0 | pass (warn-mode overage signals remain; `ExpertEditPanelView.tsx` still above budget) |
| `docs:check` | 0 | pass |

## LOC Or Coupling Delta
1. `ExpertEditPanelView.tsx`: `5219` -> `5213` (`-6` lines, size-budget script count).
2. `expertEditLayerSessionUtils.ts`: `435` -> `461` (`+26` lines) with owned-layer image URL helpers.
3. Coupling reduction:
   - Owned layer URL collection/diff behavior moved into layer-session utility.
   - Layer-effect stale URL revoke and unmount owned URL revoke in `ExpertEditPanelView` now reuse shared helpers.

## Parity Assertions
1. `ExpertEditPanelView` prop contract remained unchanged.
2. No API/server/schema changes.
3. Owned object-URL revoke behavior remained unchanged for stale-layer and unmount cleanup paths; extraction-only seam.

## Task Contract Checklist
1. Behavior/API parity: pass.
2. Required gates: pass.
3. Docs/tracker/evidence parity: pass.
4. Audit findings: `blocking=0`, `non-blocking=0`, `deferred=1`.

## Deferred
1. `LB-DEFER-003`: `B2-01` remains in progress; additional seams are required to reach Expert Edit target size-budget convergence.

## Rollback Note
1. Revert this slice commit to inline owned-layer image URL collection/diff logic back into `ExpertEditPanelView`.
2. No data migration or runtime flag rollback required.

## Linked Plan Artifacts
1. `docs/archive/planning/lane-b-master-plan-2026-03-16.md`
2. `docs/archive/planning/lane-b-tracker-spec-2026-03-16.md`
3. `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`
