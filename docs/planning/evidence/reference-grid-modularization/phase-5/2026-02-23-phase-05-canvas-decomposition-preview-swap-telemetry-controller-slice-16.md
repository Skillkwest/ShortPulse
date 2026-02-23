# Phase 5 Canvas Decomposition Preview Swap Telemetry Controller (Slice 16)

Date (UTC): 2026-02-23
Phase: 5 (Canvas + State Decomposition)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Slice 16 Done-State Definition
This slice is complete only when all of the following are true:
1. Preview-swap telemetry effects are extracted from `ReferenceCanvas` into a dedicated controller hook.
2. `ReferenceCanvas` consumes extracted telemetry controller wiring without changing swap-rate/repaint-spike behavior.
3. Existing curated/paste/selector/drop suites remain green.
4. Lint and type checks remain green.

## Slice 16 Done-State Attestation
1. Added preview-swap telemetry controller hook:
   - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridPreviewSwapTelemetryController.ts`
2. Rewired `ReferenceCanvas` to consume extracted preview-swap telemetry orchestration.
3. Removed in-component preview-swap tracking/reset effects from `ReferenceCanvas`.
4. Existing parity suites remained green after extraction.

## Scope
In scope:
1. Extract visible-preview URL swap tracking effect.
2. Extract swap-telemetry reset-on-empty effect.
3. Preserve metric payload semantics (`swapRatePerMinute`, `repaintSpikeCount`, `lastSwapBurstCount`).

Out of scope:
1. Telemetry emission format changes.
2. `useAiStudioState` decomposition.
3. Phase 5 closeout.

## Files Added
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridPreviewSwapTelemetryController.ts`

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
1. Continued extracting effect-heavy telemetry logic into focused runtime controllers.
2. Preserved existing metric semantics to avoid telemetry contract drift.

## Regression Review
1. No regressions observed in parity suites.
2. Preview swap metric behavior remains unchanged.

## Rollback Readiness
- Rollback path: revert this slice changes to restore preview-swap effects directly in `ReferenceCanvas`.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: keep Phase 5 in progress and continue with next decomposition slice.
