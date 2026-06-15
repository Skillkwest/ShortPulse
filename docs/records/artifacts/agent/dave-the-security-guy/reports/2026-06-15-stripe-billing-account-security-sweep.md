# 2026-06-15 Stripe Billing Account Security Sweep

Agent: Dave the Security Guy  
Mode: launch-readiness security audit, no UI/UX/product-behavior changes  
Branch: local `production`

## Scope

Audited the primary Stripe and billing trust boundaries for launch readiness:

- authenticated credit-package checkout
- authenticated Stripe portal creation
- subscription plan change and storage add-on mutation
- authenticated payment/transaction history
- Stripe webhook credit and subscription writes
- admin billing customer sync, admin portal, internal comp contracts, manual credit adjustments
- internal billing renewal runner
- billing/credit SQL and RLS posture

Out of scope by instruction: UI/UX changes, product redesign, broad cleanup, legacy/fallback route hunting, hosted data mutation, live purchase creation, secret inspection, or production customer-state mutation.

## Stop Condition

Stop after this retained audit unless a fresh repo-backed issue shows all of:

1. a concrete attacker can cross a Stripe, billing, account, or credit boundary,
2. the impact materially affects July 7 launch safety,
3. the canonical owning fix is clear and small,
4. the ROI is stronger than stopping.

This sweep did not meet that edit gate. No code changes were made.

## Ranked Findings

### 1. No confirmed cross-account Stripe/customer/subscription bypass

Severity: no confirmed issue  
Confidence: high from code and targeted tests  
Boundary: user account to Stripe customer/subscription/billing rows  
Launch impact: positive evidence for launch readiness  
ROI: stop/report; no patch

Evidence:

- `/api/billing/stripe/checkout` requires `requireApiUser`, accepts only `packageId`, loads the package server-side, derives the Stripe customer from `user.id`, and writes `metadata[user_id]` from the authenticated user.
- `/api/billing/stripe/portal` requires `requireApiUser` and derives the Stripe customer from the authenticated user; no request-supplied customer id is accepted.
- subscription and storage add-on mutation routes load billing state by `user.id`, then call `readVerifiedStripeSubscriptionForUser` before allowing Stripe subscription changes.
- `readVerifiedStripeCustomerForUser` checks Stripe customer `metadata.user_id` against the expected user and fails closed on mismatch; subscription verification composes through that customer check.
- payment-history routes resolve the caller's billing state and verified Stripe customer before listing invoices; credit top-ups are filtered by `ai_credit_ledger.user_id`.

### 2. Webhook boundary is signed and user/customer verified; duplicate reprocessing is intentional, not a launch security fix

Severity: no confirmed issue  
Confidence: medium-high  
Boundary: Stripe webhook to credit/subscription writes  
Launch impact: positive, with one residual hosted-proof warning below  
ROI: no patch

Evidence:

- webhook body parsing disables Next body parsing, caps payload size, and verifies Stripe signature before parsing event data.
- event IDs are claimed in `stripe_event_log`; claim failure skips side effects.
- checkout credit grants require paid status, metadata user id, Stripe customer id, and `readVerifiedStripeCustomerForUser`.
- duplicate credit grants are guarded by `ai_credit_ledger` source-ref uniqueness.
- existing tests explicitly assert duplicate event reprocessing as intended safe behavior, so changing it would be a behavior/design change without a confirmed account-leak path.

### 3. Admin/internal credit mutation surfaces are privileged and bounded

Severity: no confirmed issue  
Confidence: high from code/tests  
Boundary: admin/internal to customer credits and billing contracts  
Launch impact: positive evidence for launch readiness  
ROI: no patch

Evidence:

- admin billing portal, customer sync, internal comp contract update, and manual credit adjustment routes require `requireAdminUser`, which uses verified auth plus `app_metadata` role/operator checks.
- manual credit adjustment enforces non-zero amount and absolute safety cap.
- internal renewal runner is disabled unless explicitly enabled and requires a configured cron secret through constant-time comparison.

### 4. SQL/RLS posture supports billing and credit account isolation

Severity: no confirmed issue  
Confidence: high from SQL review  
Boundary: direct database reads/writes for billing profiles, contracts, storage add-ons, credit balance, credit ledger, Stripe event log  
Launch impact: positive evidence for launch readiness  
ROI: no patch

Evidence:

- `billing_profiles`, `billing_subscription_contracts`, and `billing_subscription_storage_addons` select policies are constrained to `user_id = auth.uid()` and write policies are service-role-only.
- `stripe_event_log` is service-role-only.
- `ai_credit_balance` and `ai_credit_ledger` are user-isolated for reads.
- users can insert only negative self-debits into the ledger; positive credit adjustments require privileged context.
- credit ledger trigger blocks zero changes, self-credit, and underflow.

## Validation

Targeted local Stripe/billing test slice:

```text
npm -C frontend run test -- tests/api/stripe-checkout.test.ts tests/api/stripe-portal.test.ts tests/api/stripe-customer.test.ts tests/api/stripe-webhook.test.ts tests/api/subscription-change.test.ts tests/api/storage-addon-change.test.ts tests/api/transactions.test.ts tests/api/subscription-transactions.test.ts tests/api/credits-snapshot.test.ts tests/api/admin-credits-adjust.test.ts tests/api/admin-billing-portal.test.ts tests/api/admin-billing-customer-sync.test.ts tests/api/admin-billing-contracts-update.test.ts tests/api/internal-billing-contract-renewals-run.test.ts
```

Result: 14 test files passed, 94 tests passed.

Read-only production billing launch-readiness audit:

```text
npm -C frontend run billing:launch-readiness -- --base-url https://www.shortpulse.ai
```

Result: 8 pass, 1 warn, 0 fail.

The warning was that local `STRIPE_SECRET_KEY` was unavailable for direct Stripe webhook endpoint event proof. Production Vercel env contract and deployed billing route parity still passed.

## Residual Risk

- Hosted live Stripe event proof was not completed in this lane because it would require local Stripe secret access or explicit hosted-provider validation steps. Do not infer that a live purchase/webhook round trip was executed.
- The current evidence supports account isolation in code, SQL, and tests, plus read-only production route/catalog/env posture. It does not prove every live Stripe dashboard webhook event subscription setting without provider-side access.
- Existing dirty worktree changes were present before this report work; this lane did not modify app code.

## Next Highest-ROI Step

If continuing Stripe launch readiness, do one explicit provider-backed no-mutation validation pass: verify Stripe dashboard webhook endpoint event subscriptions and, if approved by the user, run a controlled low-dollar live purchase/webhook round trip on a test account. Without that approval, the stop condition is reached.
