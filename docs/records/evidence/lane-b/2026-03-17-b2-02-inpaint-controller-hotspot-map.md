# Lane B Hotspot Map: B2-02 useInpaintMaskController

date_utc: 2026-03-17  
slice_id: B2-02  
track: B-Core  
owner: Engineering  
linked_pr: n/a (planning/control artifact)

## Purpose
1. Record the current decomposition surface inside `useInpaintMaskController.ts` before opening the next Lane B extraction slice.
2. Keep Lane B moving to the next hotspot after the `B2-01` Expert Edit controller checkpoint instead of continuing low-yield seam work in the prior hotspot.
3. Lock a characterization-first rule because current repo coverage for this module is helper-heavy and does not yet fully characterize hook behavior.

## Current State
1. `useInpaintMaskController.ts` is `1801` lines and remains above the Lane B warn-mode budget (`1400`).
2. The file mixes at least five distinct responsibilities:
   - pure geometry and coordinate mapping,
   - contour derivation and marching-ants rendering,
   - mask-canvas analysis/throttling/animation,
   - pointer-session interaction logic for brush/lasso,
   - hook-level lifecycle/effect orchestration and export/snapshot flows.
3. Existing test coverage is useful but incomplete for modularization:
   - `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts` covers exported helpers,
   - the repo does not yet have strong hook-behavior characterization for pointer lifecycle, snapshot restore, or export flow.

## Remaining Domain Clusters
### 1. Pure coordinate and geometry helpers
Includes:
1. `resolveSceneCanvasPoint`
2. `toClampedCanvasPoint`
3. `mapSurfacePointToMaskCanvasPoint`
4. `resolveMaskSpaceScaleFromSurface`
5. `resolveInpaintBrushPaintRadius`
6. `resolveMaskExportSourceWindow`

Why it matters:
1. These are pure transforms with stable inputs/outputs.
2. They already have meaningful helper coverage and are strong early extraction candidates.
3. Moving them first reduces hook bulk without increasing orchestration ambiguity.

### 2. Contour derivation and overlay rendering helpers
Includes:
1. `buildContourPathsFromSegments`
2. `deriveMaskContourFromAlpha`
3. `renderOverlayFrame`
4. lasso preview mapping and stroke-width helpers
5. marching-ants cadence helpers

Why it matters:
1. This is a coherent render/math domain separate from hook state ownership.
2. It is large enough to warrant its own module, but should remain pure/render-oriented rather than becoming another heavy hook.
3. It likely needs no behavioral rewrite, only clearer module ownership.

### 3. Mask analysis and animation orchestration
Includes:
1. `analyzeLayerMask`
2. `queueLayerAnalysis`
3. `renderOverlay`
4. `renderOverlayNow`
5. `animateOverlay`
6. `stopOverlayAnimation`

Why it matters:
1. This is the first true orchestration cluster inside the hook.
2. It owns timers, animation frames, and selected-layer overlay lifecycle.
3. It is coupled to refs and selected-layer state, so extraction should follow characterization and pure-helper isolation.

### 4. Pointer-session interaction controller
Includes:
1. `resolveMaskInteractionPoint`
2. `onPointerDown`
3. `onPointerMove`
4. `onPointerUp`
5. `onPointerCancel`
6. `onPointerLeave`
7. `endPointerSession`
8. brush/lasso mutation helpers

Why it matters:
1. This is the main interaction state machine for the hook.
2. It is a strong eventual controller boundary, but risk is higher because behavior coverage is currently weaker than `B2-01`.
3. It should not be the first extraction until characterization is stronger.

### 5. Snapshot/export and lifecycle effects
Includes:
1. `captureMaskSnapshot`
2. `restoreMaskSnapshot`
3. `clearAllMasks`
4. `clearLayerMask`
5. `invertLayerMask`
6. `exportSelectedLayerMaskBlob`
7. dropzone/image/layer synchronization effects

Why it matters:
1. This area crosses persistence, export, and hook synchronization responsibilities.
2. It is important but should stay behind clearer lower-level boundaries first.
3. It is not the right first extraction target.

## Extraction Readiness Ranking
1. `Pure coordinate and geometry helpers`
   - Highest-confidence first move.
   - Pure logic, explicit inputs/outputs, helper tests already present.
2. `Contour derivation and overlay rendering helpers`
   - Also strong, but a little larger and more visually coupled.
   - Good follow-up after geometry helpers are separated.
3. `Mask analysis and animation orchestration`
   - Good mid-stage boundary after characterization improves.
4. `Pointer-session interaction controller`
   - Strong eventual boundary, but should follow characterization lock.
5. `Snapshot/export and lifecycle effects`
   - Defer until lower-level boundaries are cleaner.

## Recommended Next Sequence
1. Open `B2-02` with characterization-first work:
   - add or expand tests that cover hook behavior for pointer-session lifecycle, snapshot restore, and export behavior.
2. Take a pure-helper extraction slice for geometry/mask-space math.
3. Follow with a pure overlay/contour extraction slice if the first slice stays green and materially shrinks the hook.
4. Reassess whether the remaining hook is ready for an internal interaction-controller extraction.
5. Do not jump to pointer/session extraction before stronger characterization exists.

## Explicit Do-Not-Do List
1. Do not begin with a broad hook split that mixes geometry, rendering, and pointer state in one move.
2. Do not continue `B2-01` seam hunting unless a new hotspot map proves a major remaining boundary.
3. Do not treat helper-test coverage as sufficient proof for pointer-session parity.
4. Do not create generic canvas utility files with vague ownership.

## Immediate Next Slice Criteria
The next accepted `B2-02` slice should satisfy all of:
1. It starts with characterization or pure-helper extraction, not controller speculation.
2. It reduces `useInpaintMaskController.ts` while keeping module ownership clearer than before.
3. It preserves the existing helper tests and adds coverage where the hook currently lacks behavioral characterization.
4. It keeps Lane B aligned with controller-first extraction only after risk is reduced by tests and lower-level helper isolation.

## Stop-Condition Alignment Note
1. `B2-01` has now landed three controller boundaries and brought `ExpertEditPanelView.tsx` below warn budget.
2. No additional `B2-01` seam is currently justified strongly enough to outrank starting the next planned hotspot.
3. Lane B should therefore move to `B2-02` rather than continuing `ExpertEditPanelView` cleanup by momentum.
