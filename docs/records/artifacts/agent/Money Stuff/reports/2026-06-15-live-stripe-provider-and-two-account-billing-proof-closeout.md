# 2026-06-15 Live Stripe Provider And Two-Account Billing Proof Closeout

Status: completed with provider setup pass and explicit transaction blockers
Owner: Money Stuff
Lane: live production Stripe provider proof and end-to-end billing transfer
Environment: production only
Production URL: `https://www.shortpulse.ai`
Production Supabase project: `ftgrqgjrchpimronuhop`

## Claim

The live Stripe provider gate is now configured and passes the canonical production billing launch-readiness check.

The full end-to-end purchase/isolation matrix is not complete because the next step requires safe non-admin production test accounts, explicit approval for real production billing mutations, a payment approach, and cleanup rules.

## Evidence

Initial provider proof with live Stripe access failed:

```bash
npm -C frontend run billing:launch-readiness -- --base-url https://www.shortpulse.ai --json
```

Initial result:

- `passed = 8`
- `warnings = 0`
- `failed = 1`
- failing check: `stripe_webhook_endpoint`
- failure summary: no enabled Stripe webhook endpoint pointed at `https://www.shortpulse.ai/api/billing/stripe/webhook`

Redacted Stripe endpoint inventory before setup:

- endpoint count: `0`
- matching enabled production billing endpoint count: `0`

Setup performed:

- created one live Stripe webhook endpoint for `https://www.shortpulse.ai/api/billing/stripe/webhook`
- enabled required billing events:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
- replaced Vercel production `STRIPE_WEBHOOK_SECRET` with the new endpoint signing secret
- redeployed the existing production deployment rather than deploying the dirty local worktree
- confirmed the new deployment is aliased to `https://www.shortpulse.ai`

Post-redeploy readiness result:

- `passed = 9`
- `warnings = 0`
- `failed = 0`
- `stripe_webhook_endpoint`: pass

Post-closeout pre-purchase cleanup/audit:

- local clipboard was cleared after using the exposed live Stripe secret for proof
- production deployment inspection still showed `https://shortpulse-9ga13frv7-kirk-artmans-projects.vercel.app` as `Ready` and aliased to `https://www.shortpulse.ai`
- production webhook route unauthenticated/unsigned smoke:
  - `GET /api/billing/stripe/webhook`: `405`
  - unsigned `POST /api/billing/stripe/webhook`: `400`
- production billing mutation unauthenticated smoke:
  - `POST /api/billing/subscription/change`: `401`
  - `POST /api/billing/storage-addon/change`: `401`
  - `POST /api/billing/stripe/checkout`: `401`
- production admin/support unauthenticated smoke:
  - `GET /api/admin/billing-diagnostics?...`: `401`
  - `GET /api/admin/pricing/state`: `401`

Redacted Stripe endpoint inventory after setup:

- endpoint count: `1`
- matching enabled production billing endpoint count: `1`
- redacted endpoint id: `we_1Tic...DkRV`
- status: `enabled`
- livemode: `true`
- URL: `https://www.shortpulse.ai/api/billing/stripe/webhook`
- missing required events: none

## Freshness

- Gathered on `2026-06-15` in the current shell on local branch `production`
- Production target checked: `https://www.shortpulse.ai`
- Post-redeploy production deployment URL observed: `https://shortpulse-9ga13frv7-kirk-artmans-projects.vercel.app`
- The deployment is aliased to:
  - `https://www.shortpulse.ai`
  - `https://shortpulse.ai`
  - `https://shortpulse.vercel.app`

## Unknowns

- recent delivery success/failure posture for real billing events is not proven yet because no real purchase event was sent through the new endpoint in this run
- subscription checkout webhook projection for Account A is not proven yet
- credit top-up webhook projection for Account A is not proven yet
- recurring storage/media add-on projection for Account A is not proven yet
- Account A vs Account B billing, credit, storage, and admin-route isolation is not proven yet

## Next Proof

Run the two-account production purchase/isolation matrix only after the user provides:

- Account A: safe non-admin production purchaser
- Account B: safe non-admin production isolation comparator
- explicit approval for a real production subscription purchase
- explicit approval for a real production credit top-up purchase
- explicit approval for a real production recurring storage/media add-on mutation
- payment method/test approach
- cleanup rules for each transaction

After that, prove:

- Account A subscription checkout creates or uses Account A's Stripe customer and writes Account A billing profile/contract state only
- Account A credit top-up creates a unique `stripe_checkout` ledger grant and changes Account A balance only
- Account A storage add-on creates a Stripe subscription item and projects Account A storage entitlement only
- Account B sees none of Account A's billing, credit, storage, or payment history
- Account A and Account B cannot access admin billing/support routes

## Decision Impact

The blocking provider setup issue is resolved. ShortPulse can now receive production Stripe billing webhook events at the configured production URL after the redeploy.

Do not treat the full billing launch proof as complete until real production purchase and account-isolation behavior has been exercised with approved safe accounts.

## Confidence Level

Partial.

Decision-grade for:

- provider endpoint existence
- live-mode endpoint posture
- required event subscription coverage
- production readiness script pass after Vercel secret update and redeploy

Not yet decision-grade for:

- real webhook delivery success
- real subscription/top-up/storage transaction projection
- two-account isolation

## Change Trigger

Recheck this claim if any of the following changes:

- Stripe webhook endpoint configuration
- Vercel `STRIPE_WEBHOOK_SECRET`
- production deployment alias
- billing webhook route implementation
- checkout, subscription, storage add-on, customer ownership, or credit ledger code
- Stripe secret rotation after this run

## Public Truth Result

Passed through the production readiness script. Public pricing and signup callback checks passed against `https://www.shortpulse.ai`.

## Sellable Catalog Result

Passed through the production readiness script. Production Supabase catalog checks found active paid plan offers, credit packages, and storage offers with required Stripe linkage.

## Stripe/Runtime Billing Truth Result

Provider setup now passes. Stripe has one enabled live endpoint for the production billing webhook URL with all required events, and production Vercel has been updated/redeployed with the matching webhook signing secret.

Real delivery success is not proven until a real approved purchase or equivalent approved event-level test runs.

## Subscriber Contract Truth Result

Not transaction-proven in this run. The contract projection path remains code-backed only until Account A completes an approved subscription checkout or subscription mutation.

## Support/Admin Truth Result

Partially code-backed only. Admin billing diagnostics, customer sync, portal, and pricing routes use `requireAdminUser`, but non-admin denial was not exercised with Account A / Account B in production.

## Security/Account Isolation Truth Result

Not proven in this run. The two-account non-admin isolation matrix did not begin because safe accounts, purchase approval, payment approach, and cleanup rules were not provided yet.

## Exact Blockers

- no safe non-admin production Account A
- no safe non-admin production Account B
- no explicit approval for real production subscription purchase
- no explicit approval for real production credit top-up purchase
- no explicit approval for real production recurring storage/media add-on mutation
- no payment method/test approach
- no cleanup rules for real production billing mutations
- live Stripe secret was exposed in chat during this run and should be rotated after the proof sequence
