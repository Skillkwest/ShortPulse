# Phase 5 Canvas Decomposition Image Hydration Controller (Slice 20)

Date (UTC): 2026-02-23
Phase: 5 (Canvas + State Decomposition)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Slice 20 Done-State Definition
This slice is complete only when all of the following are true:
1. Image hydration/decode queue runtime is extracted from `ReferenceCanvas` into a dedicated controller hook.
2. `ReferenceCanvas` consumes extracted hydration APIs without behavior changes to queueing, fallback, adaptive local transcode, or object URL cleanup.
3. Existing curated/paste/selector/drop suites remain green.
4. Lint/type checks and adaptive-v2 protected gate remain green.

## Slice 20 Done-State Attestation
1. Added image hydration controller hook:
   - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridImageHydrationController.ts`
2. Rewired `ReferenceCanvas` to consume `imageHydrationState`, `enqueueImageHydration`, and queue-prune API from extracted hook.
3. Moved stale hydration-id cleanup and hydration object URL teardown lifecycle into the extracted hook.
4. Removed in-component hydration queue refs/callbacks/effects from `ReferenceCanvas`.

## Scope
In scope:
1. Extract hydration queue/decode runtime.
2. Extract adaptive local preview transcode lifecycle for hydration path.
3. Preserve existing hydration scheduling and queue pruning behavior.

Out of scope:
1. Behavior changes to hydration policy.
2. `useAiStudioState` decomposition.
3. Phase 5 closeout.

## Files Added
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridImageHydrationController.ts`

## Files Updated
- `frontend/features/ai-studio/components/ReferenceCanvas.tsx`
- `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
- `docs/change_log.md`

## Validation Snapshot
- `ReferenceCanvas.tsx` line count moved to `1135` lines (from pre-slice 1545).
- Target lane remains warn-only and still flags `ReferenceCanvas.tsx`, `MediaLibraryModal.tsx`, and `useAiStudioState.ts`.

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run test -- ReferenceCanvas.curated.test.tsx ReferenceCanvas.paste.test.tsx ReferenceCanvas.selectorStore.test.tsx AiStudioPageContent.drop.test.tsx` | Pass | 55 tests passing |
| `npm -C frontend run lint` | Pass | no lint warnings/errors |
| `npm -C frontend run type-check` | Pass | no type errors |
| `npm -C frontend run docs:check` | Pass | docs/semantic/migration/archive checks passing |
| `npm -C frontend run check:architecture-boundary` | Pass | boundary checks passing |
| `npm -C frontend run check:size-budget` | Pass (warn lane) | expected reference-grid target-lane warnings |
| `npm -C frontend run test:adaptive-v2-gate` | Pass | protected adaptive/reference/media suite passing |

## Best-Practice Alignment
1. Kept render component thin by extracting stateful runtime concerns into a single-purpose controller.
2. Preserved existing behavior contracts and side-effect sequencing through adapter-style API.
3. Maintained no-regression promotion discipline with parity + guardrail checks.

## Regression Review
1. No regressions observed in targeted parity suites.
2. Adaptive-v2 protected gate remains green.

## Rollback Readiness
- Rollback path: revert this slice changes to restore hydration runtime to `ReferenceCanvas`.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: keep Phase 5 in progress and continue with next decomposition slice.
