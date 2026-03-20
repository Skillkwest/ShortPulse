# CP-401 Evidence Packet - Transform And Threshold Harness Progress

## Packet Metadata
1. Packet ID: `CP-401-2026-03-20-TRANSFORM-THRESHOLD-HARNESS-PROGRESS`
2. Phase / Tracker row: `P4 / CP-401`
3. Date (UTC): `2026-03-20`
4. Owners: AI Studio FE
5. Branch / commit: `editor-fix / pending`
6. Environment: local dev workspace (`frontend`)

## Scope
1. Surfaces covered: shared stage geometry + markup pointer mapping + inpaint interaction mapping + flatten camera normalization.
2. Modes covered: deterministic transform/unit invariants only (no browser visual capture in this packet).
3. Matrix slices covered: canonical zoom set `{0.5,1,2,4}` and canonical pan tuple set `{(0,0),(37,-19),(-120,80)}` in unit tests.

## Implementation Evidence
1. Added canonical zoom/pan round-trip test coverage in:
   - `frontend/features/ai-studio/components/edit/__tests__/stageSceneGeometry.test.ts`
2. Added canonical zoom/pan pointer-to-scene mapping assertions in:
   - `frontend/features/ai-studio/components/edit/__tests__/markupStrokeController.test.ts`
3. Added canonical zoom/pan mask interaction mapping assertions in:
   - `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`
4. Added canonical zoom/pan camera offset normalization assertions in:
   - `frontend/features/ai-studio/logic/__tests__/expertEditStageFlatten.test.ts`

## Validation Commands
1. `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/stageSceneGeometry.test.ts features/ai-studio/components/edit/__tests__/markupStrokeController.test.ts features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts features/ai-studio/logic/__tests__/expertEditStageFlatten.test.ts`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run build`

## Validation Result
1. All listed commands passed.
2. `lint` reported pre-existing warnings outside CP-401 files; no new lint errors were introduced.

## Status Decision
1. `CP-401`: `IN_PROGRESS` with core transform-harness matrix coverage now landed in unit suites.
2. Final `CP-401 DONE` decision remains gated behind:
   - Phase 4 row alignment (`CP-402`, `CP-403`, `CP-404`) per tracker exit criteria.

## Outstanding Work
1. Fold these unit harness updates into consolidated Phase 4 evidence.
2. Add CI-gated parity command wiring (`CP-404`) and visual drift harness evidence (`CP-403`).
