# Phase 4 Media Runtime Unification Foundation Evidence

Date (UTC): 2026-02-23
Phase: 4 (Media Runtime Unification Foundation)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Scope
In scope:
1. Introduce shared media preview runtime policy helpers for both AI Studio modal and Media Library route.
2. Centralize sign-budget device resolution logic in one pure module.
3. Centralize retry-cap policy checks used by preview error handlers.
4. Preserve current runtime behavior while creating an extraction seam for later Phase 4 slices.

Out of scope:
1. Full modal/route runtime controller merge.
2. Storage signing service abstraction changes.
3. Download fallback algorithm changes.

## Files Added
- `frontend/lib/mediaPreviewRuntimePolicy.ts`
- `frontend/features/media-library/logic/__tests__/mediaPreviewRuntimePolicy.test.ts`

## Files Updated
- `frontend/features/media-library/logic/mediaLibraryPageHelpers.ts`
- `frontend/features/media-library/hooks/useMediaPreviewRuntime.ts`
- `frontend/features/ai-studio/components/MediaLibraryModal.tsx`

## Behavioral Notes
1. Route and modal sign-budget resolution now share one policy implementation; route/modal budget values remain unchanged.
2. Route and modal preview-error retry checks now share one retry-cap helper; effective threshold remains `3` attempts.
3. Modal sign-batch per-item attempt cap now consumes shared policy helper; effective threshold remains `3` attempts.
4. This slice is policy extraction only; no intended user-visible behavior changes.

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run test -- features/media-library/logic/__tests__/mediaPreviewRuntimePolicy.test.ts features/media-library/logic/__tests__/mediaLibraryPageHelpers.test.ts features/media-library/hooks/__tests__/useMediaPreviewRuntime.test.ts features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx` | Pass | 27 tests passing |
| `npm -C frontend run type-check` | Pass | no type errors |
| `npm -C frontend run lint` | Pass | no lint errors |
| `npm -C frontend run check:architecture-boundary` | Pass | boundary checks green |
| `npm -C frontend run docs:check` | Pass | docs governance checks green |
| `npm -C frontend run check:size-budget` | Pass (warn lane expected) | reference-grid hotspots still above target caps |
| `npm -C frontend run test:adaptive-v2-gate` | Pass | protected adaptive/reference lane green; pre-existing modal test `act(...)` warning + unresolved preview-row logs remain non-blocking |

## Regression Review
1. Regressions found: none in modal/route preview runtime tests or adaptive v2 gate.
2. Behavior parity preserved for retry thresholds and sign-budget values.

## Rollback Readiness
- Rollback path: revert this foundation commit to restore prior duplicated policy logic.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: continue Phase 4 extraction with runtime-controller unification slices.
