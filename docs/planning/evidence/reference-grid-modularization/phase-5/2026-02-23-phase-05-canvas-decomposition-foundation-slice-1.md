# Phase 5 Canvas Decomposition Foundation (Slice 1)

Date (UTC): 2026-02-23
Phase: 5 (Canvas + State Decomposition)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Phase Done-State Contract (Unchanged)
Phase 5 remains complete only when all of the following are true:
1. `ReferenceCanvas` is split into view + controller modules.
2. `useAiStudioState` reference concerns are split into domain services.
3. Behavior parity remains unchanged and phase gate tests are green.
4. Size-budget targets pass in the Phase 5 target lane.

## Slice 1 Done-State Definition
This slice is complete only when all of the following are true:
1. Reference-card rendering is moved out of `ReferenceCanvas` into a dedicated presentational module.
2. Clipboard/paste normalization and media URL parsing logic is moved out of `ReferenceCanvas` into a dedicated controller module.
3. Existing `ReferenceCanvas` paste/curated/selector tests remain green.
4. New unit tests cover the extracted clipboard controller behavior.

## Slice 1 Done-State Attestation
1. `ReferenceCanvasCard` extracted to:
   - `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasCard.tsx`
2. Clipboard controller extracted to:
   - `frontend/features/ai-studio/reference-grid/controllers/referenceGridClipboard.ts`
3. `ReferenceCanvas` now imports both modules and no longer contains duplicated implementations.
4. `ReferenceCanvas` line count reduced from 3489 to 2902 lines in this slice.

## Scope
In scope:
1. Extract reference-card presentational component.
2. Extract clipboard/paste parsing and normalization logic.
3. Add dedicated clipboard controller unit coverage.

Out of scope:
1. `useAiStudioState` decomposition.
2. Additional `ReferenceCanvas` controller extraction slices.
3. Phase 5 closeout.

## Files Added
- `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasCard.tsx`
- `frontend/features/ai-studio/reference-grid/controllers/referenceGridClipboard.ts`
- `frontend/features/ai-studio/reference-grid/controllers/__tests__/referenceGridClipboard.test.ts`

## Files Updated
- `frontend/features/ai-studio/components/ReferenceCanvas.tsx`
- `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
- `docs/change_log.md`

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run test -- ReferenceCanvas.paste.test.tsx ReferenceCanvas.curated.test.tsx ReferenceCanvas.selectorStore.test.tsx referenceGridClipboard.test.ts` | Pass | 52 tests passing |
| `npm -C frontend run lint` | Pass | no lint errors |
| `npm -C frontend run type-check` | Pass | no type errors |
| `npm -C frontend run check:architecture-boundary` | Pass | boundary checks green |
| `npm -C frontend run docs:check` | Pass | docs governance checks green |
| `npm -C frontend run check:size-budget` | Pass (warn lane expected) | hotspot budget warnings expected pre-closeout |

## Best-Practice Alignment
1. React modularization guidance was followed by extracting UI rendering and non-UI logic into dedicated modules before behavior changes:
   - https://react.dev/learn/extracting-state-logic-into-a-reducer
2. Incremental strangler migration was used (small reversible slice, parity tests, rollback-ready):
   - https://martinfowler.com/bliki/StranglerFigApplication.html

## Regression Review
1. Existing ReferenceCanvas behavior suites are green after extraction.
2. No behavior changes were introduced in paste ingestion, curated ordering, or selector-store fallback paths.

## Rollback Readiness
- Rollback path: revert this slice commit to restore in-file implementations.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: keep Phase 5 in progress and continue with next decomposition slice.
