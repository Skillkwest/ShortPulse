# Phase 5 Canvas Decomposition Card Items Controller (Slice 22)

Date (UTC): 2026-02-23
Phase: 5 (Canvas + State Decomposition)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Slice 22 Done-State Definition
This slice is complete only when all of the following are true:
1. Visible card-item derivation is extracted from `ReferenceCanvas` into a dedicated controller hook.
2. `ReferenceCanvas` consumes extracted card-item outputs without behavior changes to URL selection, hydration-source matching, or transformed adaptive preview counting.
3. Existing curated/paste/selector/drop suites remain green.
4. Lint/type checks remain green.

## Slice 22 Done-State Attestation
1. Added card-items controller hook:
   - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardItemsController.ts`
2. Rewired `ReferenceCanvas` to consume hook-managed `visibleCardItems`, `curatedVisibleCardItems`, `allVisibleCardItems`, and `transformedAdaptivePreviewCount`.
3. Removed in-component card-item URL and hydration-source matching derivations from `ReferenceCanvas`.
4. Existing parity suites remained green after extraction.

## Scope
In scope:
1. Extract card URL/preview/item derivation.
2. Extract hydration-aware image source assignment logic.
3. Extract transformed adaptive preview count derivation.

Out of scope:
1. Hydration queue scheduling behavior changes.
2. `useAiStudioState` decomposition.
3. Phase 5 closeout.

## Files Added
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardItemsController.ts`

## Files Updated
- `frontend/features/ai-studio/components/ReferenceCanvas.tsx`
- `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
- `docs/change_log.md`

## Validation Snapshot
- `ReferenceCanvas.tsx` line count reduced further during this and adjacent slices.

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run test -- ReferenceCanvas.curated.test.tsx ReferenceCanvas.paste.test.tsx ReferenceCanvas.selectorStore.test.tsx AiStudioPageContent.drop.test.tsx` | Pass | 55 tests passing |
| `npm -C frontend run lint` | Pass | no lint warnings/errors |
| `npm -C frontend run type-check` | Pass | no type errors |

## Best-Practice Alignment
1. Isolated deterministic card-derivation logic behind a focused controller seam.
2. Preserved no-regression behavior through parity tests and unchanged policy flags.

## Regression Review
1. No regressions observed in targeted parity suites.

## Rollback Readiness
- Rollback path: revert this slice changes to restore card-item derivation in `ReferenceCanvas`.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: keep Phase 5 in progress and continue with next decomposition slice.
