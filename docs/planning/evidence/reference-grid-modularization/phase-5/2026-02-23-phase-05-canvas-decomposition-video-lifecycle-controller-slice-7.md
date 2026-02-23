# Phase 5 Canvas Decomposition Video Lifecycle Controller (Slice 7)

Date (UTC): 2026-02-23
Phase: 5 (Canvas + State Decomposition)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Slice 7 Done-State Definition
This slice is complete only when all of the following are true:
1. Video node registration and observer/autoplay lifecycle orchestration is extracted from `ReferenceCanvas` into a dedicated controller hook.
2. `ReferenceCanvas` consumes extracted video lifecycle callbacks without behavior changes to autoplay visibility, detach policy, or cleanup semantics.
3. Existing curated/paste/selector/drop suites remain green.
4. Lint and type checks remain green.

## Slice 7 Done-State Attestation
1. Added video lifecycle controller hook:
   - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVideoLifecycleController.ts`
2. Rewired `ReferenceCanvas` to consume extracted `registerVideoNode` callback and lifecycle orchestration.
3. Removed in-component video observer lifecycle effects (visibility observers, stale-node pruning, detach timeout cleanup, autoplay invalid-id pruning).
4. Existing parity suites remained green after extraction.

## Scope
In scope:
1. Extract card video node registration and observer attachment logic.
2. Extract all-refs/curated intersection observer lifecycle for autoplay visibility.
3. Extract autoplay detach timeout management and stale node cleanup.

Out of scope:
1. Autoplay attach-budget recompute policy extraction.
2. `useAiStudioState` decomposition.
3. Phase 5 closeout.

## Files Added
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVideoLifecycleController.ts`

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
| `npm -C frontend run check:architecture-boundary` | Pass | boundary checks green |
| `npm -C frontend run docs:check` | Pass | docs governance checks green |
| `npm -C frontend run check:size-budget` | Pass (warn lane expected) | hotspot budget warnings expected pre-closeout |
| `npm -C frontend run test:adaptive-v2-gate` | Pass | protected adaptive/reference lane green (existing modal unresolved-preview logs unchanged) |

## Best-Practice Alignment
1. Continued incremental controller extraction to isolate side-effectful runtime behavior from render composition.
2. Preserved no-regression parity by keeping autoplay budget policy logic unchanged and extracting only lifecycle plumbing.

## Regression Review
1. No regressions observed in quick-slot/all-refs autoplay visibility behavior.
2. Existing detach timing and observer cleanup semantics remain unchanged.

## Rollback Readiness
- Rollback path: revert this slice commit to restore video lifecycle orchestration inside `ReferenceCanvas`.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: keep Phase 5 in progress and continue with next decomposition slice.
