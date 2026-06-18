# Fal Upload Auth Boundary

Touched:
- `frontend/pages/api/fal/upload-url.ts`
- `frontend/tests/api/fal-upload-url.test.ts`

Did:
- Added route-owned auth verifier exception logging for Fal CDN upload staging.
- Failed closed before rate limiting, request-body upload handling, provider key reads, source fetches, storage downloads, or Fal CDN upload work when auth verification throws.
- Added a focused route test for the auth verifier failure side-effect boundary.

Validation:
- `npm -C frontend run test -- --run tests/api/fal-upload-url.test.ts`: 10 passed.
- `npm -C frontend run type-check:touched`: passed.
- `npm -C frontend run docs:check`: passed.
- `git diff --check -- frontend/pages/api/fal/upload-url.ts frontend/tests/api/fal-upload-url.test.ts`: passed.

Proof boundary:
- Local source and route-test proof only.
- Did not touch the dirty Fal submit lane.
- Fresh production route parity still fails because deployed `https://www.shortpulse.ai` exposes `/api/upload-video`, `/api/upload-audio`, and `/api/media/admit-image-asset`.
