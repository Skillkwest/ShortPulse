# Billing Pricing Catalog

Purpose: keep subscription and credit-pack pricing easy to change without touching generation model pricing.

## Credit unit policy
- `1 credit = $0.01` is fixed.
- AI model debit logic remains in `frontend/lib/model-runtime/pricingStrategies.ts`.
- This catalog only controls subscription and top-up pricing.

## Source of truth
- Public acquisition pricing shown in UI is loaded from Supabase tables:
  - `billing_plans`
  - `billing_plan_offers`
  - `billing_credit_packages`
  - `billing_storage_addons`
  - `billing_storage_addon_offers`
- The primary billing UI reads those values through the authenticated catalog route:
  - `frontend/pages/api/billing/catalog.ts`
- UI presentation and package math helpers live in:
  - `frontend/features/billing/catalog.ts`
- Subscriber-specific recurring terms are stored separately in:
  - `billing_subscription_contracts`
- Subscriber-specific recurring storage add-ons are stored separately in:
  - `billing_subscription_storage_addons`
- Admin/internal non-public access is modeled as hidden offers plus contract source, not as a public tier:
  - hidden `billing_plan_offers` rows such as `business__internal_comp`
  - `billing_subscription_contracts.contract_source = 'internal_comp'`

## Subscriber pricing policy
- Public offers can change over time for new purchases.
- Existing subscribers keep the recurring price and included monthly credits from the offer they originally bought while the subscription remains continuously active.
- Plan changes move the subscriber onto the current public offer for the target plan unless an operator explicitly preserves a legacy contract.
- Canceling and later restarting defaults to the current public offer rather than restoring the old legacy price automatically.
- Internal comp policy:
  - internal/admin comp access is never acquisition-enabled
  - internal comp contracts use hidden offers with `recurring_price_cents = 0`
  - monthly renewals for internal comp contracts come from the internal renewal runner, not Stripe invoices

## Current catalog (2026-02-10)
### Subscription plans
- `free`: `$0`, `100` credits/month, `1 GB`
- `media`: `$12`, `600` credits/month, `25 GB`
- `studio`: `$39`, `3,000` credits/month, `100 GB`
- `business`: `$129`, `12,000` credits/month, `500 GB`

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
1. Create a new Stripe Price for the changed recurring plan or one-time package.
2. Create a new internal offer row for recurring subscriptions instead of overwriting the existing historical offer:
   - `billing_plan_offers`
   - `billing_storage_addon_offers` for recurring storage add-ons
3. Update the acquisition catalog for new buyers:
   - `billing_plans` for shared tier metadata
   - `billing_plan_offers` for the current public recurring offer
   - `billing_credit_packages` for top-up packages
   - `billing_storage_addons` for shared recurring storage add-on metadata
   - `billing_storage_addon_offers` for the current public recurring storage add-on offer
4. Keep bootstrap seeds aligned for new environments:
   - `sql/create_billing_credit_tables.sql`
   - `docs/supabase_full_schema.sql`
5. Keep Stripe aligned with database values:
   - Update `billing_plan_offers.stripe_price_id` for recurring subscriptions.
   - Update `billing_credit_packages.stripe_price_id` for top-up purchases.
   - Update `billing_storage_addon_offers.stripe_price_id` for recurring storage add-ons.
   - Do not mutate historical offers already tied to active subscriber contracts.
   - Do not attach Stripe price ids to hidden internal comp offers.
6. Verify in app:
   - `/profile?section=billing` reflects updated plan and package prices from `/api/billing/catalog`.
   - `/profile?section=billing` reflects recurring storage add-on catalog entries from `/api/billing/catalog`.
   - `/dashboard` and `/media-library` reflect the correct storage entitlement from the active contract plus add-ons.
   - Checkout opens with the intended package amount.
   - Webhook grants expected credits after successful payment.
   - Webhook sync captures recurring storage add-on subscription items into `billing_subscription_storage_addons`.
   - Existing subscribers still see their locked recurring price from `billing_subscription_contracts`.

## Quick verification SQL
```sql
select id, display_name, monthly_price_cents, monthly_credits_cents, storage_limit_bytes
from billing_plans
order by monthly_price_cents asc;

select id, plan_id, offer_name, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, stripe_price_id, acquisition_enabled
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

select user_id, plan_id, offer_id, contract_source, stripe_subscription_id, stripe_price_id, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, status
from billing_subscription_contracts
where ended_at is null
order by created_at desc;

select user_id, storage_addon_id, offer_id, stripe_subscription_id, stripe_subscription_item_id, stripe_price_id, storage_limit_bytes, quantity, recurring_price_cents, status
from billing_subscription_storage_addons
where ended_at is null
order by created_at desc;
```
