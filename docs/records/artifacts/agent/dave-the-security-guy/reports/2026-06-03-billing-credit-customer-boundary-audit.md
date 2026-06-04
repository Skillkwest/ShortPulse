# Billing, Credit, And Stripe Customer Boundary Audit

Date: 2026-06-03
Agent: Dave the Security Guy
Mode: launch-readiness security audit, no product/UI/UX changes
Repo branch: local `production`

## Scope

This lane checked whether a signed-in user, webhook event, admin billing route, or service-role helper can cross into another user's credits, Stripe customer, Stripe subscription, billing profile, billing contract, recurring storage add-on, or billing transaction feed.

The Nuclo handoff remains the current Supabase posture input for the prior scheduler/RPC remediation lane. This audit did not mutate hosted Supabase, Stripe, Vercel, GitHub secrets, or production data.

## Ranked Finding Shortlist

| Finding | Severity | Confidence | Trust boundary | Launch impact | ROI |
| --- | --- | --- | --- | --- | --- |
| No confirmed cross-user billing/customer/credit leak in audited current code | Informational | High | Authenticated account to billing/credit/Stripe state | Reduces launch uncertainty for one of the highest-risk account-security surfaces | High as audit evidence, no code edit |
| Admin billing responses can return raw internal error messages after `requireAdminUser` | Low | Medium | Admin-only operational error surface | Not a cross-user leak for normal users; could expose internal diagnostics to a compromised admin session | Defer; not top launch ROI versus account isolation |

## Evidence

User-facing billing routes derive authority from `requireApiUser` and do not accept client-supplied Stripe customer IDs, Stripe subscription IDs, or target user IDs:

- `frontend/pages/api/billing/stripe/portal.ts` creates a portal for the authenticated `user.id` through `ensureStripeCustomerForUser`.
- `frontend/pages/api/billing/stripe/checkout.ts` creates credit Checkout sessions for the authenticated `user.id`, sets `client_reference_id` and metadata from server-side identity, and only accepts a package id.
- `frontend/pages/api/billing/subscription/change.ts` loads billing profile/contract rows by `user.id`, verifies live Stripe subscriptions through `readVerifiedStripeSubscriptionForUser`, then creates Checkout or portal sessions for that user.
- `frontend/pages/api/billing/storage-addon/change.ts` loads active storage add-on rows by `user.id`, verifies the live Stripe subscription belongs to that user, then updates Stripe subscription items.
- `frontend/pages/api/billing/stripe/transactions.ts` and `frontend/pages/api/billing/stripe/subscription-transactions.ts` resolve the authenticated user's billing state before listing Stripe invoices.
- `frontend/pages/api/credits/snapshot.ts` reads `ai_credit_balance`, `ai_credit_ledger`, and `ai_credit_reservations` with `.eq("user_id", user.id)` on every path.

The canonical Stripe customer helper verifies provider authority instead of trusting local rows alone:

- `frontend/lib/server/api/stripeCustomer.ts` reads the live Stripe customer and requires `customer.metadata.user_id === userId` before reuse.
- `readVerifiedStripeSubscriptionForUser` resolves the subscription's customer and then verifies that customer against the same user.
- `syncStripeCustomerForUser` refuses ownership mismatches and only allows metadata repair when the live customer has no metadata user id.

Webhook credit and subscription writes are signature verified, idempotent, and tied back to verified customer ownership:

- `frontend/pages/api/billing/stripe/webhook.ts` disables body parsing, reads a bounded raw body, verifies the Stripe signature, and claims the event in `stripe_event_log`.
- Checkout credit grants read metadata user id plus the session customer, then call `readVerifiedStripeCustomerForUser` before writing `ai_credit_ledger`.
- Subscription and invoice handlers resolve the billing profile by Stripe customer, then verify the Stripe customer before updating billing profile/contracts or applying subscription renewal credits.
- Ledger writes use source refs and duplicate detection for idempotency.

Admin billing routes are correctly admin-gated before target-user operations:

- `frontend/pages/api/admin/billing/portal.ts`
- `frontend/pages/api/admin/billing/customer-sync.ts`
- `frontend/pages/api/admin/billing/contracts/update.ts`

SQL posture evidence remains consistent with the Nuclo handoff and local SQL audit artifacts:

- `sql/audit_billing_credit_rls.sql` covers `billing_profiles`, `billing_subscription_contracts`, `ai_credit_balance`, `ai_credit_ledger`, `ai_credit_reservations`, and `stripe_event_log`.
- `sql/create_billing_credit_tables.sql` and later migrations keep user-facing billing/credit rows isolated by `auth.uid()` with service-role management policies for server-owned writes.
- `sql/migrations/087_add_storage_entitlements_and_recurring_storage_addons.sql` isolates recurring storage add-on rows by `auth.uid()` and service-role management.

## Highest-ROI Decision Before Edits

No code edit was selected.

Why: the candidate highest-risk attacker path was cross-user billing or credit authority, especially a route trusting a client-supplied `userId`, `stripe_customer_id`, `stripe_subscription_id`, or webhook metadata without provider-customer verification. Current code already resolves identity server-side and verifies live Stripe customer ownership at the canonical helper. A patch would be lower ROI than stopping because it would likely add duplicate checks or response cleanup without closing a proven launch-risk boundary.

## Validation

Targeted billing/security test run:

```bash
npm -C frontend test -- --run tests/api/stripe-customer.test.ts tests/api/stripe-checkout.test.ts tests/api/stripe-portal.test.ts tests/api/subscription-change.test.ts tests/api/storage-addon-change.test.ts tests/api/transactions.test.ts tests/api/credits-snapshot.test.ts tests/api/stripe-webhook.test.ts tests/api/admin-billing-portal.test.ts tests/api/admin-billing-customer-sync.test.ts tests/api/internal-billing-contract-renewals-run.test.ts
```

Result: 11 test files passed, 82 tests passed.

## Residual Launch Risk

- Hosted Supabase RLS posture was not re-mutated or re-probed in this lane; Nuclo's handoff remains the current hosted proof for billing credit RLS and runtime SQL audit posture.
- This audit did not use real Stripe production customer data or mutate Stripe.
- Admin-only raw internal error responses remain a lower-ROI hardening backlog item, not a confirmed normal-user cross-account leak.

## Next Highest-ROI Step

Continue with the next account-isolation surface that can actually cross user boundaries: current media/project persistence routes and signed-storage helpers, using fresh repo evidence only and stopping if the prior retained reports still match current code.
