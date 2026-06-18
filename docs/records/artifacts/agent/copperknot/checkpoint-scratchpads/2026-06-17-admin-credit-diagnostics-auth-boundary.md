# Admin Credit Diagnostics Auth Boundary

Touched:
- `frontend/pages/api/admin/credits/adjust.ts`
- `frontend/pages/api/admin/credits/ledger.ts`
- `frontend/pages/api/admin/billing-diagnostics.ts`
- `frontend/pages/api/admin/user-health.ts`
- `frontend/pages/api/admin/user-health-fleet.ts`
- `frontend/lib/server/api/authTokenVerifier.ts`
- `frontend/tests/api/auth-helper.test.ts`
- matching focused API tests

Done:
- Refreshed production route parity after deploy; `https://www.shortpulse.ai` still resolves to the same deployment and still exposes retired `/api/upload-video`, `/api/upload-audio`, and `/api/media/admit-image-asset`.
- Treated route parity as a release/deploy proof boundary, not a source patch target.
- Wrapped admin auth verification in route-owned failure handling for admin credit adjustment, credit ledger, and billing diagnostics.
- Extended the same route-owned admin auth failure boundary to per-user and fleet user-health diagnostics.
- Added tests proving unexpected admin-auth verifier failures log route-owned `.auth` diagnostics, return safe errors, and stop before Supabase, Stripe, credit-ledger, or fleet-health side effects.
- Hardened the canonical bearer verifier so unreadable Supabase auth payloads return the controlled `AUTH_VERIFICATION_UNAVAILABLE` 503 path instead of escaping as raw verifier exceptions.

Validation:
- `npm -C frontend run test -- --run tests/api/admin-credits-adjust.test.ts tests/api/admin-credit-ledger.test.ts tests/api/admin-billing-diagnostics.test.ts` passed 18 tests.
- `npm -C frontend run test -- --run tests/api/admin-credits-adjust.test.ts tests/api/admin-credit-ledger.test.ts tests/api/admin-billing-diagnostics.test.ts tests/api/admin-billing-portal.test.ts tests/api/admin-billing-customer-sync.test.ts tests/api/admin-billing-contracts-update.test.ts tests/api/admin-pricing-state.test.ts tests/api/admin-pricing-mutations.test.ts tests/api/credits-snapshot.test.ts tests/api/billing-catalog.test.ts tests/api/billing-credit-packages.test.ts tests/api/model-pricing-policy.test.ts` passed 68 tests.
- `npm -C frontend run test -- --run tests/api/admin-user-health.test.ts tests/api/admin-user-health-fleet.test.ts tests/api/admin-credits-adjust.test.ts tests/api/admin-credit-ledger.test.ts tests/api/admin-billing-diagnostics.test.ts tests/lib/admin-user-health-deep-report.test.ts tests/lib/admin-user-health-fleet-scan.test.ts` passed 41 tests.
- `npm -C frontend run test -- --run tests/api/admin-user-health.test.ts tests/api/admin-user-health-fleet.test.ts tests/api/admin-credits-adjust.test.ts tests/api/admin-credit-ledger.test.ts tests/api/admin-billing-diagnostics.test.ts tests/api/admin-billing-portal.test.ts tests/api/admin-billing-customer-sync.test.ts tests/api/admin-billing-contracts-update.test.ts tests/api/admin-pricing-state.test.ts tests/api/admin-pricing-mutations.test.ts tests/api/credits-snapshot.test.ts tests/api/billing-catalog.test.ts tests/api/billing-credit-packages.test.ts tests/api/model-pricing-policy.test.ts tests/lib/admin-user-health-deep-report.test.ts tests/lib/admin-user-health-fleet-scan.test.ts` passed 91 tests.
- `npm -C frontend run test -- --run tests/api/auth-helper.test.ts tests/api/admin-user-health.test.ts tests/api/admin-user-health-fleet.test.ts tests/api/admin-credits-adjust.test.ts tests/api/admin-credit-ledger.test.ts tests/api/admin-billing-diagnostics.test.ts tests/api/admin-billing-portal.test.ts tests/api/admin-billing-customer-sync.test.ts tests/api/admin-billing-contracts-update.test.ts tests/api/admin-pricing-state.test.ts tests/api/admin-pricing-mutations.test.ts tests/api/credits-snapshot.test.ts tests/api/billing-catalog.test.ts tests/api/billing-credit-packages.test.ts tests/api/model-pricing-policy.test.ts tests/lib/admin-user-health-deep-report.test.ts tests/lib/admin-user-health-fleet-scan.test.ts` passed 105 tests.
- `npm -C frontend run test -- --run tests/api/auth-helper.test.ts tests/api/admin-access.test.ts tests/api/protected-api-paths.parity.test.ts tests/api/internal-route-inventory-regression.test.ts` passed 22 tests.
- `npm -C frontend run type-check:touched` passed.
- `npm -C frontend run docs:check` passed.
- `git diff --check -- <touched files>` passed.
