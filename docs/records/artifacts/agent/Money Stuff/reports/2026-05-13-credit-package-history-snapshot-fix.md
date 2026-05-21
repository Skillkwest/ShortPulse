# 2026-05-13 Credit Package History Snapshot Fix

Purpose: retain Money Stuff's first one-time-commerce implementation run fixing historical credit-purchase display drift after package repricing or renaming.

## Report Metadata

- Date: 2026-05-13
- Lane: credit packages
- Requested trigger phrase: continue with Money Stuff's next one-time-commerce implementation step
- Operator intent: preserve truthful historical credit-purchase history even when current package catalog values later change

## Starting State

- Public truth state:
  - account transaction history could show current package names and prices for older top-up purchases when Stripe session lookup was unavailable
- Sellable catalog state:
  - current package catalog rows remained correct for live purchases
- Billing/runtime state:
  - checkout metadata and webhook ledger metadata did not preserve historical package-name or package-price snapshots
- Support/admin state:
  - support could see that a top-up happened, but historical fallback display was vulnerable to later catalog drift

## Actions Taken

1. Extended top-up checkout metadata in `frontend/pages/api/billing/stripe/checkout.ts` to include:
   - `credit_package_display_name`
   - `credit_package_price_cents`
2. Extended webhook ledger grant metadata in `frontend/pages/api/billing/stripe/webhook.ts` to persist those same historical package snapshots.
3. Updated `frontend/lib/server/api/stripeTransactions.ts` so unified transaction history now falls back in this order:
   - live Stripe Checkout session amount,
   - historical ledger snapshot,
   - current mutable package catalog row.
4. Added targeted regression coverage for:
   - checkout metadata creation,
   - delayed-payment webhook grants,
   - historical transaction fallback when the current catalog no longer matches the original purchase.

## Validation

- Commands run:
  - `npx vitest run tests/api/stripe-checkout.test.ts tests/api/stripe-webhook.test.ts tests/api/transactions.test.ts`
  - `git diff --check -- frontend/pages/api/billing/stripe/checkout.ts frontend/pages/api/billing/stripe/webhook.ts frontend/lib/server/api/stripeTransactions.ts frontend/tests/api/stripe-checkout.test.ts frontend/tests/api/stripe-webhook.test.ts frontend/tests/api/transactions.test.ts`
- Tests passed:
  - `tests/api/stripe-checkout.test.ts`
  - `tests/api/stripe-webhook.test.ts`
  - `tests/api/transactions.test.ts`
- Gaps or blockers:
  - no live Stripe test-mode top-up walkthrough in this run

## Outcome

- Public truth result:
  - historical credit-purchase titles and fallback paid amounts now stay anchored to the original purchase metadata
- Sellable catalog result:
  - no change to active package sellability or current package pricing authority
- Billing/runtime result:
  - new top-up grants now persist enough historical snapshot metadata to reconstruct purchase history safely
- Support/admin result:
  - future purchase-history investigations are less vulnerable to later package repricing or renaming
- Docs/index updates:
  - no canonical billing docs needed changes for this narrow runtime fix

## Lessons Learned

- Durable lesson(s):
  - one-time-commerce history needs immutable purchase snapshots just as much as recurring commerce needs immutable subscriber contracts
  - Stripe-session lookups are helpful but should not be the only historical truth source
- Tooling gap(s):
  - a live Stripe test-mode top-up walkthrough is still needed to complete Money Stuff's one-time-commerce proof path
- SOP/doc updates needed:
  - add a one-time-commerce historical-fallback check to a future Money Stuff checklist or rubric

## Follow-Ups

- Immediate next step:
  - run Money Stuff on the storage add-on lane
- Deferred validation:
  - run a real Stripe test-mode top-up purchase and confirm the new snapshot metadata lands end to end
- Remaining risk:
  - old historical purchases created before this fix still depend on Stripe session retrieval or mutable current package rows
