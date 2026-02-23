# Phase 5 Canvas Decomposition Viewport Projection Controller (Slice 21)

Date (UTC): 2026-02-23
Phase: 5 (Canvas + State Decomposition)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Slice 21 Done-State Definition
This slice is complete only when all of the following are true:
1. Virtual-window and viewport projection derivations are extracted from `ReferenceCanvas` into a dedicated controller hook.
2. `ReferenceCanvas` consumes extracted projection outputs without behavior changes for overscan, hard viewport capping, visible slices, spacer heights, or near-viewport queues.
3. Existing curated/paste/selector/drop suites remain green.
4. Lint/type checks remain green.

## Slice 21 Done-State Attestation
1. Added viewport projection controller hook:
   - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridViewportProjectionController.ts`
2. Rewired `ReferenceCanvas` to consume hook-derived window/projection outputs (`visibleOutputs`, `visibleCuratedOutputs`, `renderedOutputIdSet`, spacers, near-viewport sets).
3. Removed in-component overscan/window/projection derivation block from `ReferenceCanvas`.
4. Existing parity suites remained green after extraction.

## Scope
In scope:
1. Extract virtual window derivation.
2. Extract hard viewport cap projection.
3. Extract near-viewport derivation for hydration queueing.

Out of scope:
1. Changes to virtualization policy values.
2. Changes to hydration policy behavior.
3. `useAiStudioState` decomposition.

## Files Added
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridViewportProjectionController.ts`

## Files Updated
- `frontend/features/ai-studio/components/ReferenceCanvas.tsx`
- `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
- `docs/change_log.md`

## Validation Snapshot
- `ReferenceCanvas.tsx` line count moved to `1047` lines.
- Target lane remains warn-only and still flags `ReferenceCanvas.tsx`, `MediaLibraryModal.tsx`, and `useAiStudioState.ts`.

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run test -- ReferenceCanvas.curated.test.tsx ReferenceCanvas.paste.test.tsx ReferenceCanvas.selectorStore.test.tsx AiStudioPageContent.drop.test.tsx` | Pass | 55 tests passing |
| `npm -C frontend run lint` | Pass | no lint warnings/errors |
| `npm -C frontend run type-check` | Pass | no type errors |

## Best-Practice Alignment
1. Extracted deterministic projection logic into a focused controller to keep render orchestration lean.
2. Preserved existing flags and policy values to avoid behavior drift.
3. Kept a strangler-style adapter seam so future decomposition can continue without broad rewrites.

## Regression Review
1. No regressions observed in parity suites.

## Rollback Readiness
- Rollback path: revert this slice changes to restore viewport-projection derivations in `ReferenceCanvas`.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: keep Phase 5 in progress and continue with next decomposition slice.
