# Phase 5 Canvas Decomposition Scroll Controller (Slice 5)

Date (UTC): 2026-02-23
Phase: 5 (Canvas + State Decomposition)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Slice 5 Done-State Definition
This slice is complete only when all of the following are true:
1. All-refs and curated scroll orchestration is extracted from `ReferenceCanvas` into a dedicated controller hook.
2. `ReferenceCanvas` consumes extracted scroll callbacks without changing scroll sampling, memory sampling, or virtual-metrics update semantics.
3. Existing curated/paste/selector/drop suites remain green.
4. Lint and type checks remain green.

## Slice 5 Done-State Attestation
1. Added scroll controller hook:
   - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridScrollController.ts`
2. Rewired `ReferenceCanvas` to consume extracted callbacks:
   - `handleAllRefsScroll`
   - `handleCuratedScroll`
3. Removed in-component RAF-throttled scroll state refs and scroll-handler orchestration from `ReferenceCanvas`.
4. Preserved cleanup behavior by moving scroll RAF cancellation into the controller hook.
5. Existing parity suites remained green after extraction.

## Scope
In scope:
1. Extract all-refs scroll metric updates and telemetry sampling.
2. Extract curated scroll metric updates.
3. Preserve virtualized rendering behavior and scroll-throttle policy.

Out of scope:
1. Remaining virtualization/media/perf observer extraction.
2. `useAiStudioState` decomposition.
3. Phase 5 closeout.

## Files Added
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridScrollController.ts`

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
1. Continued controller extraction pattern to keep view composition separate from interaction/runtime orchestration.
2. Preserved strangler-style incremental migration with reversible, low-blast-radius seams and parity-first validation.

## Regression Review
1. No regressions observed in all-refs/curated scroll behavior or virtual window updates.
2. Telemetry sampling paths (`media.grid.scroll.sample`, `media.grid.memory.sample`) remain active and unchanged.

## Rollback Readiness
- Rollback path: revert this slice commit to restore scroll orchestration inside `ReferenceCanvas`.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: keep Phase 5 in progress and continue with next decomposition slice.
