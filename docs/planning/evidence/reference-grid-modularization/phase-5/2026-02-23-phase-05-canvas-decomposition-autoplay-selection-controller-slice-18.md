# Phase 5 Canvas Decomposition Autoplay Selection Controller (Slice 18)

Date (UTC): 2026-02-23
Phase: 5 (Canvas + State Decomposition)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Slice 18 Done-State Definition
This slice is complete only when all of the following are true:
1. Autoplay selection/recompute logic and related runtime ref synchronization are extracted from `ReferenceCanvas` into a dedicated controller hook.
2. `ReferenceCanvas` consumes extracted autoplay selection controller without behavior changes.
3. Existing curated/paste/selector/drop suites remain green.
4. Lint and type checks remain green.

## Slice 18 Done-State Attestation
1. Added autoplay selection controller hook:
   - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridAutoplaySelectionController.ts`
2. Rewired `ReferenceCanvas` to consume extracted `recomputeAutoplayBudget` callback and ref-sync side effects.
3. Removed in-component autoplay selection derivation block and related sync effects from `ReferenceCanvas`.
4. Existing parity suites remained green after extraction.

## Scope
In scope:
1. Extract visible-video prioritization and `autoplayEnabledIds` selection logic.
2. Extract `recomputeAutoplayBudgetRef`, `desiredVideoAttachBudgetRef`, and `autoplayEnabledIdsStateRef` synchronization effects.
3. Preserve existing autoplay selection semantics and thresholds.

Out of scope:
1. Autoplay selection algorithm changes.
2. `useAiStudioState` decomposition.
3. Phase 5 closeout.

## Files Added
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridAutoplaySelectionController.ts`

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
1. Continued extracting selection/runtime policy into focused controller hooks.
2. Kept behavior stable by preserving existing selection and ref-sync semantics.

## Regression Review
1. No regressions observed in parity suites.
2. Autoplay selection behavior remains unchanged.

## Rollback Readiness
- Rollback path: revert this slice changes to restore autoplay selection orchestration inside `ReferenceCanvas`.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: keep Phase 5 in progress and continue with next decomposition slice.
