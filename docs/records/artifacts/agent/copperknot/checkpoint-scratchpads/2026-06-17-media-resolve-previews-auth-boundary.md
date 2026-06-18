# Media Resolve Previews Auth Boundary

Touched:
- `frontend/pages/api/media/resolve-previews.ts`
- `frontend/tests/api/media-resolve-previews.test.ts`

Did:
- Added route-owned auth verifier exception logging for media preview resolution.
- Failed closed before media row lookup, storage object lookup, basename repair, or signing work when auth verification throws.
- Added a focused route test for the auth verifier failure side-effect boundary.

Validation:
- `npm -C frontend run test -- --run tests/api/media-resolve-previews.test.ts`: 15 passed.
- `npm -C frontend run type-check:touched`: passed.
- `npm -C frontend run docs:check`: passed.
- `git diff --check -- frontend/pages/api/media/resolve-previews.ts frontend/tests/api/media-resolve-previews.test.ts`: passed.

Proof boundary:
- Local source and route-test proof only.
- Fresh production route parity still fails because deployed `https://www.shortpulse.ai` exposes `/api/upload-video`, `/api/upload-audio`, and `/api/media/admit-image-asset`.
