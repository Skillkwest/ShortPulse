# CP-004 Baseline Coverage Gap Inventory (2026-03-20)

## Purpose
Provide an explicit, repo-backed inventory of what the current automated baseline already covers versus what still blocks `CP-004` closeout.

This artifact supports:
1. `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp004-baseline-matrix.md`
2. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-tracker-2026-03-20.md`

## Waiver Status
1. `CP-004` is marked complete via approved waiver `CP-004-W1`.
2. Gaps listed below remain real residual risk and are intentionally carried forward into implementation validation.

## Current Automated Coverage (Confirmed)
### Inpaint zoom geometry and brush compensation
1. Pointer mapping under zoom is covered at `sceneScale: 0.5` and `sceneScale: 2`:
   - `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts:366`
   - `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts:378`
   - `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts:389`
2. Brush radius compensation under zoom is covered at `0.5`, `1`, and `2`:
   - `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts:462`
   - `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts:468`
   - `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts:472`

### Scene-space aspect mapping core
1. Aspect remapping tests currently validate `16:9 <-> 9:16` style transforms:
   - `frontend/features/ai-studio/components/edit/__tests__/stageSceneGeometry.test.ts:31`
   - `frontend/features/ai-studio/components/edit/__tests__/stageSceneGeometry.test.ts:35`
   - `frontend/features/ai-studio/components/edit/__tests__/stageSceneGeometry.test.ts:37`
   - `frontend/features/ai-studio/components/edit/__tests__/stageSceneGeometry.test.ts:38`

### Inline/modal viewport zoom propagation
1. Inline wheel zoom and modal viewport state propagation are covered:
   - `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx:2887`
2. Move-panel zoom slider behavior is covered for slider max (`value=100`), but this does not by itself assert `scale=4`:
   - `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx:3254`
   - `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx:3287`

## Remaining CP-004 Blocking Gaps
### Gap A: Explicit `zoom=4` parity evidence
1. Existing tests exercise non-default zoom, but CP-004 requires explicit baseline matrix closure at `zoom=4`.
2. This remains open in baseline packet + tracker.

### Gap B: Canonical pan tuple closure
1. CP-004 requires explicit tuple coverage for `(0,0)`, `(37,-19)`, `(-120,80)`.
2. Existing tests validate pan behavior qualitatively, but do not close this canonical tuple set in one packet.

### Gap C: Stage aspect `4:3` baseline slice
1. Current automated aspect tests are `16:9` and `9:16` oriented.
2. CP-004 still requires a `4:3` stage baseline row.

### Gap D: DPR matrix closure (`1`, `2`, `3`)
1. No explicit `deviceScaleFactor`/DPR matrix assertions were found across current parity-related tests:
   - repo-wide test search for `deviceScaleFactor`, `DPR`, and `pixelRatio` returned no parity-test hits.
2. CP-004 closeout still requires explicit DPR capture and threshold rollup.
3. Browser-backed capture harness is now available:
   - `frontend/tests/e2e/expert-edit-coordinate-parity.audit.js`
   - `npm -C frontend run test:e2e:expert-edit-parity`
4. In this workspace the harness is blocked by missing `PLAYWRIGHT_AUDIT_EMAIL` (empty in `frontend/.env.local`), so DPR matrix closure remains open.

## Additional Readiness Risk To Keep Visible
1. Viewport scale cap allows `4`, while flatten camera clamps at `3`:
   - `frontend/features/ai-studio/components/edit/expertEditViewportUtils.ts:7`
   - `frontend/features/ai-studio/logic/expertEditStageFlatten.ts:68`
2. This is already tracked in the coordinate-parity plan as a dedicated phase item, but it should be considered during baseline interpretation at high zoom.

## Required Next Action
1. Execute the CP-004 remaining closure run sheet in:
   - `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp004-baseline-matrix.md`
2. Keep implementation blocked until these four gaps are closed and `CP-004` is marked `DONE`.
