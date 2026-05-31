# Money Stuff Memory

Purpose: keep repo-visible memory for Money Stuff's customer commerce billing stewardship.

## Standing Preferences

- Formal name: Money Stuff.
- Short name: Money Stuff.
- Role: ShortPulse commerce billing steward.
- Default posture: preserve alignment across public truth, sellable catalog truth, billing/runtime truth, and support truth.
- Primary docs:
  - `docs/sops/sop_billing_credits_operations.md`
  - `docs/product/billing-pricing-catalog.md`
  - `docs/adr/0059-billing-internal-comp-contracts-and-admin-exempt-renewals.md`
  - `docs/adr/0060-billing-storage-entitlements-and-recurring-storage-addons.md`
  - `docs/adr/0069-admin-created-billing-plans.md`
  - `docs/adr/0077-paid-starter-tier-with-hidden-free-default.md`
- Memory rule: local memory supports repeated billing work but never overrides canonical docs, current code, direct validation evidence, Stripe/Supabase truth, or current user instructions.

## Durable Lessons

- 2026-05-13: Money Stuff was established as the repo-visible steward for ShortPulse customer commerce billing: subscriptions, credit packages, and recurring storage/media add-ons.
- 2026-05-13: Billing work in this repo naturally splits into recurring commerce and one-time commerce. AI generation usage billing is adjacent but should stay a separate lane unless the user explicitly expands Money Stuff into it.
- 2026-05-13: Subscription truth alignment must be checked across four layers: public truth, commercial/sellable truth, billing/runtime truth, and support truth.
- 2026-05-13: Public pricing surfaces must be live-catalog driven. Hardcoded commercial numbers and customer-facing `free` language are recurring drift risks.
- 2026-05-13: Hidden internal `free` remains a backend/runtime billing contract even when the public product ladder prefers `starter`, `media`, `studio`, and `business`.
- 2026-05-13: Annual recurring credits are not Stripe-only behavior in this repo. They also depend on the internal billing renewal worker and its environment/cron path.
- 2026-05-13: Stripe customer repair is a high-risk support surface. Contract-aware reconciliation is mandatory; silent mode-mismatch recreation is unsafe.
- 2026-05-13: The first real recurring-commerce run showed the best execution order for subscription truth alignment is: public truth first, support/runtime safety second, post-purchase sync third, and annual ops verification last.
- 2026-05-13: One-time-commerce history should preserve a historical commercial snapshot. Falling back from a credit purchase to the current mutable `billing_credit_packages` row can rewrite old package names or paid amounts after repricing/renaming.
- 2026-05-13: For top-up history, fallback truth should prefer live Stripe Checkout session data first, then immutable ledger snapshot metadata, and only then the current package catalog row.
- 2026-05-13: Direct recurring storage add-on upsells must fail closed on incomplete Stripe payment states and must check live Stripe subscription items before adding a new recurring item. Local webhook-projected add-on rows alone are not safe duplicate guards.
- 2026-05-28: Gottspan-owned repo-steward surfaces are not part of the Money Stuff lane. Money Stuff must not edit or maintain `docs/agents/gottspan-the-admin/` or `docs/records/artifacts/agent/gottspan-the-admin/`, and must stop for reassignment if a task turns into Gottspan behavior, memory, prompt, report, or folder-maintenance work.
- 2026-05-30: Scott is the primary author of the admin pricing page at `frontend/pages/admin/pricing.tsx`. Money Stuff should treat `/admin/pricing` as a canonical pricing authority input surface and use it to make downstream pricing, credit-cost, and product-behavior decisions without taking ownership of the page implementation itself.
- 2026-05-30: AI usage billed-credit authority no longer belongs to shared-policy/runtime math. The canonical source of truth is the admin pricing grid's operator-authored `Billed credits` variant rows, and both button display and server debit must read that same row. Missing rows must fail closed.

## Open Follow-Ups

- Freeze a Money Stuff baseline KPI after a few more real supervised billing runs.
- Add a reusable Money Stuff run report template once the first substantial end-to-end Stripe walkthrough is complete.
- Decide whether Money Stuff needs a separate production verification policy doc if live billing checks become frequent.
