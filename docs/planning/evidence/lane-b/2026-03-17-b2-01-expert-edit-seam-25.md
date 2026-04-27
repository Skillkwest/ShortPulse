# Lane B Evidence Packet: B2-01 Expert Edit Seam 25

date_utc: 2026-03-17  
slice_id: B2-01  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope
1. Extract the markup viewport/pan lifecycle from `ExpertEditPanelView` into `useExpertEditMarkupViewportController`.
2. Keep the panel focused on orchestration while the new hook owns zoom slider updates, viewport reset, size synchronization, wheel zoom, and pan-session lifecycle.
3. Complete the paired markup interaction boundary identified in the `B2-01` hotspot map.

## Files Updated
1. `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
2. `frontend/features/ai-studio/components/edit/useExpertEditMarkupViewportController.ts`
3. `docs/planning/evidence/lane-b/README.md`
4. `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-25.md`
5. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`

## Commands Run
1. `npm -C frontend run test -- features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run check:architecture-boundary`
5. `npm -C frontend run check:size-budget`

## Results
| command | exit_code | result |
| --- | --- | --- |
| `test -- ExpertEditPanelView.test.tsx` | 0 | pass (`1` file, `142` tests) |
| `type-check` | 0 | pass |
| `lint` | 0 | pass (`7` warnings, no new errors) |
| `check:architecture-boundary` | 0 | pass |
| `check:size-budget` | 0 | pass (`ExpertEditPanelView.tsx` remains below Lane B warn-mode budget) |

## LOC Or Coupling Delta
1. `ExpertEditPanelView.tsx`: `4980` -> `4823` (`-157` lines, `wc -l`).
2. `useExpertEditMarkupViewportController.ts`: new file at `272` lines.
3. Coupling reduction:
   - Markup viewport and pan interaction logic now lives behind its own controller hook.
   - The draw controller and viewport controller are now separate internal boundaries instead of one mixed interaction block.
   - `ExpertEditPanelView` no longer owns direct pan-session state transitions, wheel zoom math, or viewport reset mechanics.

## Net Complexity Note
1. Net complexity improved because the new controller is a coherent markup viewport boundary, not generic utility growth.
2. The hotspot dropped further below budget while the markup interaction domain became split into two named controllers.
3. This extraction makes the remaining `B2-01` work easier to judge: transform-session logic is now more isolated from markup concerns.

## Seam Selection Rationale
1. This slice cleared the Lane B rubric as a `shared_extraction` because it created a stable domain controller with clear ownership.
2. It directly follows the hotspot-map recommendation to pair markup draw extraction with markup viewport/pan extraction.
3. It materially improves the hotspot and reduces cross-domain coupling inside `ExpertEditPanelView`.

## Parity Assertions
1. `ExpertEditPanelView` prop contract remained unchanged.
2. No API/server/schema changes.
3. Markup viewport zoom, panning, recenter/reset, and wheel behavior remained unchanged; extraction-only seam.

## Task Contract Checklist
1. Behavior/API parity: pass.
2. Required gates: pass.
3. Net complexity improved with a real controller boundary: pass.
4. Docs/tracker/evidence parity: pass.
5. Seam-selection rubric cleared: pass.
6. Audit findings: `blocking=0`, `non-blocking=0`, `deferred=1`.

## Deferred
1. `LB-DEFER-003`: `B2-01` remains in progress; transform-session and remaining orchestration/presenter boundaries still remain.

## Rollback Note
1. Revert this slice commit to inline the viewport/pan lifecycle back into `ExpertEditPanelView`.
2. No data migration or runtime flag rollback required.

## Linked Plan Artifacts
1. `docs/archive/planning/lane-b-master-plan-2026-03-16.md`
2. `docs/archive/planning/lane-b-tracker-spec-2026-03-16.md`
3. `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`
4. `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-hotspot-map.md`
