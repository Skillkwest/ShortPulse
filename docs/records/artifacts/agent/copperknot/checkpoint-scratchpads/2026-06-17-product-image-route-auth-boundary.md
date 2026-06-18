# 2026-06-17 Product Image Route Auth Boundary

- Selected clean Storage / Creative Library route seam while leaving dirty product-image service files untouched.
- Touched product-image asset prepare, finalize, and storage-admit routes plus their focused route test.
- Added route-owned auth verifier exception handling with `.auth` labels before rate-limit or product-image admission service calls.
- Validation passed: `tests/api/media-product-image-asset-routes.test.ts` `8/8`, `npm -C frontend run type-check:touched`, `npm -C frontend run docs:check`, and `git diff --check` for touched files.
- Remaining proof boundary: production route parity still fails on retired-route exposure until deploy/alias surface changes.
