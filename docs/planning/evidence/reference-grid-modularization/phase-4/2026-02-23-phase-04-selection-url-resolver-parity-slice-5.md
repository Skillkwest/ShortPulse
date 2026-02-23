# Phase 4 Selection URL Resolver Parity (Slice 5) Evidence

Date (UTC): 2026-02-23
Phase: 4 (Media Runtime Unification)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Scope
In scope:
1. Remove duplicated media-selection signing candidate logic from AI Studio modal.
2. Route modal selection URL signing through shared resolver helper.
3. Add unit coverage for canonical-path priority, fallback behavior, and candidate dedupe.

Out of scope:
1. Full Phase 4 closeout.
2. Any API contract changes for media preview resolve endpoints.
3. Phase 5 decomposition work.

## Files Updated
- `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- `frontend/features/media-library/logic/mediaPreviewResolver.ts`
- `frontend/features/media-library/logic/__tests__/mediaPreviewResolver.test.ts`

## Behavioral Notes
1. Modal media selection still prefers canonical `storage_path` for final/full selection URL.
2. Fallback signing behavior for selection now runs through shared resolver helper.
3. No change to modal unresolved-preview fallback/recovery pipeline.

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run test -- mediaPreviewResolver.test.ts MediaLibraryModal.test.tsx` | Pass | 15 tests passing |
| `npm -C frontend run lint` | Pass | no lint errors |
| `npm -C frontend run type-check` | Pass | no type errors |
| `npm -C frontend run check:architecture-boundary` | Pass | boundary checks green |
| `npm -C frontend run docs:check` | Pass | docs governance checks green |
| `npm -C frontend run check:size-budget` | Pass (warn lane expected) | reference-grid hotspots still above target caps |
| `npm -C frontend run test:adaptive-v2-gate` | Pass | protected adaptive/reference lane green; known modal test warning/log noise unchanged |

## Regression Review
1. No regressions observed in modal selection behavior tests.
2. Existing modal test warning/log noise remains non-blocking and unchanged.

## Rollback Readiness
- Rollback path: revert this slice commit to restore local modal selection URL resolver callback.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: Continue Phase 4 parity slices toward closeout.
