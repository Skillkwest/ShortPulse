# Billing Pricing Catalog

Purpose: keep subscription, storage add-on, and credit-pack pricing easy to change without mutating the separate AI model debit policy.

## Credit accounting policy

- Catalog tables define how many credits a plan or top-up grants to a user account.
- The current default AI model debit scale is `1 credit = $0.01`, but that runtime conversion is no longer fixed in code; it lives in the shared model-pricing control plane documented in `docs/product/ai-studio-pricing.md`.
- Changes to model markup, row-specific round-nearest values, or credit conversion affect future generation debits only.
- Changes to this billing catalog affect product/package pricing and granted-credit quantities only.

## Source of truth

- Public acquisition pricing shown in UI is loaded from current acquisition offer rows plus shared metadata:
  - `billing_plan_offers` for current recurring plan prices, credits, storage, billing interval, and active generation slots
  - `billing_plans` for shared plan metadata such as stable ids, display names, Stripe product linkage, and UI ordering
  - `billing_credit_packages`
  - `billing_storage_addon_offers` for current recurring storage add-on prices and capacity
  - `billing_storage_addons` for shared storage add-on metadata
- Public acquisition surfaces now load those values server-side through the shared loader:
  - `frontend/lib/server/api/billingCatalog.ts`
  - Used by `/`, `/dashboard`, and `/pricing`
- Authenticated account-management surfaces still read those values through the authenticated catalog route:
  - `frontend/pages/api/billing/catalog.ts`
- Operators can now inspect and update public catalog pricing from:
  - `/admin/pricing`
- New plan tiers can now be created from the same admin surface:
  - `/api/admin/pricing/plans/create` creates the `billing_plans` row, initial monthly and annual current `billing_plan_offers` rows, and the Stripe product plus recurring prices in one operator flow.
- Existing plan/storage offer activation uses service-role-only atomic RPCs from `sql/migrations/116_add_atomic_admin_pricing_offer_activation_rpcs.sql`.
- Operators can inspect the active runtime model-pricing policy from the same admin surface, but that policy is a separate control plane from the billing catalog tables in this doc.
- UI presentation and package math helpers live in:
  - `frontend/features/billing/catalog.ts`
- Subscriber-specific recurring terms are stored separately in:
  - `billing_subscription_contracts`
  - `billing_subscription_contracts.max_concurrent_generations` snapshots the active generation slot entitlement for that subscriber
- Subscriber-specific recurring storage add-ons are stored separately in:
  - `billing_subscription_storage_addons`
- `billing_profiles` is a runtime projection only. It must not be treated as the authoritative source for paid recurring entitlements when an open contract row is missing.
- Admin/internal non-public access is modeled as hidden offers plus contract source, not as a public tier:
  - hidden `billing_plan_offers` rows such as `business__internal_comp`
  - `billing_subscription_contracts.contract_source = 'internal_comp'`

## Subscriber pricing policy

- Public offers can change over time for new purchases.
- Recurring plan pricing is now interval-aware:
  - monthly and annual recurring offers are versioned separately in `billing_plan_offers`
  - only one current acquisition-enabled offer may exist per `plan_id + billing_interval`
- Existing subscribers keep the recurring price and included monthly credits from the offer they originally bought while the subscription remains continuously active.
- Plan changes move the subscriber onto the current public offer for the target plan unless an operator explicitly preserves a legacy contract.
- Canceling and later restarting defaults to the current public offer rather than restoring the old legacy price automatically.
- Internal comp policy:
  - internal/admin comp access is never acquisition-enabled
  - internal comp contracts use hidden offers with `recurring_price_cents = 0`
  - monthly renewals for internal comp contracts come from the internal renewal runner, not Stripe invoices
- Annual billing policy:
  - annual subscribers pay yearly but still receive credits monthly
  - `billing_subscription_contracts.next_credit_grant_at` tracks the next monthly allocation due inside the active annual term
  - annual monthly allocations are processed by the secured billing renewal runner rather than by annual Stripe invoices alone

## Current catalog (2026-06-04)

Public entry-plan note:

- `Starter` is the public first paid plan.
- The legacy `free` database id is a non-public baseline fallback row, not a customer-facing plan, and carries `0` active generation slots.

### Subscription plans

- `starter`: `$15/month` or `$180/year`, `350` credits/month, `1 GB`, `1` active generation
- `media`: `$49/month` or `$588/year`, `1,200` credits/month, `25 GB`, `2` active generations
- `studio`: `$129/month` or `$1,188/year`, `3,200` credits/month, `100 GB`, `4` active generations
- `business`: `$299/month` or `$2,748/year`, `7,500` credits/month, `500 GB`, `8` active generations

### Recurring storage add-ons

- `storage_25gb`: `$5/month`, `+25 GB`
- `storage_100gb`: `$15/month`, `+100 GB`
- `storage_500gb`: `$49/month`, `+500 GB`

### Credit packs

