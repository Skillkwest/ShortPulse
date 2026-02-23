# Phase 4 Media Preview Recovery Controller (Slice 3) Evidence

Date (UTC): 2026-02-23
Phase: 4 (Media Runtime Unification)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Scope
In scope:
1. Extract shared preview-recovery runtime controller for retry/sign-refresh/hydration fallback.
2. Route both Media Library route runtime and AI Studio modal runtime through shared recovery controller.
3. Preserve modal optimizer fallback behavior and retry-cap semantics.
4. Add dedicated unit coverage for shared recovery controller.

Out of scope:
1. Full runtime closeout and dead code retirement.
2. Data fetch orchestration merge.
3. Storage path contract changes.

## Files Added
- `frontend/features/media-library/hooks/useMediaPreviewRecoveryController.ts`
- `frontend/features/media-library/hooks/__tests__/useMediaPreviewRecoveryController.test.ts`

## Files Updated
- `frontend/features/media-library/hooks/useMediaPreviewRuntime.ts`
- `frontend/features/ai-studio/components/MediaLibraryModal.tsx`

## Behavioral Notes
1. Route and modal now share one recovery controller for:
   - signed-url refresh attempts,
   - retry-cap checks,
   - hydrate fallback after unresolved preview resolution.
2. Modal keeps optimizer-source fallback behavior via `beforeRetry` callback injection.
3. Retry-cap behavior remains unchanged (`3` max attempts) via shared policy helper.
4. Selection-time `refreshSignedUrl` behavior in modal remains available and now comes from shared controller.

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run test -- features/media-library/hooks/__tests__/useMediaPreviewRecoveryController.test.ts features/media-library/hooks/__tests__/useMediaPreviewRuntime.test.ts features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts` | Pass | 19 tests passing |
| `npm -C frontend run type-check` | Pass | no type errors |
| `npm -C frontend run lint` | Pass | no lint errors |
| `npm -C frontend run check:architecture-boundary` | Pass | boundary checks green |
| `npm -C frontend run docs:check` | Pass | docs governance checks green |
| `npm -C frontend run check:size-budget` | Pass (warn lane expected) | reference-grid hotspots still above target caps |
| `npm -C frontend run test:adaptive-v2-gate` | Pass | protected adaptive/reference lane green; unresolved preview-row logs remain non-blocking |

## Regression Review
1. No new regressions found in modal retry-cap tests or route preview runtime tests.
2. Modal unresolved signing logs remain expected/non-blocking in test environment.

## Rollback Readiness
- Rollback path: revert this slice commit to restore route/modal local recovery handlers.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: Continue Phase 4 with remaining parity closeout and cleanup slices.
