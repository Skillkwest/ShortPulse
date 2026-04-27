# Lane B Evidence Packet: B2-03 Media Library Selection Controller Split

date_utc: 2026-03-17  
slice_id: B2-03  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope
1. Extract preview modal state, preview URL resolution, prompt selection, and all-media media selection/context-menu behavior from `MediaLibraryPanel.tsx` into `useMediaLibraryPanelSelectionController.ts`.
2. Keep `MediaLibraryPanel` behavior unchanged while isolating the preview/selection boundary identified in the `B2-03` hotspot map.
3. Use the existing `MediaLibraryPanel` component test suite as the regression floor for the extraction.

## Files Updated
1. `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
2. `frontend/features/ai-studio/hooks/useMediaLibraryPanelSelectionController.ts`
3. `docs/planning/evidence/lane-b/README.md`
4. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`
5. `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`
6. `docs/planning/evidence/lane-b/2026-03-17-b2-03-media-library-selection-controller-split.md`

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
| `check:size-budget` | 0 | pass (`MediaLibraryPanel.tsx` improved from `1570` to `1469` lines and remains below the `1600`-line warn budget) |
| `docs:check` | 0 | pass |

## LOC Or Coupling Delta
1. `MediaLibraryPanel.tsx`: `1570` -> `1469` (`-101` lines, `wc -l`).
2. `useMediaLibraryPanelSelectionController.ts`: new file at `189` lines.
3. Coupling reduction:
   - preview modal state and resolution no longer live directly in the panel,
   - all-media right-click selection and double-click preview flows now sit behind one named controller boundary,
   - prompt selection behavior now shares the same selection-oriented controller instead of remaining inline panel wiring.

## Net Complexity Note
1. Net complexity improved because the new hook groups one stable behavior family instead of scattering small helper moves.
2. The remaining panel surface now skews toward preview signing/hydration and render composition, which are higher-coupling concerns than the already-extracted loader/mutation/selection clusters.
3. This is the point where `B2-03` should checkpoint rather than continue shaving the same hotspot.

## Seam Selection Rationale
1. This slice cleared the `B2-03` hotspot map as the last justified controller seam before checkpoint:
   - it isolates preview/selection orchestration,
   - it keeps the broad component test suite as the behavior contract,
   - it further reduces the hotspot after the loader and mutation controller splits.
2. It avoids presenter churn and does not introduce generic utility drift.

## Parity Assertions
1. `MediaLibraryPanel` public props remained unchanged.
2. No API/server/schema changes.
3. Existing behaviors around all-media right-click selection, preview-modal opening, prompt selection, and folder-change modal reset remained covered by the panel test suite and stayed green.

## Task Contract Checklist
1. Behavior/API parity: pass.
2. Required gates: pass.
3. Net complexity improved with a real selection/controller boundary: pass.
4. Docs/tracker/evidence parity: pass.
5. Seam-selection rubric cleared: pass.
6. Audit findings: `blocking=0`, `non-blocking=0`, `deferred=1`.

## Deferred
1. `LB-DEFER-009`: revisit `B2-03` only if later lane work shows a clearly bounded preview-signing/runtime ownership seam worth extracting without presenter churn.

## Rollback Note
1. Revert this slice commit to inline the selection controller back into `MediaLibraryPanel.tsx`.
2. No data migration or runtime rollback required.

## Linked Plan Artifacts
1. `docs/archive/planning/lane-b-master-plan-2026-03-16.md`
2. `docs/archive/planning/lane-b-tracker-spec-2026-03-16.md`
3. `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`
4. `docs/planning/evidence/lane-b/2026-03-17-b2-03-media-library-hotspot-map.md`

