# Phase 5 AI Studio State Output/Projection Decomposition (Slice 28)

Date (UTC): 2026-02-23
Phase: 5 (Canvas + State Decomposition)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Slice 28 Done-State Definition
This slice is complete only when all of the following are true:
1. `useAiStudioState` output collection/store bridge logic is extracted into a dedicated hook.
2. Projection lifecycle effects (prune/pinned sync/all-refs compatibility) are extracted into a dedicated hook.
3. Model-option derivation and optimistic placeholder actions are extracted behind focused hooks.
4. `useAiStudioState.ts` is reduced to at or under the target size budget while preserving behavior parity.
5. Guardrail checks and adaptive/reference protected tests are green.

## Slice 28 Done-State Attestation
1. Added output-collection/store bridge hook:
   - `frontend/features/ai-studio/hooks/useAiStudioOutputCollectionState.ts`
2. Added projection lifecycle effects hook:
   - `frontend/features/ai-studio/hooks/useAiStudioReferenceProjectionEffects.ts`
3. Added model/options and optimistic placeholder extraction hooks:
   - `frontend/features/ai-studio/hooks/useAiStudioAllowedModelOptions.ts`
   - `frontend/features/ai-studio/hooks/useAiStudioOptimisticPlaceholderActions.ts`
4. Added output-store selector wrapper hook:
   - `frontend/features/ai-studio/hooks/useAiStudioOutputStoreSelectors.ts`
5. Rewired `frontend/features/ai-studio/hooks/useAiStudioState.ts` to consume extracted hooks.

## Scope
In scope:
1. Output collection/store publisher extraction.
2. Projection lifecycle effect extraction.
3. Stable action/selector extraction for `useAiStudioState` size-budget closure.

Out of scope:
1. Behavior changes for archive/curated semantics.
2. Media runtime policy changes.
3. Phase 6 enforce-mode promotion.

## Files Added
- `frontend/features/ai-studio/hooks/useAiStudioOutputCollectionState.ts`
- `frontend/features/ai-studio/hooks/useAiStudioReferenceProjectionEffects.ts`
- `frontend/features/ai-studio/hooks/useAiStudioAllowedModelOptions.ts`
- `frontend/features/ai-studio/hooks/useAiStudioOptimisticPlaceholderActions.ts`
- `frontend/features/ai-studio/hooks/useAiStudioOutputStoreSelectors.ts`

## Files Updated
- `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
- `docs/change_log.md`

## Validation Snapshot
- `frontend/features/ai-studio/hooks/useAiStudioState.ts`: `641` lines (target <= `650`).
- `frontend/features/ai-studio/components/ReferenceCanvas.tsx`: `834` lines (target <= `900`).
- `frontend/features/ai-studio/components/MediaLibraryModal.tsx`: `796` lines (target <= `800`).

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run lint` | Pass | no lint errors |
| `npm -C frontend run type-check` | Pass | no type errors |
| `npm -C frontend run test -- useAiStudioState.outputStoreBridge.test.tsx useAiStudioWorkspaceActions.test.ts useAiStudioReferenceAssetActions.test.ts useAiStudioShellDndController.test.ts MediaLibraryModal.test.tsx ReferenceCanvas.curated.test.tsx ReferenceCanvas.paste.test.tsx ReferenceCanvas.selectorStore.test.tsx AiStudioPageContent.drop.test.tsx` | Pass | 82 tests passing |
| `npm -C frontend run docs:check` | Pass | docs governance checks green |
| `npm -C frontend run check:architecture-boundary` | Pass | boundary checks green |
| `npm -C frontend run check:size-budget` | Pass | target lane budgets satisfied |
| `npm -C frontend run test:adaptive-v2-gate` | Pass | protected adaptive/reference lane green; known modal warning/log noise unchanged |

## Best-Practice Alignment
1. Preserves strangler-style extraction by moving side effects and data-shape orchestration behind narrow hooks.
2. Maintains behavior parity through existing integration suites plus selector-store bridge tests.
3. Closes explicit hotspot budget objective before enforce-mode promotion.

## Regression Review
1. No behavioral regressions observed in reference-grid, ingestion, selector-store bridge, and modal suites.
2. Existing non-blocking modal `act(...)` warning and unresolved-preview debug logs remain unchanged from baseline.

## Rollback Readiness
- Rollback path: revert this slice hooks and restore inlined `useAiStudioState` blocks.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: accept slice 28; Phase 5 done-state criteria are satisfied.
- Next phase: Phase 6 (Guardrails + Cleanup).
