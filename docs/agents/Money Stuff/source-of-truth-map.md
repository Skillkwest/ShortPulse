# Money Stuff Source Of Truth Map

Purpose: define where Money Stuff should look first for billing authority across subscriptions, credit packages, recurring storage/media add-ons, and active runtime pricing policy.

## Truth Layers

Money Stuff should reason about billing in this order:

1. Stripe/runtime billing truth
2. subscriber contract truth
3. live sellable catalog truth
4. UI display/copy truth

## Subscription Plans

### Public truth

- Public pricing page and account-plan cards:
  - `frontend/features/pricing/`
  - `frontend/features/billing/`
  - `frontend/features/profile/components/ProfileSubscriptionSection.tsx`
- Public plan naming policy:
  - `docs/adr/0077-paid-starter-tier-with-hidden-free-default.md`

### Sellable catalog truth

- `billing_plans`
- `billing_plan_offers`
- Stripe product + recurring price ids
- Server read model:
  - `frontend/lib/server/api/billingCatalog.ts`

### Subscriber contract truth

- `billing_subscription_contracts`

### Runtime projection truth

- `billing_profiles`

### Runtime mutation path

- `frontend/pages/api/billing/subscription/change.ts`
- `frontend/pages/api/billing/stripe/webhook.ts`

## Credit Packages

### Public truth

- Credit package account surfaces under `frontend/features/billing/` and `/profile`

### Sellable catalog truth

- `billing_credit_packages`
- Admin mutation route:
  - `frontend/pages/api/admin/pricing/credit-packages/update.ts`

### Billing/grant truth

- Stripe Checkout session state
- `ai_credit_ledger`
- `ai_credit_balance`
- `stripe_event_log`

### Runtime mutation path

- `frontend/pages/api/billing/credit-packages.ts`
- `frontend/pages/api/billing/stripe/checkout.ts`
- `frontend/pages/api/billing/stripe/webhook.ts`

## Recurring Storage / Media Add-Ons

### Public truth

- Account/profile storage surfaces
- Storage add-on CTA and history views

### Sellable catalog truth

- `billing_storage_addons`
- `billing_storage_addon_offers`
- Admin mutation route:
  - `frontend/pages/api/admin/pricing/storage-offers/create.ts`

### Subscriber contract truth

- `billing_subscription_storage_addons`
- base storage snapshot on `billing_subscription_contracts`

### Runtime mutation path

- `frontend/pages/api/billing/storage-addon/change.ts`
- `frontend/pages/api/billing/stripe/webhook.ts`

## AI Usage Pricing / Admin Pricing Authority

### Primary authority input surface

- `/admin/pricing`
- `frontend/pages/admin/pricing.tsx`
- Scott is the primary author and maintainer of this page implementation.

### Shared pricing authority state

- `frontend/pages/api/admin/pricing/state.ts`
- `frontend/pages/api/pricing/model-policy.ts`
- `frontend/lib/server/api/modelPricingControlPlane.ts`
- `frontend/lib/model-runtime/pricingPolicy.ts`
- `frontend/lib/model-runtime/pricingStrategies.ts`
- `frontend/features/admin/pricingCostDocs.ts`

### Money Stuff responsibility

- Read `/admin/pricing` as the canonical pricing authority input surface.
- Use that authority to decide whether product credit costs, button labels, guardrails, and billing-facing UX are aligned.
- Do not edit or maintain the admin pricing page implementation itself unless the user explicitly reassigns that page lane.

## Annual Renewals

### Contract truth

- `billing_subscription_contracts.next_credit_grant_at`
- `billing_subscription_contracts.last_credit_grant_at`

### Runtime truth

- `frontend/pages/api/internal/billing-contract-renewals/run.ts`
- env flag + cron secret + scheduler health

## Support / Reconciliation Truth

### Primary diagnostics

- `frontend/pages/api/admin/billing-diagnostics.ts`
- `frontend/pages/api/admin/billing/customer-sync.ts`
- `frontend/pages/api/admin/billing/portal.ts`
- `scripts/verify_billing_contracts_against_stripe.ts`

### Reconciliation pairs

- Stripe customer <-> `billing_profiles.stripe_customer_id`
- Stripe customer <-> `billing_subscription_contracts.stripe_customer_id`
- Stripe subscription <-> `billing_subscription_contracts.stripe_subscription_id`
- public card display <-> live catalog row
- paid event <-> credit grant / contract update / account projection

## Canonical Checks Money Stuff Should Expect

- Is the customer-facing price the same as the live sellable offer?
- Is the displayed interval actually purchasable?
- Does Stripe have the correct product/price/customer/subscription object?
- Does Supabase store the correct contract, projection, and ledger state?
- Does the profile/admin UI project the same truth back after webhook or renewal processing?
