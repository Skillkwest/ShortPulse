# 2026-06-17 Billing auth boundary failure honesty

- Context: customer billing/account actions are launch-trust surfaces; this pass did not change prices, catalog rows, Stripe objects, checkout/portal semantics, or UI/UX.
- Touched: `frontend/pages/api/billing/stripe/portal.ts`, `frontend/pages/api/billing/stripe/checkout.ts`, `frontend/pages/api/billing/stripe/transactions.ts`, `frontend/pages/api/billing/stripe/subscription-transactions.ts`, `frontend/pages/api/billing/subscription/change.ts`, `frontend/pages/api/billing/storage-addon/change.ts`, and matching route tests.
- Change: customer billing routes now catch unexpected auth-verification throws before any Supabase or Stripe side effects, log route-owned diagnostics, and return existing safe billing failure messages.
- Validation: `npm -C frontend run test -- --run tests/api/stripe-portal.test.ts tests/api/stripe-checkout.test.ts tests/api/transactions.test.ts tests/api/subscription-transactions.test.ts tests/api/subscription-change.test.ts tests/api/storage-addon-change.test.ts tests/api/account-identity.test.ts`; `npm -C frontend run type-check:touched`; `npm -C frontend run docs:check`; `git diff --check`.
- Boundary: local source/test proof only; no production-mutating billing proof, checkout, portal action, commit, push, or deploy.
