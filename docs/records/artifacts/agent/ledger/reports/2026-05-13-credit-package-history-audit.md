# 2026-05-13 Credit Package History Audit

Purpose: retain Ledger's first substantive one-time-commerce audit covering credit package catalog, Stripe checkout, webhook grant behavior, and unified billing history projection.

## Report Metadata

- Date: 2026-05-13
- Lane: credit packages
- Requested trigger phrase: continue Ledger training on one-time commerce
- Operator intent: verify whether credit packages are labeled and charged correctly and identify the next real one-time billing risk

## Starting State

- Public truth state:
  - profile credit-package cards are loaded from the shared billing catalog via `/api/billing/catalog`
  - a separate authenticated `/api/billing/credit-packages` route still exists as a direct table read
- Sellable catalog state:
  - credit packages are catalog-backed in `billing_credit_packages`
  - admin credit-package activation validates Stripe price linkage
- Billing/runtime state:
  - Stripe checkout metadata stores `credit_package_id` and `credit_amount_cents`
  - webhook grants credit purchases into `ai_credit_ledger` with source `stripe_checkout`
- Support/admin state:
  - unified billing history reconstructs credit purchases from ledger rows plus Stripe session lookups

## Actions Taken

1. Audited the one-time-commerce runtime surfaces:
   - `/api/billing/credit-packages`
   - `/api/billing/stripe/checkout`
   - `/api/billing/stripe/webhook`
   - `frontend/lib/server/api/stripeTransactions.ts`
2. Audited the catalog/admin surfaces:
   - `frontend/lib/server/api/billingCatalog.ts`
   - `frontend/pages/api/admin/pricing/credit-packages/update.ts`
   - `frontend/pages/api/admin/pricing/state.ts`
3. Audited the active tests and account UX projections for top-up history.

## Validation

- Commands run:
  - targeted source reads for the routes and helpers above
  - targeted search across tests/docs/routes for `billing_credit_packages`, `credit_package_id`, `checkout.session.async_payment_succeeded`, and `Credit top-up`
- Tests reviewed:
  - `frontend/tests/api/stripe-checkout.test.ts`
  - `frontend/tests/api/stripe-webhook.test.ts`
  - `frontend/tests/api/billing-catalog.test.ts`
  - `frontend/tests/api/transactions.test.ts`
  - `frontend/tests/pages/profile.transactions-actions.test.tsx`
- Gaps or blockers:
  - this run was audit-only; no live Stripe walkthrough was performed

## Outcome

- Public truth result:
  - active profile credit-package cards are sourced from the shared billing catalog rather than the standalone `/api/billing/credit-packages` route
- Sellable catalog result:
  - admin mutation flow enforces Stripe price presence and validates paid package price linkage before activation
- Billing/runtime result:
  - checkout and webhook correctly guard grants to paid sessions, including delayed-payment success handling
  - top-up credit grants are idempotent on duplicate ledger `source_ref`
- Support/admin result:
  - unified billing history can show credit purchases even for accounts currently on internal-comp contracts

## Findings

### High: historical credit-purchase history can drift after package repricing or renaming

`listCreditPurchaseTransactions()` reconstructs credit-purchase rows from `ai_credit_ledger`, then falls back to the **current** `billing_credit_packages.price_cents` and `display_name` when the historical Stripe Checkout session cannot be fetched. The webhook grant metadata stores `credit_package_id`, but not a historical package-name or price snapshot.

That means old top-up history can drift if:

- a package is renamed later,
- a package price changes later,
- or an old Checkout session is no longer retrievable from Stripe.

Evidence path:

- checkout metadata only stores:
  - `credit_package_id`
  - `credit_amount_cents`
- webhook ledger grant stores:
  - `checkout_session_id`
  - `stripe_customer_id`
  - `credit_package_id`
- transaction history fallback uses mutable current catalog values from `billing_credit_packages`

### Low: direct `/api/billing/credit-packages` route is not the active profile source

Profile credits currently load packages from `/api/billing/catalog`, not `/api/billing/credit-packages`. The standalone route is not inherently broken, but it is a duplicated read model and therefore a future drift risk if package presentation fields diverge.

## Lessons Learned

- Durable lesson(s):
  - one-time commerce needs a historical commercial snapshot, not only a live catalog reference
  - webhook grant metadata should preserve enough package context to rebuild purchase history even when Stripe session lookups fail later
  - duplicated read models are not urgent bugs by themselves, but they are recurring billing-drift risks
- Tooling gap(s):
  - no explicit one-time-commerce reconciliation check yet exists for historical top-up display parity
- SOP/doc updates needed:
  - add a one-time-commerce history/parity check to Ledger's future audit checklist once that checklist exists

## Follow-Ups

- Immediate next step:
  - implement a historical snapshot fix for credit-purchase history
- Deferred validation:
  - run a real Stripe test-mode top-up purchase after the snapshot fix lands
- Remaining risk:
  - current top-up history is correct while Stripe session retrieval succeeds, but historical fallback can misstate old package titles or paid amounts after later catalog changes
