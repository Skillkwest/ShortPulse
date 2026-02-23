# Phase 5 Canvas Decomposition Card Drag Controller (Slice 12)

Date (UTC): 2026-02-23
Phase: 5 (Canvas + State Decomposition)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Slice 12 Done-State Definition
This slice is complete only when all of the following are true:
1. Card drag start/end protocol handlers are extracted from `ReferenceCanvas` into a dedicated controller hook.
2. `ReferenceCanvas` consumes extracted handlers without changing drag payload semantics.
3. Existing curated/paste/selector/drop suites remain green.
4. Lint and type checks remain green.

## Slice 12 Done-State Attestation
1. Added card drag controller hook:
   - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardDragController.ts`
2. Rewired `ReferenceCanvas` to consume extracted card drag handlers.
3. Removed in-component card drag start/end callbacks from `ReferenceCanvas`.
4. Existing parity suites remained green after extraction.

## Scope
In scope:
1. Extract drag-start payload wiring (`prepareReferenceDrag`).
2. Extract drag-end cleanup wiring (`clearDragState`).
3. Preserve existing drag source-surface semantics.

Out of scope:
1. DnD payload schema changes.
2. `useAiStudioState` decomposition.
3. Phase 5 closeout.

## Files Added
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardDragController.ts`

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
1. Continued small, reversible extraction of interaction protocol handlers.
2. Kept drag protocol ownership centralized in a single controller hook.

## Regression Review
1. No regressions observed in parity suites.
2. Existing drag/drop behavior remains unchanged.

## Rollback Readiness
- Rollback path: revert this slice changes to restore card drag handlers directly in `ReferenceCanvas`.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: keep Phase 5 in progress and continue with next decomposition slice.
