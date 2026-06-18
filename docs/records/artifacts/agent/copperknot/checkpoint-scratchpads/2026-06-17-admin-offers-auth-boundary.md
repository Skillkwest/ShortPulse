# 2026-06-17 Admin Offers Auth Boundary

- Selected clean dashboard-offers seam because logged-out dashboard offers support acquisition/account trust without changing billing policy.
- Touched `/api/admin/offers` and its focused route test.
- Added route-owned admin auth verifier exception handling with `admin/offers.auth` before offer reads/writes.
- Preserved marketing-only scope; no pricing catalog, Stripe, billing policy, UI, or UX changes.
- Validation passed: `tests/api/admin-offers.test.ts` `4/4`, `features/admin/logic/__tests__/useAdminOffersController.test.tsx` `3/3`, `npm -C frontend run type-check:touched`, `npm -C frontend run docs:check`, and `git diff --check` for touched files.
- Remaining proof boundary: production route parity still fails on retired-route exposure until deploy/alias surface changes.
