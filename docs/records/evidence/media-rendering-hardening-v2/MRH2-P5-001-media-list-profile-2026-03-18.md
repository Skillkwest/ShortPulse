# MRH2-P5-001 Evidence Packet (2026-03-18)

## Slice
- `MRH2-P5-001`
- Lane: `Pipeline`
- Phase: `P5`
- Surface: `media list API`

## Scope Closed
- Make `profile=minimal` the actual default contract for `POST /api/media/list`.
- Keep metadata-heavy consumers compatible by requiring explicit `expanded` requests for modal and panel surfaces.
- Keep fallback direct queries aligned to the same profile split when the server list API is disabled.

## Code Changes
- [mediaListProfile.ts](../../../../frontend/lib/mediaListProfile.ts)
- [list.ts](../../../../frontend/pages/api/media/list.ts)
- [mediaListApi.ts](../../../../frontend/features/media-library/logic/mediaListApi.ts)
- [useMediaTabDataController.ts](../../../../frontend/features/media-library/hooks/useMediaTabDataController.ts)
- [useMediaLibraryPanelDataController.ts](../../../../frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts)
- [media-list.test.ts](../../../../frontend/tests/api/media-list.test.ts)
- [api-list-profile-spec](../../../planning/media-rendering-hardening-v2-api-list-profile-spec-2026-03-16.md)

## Compatibility Decision
- `media-library-route`: `minimal`
- `media-library-modal`: `expanded`
- `media-library-panel`: `expanded`

This preserves current metadata-dependent UI behavior while removing default metadata overfetch from the route hot path.

## Targeted Tests
- `npm test -- --run tests/api/media-list.test.ts`
- `npm test -- --run features/media-library/hooks/__tests__/useMediaTabDataController.test.ts`
- `npm test -- --run features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx`

## Full Gates
- `npm run lint`
- `npm run type-check`
- `npm run build`
- `npm run docs:check`

## Results
- Targeted tests: pass
- `lint`: pass with the same two pre-existing unrelated warnings
- `type-check`: pass
- `build`: pass
- `docs:check`: pass

## Risk Review
- The route hot path now stops selecting `metadata` by default, which is the intended payload reduction for this slice.
- Modal and panel keep explicit `expanded` requests because they still use metadata for prompt text, drag payloads, and aspect-ratio fallback behavior.
- The API returns a deterministic validation error for unknown profile values and exposes the chosen profile in `x-shortpulse-media-list-profile`.
- Fallback direct Supabase queries in the route/controller path now mirror the same profile split so API disablement does not silently reintroduce metadata overfetch.

## Rollback
- Revert this slice to return to the metadata-heavy list row contract for all surfaces and to remove the explicit route/modal/panel profile split.
