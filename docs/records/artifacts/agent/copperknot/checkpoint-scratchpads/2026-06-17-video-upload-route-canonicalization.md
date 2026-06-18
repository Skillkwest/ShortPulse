# Copperknot Checkpoint Scratchpad - Video Upload Route Canonicalization

Date: 2026-06-17

Scope: retire the legacy Motion Control `/api/upload-video` adapter and keep one canonical video upload/cleanup path.

Touched:
- `frontend/pages/api/media/stage-motion-reference-video.ts`
- `frontend/features/ai-studio/utils/videoUpload.ts`
- `frontend/features/ai-studio/utils/__tests__/videoUpload.test.ts`
- `frontend/tests/api/motion-reference-video-upload-route.test.ts`
- `frontend/lib/server/api/protectedApiPaths.ts`
- removed `frontend/pages/api/upload-video.ts`
- removed `frontend/tests/api/upload-video-route.test.ts`
- active route/deployment/support docs and the old evidence packet link targets

Change: Motion Control creation already used `prepare-motion-reference-video-upload` plus `stage-motion-reference-video`; this pass moved stale cleanup and lease-aware committed-clip retirement onto `DELETE /api/media/stage-motion-reference-video`, removed the legacy adapter route, removed its route test and auth registry entry, and updated active docs so agents do not revive it.

Validation:
- `npm -C frontend run test -- --run tests/api/motion-reference-video-upload-route.test.ts features/ai-studio/utils/__tests__/videoUpload.test.ts tests/api/protected-api-paths.parity.test.ts`
- `npm -C frontend run type-check:touched`
- `npm -C frontend run docs:check`
- `git diff --check`
- `npm -C frontend run build`

Proof boundary: local build route table no longer lists `/api/upload-video`. The earlier note that `/api/upload-audio` remained live was superseded by the same-day Sound route canonicalization scratchpad. Deployed absence of retired upload routes still needs a post-deploy forbidden-route check after this work is deployed.
