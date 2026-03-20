# CP-301 / CP-302 Evidence Packet - Mask And Export Contract Progress

## Packet Metadata
1. Packet ID: `CP-301-302-2026-03-20-MASK-EXPORT-CONTRACT-PROGRESS`
2. Phase / Tracker rows: `P3 / CP-301, CP-302`
3. Date (UTC): `2026-03-20`
4. Owners: AI Studio FE
5. Branch / commit: `editor-fix / ba8c5120`
6. Environment: local dev workspace (`frontend`)

## Scope
1. Surfaces covered: inline + modal inpaint overlays (shared mask controller)
2. Modes covered: inpaint brush/lasso mask rendering + submit mask export path
3. Matrix slices covered: unit/integration command set for current implementation slice

## Implementation Evidence
1. Canonical selected-layer mask resolution:
   - `frontend/features/ai-studio/components/edit/useInpaintMaskController.ts`
   - selected layer mask canvas now resolves to selected image natural pixel dimensions when available.
2. Canonical scene remap on mask-canvas resize:
   - `remapMaskCanvasToSize` uses scene-preserving mapping (`resolveSceneMappedDrawRect`) to avoid geometry distortion.
3. Export camera/crop parity with flatten contract:
   - export now draws mask via `resolveContainSizeForStage(...)` + `resolveStageFlattenCameraTransform(...)` in one path.
   - removed legacy mask export source-window crop logic from submit path.
4. Regression coverage:
   - `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`
   - added contain-fit export geometry assertion (`4x2 -> 16x16` maps to `16x8` centered draw).

## Validation Commands
1. `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`
2. `npm -C frontend run test -- features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
3. `npm -C frontend run type-check`
4. `npm -C frontend run lint`
5. `npm -C frontend run build`

## Validation Result
1. All listed commands passed.
2. `lint` reported pre-existing warnings outside CP-301/CP-302 files; no new lint errors introduced.

## Outstanding Work
1. Run full Phase 3 matrix evidence (`zoom/pan/aspect/DPR`) for export alignment threshold (`<= 1 mask px`) before marking `CP-302` `DONE`.
2. Capture additional explicit evidence for non-zero pan + high zoom export parity runs in the final Phase 3 packet.
