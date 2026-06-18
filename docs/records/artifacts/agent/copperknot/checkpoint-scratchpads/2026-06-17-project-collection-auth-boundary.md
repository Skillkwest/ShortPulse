# 2026-06-17 Project Collection Auth Boundary

- Selected clean Projects / Workspace Restore seam after higher queue rows were handed-off, dirty, or deploy/proof gated.
- Touched project create/list collection routes and added isolated `projects-auth-boundary` route tests.
- Added route-owned auth verifier exception handling with `projects-create.auth` and `projects-list.auth` before rate-limit, create, or list service work.
- Avoided editing the dirty broad project test lane; used it as adjacent validation only.
- Validation passed: project auth/broad route Vitest slice `40/40`, `npm -C frontend run type-check:touched`, `npm -C frontend run docs:check`, and `git diff --check` for touched files.
- Remaining proof boundary: production route parity still fails on retired-route exposure until deploy/alias surface changes.
