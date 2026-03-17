# Lane B Evidence Packet: B2-01 Expert Edit Seam 2

date_utc: 2026-03-16  
slice_id: B2-01  
track: B-Core  
owner: Engineering  
linked_pr: n/a (local execution slice)

## Scope
1. Extract viewport, zoom, and pan helper constants/types/utilities out of `ExpertEditPanelView`.
2. Keep `ExpertEditPanelView` public props/behavior unchanged.
3. Keep B2-01 in progress; no cross-domain extraction in this slice.

## Files Updated
1. `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
2. `frontend/features/ai-studio/components/edit/expertEditViewportUtils.ts`
3. `docs/planning/evidence/lane-b/README.md`
4. `docs/planning/evidence/lane-b/2026-03-16-b2-01-expert-edit-seam-2.md`
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
1. `ExpertEditPanelView.tsx`: `5978` -> `5887` (`-91` lines, size-budget script count).
2. New module: `expertEditViewportUtils.ts` (`119` lines).
3. Coupling reduction:
   - Stage viewport sizing, renderable viewport fallback, pan-offset conversion, and move-stage zoom conversions moved into a dedicated edit-domain utility module.
   - Viewport constant authority moved out of page-level orchestration scope.

## Parity Assertions
1. `ExpertEditPanelView` prop contract remained unchanged.
2. No API/server/schema changes.
3. No behavior changes to stage viewport/zoom semantics (utility extraction only).

## Task Contract Checklist
1. Behavior/API parity: pass.
2. Required gates: pass.
3. Docs/tracker/evidence parity: pass.
4. Audit findings: `blocking=0`, `non-blocking=0`, `deferred=1`.

## Deferred
1. `LB-DEFER-003`: `B2-01` remains in progress; additional seams are required to reach Expert Edit target size-budget convergence.

## Rollback Note
1. Revert this slice commit to inline viewport/zoom/pan utilities back into `ExpertEditPanelView`.
2. No data migration or runtime flag rollback required.

## Linked Plan Artifacts
1. `docs/planning/lane-b-master-plan-2026-03-16.md`
2. `docs/planning/lane-b-tracker-spec-2026-03-16.md`
3. `docs/planning/lane-b-execution-plan-2026-03-16.md`
