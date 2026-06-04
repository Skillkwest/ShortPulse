# Primary Account Billing Credit Route Boundary Audit

Date: 2026-06-03
Agent: Dave the Security Guy
Lane: launch-readiness security, primary working account/billing/credit routes only

## Scope

Audit whether primary ShortPulse account, billing, credit, and Stripe webhook routes let one user access or mutate another user's account, credits, Stripe customer/subscription state, payment history, recurring storage billing, or media-compliance account row. Legacy, backup, fallback, deprecated, and parallel routes were intentionally excluded unless current primary runtime depended on them.

## Stop Decision

No code fix was made. I found no confirmed high-ROI primary-route attacker path where an authenticated user can supply another user's id, Stripe customer id, subscription id, credit id, or account identifier and cross a protected account/billing/credit boundary. Per Dave's stop rule, this is a bounded no-fix audit.

## Evidence Checked

- `docs/agents/dave-the-security-guy/goal-prompt.md`: updated to make "primary working routes only" durable.
- `frontend/lib/server/api/auth.ts` and `frontend/lib/server/api/authTokenVerifier.ts`: `requireApiUser` verifies bearer identity server-side and does not authorize from proxy headers alone.
- `frontend/pages/api/account/profile/update.ts`, `frontend/pages/api/account/email/update.ts`, `frontend/pages/api/account/email/confirm.ts`, and `frontend/pages/api/account/media-compliance.ts`: account mutations derive identity from the verified bearer user and do not accept caller-supplied target user ids.
- `frontend/pages/api/credits/snapshot.ts`: balance, ledger fallback, legacy ledger fallback, and reservations are all filtered by the verified `user.id`.
- `frontend/lib/server/api/stripeCustomer.ts`: Stripe customer/subscription helpers load local mappings by `user_id`, create customers with `metadata[user_id]`, and verify live Stripe customer metadata before using a customer or subscription.
- `frontend/pages/api/billing/stripe/checkout.ts`, `frontend/pages/api/billing/stripe/portal.ts`, `frontend/pages/api/billing/stripe/transactions.ts`, `frontend/pages/api/billing/stripe/subscription-transactions.ts`, `frontend/pages/api/billing/subscription/change.ts`, and `frontend/pages/api/billing/storage-addon/change.ts`: primary billing routes derive customer/subscription authority from the verified user and the verified Stripe helper, not request-supplied billing ids.
- `frontend/pages/api/billing/stripe/webhook.ts`: Stripe webhook requires signature verification and bounded raw body reads; credit grants verify Stripe customer ownership and use source-ref idempotency.

## Finding Shortlist

| Finding | Severity | Confidence | Boundary | Launch impact | ROI | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| No confirmed primary-route cross-user account/billing/credit access path found. | Informational | High | account, billing, credits | Positive: current primary-route controls are aligned with launch isolation goals. | High as audit evidence; no code ROI. | Stop after bounded audit. |
| Stripe webhook duplicate event handling continues processing after a duplicate event claim. | Low/Medium candidate, not confirmed exploit | Medium | webhook/idempotency | Existing tests describe this as intentional safe reprocessing, and credit grants have per-user/source/source-ref uniqueness. Changing it could weaken recovery after claim-before-processing failure. | Low until a concrete duplicate side effect is proven. | Deferred; do not edit by momentum. |

## Root-Cause Notes

- The current canonical billing/customer root is `frontend/lib/server/api/stripeCustomer.ts`: this is where user-scoped billing rows are reconciled with live Stripe ownership metadata.
- The current canonical credit snapshot root is `frontend/pages/api/credits/snapshot.ts`: every read path applies `eq("user_id", user.id)`.
- The duplicate-webhook candidate is a contract mismatch between checklist wording and the current tested recovery behavior, not a proven cross-user leak or duplicate-credit exploit.

## Validation

- Focused API tests passed:
  - `npm -C frontend test -- --run tests/api/stripe-customer.test.ts tests/api/stripe-checkout.test.ts tests/api/stripe-portal.test.ts tests/api/stripe-webhook.test.ts tests/api/subscription-change.test.ts tests/api/storage-addon-change.test.ts tests/api/subscription-transactions.test.ts tests/api/credits-snapshot.test.ts tests/api/billing-catalog.test.ts tests/api/billing-credit-packages.test.ts tests/api/account-identity.test.ts tests/api/account.media-compliance.test.ts`
  - Result: 12 test files passed, 96 tests passed.
- Docs/security checks passed:
  - `npm -C frontend run docs:check`
  - `node scripts/check_secret_exposure.js`
  - `git diff --check`
- Dave goal prompt length after update: 2,716 characters.
- No app code changed.
- No hosted Supabase, Vercel, Stripe, GitHub secrets, billing/customer state, or production data were mutated.

## Residual Risk

- Hosted SQL/RLS/runtime posture was not re-probed in this pass; this audit is local source evidence only.
- Stripe webhook duplicate processing should be revisited only if live evidence shows duplicate non-idempotent side effects, missing `ux_ai_credit_ledger_source_ref`, or subscription/storage updates that are not idempotent.
- Admin billing routes were not expanded here because the user's current instruction prioritized primary working routes and account/billing/credit customer paths.

## Next Highest-ROI Step

Run a hosted-safe user-isolation proof for primary billing/credit tables and storage entitlement RPCs through the approved Supabase CLI/operator path, without mutating production data or exposing raw credentials. Stop if the proof requires live secrets or production customer data without explicit approval.
