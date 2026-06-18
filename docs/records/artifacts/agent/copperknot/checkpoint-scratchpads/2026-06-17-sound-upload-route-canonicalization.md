# Copperknot Checkpoint Scratchpad - Sound Upload Route Canonicalization

Date: 2026-06-17

Scope: retire the stale `/api/upload-audio` adapter and move current audio-reference intake to the existing browser-direct media upload route pair.

Touched:
- removed `frontend/pages/api/upload-audio.ts`
- removed `frontend/tests/api/upload-audio-route.test.ts`
- removed `frontend/lib/server/mediaUploadAdapterTelemetry.ts`
- `frontend/lib/server/api/protectedApiPaths.ts`
- `frontend/features/ai-studio/utils/audioUpload.ts`
- `frontend/features/ai-studio/utils/__tests__/audioUpload.test.ts`
- active API/launch/decommission docs

Change: `frontend/features/ai-studio/utils/audioUpload.ts` now calls `/api/media/prepare-upload`, uploads the audio blob through the signed Supabase storage target, then calls `/api/media/finalize-upload`; this pass also removed the unused compatibility adapter, its route test, the now-empty legacy telemetry shim, and the exact auth registry entry.

Validation:
- `npm -C frontend run test -- --run features/ai-studio/utils/__tests__/audioUpload.test.ts tests/api/media-prepare-upload-route.test.ts tests/api/media-finalize-upload-route.test.ts tests/api/media-upload.route.test.ts tests/api/protected-api-paths.parity.test.ts` passed with `5` files / `19` tests.
- `npm -C frontend run type-check:touched` passed.
- `npm -C frontend run docs:check` passed.
- `git diff --check` passed.
- `npm -C frontend run build` passed; the generated route table does not list `/api/upload-audio`.

Proof boundary: this is local source/route cleanup proof only. Sound remains below floor until production-safe provider/env posture, authenticated output insertion, and any explicitly approved credit-consuming Sound proof are complete.
