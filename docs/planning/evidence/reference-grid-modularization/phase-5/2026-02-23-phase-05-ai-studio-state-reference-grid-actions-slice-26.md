# Phase 5 AI Studio State Reference Grid Actions (Slice 26)

Date (UTC): 2026-02-23
Phase: 5 (Canvas + State Decomposition)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Slice 26 Done-State Definition
This slice is complete only when all of the following are true:
1. Archive/restore and curated projection actions are extracted from `useAiStudioState` into a dedicated hook.
2. Reference-grid behavior remains unchanged for soft-archive limits, restore flows, and quick-slot projection actions.
3. `useAiStudioState` bridge and reference-grid parity suites remain green.
4. Lint/type checks remain green.

## Slice 26 Done-State Attestation
1. Added reference-grid action bundle hook:
   - `frontend/features/ai-studio/hooks/useAiStudioReferenceGridStateActions.ts`
2. Rewired `useAiStudioState` to consume extracted actions:
   - `archiveOlderOutputs`
   - `restoreArchivedOutput`
   - `restoreAllArchivedOutputs`
   - `setOutputs`
   - `addCuratedReference`
   - `removeCuratedReference`
   - `reorderCuratedReference`
   - `clearCuratedReferences`
   - `resetReferenceGridState`
3. Removed in-hook archive/projection action implementations from `useAiStudioState`.

## Scope
In scope:
1. Extract archive/restore policy actions.
2. Extract curated projection state actions.

Out of scope:
1. Output lifecycle deletion behavior changes.
2. Task orchestration behavior changes.
3. Phase 5 closeout.

## Files Added
- `frontend/features/ai-studio/hooks/useAiStudioReferenceGridStateActions.ts`

## Files Updated
- `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
- `docs/change_log.md`

## Validation Snapshot
- `useAiStudioState.ts` line count reduced further during this and adjacent slices.

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run lint` | Pass | no lint warnings/errors |
| `npm -C frontend run type-check` | Pass | no type errors |
| `npm -C frontend run test -- useAiStudioState.outputStoreBridge.test.tsx useAiStudioWorkspaceActions.test.ts ReferenceCanvas.curated.test.tsx ReferenceCanvas.paste.test.tsx ReferenceCanvas.selectorStore.test.tsx AiStudioPageContent.drop.test.tsx MediaLibraryModal.test.tsx` | Pass | 77 tests passing |

## Best-Practice Alignment
1. Isolated projection/archive policy actions behind a dedicated hook boundary.
2. Preserved behavior by reusing existing actions and soft-archive constraints unchanged.

## Regression Review
1. No regressions observed in state bridge, reference-grid, and media-modal suites.

## Rollback Readiness
- Rollback path: revert this slice hook and `useAiStudioState` delegation.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: keep Phase 5 in progress and continue `useAiStudioState` decomposition.
