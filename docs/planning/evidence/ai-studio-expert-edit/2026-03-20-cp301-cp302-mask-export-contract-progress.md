# CP-301 / CP-302 Evidence Packet - Mask And Export Contract Status

## Packet Metadata
1. Packet ID: `CP-301-302-2026-03-20-MASK-EXPORT-CONTRACT-PROGRESS`
2. Phase / Tracker rows: `P3 / CP-301, CP-302`
3. Date (UTC): `2026-03-20`
4. Owners: AI Studio FE
5. Branch / commits: `editor-fix / ba8c5120, f357db5d`
6. Environment: local dev workspace (`frontend`)

## Scope
1. Surfaces covered: inline + modal inpaint overlays (shared mask controller)
2. Modes covered: inpaint brush/lasso mask rendering + submit mask export path
3. Matrix slices covered: local repo validation suite for mask/export parity and camera-framing parity

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

## Additional Regression Coverage
1. `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
   - `keeps flatten and inpaint mask export camera framing aligned under zoom and pan`
   - asserts mask export camera parity (`scale`, `offsetX`, `offsetY`, `viewport`) against flatten camera under non-zero pan + zoom.

## Validation Commands
1. `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/stageSceneGeometry.test.ts`
2. `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`
3. `npm -C frontend run test -- features/ai-studio/logic/__tests__/expertEditStageFlatten.test.ts`
4. `npm -C frontend run test -- features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
5. `npm -C frontend run type-check`
6. `npm -C frontend run lint`
7. `npm -C frontend run build`
8. `npm -C frontend run docs:check`

## Validation Result
1. All listed commands passed.
2. `lint` reported pre-existing warnings outside CP-301/CP-302 files; no new lint errors introduced.

## Status Decision
1. `CP-301`: `PASS` and ready for `DONE` in tracker.
2. `CP-302`: `PASS` for local automated validations; `HOLD` for final browser-backed matrix closure (`zoom/pan/aspect/DPR`) because this workspace still lacks credentialed Playwright parity capture.

## Outstanding Work
1. Run credentialed browser-backed parity matrix for `CP-302` (`zoom={0.5,1,2,4}`, canonical pan tuples, stage aspect variants, DPR `1/2/3`) and publish a closeout packet.
2. Once matrix evidence lands, flip `CP-302` to `DONE` and open `P4` (`CP-401` through `CP-404`).
