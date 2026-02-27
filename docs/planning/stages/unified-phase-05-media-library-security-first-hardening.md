# Unified Phase 05: Media Library Security-First Hardening

Status: Planned  
Owner: Engineering

## Progress Notes
1. Slice A preview-trust centralization was landed as pre-entry prep on 2026-02-27:
   - `frontend/lib/mediaPreviewTrustPolicy.ts`
   - `frontend/lib/mediaPreviewPath.ts`
   - `frontend/lib/adaptive-media/resolver.ts`
   - `frontend/features/ai-studio/logic/referenceGridMedia.ts`
   - `frontend/next.config.js`
2. Slice B server-authoritative upload route landed as pre-entry prep on 2026-02-27:
   - `frontend/lib/server/mediaUploadService.ts`
   - `frontend/pages/api/media/upload.ts`
   - `frontend/tests/api/media-upload.route.test.ts`
3. Slice C hook migration landed as pre-entry prep on 2026-02-27:
   - `frontend/features/media-library/hooks/useMediaUploadController.ts`
   - `frontend/features/media-library/hooks/__tests__/useMediaUploadController.test.ts`
   - migration is rollout-gated by `NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED` with legacy direct-upload fallback retained for rollback.
4. Slice D shared query model + modal scope fix landed as pre-entry prep on 2026-02-27:
   - `frontend/features/media-library/logic/mediaQueryModel.ts`
   - `frontend/features/media-library/logic/mediaLibraryPageHelpers.ts`
   - `frontend/features/ai-studio/logic/mediaLibraryModalModel.ts`
   - `frontend/features/media-library/hooks/useMediaTabDataController.ts`
   - `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
   - `frontend/features/media-library/logic/__tests__/mediaQueryModel.test.ts`
   - `frontend/features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx`
5. Full Phase 05 entry/closure remains blocked until Phase 04 canary signoff is complete.

## Objective
Harden Media Library upload and preview trust boundaries with server-authoritative persistence, strict direct-preview trust rules, and unified scoped query behavior.

## In Scope
1. Server-authoritative media upload path for Media Library.
2. Client upload migration to authenticated API path behind rollout flag.
3. Centralized preview trust policy for direct URL fallback and image optimizer host decisions.
4. Modal/page query model unification with explicit user scoping for prompt/media loads.
5. Targeted tests and docs/evidence updates for all touched surfaces.

## Out of Scope
1. New DB/index migrations beyond existing baseline.
2. Virtualization/performance architecture redesign.
3. Billing/runtime admission behavior changes.

## Implementation Slices
1. Slice A: preview trust policy module + integration in `mediaPreviewPath`, resolve-previews route, and adaptive resolver paths.
2. Slice B: server-authoritative `/api/media/upload` route + upload service.
3. Slice C: migrate `useMediaUploadController` to `/api/media/upload` behind `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED`.
4. Slice D: shared media query model extraction and modal prompt scope drift fix.
5. Slice E: docs/evidence/tracker updates and final validation packet.

## Validation Gates
1. `npm -C frontend run test -- media-resolve-previews upload-image-route upload-video-route useMediaUploadController MediaLibraryModal mediaPreviewResolver mediaPreviewRuntimeShared`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run docs:check`
5. `npm -C frontend run build`

## Targeted Research Checkpoint
1. Not required unless external vendor contract behavior changes (for this phase, local repo sources are authoritative).
2. If new external storage/image-host constraints are introduced, add a short primary-source note in phase evidence.

## Required Docs Updates
1. `docs/planning/shortpulse-unified-buildout-tracker.md`
2. `docs/planning/evidence/unified-buildout/phase-05/*`
3. `docs/api/api-internal-routes.md`
4. `docs/security-checklist.md`
5. `docs/deployment.md`
6. `docs/change_log.md`
7. Relevant SOPs under `docs/sops/` (media upload/preview operational guidance).

## Exit Criteria
1. Media Library upload persistence path is server-authoritative and authenticated.
2. Untrusted direct preview hosts are blocked by default.
3. Unknown hosts are not wrapped by Next image optimizer transforms.
4. Modal and route query behavior is scoped and parity-tested.
5. Validation gates are green and evidence is committed.

## Rollback Plan
1. Revert only the Phase 05 commit slice(s).
2. Keep upload-route fallback path and rollout flags available until stability is confirmed.
3. Preserve prior stable behavior while retaining completed Phase 04 hardening.
