# Stripe Failed-Payment Recovery Buildout Plan

Source status: implementation source for the July 7, 2026 Money Stuff billing lane.

## Objective

Make failed renewals, failed purchases, and payment-action-required states visible, recoverable, and correctly gated without granting credits before Stripe confirms payment.

## Owner And Lane

Owner lane: Money Stuff, the ShortPulse commerce billing steward.

Secondary touched surfaces are Profile billing UI, admin billing diagnostics, SQL entitlement helpers, and billing docs.

## Source Of Truth

- Stripe webhook credit/subscription handling: `frontend/pages/api/billing/stripe/webhook.ts`
- Billing status and storage entitlement rules: `frontend/lib/billing/storageAddonEligibility.ts`
- Paid media-library access guard: `frontend/lib/server/api/mediaLibraryPaidAccess.ts`
- Customer payment history helpers: `frontend/lib/server/api/stripeTransactions.ts`
- Customer account summary/profile billing surfaces: `frontend/pages/api/billing/account-summary.ts`, `frontend/features/billing/accountSummary.ts`, `frontend/pages/profile.tsx`
- Admin billing diagnostics: `frontend/lib/server/api/adminBillingDiagnostics.ts`
- Billing/credits SQL bootstrap and migrations: `sql/create_billing_credit_tables.sql`, `sql/migrations/`
- Billing operations SOP: `docs/sops/sop_billing_credits_operations.md`

## Approved Scope

- Centralize subscription status semantics for paid access, recovery/grace, and revoked states.
- Handle Stripe failed-payment and payment-action-required webhook events without minting credits.
- Surface current failed/open invoice recovery context to customer and support surfaces.
- Align TypeScript, SQL, tests, and docs so `unpaid` no longer behaves like current paid access.
- Preserve the existing webhook-paid credit grant authority and existing Stripe Billing Portal recovery path.

## Non-Goals

- Do not change public prices, plan names, credit package amounts, Stripe products, or Stripe Prices.
- Do not add manual fallback credit grants, duplicate subscription authorities, or browser-side fulfillment.
- Do not change model pricing, generation debit formulas, launch posture, branch policy, or mobile scope.
- Do not apply hosted SQL, deploy, commit, push, or perform production mutation/proof in this lane.

## Implementation Sequence

1. Define a shared billing subscription status policy helper.
2. Replace hardcoded paid/current status arrays in media, storage, account summary, admin diagnostics, and related tests.
3. Add Stripe webhook handling for `invoice.payment_failed`, `invoice.payment_action_required`, and `checkout.session.async_payment_failed`; log recovery context and never grant credits from those events.
4. Expose latest open/failed invoice recovery context through authenticated customer billing APIs and render it in existing Profile billing/history surfaces with the existing Billing Portal path.
5. Add admin billing diagnostics findings for failed/open invoice states and `unpaid` paid-access drift.
6. Add SQL migration/bootstrap/schema/doc updates for the new `unpaid` access cutoff.
7. Validate focused tests first, then broader lint/type/build/docs checks as feasible.

## Proof Requirements

- Focused Vitest coverage for subscription status policy, webhook failure events, storage/media access semantics, account summary/recovery parsing, Profile rendering, and admin diagnostics.
- SQL drift tests updated for the new current-status contract.
- At minimum, run the focused tests touched by this buildout.
- Broader proof target before handoff: `npm -C frontend run lint`, `npm -C frontend run type-check`, `npm -C frontend run build`, and `npm -C frontend run docs:check` unless blocked by unrelated worktree state.
- Production proof requires a separate approved deploy plus production URL/Supabase/Stripe readback.

## Stop Condition

Stop when the repo implementation, docs, SQL migration files, and focused tests match this plan, or earlier if a required product-policy decision becomes unclear, validation blocks safe progress, or remaining proof depends on deploy, hosted SQL apply, production mutation, commit, push, or another owner lane.
