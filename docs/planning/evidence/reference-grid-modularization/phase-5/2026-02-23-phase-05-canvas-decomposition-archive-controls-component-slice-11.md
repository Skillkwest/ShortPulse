# Phase 5 Canvas Decomposition Archive Controls Component (Slice 11)

Date (UTC): 2026-02-23
Phase: 5 (Canvas + State Decomposition)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Slice 11 Done-State Definition
This slice is complete only when all of the following are true:
1. Header/archive inline/panel presentation blocks are extracted from `ReferenceCanvas` into a dedicated component.
2. `ReferenceCanvas` consumes the new component without changing add-files/media-library/archive UI behavior.
3. Existing curated/paste/selector/drop suites remain green.
4. Lint and type checks remain green.

## Slice 11 Done-State Attestation
1. Added archive controls component:
   - `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasArchiveControls.tsx`
2. Rewired both split and non-split layouts in `ReferenceCanvas` to consume shared archive controls.
3. Removed in-component header/archive presentation constants from `ReferenceCanvas`.
4. Existing parity suites remained green after extraction.

## Scope
In scope:
1. Extract `Reference Grid` header presentation.
2. Extract archive inline controls presentation.
3. Extract archive panel presentation.

Out of scope:
1. Archive state policy changes.
2. `useAiStudioState` decomposition.
3. Phase 5 closeout.

## Files Added
- `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasArchiveControls.tsx`

## Files Updated
- `frontend/features/ai-studio/components/ReferenceCanvas.tsx`
- `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
- `docs/change_log.md`

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run test -- ReferenceCanvas.curated.test.tsx ReferenceCanvas.paste.test.tsx ReferenceCanvas.selectorStore.test.tsx AiStudioPageContent.drop.test.tsx` | Pass | 55 tests passing |
| `npm -C frontend run lint` | Pass | no lint warnings/errors |
| `npm -C frontend run type-check` | Pass | no type errors |

## Best-Practice Alignment
1. Continued view/controller decomposition by extracting pure presentation from orchestration-heavy parent component.
2. Reduced duplicated split/non-split rendering logic by sharing one archive controls component.

## Regression Review
1. No regressions observed in parity suites.
2. Archive controls and add-files actions remain unchanged.

## Rollback Readiness
- Rollback path: revert this slice changes to restore header/archive presentation constants in `ReferenceCanvas`.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: keep Phase 5 in progress and continue with next decomposition slice.
