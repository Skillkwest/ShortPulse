# 2026-06-20 Media Upload Adapter Retirement

Purpose: reduce launch risk by retiring the unused multipart/raw `/api/media/upload` compatibility route and keeping the canonical Media Library / Reference Grid upload seam as `/api/media/prepare-upload` -> browser direct storage upload -> `/api/media/finalize-upload`.

Touched:

- Deleted `frontend/pages/api/media/upload.ts` and `frontend/tests/api/media-upload.route.test.ts`.
- Added `/api/media/upload` to deployment route-parity forbidden routes.
- Removed the dead media upload route flag pair from active env/contract docs.
- Updated active API/operator/system/docs, the Copperknot queue/board, the Media Library handoff, and the MVP security-audit skill to point at prepare/finalize.
- Fixed one historical evidence packet link that still pointed at the retired test file.

Validation:

- `npm -C frontend test -- --run tests/api/media-prepare-upload-route.test.ts tests/api/media-finalize-upload-route.test.ts tests/api/protected-api-paths.parity.test.ts tests/scripts/deployment-route-parity.test.mjs` passed (`4` files / `16` tests).
- `npm -C frontend test -- --run tests/scripts/vercel-env-contract.test.mjs` passed (`1` file / `8` tests).
- Scoped ESLint for the touched route-parity/media tests passed.
- `npm -C frontend run type-check:touched` passed for touched frontend TS paths; repo-wide type-check still has unrelated diagnostics.
- `npm -C frontend run docs:check`, `node --check scripts/verify_deployment_route_parity.mjs`, and `git diff --check` passed.

Boundary:

- This is local source hardening only. Deployed absence of `/api/media/upload` remains a post-deploy route-parity proof boundary.
- This does not prove authenticated production media save/browse/organize/reuse/reopen behavior.
