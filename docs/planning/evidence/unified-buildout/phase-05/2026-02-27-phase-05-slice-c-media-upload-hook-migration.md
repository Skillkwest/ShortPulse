# Phase 05 Slice C Evidence: Media Upload Hook Migration

Date: 2026-02-27  
Owner: Engineering  
Status: Completed (pre-entry prep slice)

## Scope
Migrate Media Library upload controller to the new server-authoritative upload route while preserving a flag-gated legacy fallback branch for rollback safety.

Implemented components:
1. Updated `frontend/features/media-library/hooks/useMediaUploadController.ts`:
   - default upload path uses `fetchWithAuth("/api/media/upload")`,
   - destination tab is derived per file (`uploaded_images | uploaded_videos | private`),
   - optimistic placeholder + cache reconciliation semantics preserved,
   - legacy direct Supabase upload/insert path retained behind `NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED=false`.
2. Updated `frontend/features/media-library/hooks/__tests__/useMediaUploadController.test.ts`:
   - API upload path assertions,
   - private-tab image-only guard assertions,
   - legacy fallback path assertions when flag is disabled.

## Runtime Contract
1. Default mode (`NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED=true`) routes Media Library uploads through `/api/media/upload`.
2. Rollback mode (`NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED=false`) preserves prior client direct upload behavior temporarily.
3. UI behavior remains unchanged for placeholders, row updates, and storage-usage refresh triggers.

## Validation Log
Executed and passing:
1. `npm -C frontend run test -- useMediaUploadController media-upload.route upload-image-route upload-video-route`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`

## Rollback
1. Set `NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED=false` to return to legacy client direct upload behavior.
2. If necessary, revert this slice commit to restore previous hook implementation.

## Follow-ups
1. Phase 05 Slice D: shared media query model extraction + modal prompt user-scope drift fix.
2. Keep full Phase 05 entry/closure blocked until Phase 04 canary signoff.
