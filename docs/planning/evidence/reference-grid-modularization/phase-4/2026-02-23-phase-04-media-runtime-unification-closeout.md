# Phase 4 Media Runtime Unification Closeout

Date (UTC): 2026-02-23
Phase: 4 (Media Runtime Unification)
Owner: Frontend + Media
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Done-State Definition
Phase 4 is complete only when all of the following are true:
1. Modal and route both use shared runtime modules for preview signing, resolver fallback, retry recovery, and storage-download hydration paths.
2. Duplicated modal runtime logic for selection signing and preview-resolver application is removed.
3. Parity tests cover ladder/fallback/retry semantics and modal selection contracts.
4. Required guardrails and protected adaptive/reference test lane are green.

## Done-State Attestation
1. Shared runtime modules now own the parity-critical paths:
   - `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`
   - `frontend/features/media-library/hooks/useMediaPreviewRecoveryController.ts`
   - `frontend/features/media-library/logic/mediaPreviewResolver.ts`
   - `frontend/features/media-library/logic/mediaPreviewRuntimeShared.ts`
2. Modal and route both call shared runtime helpers for:
   - `signStoragePath` (`signMediaStoragePath`)
   - `resolveSignedUrlsByMediaIds` (`resolveAndApplySignedPreviewUrlsByRows`)
   - `hydrateViaStorageDownload` (`hydrateMediaPreviewViaStorageDownload`)
3. Modal selection signing is shared via:
   - `resolveSignedSelectionUrl` in `frontend/features/media-library/logic/mediaPreviewResolver.ts`
4. No-regression checks are green (see test matrix below).

## Scope (Final Slice + Closeout)
In scope:
1. Add shared runtime helper module for sign/resolve/hydrate flows.
2. Route both modal and route runtime callbacks through the shared helper module.
3. Add dedicated unit coverage for shared helper behavior.
4. Close Phase 4 checklist + evidence.

Out of scope:
1. Phase 5 decomposition (`ReferenceCanvas`, `useAiStudioState`) work.
2. Size-budget reduction work.
3. Guardrail enforce-mode promotion (Phase 6).

## Files Added
- `frontend/features/media-library/logic/mediaPreviewRuntimeShared.ts`
- `frontend/features/media-library/logic/__tests__/mediaPreviewRuntimeShared.test.ts`

## Files Updated
- `frontend/features/media-library/hooks/useMediaPreviewRuntime.ts`
- `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
- `docs/change_log.md`

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run test -- mediaPreviewRuntimeShared.test.ts mediaPreviewResolver.test.ts useMediaPreviewRuntime.test.ts MediaLibraryModal.test.tsx` | Pass | 21 tests passing |
| `npm -C frontend run lint` | Pass | no lint errors |
| `npm -C frontend run type-check` | Pass | no type errors |
| `npm -C frontend run check:architecture-boundary` | Pass | boundary checks green |
| `npm -C frontend run docs:check` | Pass | docs governance checks green |
| `npm -C frontend run check:size-budget` | Pass (warn lane expected) | reference-grid hotspots remain above target caps; expected until phase-5+ |
| `npm -C frontend run test:adaptive-v2-gate` | Pass | protected adaptive/reference lane green; known modal warning/log noise unchanged |

## Regression Review
1. No runtime behavior regressions observed in modal flow tests.
2. Retry-cap, fallback, and canonical-selection semantics remain covered.
3. Existing non-blocking modal `act(...)` warning and unresolved-preview debug logs remain unchanged.

## Rollback Readiness
- Rollback path: revert closeout commit to restore previous per-surface sign/resolve/hydrate callback implementations.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: Phase 4 complete.
- Next phase: Phase 5 (Canvas + State Decomposition).
