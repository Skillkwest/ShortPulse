# 2026-06-17 Media Compliance Auth Boundary

- Selected clean Public Entry / Account Trust seam after higher queue rows were handed-off, dirty, or deploy/proof gated.
- Touched `/api/account/media-compliance` and its focused route test.
- Added route-owned auth verifier exception handling with `account/media-compliance.auth` and `scope: app`.
- Preserved existing customer-facing media agreement behavior while making auth/compliance gate failures more diagnosable.
- Validation passed: focused account/protected-gate Vitest slice `26/26`, `npm -C frontend run type-check:touched`, `npm -C frontend run docs:check`, and `git diff --check` for touched files.
- Remaining proof boundary: production route parity still fails on retired-route exposure until deploy/alias surface changes.
