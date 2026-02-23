# Phase 4 Media Runtime Controller Parity (Slice 2) Evidence

Date (UTC): 2026-02-23
Phase: 4 (Media Runtime Unification)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Scope
In scope:
1. Replace duplicated modal sign-pass effect with shared signing controller hook used by Media Library route.
2. Add shared-controller options for surface telemetry labels, unresolved warning prefix, enabled-gate, and result relevance checks.
3. Preserve modal no-regression semantics for per-item sign-attempt cap.
4. Add targeted hook tests for signing-pass enable/disable behavior.

Out of scope:
1. Full preview/sign/retry/download runtime merge across all controllers.
2. Modal/route data-fetch orchestration unification.
3. Download fallback algorithm changes.

## Files Updated
- `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`
- `frontend/features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts`
- `frontend/features/ai-studio/components/MediaLibraryModal.tsx`

## Behavioral Notes
1. `MediaLibraryModal` now runs signing passes through `useMediaPreviewSigningController` (same core pass as route surface).
2. Shared controller now supports modal-specific runtime guards:
   - `isSigningPassEnabled`
   - `isResultStillRelevant`
   - `surface`
   - `unresolvedWarningPrefix`
   - `maxSignAttemptsPerItem`
3. Modal per-item sign-attempt cap remains `3` attempts via shared policy constant.
4. Existing modal unresolved preview dev logs remain behaviorally unchanged.

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run test -- features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts` | Pass | 14 tests passing |
| `npm -C frontend run test -- features/media-library/hooks/__tests__/useMediaPreviewRuntime.test.ts features/media-library/logic/__tests__/mediaPreviewRuntimePolicy.test.ts features/media-library/logic/__tests__/mediaLibraryPageHelpers.test.ts` | Pass | 14 tests passing |
| `npm -C frontend run type-check` | Pass | no type errors |
| `npm -C frontend run lint` | Pass | no lint errors |
| `npm -C frontend run check:architecture-boundary` | Pass | boundary checks green |
| `npm -C frontend run docs:check` | Pass | docs governance checks green |
| `npm -C frontend run check:size-budget` | Pass (warn lane expected) | reference-grid hotspots still above target caps |
| `npm -C frontend run test:adaptive-v2-gate` | Pass | protected adaptive/reference lane green; unresolved preview-row logs remain non-blocking |

## Regression Review
1. Initial refactor introduced a modal signing-loop regression (missing per-item cap wiring in shared controller).
2. Regression was fixed in this slice by adding `maxSignAttemptsPerItem` to shared controller and wiring modal to shared policy cap constant.
3. Post-fix modal retry-cap parity tests are green across all media tabs.

## Rollback Readiness
- Rollback path: revert this slice commit to restore modal-local sign-pass effect and pre-option shared controller behavior.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: Continue Phase 4 with remaining runtime controller extraction slices.
