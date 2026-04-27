# Lane B Evidence Packet: B2-01 Expert Edit Seam 24

date_utc: 2026-03-17  
slice_id: B2-01  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope
1. Extract the markup draw/erase pointer lifecycle from `ExpertEditPanelView` into `useExpertEditMarkupDrawController`.
2. Keep the panel responsible for orchestration while the new hook owns draw-session activation, pointer sampling, stroke append/erase, and terminal cleanup.
3. Land the first post-hotspot-map `B2-01` boundary extraction and validate that it materially reduces the hotspot.

## Files Updated
1. `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
2. `frontend/features/ai-studio/components/edit/useExpertEditMarkupDrawController.ts`
3. `docs/planning/evidence/lane-b/README.md`
4. `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-24.md`
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
| `check:size-budget` | 0 | pass (`ExpertEditPanelView.tsx` no longer exceeds Lane B warn-mode budget) |
| `docs:check` | 0 | pass |

## LOC Or Coupling Delta
1. `ExpertEditPanelView.tsx`: `5133` -> `4980` (`-153` lines, `wc -l`).
2. `useExpertEditMarkupDrawController.ts`: new file at `275` lines.
3. Coupling reduction:
   - Markup draw/erase pointer lifecycle now lives behind a dedicated controller hook.
   - `ExpertEditPanelView` no longer owns the internal draw-session state machine directly.
   - The extraction follows the hotspot-map boundary ranking rather than helper-level cleanup.

## Net Complexity Note
1. Net complexity improved despite the new file because the extracted hook has a clear domain boundary: markup draw interaction control.
2. The hotspot shrank materially and dropped below the Lane B warn-mode budget, which is the strongest available objective signal for this slice.
3. This is not generic utility growth; it is a controller boundary that prepares later separation between markup draw and markup viewport/pan concerns.

## Seam Selection Rationale
1. This slice cleared the Lane B rubric as a `shared_extraction` because it created a stable, well-named domain boundary with strong internal cohesion.
2. The extracted controller owns one responsibility cluster: draw/erase pointer session lifecycle.
3. It directly followed the `B2-01` hotspot map recommendation and materially improved the next extraction path for markup interactions.

## Parity Assertions
1. `ExpertEditPanelView` prop contract remained unchanged.
2. No API/server/schema changes.
3. Markup draw, erase, pointer terminal, and leave behavior remained unchanged; extraction-only seam.

## Task Contract Checklist
1. Behavior/API parity: pass.
2. Required gates: pass.
3. Net complexity improved with a real controller boundary: pass.
4. Docs/tracker/evidence parity: pass.
5. Seam-selection rubric cleared: pass.
6. Audit findings: `blocking=0`, `non-blocking=0`, `deferred=1`.

## Deferred
1. `LB-DEFER-003`: `B2-01` remains in progress; markup viewport/pan and transform-session boundaries still remain.

## Rollback Note
1. Revert this slice commit to inline the markup draw lifecycle back into `ExpertEditPanelView`.
2. No data migration or runtime flag rollback required.

## Linked Plan Artifacts
1. `docs/archive/planning/lane-b-master-plan-2026-03-16.md`
2. `docs/archive/planning/lane-b-tracker-spec-2026-03-16.md`
3. `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`
4. `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-hotspot-map.md`
