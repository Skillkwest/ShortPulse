# Phase 05 Slice B Evidence: Server-Authoritative Media Upload Route

Date: 2026-02-27  
Owner: Engineering  
Status: Completed (pre-entry prep slice)

## Scope
Introduce a server-authoritative Media Library upload path that validates destination/mime/signature server-side, persists `media_files` rows, and returns signed preview metadata.

Implemented components:
1. Added `frontend/lib/server/mediaUploadService.ts`:
   - multipart and raw parsing support,
   - destination-tab validation (`uploaded_images | uploaded_videos | private`),
   - magic-byte MIME detection and declared-vs-detected compatibility checks,
   - destination-specific size/type policy enforcement,
   - scoped storage path generation,
   - storage upload + `media_files` insert + signed preview URL response mapping.
2. Added `frontend/pages/api/media/upload.ts`:
   - authenticated `POST` route with fail-closed auth,
   - rollout gate `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED` (default `true`),
   - structured service error mapping and route exception logging.
3. Added route tests in `frontend/tests/api/media-upload.route.test.ts`.

## Runtime Contract
1. `/api/media/upload` does not trust client MIME/classification for persisted row metadata.
2. Destination tab controls allowed content class and resulting persisted source/path.
3. Route is rollout-gated by `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED`.

## Validation Log
Executed and passing:
1. `npm -C frontend run test -- media-upload.route upload-image-route upload-video-route`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`

## Rollback
1. Revert this slice commit to remove `/api/media/upload` and service usage.
2. Existing `/api/upload-image` and `/api/upload-video` paths remain available as compatibility paths.

## Follow-ups
1. Phase 05 Slice C: migrate `useMediaUploadController` to `/api/media/upload` behind `NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED`.
2. Keep full Phase 05 entry/closure blocked until Phase 04 canary signoff.
