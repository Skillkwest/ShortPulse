# Media Rendering Hardening v2 Test Realignment Matrix (2026-03-18)

Last updated: 2026-03-18
Status: Active

## Purpose
Separate valuable characterization tests from tests that currently lock in media-delivery drift so implementation can move without accidental regressions or false blockers.

## Classification Rules
- `Keep`: still protects desired contract behavior.
- `Rewrite`: useful surface coverage exists, but assertion currently protects drift or incomplete policy.
- `Add`: missing coverage for in-scope contract.

## Matrix
| test file | current protected behavior | classification | action needed before or during implementation |
| --- | --- | --- | --- |
| `frontend/features/media-library/logic/__tests__/mediaLibraryAdaptivePreview.test.ts` | Runtime adaptive helper keeps signed Media Library URLs unchanged | Keep | Preserve the assertion that runtime adaptive logic does not rewrite signed Media Library URLs; extend wording to make clear transforms are an upstream signing concern |
| `frontend/tests/api/media-sign-batch.test.ts` | Panel profile resolves and transform flags remain disabled by default | Rewrite | Keep compatibility assertions where needed, rewrite architectural assumptions so preview authority is derivative-first and transforms stay compatibility-only |
| `frontend/tests/api/media-resolve-previews.test.ts` | Panel resolve path applies no transforms by default | Rewrite | Align with accepted sign/resolve policy and fallback taxonomy |
| `frontend/features/ai-studio/logic/__tests__/referenceGridMedia.test.ts` | Reference-grid uses derivative/preview-first selection, `/_next/image` for trusted Supabase object URLs, and preserves existing render-image URLs only as compatibility paths | Keep | Convert from characterization wording to accepted-policy wording; keep coverage because the optimizer-backed split is intentional while render-image URLs remain migration debt, not target architecture |
| `frontend/features/ai-studio/logic/__tests__/mediaLibraryPanelPreviewResolver.test.ts` | Panel keeps signed object URLs out of Next optimizer and preserves existing render-image URLs only as compatibility paths when already on render endpoint | Keep | Extend to assert the accepted panel policy rather than treat compatibility handling as target behavior |
| `frontend/features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx` | Panel passes a preview resolver callback and enables adaptive quality by configured surface | Keep | Extend to verify accepted panel-specific semantics after P1/P3 |
| `frontend/features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx` | Character Manager behavior remains stable across modularized flows | Keep | Add explicit image-delivery assertions once character-grid enters unified contract |
| `frontend/features/character-manager/components/__tests__/CharacterQuickSwapDeckSection.windowing.test.tsx` | Quick-swap windowing and deck behavior remain stable | Keep | Extend with accepted quick-swap card/preview policy assertions during P3 |
| `frontend/features/ai-studio/reference-grid/controllers/__tests__/useReferenceGridImageHydrationController.test.ts` | Reference-grid hydration queue and failover behavior | Keep | Extend only if fallback taxonomy changes |
| `frontend/lib/server/__tests__/imageDimensions.test.ts` | PNG/JPEG/GIF/WEBP parsing only | Add | Add HEIC/HEIF/AVIF support tests or explicit unsupported-policy tests |
| `frontend/lib/__tests__/mediaSignedUrlCache.test.ts` | Batch signing concurrency and coverage | Keep | Extend if preview profile or caching policy changes |
| `frontend/features/media-library/logic/__tests__/mediaPreviewResolver.test.ts` | Resolve-previews API request handling and selection URL fallback | Keep | Extend for new deterministic fallback order |
| `frontend/features/media-library/components/__tests__/MediaFileModal.test.tsx` | Media Library file modal renders the selected signed URL directly | Keep | Extend only if modal fallback chain changes |
| `frontend/features/ai-studio/components/__tests__/DetailModal.test.tsx` | Detail modal full-quality path and fallback candidates remain stable | Keep | Add one explicit accepted-policy assertion for full-quality-first behavior if needed during P3 |
| `frontend/features/ai-studio/components/media-library-modal/MediaLibraryPanelPreviewModal.tsx` tests | No dedicated coverage exists for panel preview modal direct-preview behavior | Add | Add component coverage for direct preview URL rendering and unavailable-state fallback before or in P3 |

## Operational Rule
Before any policy-changing slice merges:
1. impacted tests must be marked `Keep`, `Rewrite`, or `Add` here,
2. rewritten policy tests must land in the same or immediately preceding slice, and
3. no deleted test may be removed without replacement evidence.
