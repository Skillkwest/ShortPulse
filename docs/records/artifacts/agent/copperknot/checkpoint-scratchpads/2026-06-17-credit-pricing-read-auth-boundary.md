# 2026-06-17 Credit pricing read auth boundary

- Context: row 7 paid-use trust seam; production route parity remains deploy-gated on retired routes, so this pass stayed local/source-only.
- Touched: `frontend/pages/api/credits/snapshot.ts`, `frontend/pages/api/billing/catalog.ts`, `frontend/pages/api/billing/credit-packages.ts`, `frontend/pages/api/pricing/model-policy.ts`, and matching route tests.
- Change: authenticated credit/catalog/pricing read routes now catch unexpected auth-verification throws before credit, catalog, or pricing-policy loaders run, log route-owned diagnostics, and return existing safe errors.
- Validation: `npm -C frontend run test -- --run tests/api/credits-snapshot.test.ts tests/api/billing-catalog.test.ts tests/api/billing-credit-packages.test.ts tests/api/model-pricing-policy.test.ts tests/api/stripe-portal.test.ts tests/api/stripe-checkout.test.ts tests/api/transactions.test.ts tests/api/subscription-transactions.test.ts tests/api/subscription-change.test.ts tests/api/storage-addon-change.test.ts tests/api/account-identity.test.ts`; `npm -C frontend run type-check:touched`; `npm -C frontend run docs:check`; `git diff --check`.
- Boundary: no price, policy, catalog, UI/UX, Stripe/Supabase mutation, commit, push, deploy, or production-mutating proof.
