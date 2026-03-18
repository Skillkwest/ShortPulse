# MRH2-P6-001 Evidence Packet (2026-03-18)

## Slice
- `MRH2-P6-001`
- Lane: `Pipeline`
- Phase: `P6`
- Surface: `legacy upload adapters`

## Scope Closed
- Keep `/api/media/upload` as the canonical persistence route.
- Rebuild `/api/upload-image` and `/api/upload-video` as storage-only compatibility adapters on top of shared upload parsing/validation/storage logic.
- Preserve legacy response shape and transient storage prefixes while removing duplicated validation/upload implementations.

## Code Changes
- [mediaUploadService.ts](../../../../frontend/lib/server/mediaUploadService.ts)
- [upload-image.ts](../../../../frontend/pages/api/upload-image.ts)
- [upload-video.ts](../../../../frontend/pages/api/upload-video.ts)
- [media-upload.route.test.ts](../../../../frontend/tests/api/media-upload.route.test.ts)
- [upload-image-route.test.ts](../../../../frontend/tests/api/upload-image-route.test.ts)
- [upload-video-route.test.ts](../../../../frontend/tests/api/upload-video-route.test.ts)
- [legacy-adapter-sunset-spec](../../media-rendering-hardening-v2-legacy-adapter-sunset-spec-2026-03-16.md)

## Adapter Decision
- `/api/media/upload` remains the only path that persists `media_files` rows.
- `/api/upload-image` now defaults to `uploaded_images` validation rules while preserving storage-only behavior and `<uid>/images/reference/*` paths.
- `/api/upload-video` now defaults to `uploaded_videos` validation rules while preserving storage-only behavior and `<uid>/videos/motion-control/*` paths.
- Both adapters still return `{ url, path, size }` so existing AI Studio callers do not break.

## Targeted Tests
- `npm test -- --run tests/api/media-upload.route.test.ts`
- `npm test -- --run tests/api/upload-image-route.test.ts`
- `npm test -- --run tests/api/upload-video-route.test.ts`

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
- Canonical and adapter routes now share the same signature validation and scoped-storage upload logic, which reduces drift risk materially.
- Legacy callers are not forced onto `media_files` persistence yet, so transient reference uploads do not start polluting the media library table.
- Adapter-specific storage prefixes remain intact, which preserves existing downstream path assumptions during the sunset window.
- This slice does not retire callers; it narrows implementation drift first so later caller migration can be data-driven.

## Rollback
- Revert this slice to restore the legacy route-local upload implementations for `/api/upload-image` and `/api/upload-video`.
