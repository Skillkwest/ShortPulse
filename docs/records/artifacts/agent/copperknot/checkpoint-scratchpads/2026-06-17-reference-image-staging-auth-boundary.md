# Reference Image Staging Auth Boundary

Date: 2026-06-17
Agent: Copperknot

Touched:
- `frontend/pages/api/media/prepare-reference-image-upload.ts`
- `frontend/pages/api/media/stage-reference-image.ts`
- `frontend/tests/api/media-prepare-reference-image-upload-route.test.ts`
- `frontend/tests/api/media-stage-reference-image-route.test.ts`

Did:
- Added route-owned auth verifier exception logging for the browser-direct reference-image prepare/finalize pair.
- Added tests proving auth verifier failures stop before rate limiting, upload target creation, staged image finalization, image admission, or signing work.
- Skipped dirty Motion Control staging files.

Validation:
- `npm -C frontend run test -- --run tests/api/media-prepare-reference-image-upload-route.test.ts tests/api/media-stage-reference-image-route.test.ts`: 10 passed.
- `npm -C frontend run test -- --run tests/api/media-prepare-reference-image-upload-route.test.ts tests/api/media-stage-reference-image-route.test.ts tests/api/media-prepare-upload-route.test.ts tests/api/media-finalize-upload-route.test.ts tests/api/media-list.test.ts tests/api/media-sign-batch.test.ts`: 66 passed.
- `npm -C frontend run type-check:touched`: passed.
- `npm -C frontend run docs:check`: passed.
- `git diff --check -- <touched reference-image route/test files>`: passed.

Proof boundary:
- Local source/test proof only. No authenticated production reference-image staging, commit, push, or deploy.
- Production route parity still fails on exposed retired routes `/api/upload-video`, `/api/upload-audio`, and `/api/media/admit-image-asset`.