- `starter_500`: `$7`, `500` credits
- `growth_2000`: `$26`, `2,000` credits
- `scale_6000`: `$78`, `6,000` credits
- `studio_10000`: `$100`, `10,000` credits

## How to change pricing

1. Decide which pricing domain is changing:
   - billing catalog (`plans`, `storage add-ons`, `credit top-ups`) via `/admin/pricing`
   - runtime AI model debit policy (`credit conversion`, per-model markup, row-specific round-nearest values) via the same admin page's model-pricing section and `docs/product/ai-studio-pricing.md`
2. If you are creating a brand-new plan tier, use `/admin/pricing` -> `Create new plan`.
   - This creates the Stripe product, monthly and annual recurring Stripe prices, the new `billing_plans` row, and the first current monthly and annual `billing_plan_offers` rows together.
3. If you are changing public pricing for an existing recurring plan, create a new internal offer row instead of overwriting historical subscriber pricing:
   - `billing_plan_offers`
   - `billing_storage_addon_offers` for recurring storage add-ons
   - include `max_concurrent_generations` when changing plan offer terms
4. If you are changing an existing plan/storage/top-up price outside the new-plan flow, create or attach the correct Stripe Price before activation.
   - Paid plan/storage/top-up activation validates the Stripe Price is active, USD-denominated, amount-matched, interval-matched for recurring offers, and catalog-target-compatible when ShortPulse metadata is present.
5. Update the acquisition catalog for new buyers:
   - `billing_plan_offers` for the current public recurring offer
   - `billing_plans` for shared tier metadata only
   - `billing_credit_packages` for top-up packages
   - `billing_storage_addon_offers` for the current public recurring storage add-on offer
   - `billing_storage_addons` for shared recurring storage add-on metadata only
6. Keep bootstrap seeds aligned for new environments:
   - `sql/create_billing_credit_tables.sql`
   - `docs/supabase_full_schema.sql`
7. Keep Stripe aligned with database values:
   - New plans now persist both `billing_plans.stripe_product_id` and `billing_plan_offers.stripe_price_id`.
   - Update `billing_plan_offers.stripe_price_id` for recurring subscriptions.
   - Update `billing_credit_packages.stripe_price_id` for top-up purchases.
   - Update `billing_storage_addon_offers.stripe_price_id` for recurring storage add-ons.
   - Do not mutate historical offers already tied to active subscriber contracts.
   - Do not attach Stripe price ids to hidden internal comp offers.
8. Verify in app:
   - `/pricing` reflects updated public plans, credit packages, and recurring storage add-ons from the shared billing catalog loader.
   - Guest `/dashboard` chips reflect the current public acquisition catalog where applicable.
   - `/profile?section=credits` reflects updated plan and package prices from `/api/billing/catalog`.
   - New plans render correctly even when the plan id is not one of the legacy fixed tiers.
   - `/profile?section=storage` reflects recurring storage add-on catalog entries from `/api/billing/catalog`.
   - Authenticated `/dashboard` and AI Studio media surfaces reflect the correct storage entitlement from the active contract plus add-ons.
   - Checkout opens with the intended package amount.
   - Webhook grants expected credits after successful payment.
   - Webhook sync captures recurring storage add-on subscription items into `billing_subscription_storage_addons`.
   - Existing subscribers still see their locked recurring price from `billing_subscription_contracts`.
   - If users change subscriptions through Stripe Billing Portal, confirm the Stripe portal configuration exposes the new recurring price as intended.
   - If the model-pricing policy changed, AI Studio estimate chips and server debits should both reflect the new active runtime policy from `/api/pricing/model-policy`.

## Quick verification SQL

```sql
select id, display_name, sort_order, stripe_product_id, monthly_price_cents, monthly_credits_cents, storage_limit_bytes
from billing_plans
order by sort_order asc, monthly_price_cents asc;

select id, plan_id, offer_name, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, max_concurrent_generations, stripe_price_id, acquisition_enabled
from billing_plan_offers
order by plan_id, created_at asc;

select id, display_name, credit_amount_cents, price_cents, sort_order
from billing_credit_packages
order by sort_order asc;

select id, display_name, storage_limit_bytes, monthly_price_cents, sort_order
from billing_storage_addons
order by sort_order asc;

select id, storage_addon_id, offer_name, storage_limit_bytes, recurring_price_cents, stripe_price_id, acquisition_enabled
from billing_storage_addon_offers
order by storage_addon_id, created_at asc;

select user_id, plan_id, offer_id, contract_source, stripe_subscription_id, stripe_price_id, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, max_concurrent_generations, status
from billing_subscription_contracts
where ended_at is null
order by created_at desc;

select user_id, storage_addon_id, offer_id, stripe_subscription_id, stripe_subscription_item_id, stripe_price_id, storage_limit_bytes, quantity, recurring_price_cents, status
from billing_subscription_storage_addons
where ended_at is null
order by created_at desc;
```
