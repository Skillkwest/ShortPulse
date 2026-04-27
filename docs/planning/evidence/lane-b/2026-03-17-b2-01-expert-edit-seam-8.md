# Lane B Evidence Packet: B2-01 Expert Edit Seam 8

date_utc: 2026-03-17  
slice_id: B2-01  
track: B-Core  
owner: Engineering  
linked_pr: n/a (local execution slice)

## Scope
1. Extract layer reorder and layer-delete state transition resolution from `ExpertEditPanelView` into `expertEditLayerSessionUtils`.
2. Keep drag/drop MIME contract and layer-stack behavior unchanged.
3. Keep B2-01 scoped to Expert Edit seam extraction only.

## Files Updated
1. `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
2. `frontend/features/ai-studio/components/edit/expertEditLayerSessionUtils.ts`
3. `docs/planning/evidence/lane-b/README.md`
4. `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-8.md`
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
1. `ExpertEditPanelView.tsx`: `5326` -> `5287` (`-39` lines, size-budget script count).
2. `expertEditLayerSessionUtils.ts`: expanded with pure layer reorder/delete state transition helpers.
3. Coupling reduction:
   - Layer reorder index/selection remapping moved into dedicated layer-session utilities.
   - Drag-over/drop reorder source resolution moved into dedicated layer-session utilities.
   - Layer delete (foundation/non-foundation) selection/editing remap moved into dedicated layer-session utilities.

## Parity Assertions
1. `ExpertEditPanelView` prop contract remained unchanged.
2. No API/server/schema changes.
3. Layer reorder and layer delete behavior remained unchanged; extraction-only seam.
4. Test regression caught during seam execution (`dataTransfer.types` undefined in jsdom drag-over path) was fixed in-slice before final gate run.

## Task Contract Checklist
1. Behavior/API parity: pass.
2. Required gates: pass.
3. Docs/tracker/evidence parity: pass.
4. Audit findings: `blocking=0`, `non-blocking=0`, `deferred=1`.

## Deferred
1. `LB-DEFER-003`: `B2-01` remains in progress; additional seams are required to reach Expert Edit target size-budget convergence.

## Rollback Note
1. Revert this slice commit to inline layer reorder/delete state resolution back into `ExpertEditPanelView`.
2. No data migration or runtime flag rollback required.

## Linked Plan Artifacts
1. `docs/archive/planning/lane-b-master-plan-2026-03-16.md`
2. `docs/archive/planning/lane-b-tracker-spec-2026-03-16.md`
3. `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`
