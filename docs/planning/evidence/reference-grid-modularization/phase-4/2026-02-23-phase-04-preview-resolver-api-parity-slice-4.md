# Phase 4 Preview Resolver API Parity (Slice 4) Evidence

Date (UTC): 2026-02-23
Phase: 4 (Media Runtime Unification)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Scope
In scope:
1. Extract shared `/api/media/resolve-previews` request/response handling into one reusable module.
2. Route both Media Library route runtime and AI Studio modal runtime through shared resolver helper.
3. Remove duplicated unresolved-id mapping code from both surfaces.
4. Add dedicated unit tests for shared preview resolver behavior.

Out of scope:
1. Remaining selection-url signing path consolidation.
2. Full Phase 4 closeout and dead code cleanup.
3. Any changes to API contract for `/api/media/resolve-previews`.

## Files Added
- `frontend/features/media-library/logic/mediaPreviewResolver.ts`
- `frontend/features/media-library/logic/__tests__/mediaPreviewResolver.test.ts`

## Files Updated
- `frontend/features/media-library/hooks/useMediaPreviewRuntime.ts`
- `frontend/features/ai-studio/components/MediaLibraryModal.tsx`

## Behavioral Notes
1. Preview resolve API behavior is unchanged; only call/parsing path was centralized.
2. Both modal and route still apply resolved URLs to tab cache and return unresolved ID set for fallback logic.
3. No runtime threshold/policy changes in this slice.

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run test -- features/media-library/logic/__tests__/mediaPreviewResolver.test.ts features/media-library/hooks/__tests__/useMediaPreviewRecoveryController.test.ts features/media-library/hooks/__tests__/useMediaPreviewRuntime.test.ts features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx` | Pass | 18 tests passing |
| `npm -C frontend run type-check` | Pass | no type errors |
| `npm -C frontend run lint` | Pass | no lint errors |
| `npm -C frontend run check:architecture-boundary` | Pass | boundary checks green |
| `npm -C frontend run docs:check` | Pass | docs governance checks green |
| `npm -C frontend run check:size-budget` | Pass (warn lane expected) | reference-grid hotspots still above target caps |
| `npm -C frontend run test:adaptive-v2-gate` | Pass | protected adaptive/reference lane green; unresolved preview-row logs remain non-blocking |

## Regression Review
1. No regressions observed in modal retry cap tests or route runtime tests.
2. Existing modal test warning/log noise remains unchanged and non-blocking.

## Rollback Readiness
- Rollback path: revert this slice commit to restore duplicated resolver callbacks in modal and route.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: Continue Phase 4 final parity and closeout slices.
