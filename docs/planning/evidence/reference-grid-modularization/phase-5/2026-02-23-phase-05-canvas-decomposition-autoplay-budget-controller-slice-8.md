# Phase 5 Canvas Decomposition Autoplay Budget Controller (Slice 8)

Date (UTC): 2026-02-23
Phase: 5 (Canvas + State Decomposition)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Slice 8 Done-State Definition
This slice is complete only when all of the following are true:
1. Autoplay attach-budget runtime policy orchestration is extracted from `ReferenceCanvas` into a dedicated controller hook.
2. `ReferenceCanvas` consumes extracted budget controller wiring without behavior changes to responsive/network/device budget resolution.
3. Existing curated/paste/selector/drop suites remain green.
4. Lint and type checks remain green.

## Slice 8 Done-State Attestation
1. Added autoplay budget controller hook:
   - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridAutoplayBudgetController.ts`
2. Rewired `ReferenceCanvas` to consume extracted budget policy orchestration.
3. Removed in-component resize/network budget listener effect and runtime clamp logic.
4. Existing parity suites remained green after extraction.

## Scope
In scope:
1. Extract responsive/network/device autoplay budget policy effect.
2. Preserve constrained-profile clamping behavior for enabled autoplay ids.
3. Preserve existing recompute trigger behavior.

Out of scope:
1. Autoplay budget calculation algorithm changes.
2. `useAiStudioState` decomposition.
3. Phase 5 closeout.

## Files Added
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridAutoplayBudgetController.ts`

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
1. Continued incremental controller extraction for effect-heavy runtime policy code.
2. Kept behavior stable by preserving existing ref-based policy semantics and thresholds.

## Regression Review
1. No regressions observed in autoplay budget behavior under viewport/device/network changes.
2. Existing constrained-profile autoplay clamp behavior remains unchanged.

## Rollback Readiness
- Rollback path: revert this slice commit to restore autoplay budget policy effect inside `ReferenceCanvas`.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: keep Phase 5 in progress and continue with next decomposition slice.
