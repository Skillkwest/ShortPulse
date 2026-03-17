# Lane B Evidence Packet: B2-03 Media Library Mutation Controller Split

date_utc: 2026-03-17  
slice_id: B2-03  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope
1. Extract folder assignment, folder removal, upload-to-folder, and delete-confirm mutation workflows from `MediaLibraryPanel.tsx` into `useMediaLibraryPanelMutationController.ts`.
2. Keep `MediaLibraryPanel` behavior unchanged while isolating the write-side controller boundary identified by the `B2-03` hotspot map.
3. Preserve the existing `MediaLibraryPanel` component test suite as the regression floor for the extraction.

## Files Updated
1. `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
2. `frontend/features/ai-studio/hooks/useMediaLibraryPanelMutationController.ts`
3. `docs/planning/evidence/lane-b/README.md`
4. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`
5. `docs/planning/evidence/lane-b/2026-03-17-b2-03-media-library-mutation-controller-split.md`

## Commands Run
1. `npm -C frontend run test -- features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run build`
5. `npm -C frontend run check:architecture-boundary`
6. `npm -C frontend run check:size-budget`
7. `npm -C frontend run docs:check`

## Results
| command | exit_code | result |
| --- | --- | --- |
| `test -- MediaLibraryPanel.test.tsx` | 0 | pass (`1` file, `35` tests) |
| `type-check` | 0 | pass |
| `lint` | 0 | pass (`7` warnings, no new errors) |
| `build` | 0 | pass |
| `check:architecture-boundary` | 0 | pass |
| `check:size-budget` | 0 | pass (`MediaLibraryPanel.tsx` improved from `1801` to `1570` lines and is now below the `1600`-line warn budget) |
| `docs:check` | 0 | pass |

## LOC Or Coupling Delta
1. `MediaLibraryPanel.tsx`: `1801` -> `1570` (`-231` lines, `wc -l`).
2. `useMediaLibraryPanelMutationController.ts`: new file at `315` lines.
3. Coupling reduction:
   - write-side workflows no longer live directly in the panel component,
   - folder membership mutations, upload destination routing, delete-confirm state, and destructive delete side effects now sit behind one named controller boundary,
   - the panel now delegates write flows instead of owning the mutation plumbing inline.

## Net Complexity Note
1. Net complexity improved because the extraction created one durable mutation/controller module rather than scattering one-off helpers.
2. The new hook centralizes workflow state that was already internally coupled in the panel, so the overall ownership model is clearer after the move.
3. The remaining hotspot work is now biased toward preview/signing or drag/drop ownership, not further mutation cleanup inside the panel.

## Seam Selection Rationale
1. This slice matched the `B2-03` hotspot map sequence exactly: take the write-side mutation boundary immediately after the loader boundary.
2. It materially reduced the hotspot and brought `MediaLibraryPanel.tsx` below its warn-mode budget.
3. It used the existing `MediaLibraryPanel` behavior suite as the contract and avoided presenter churn.

## Parity Assertions
1. `MediaLibraryPanel` public props remained unchanged.
2. No API/server/schema changes.
3. Existing behaviors around folder assignment, uploads, delete confirmation, and list refresh remained covered by the panel test suite and stayed green.

## Task Contract Checklist
1. Behavior/API parity: pass.
2. Required gates: pass.
3. Net complexity improved with a real mutation/controller boundary: pass.
4. Docs/tracker/evidence parity: pass.
5. Seam-selection rubric cleared: pass.
6. Audit findings: `blocking=0`, `non-blocking=0`, `deferred=1`.

## Deferred
1. `LB-DEFER-008`: `B2-03` still needs a follow-up boundary around preview modal/selection orchestration or another equally coherent controller seam before any presenter-only split.

## Rollback Note
1. Revert this slice commit to inline the mutation controller back into `MediaLibraryPanel.tsx`.
2. No data migration or runtime rollback required.

## Linked Plan Artifacts
1. `docs/planning/lane-b-master-plan-2026-03-16.md`
2. `docs/planning/lane-b-tracker-spec-2026-03-16.md`
3. `docs/planning/lane-b-execution-plan-2026-03-16.md`
4. `docs/planning/evidence/lane-b/2026-03-17-b2-03-media-library-hotspot-map.md`
