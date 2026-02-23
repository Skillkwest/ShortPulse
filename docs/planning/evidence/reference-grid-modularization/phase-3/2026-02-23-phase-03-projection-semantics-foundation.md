# Phase 3 Projection Semantics Foundation Evidence

Date (UTC): 2026-02-23
Phase: 3 (Projection Semantics Foundation)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Scope
In scope:
1. Introduce explicit projection state module for `allRefs` and `quickSlots` semantics.
2. Replace direct curated-delete hidden mutation with projection-state suppression transition.
3. Preserve runtime behavior through compatibility mirroring (`hiddenInReferenceGrid`) while migration is in progress.
4. Add projection module unit tests and state-bridge parity coverage updates.

Out of scope:
1. Phase 3 full closeout (remaining semantic cleanup and final hidden-flag removal).
2. Phase 4 media runtime unification.
3. Adaptive compression runtime algorithm changes (tracked as a cross-phase modularization concern).

## Files Added
- `frontend/features/ai-studio/reference-projections/types.ts`
- `frontend/features/ai-studio/reference-projections/projections.ts`
- `frontend/features/ai-studio/reference-projections/index.ts`
- `frontend/features/ai-studio/reference-projections/__tests__/referenceProjections.test.ts`

## Files Updated
- `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioState.outputStoreBridge.test.tsx`

## Behavioral Notes
- New explicit projection state now tracks:
  - `quickSlotIds`
  - `removedFromAllRefsIds`
- Curated delete semantics now transition through projection state (`markReferenceRemovedFromAllRefs`) rather than direct output mutation.
- Compatibility adapter keeps `hiddenInReferenceGrid` in sync so existing surfaces remain behaviorally unchanged during migration.

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run test -- features/ai-studio/reference-projections/__tests__/referenceProjections.test.ts features/ai-studio/reference-ingestion/__tests__/buildFromInput.test.ts features/ai-studio/logic/__tests__/stateParsers.uploads.test.ts features/ai-studio/components/__tests__/ReferenceCanvas.curated.test.tsx features/ai-studio/components/__tests__/ReferenceCanvas.paste.test.tsx features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx features/ai-studio/hooks/__tests__/useAiStudioWorkspaceActions.test.ts features/ai-studio/hooks/__tests__/useAiStudioState.outputStoreBridge.test.tsx` | Pass | 84 tests passing |
| `npm -C frontend run type-check` | Pass | no type errors |
| `npm -C frontend run lint` | Pass | no lint errors |
| `npm -C frontend run check:architecture-boundary` | Pass | boundary checks green |
| `npm -C frontend run docs:check` | Pass | docs governance checks green |
| `npm -C frontend run check:size-budget` | Pass (warn lane expected) | hotspot files remain above target caps in warn lane |

## Regression Review
- Regressions found: none in targeted projection and reference-grid flows.
- Non-blocking noise (pre-existing): modal test `act(...)` warning and unresolved preview-row logs.

## Adaptive Compression Note
- Adaptive compression implementation behavior is intentionally unchanged in this phase.
- This phase improves structural seams so adaptive-media/compression runtime can be modularized safely in later extraction without coupling to projection semantics.

## Rollback Readiness
- Rollback path: revert this foundation commit to return to pre-projection-curated-delete transition path.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: Go for continued Phase 3 extraction slices.
