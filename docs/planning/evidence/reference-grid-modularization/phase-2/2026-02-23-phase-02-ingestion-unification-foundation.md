# Phase 2 Ingestion Unification Foundation Evidence

Date (UTC): 2026-02-23
Phase: 2 (Ingestion Unification)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Scope
In scope:
1. Introduce canonical reference-ingestion input contract.
2. Introduce single ingestion adapter for files/paste/library/agent pathways.
3. Rewire `useAiStudioState` ingestion entrypoints to canonical adapter.
4. Add acceptance-matrix unit coverage for ingestion variants.

Out of scope:
1. Projection semantic changes.
2. Media runtime convergence.
3. Canvas decomposition.

## Files Added
- `frontend/features/ai-studio/reference-ingestion/types.ts`
- `frontend/features/ai-studio/reference-ingestion/buildFromInput.ts`
- `frontend/features/ai-studio/reference-ingestion/index.ts`
- `frontend/features/ai-studio/reference-ingestion/__tests__/buildFromInput.test.ts`

## Files Updated
- `frontend/features/ai-studio/hooks/useAiStudioState.ts`

## Behavioral Notes
- Existing ingestion semantics were preserved:
  - file ingestion still delegates to `mapUploadsFromFiles`.
  - agent prompt IDs keep `prompt-` prefix and timestamp `Agent`.
  - pasted prompt IDs keep `prompt-paste-` prefix and timestamp `Clipboard`.
  - pasted media IDs keep `media-paste-` prefix and clipboard media semantics.
  - media-library insertions preserve generated/library source timestamp and media-source mapping.

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run test -- buildFromInput.test.ts useAiStudioState.outputStoreBridge.test.tsx ReferenceCanvas.paste.test.tsx MediaLibraryModal.test.tsx useAiStudioWorkspaceActions.test.ts stateParsers.uploads.test.ts` | Pass | 48 tests passing |
| `npm -C frontend run type-check` | Pass | no type errors |
| `npm -C frontend run lint` | Pass | no lint errors |
| `npm -C frontend run check:architecture-boundary` | Pass | reference-ingestion boundary lane clean |
| `npm -C frontend run check:size-budget` | Pass (warn lane expected) | hotspot files remain above future target limits |
| `npm -C frontend run docs:check` | Pass | docs governance checks clean |

## Regression Review
- Regressions found: none in targeted ingestion/paste/library/state validation.
- Non-blocking test noise observed:
  - pre-existing React `act(...)` warning in `MediaLibraryModal` test.
  - pre-existing unresolved preview row console logs in modal tests.

## Rollback Readiness
- Rollback path: revert `reference-ingestion` module additions and `useAiStudioState` ingestion-callsite rewiring.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: Go (ingestion contract and adapter integrated, parity tests green).
- Follow-up: proceed to Phase 3 projection-semantics extraction in next PR slice.
