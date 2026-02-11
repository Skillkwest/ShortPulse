# Billing Pricing Catalog

Purpose: keep subscription and credit-pack pricing easy to change without touching generation model pricing.

## Credit unit policy
- `1 credit = $0.01` is fixed.
- AI model debit logic remains in `frontend/features/ai-studio/logic/pricingStrategies.ts`.
- This catalog only controls subscription and top-up pricing.

## Source of truth
- Runtime prices shown in UI are loaded from Supabase tables:
  - `billing_plans`
  - `billing_credit_packages`
- UI presentation and package math helpers live in:
  - `frontend/features/billing/catalog.ts`

## Current catalog (2026-02-10)
### Subscription plans
- `free`: `$0`, `100` credits/month
- `media`: `$12`, `600` credits/month
- `studio`: `$39`, `3,000` credits/month
- `business`: `$129`, `12,000` credits/month

### Credit packs
- `starter_500`: `$7`, `500` credits
- `growth_2000`: `$26`, `2,000` credits
- `scale_6000`: `$78`, `6,000` credits
- `studio_10000`: `$100`, `10,000` credits

## How to change pricing
1. Update live catalog values in Supabase using:
   - `sql/update_billing_pricing_catalog_20260210.sql` (or a newer migration file)
2. Keep bootstrap seeds aligned for new environments:
   - `sql/create_billing_credit_tables.sql`
   - `docs/supabase_full_schema.sql`
3. Keep Stripe aligned with database values:
   - Create/update Stripe prices for each plan/package.
   - Update `billing_plans.stripe_price_id` and `billing_credit_packages.stripe_price_id`.
4. Verify in app:
   - `/profile?section=billing` reflects updated plan and package prices.
   - Checkout opens with the intended package amount.
   - Webhook grants expected credits after successful payment.

## Quick verification SQL
```sql
select id, display_name, monthly_price_cents, monthly_credits_cents
from billing_plans
order by monthly_price_cents asc;

select id, display_name, credit_amount_cents, price_cents, sort_order
from billing_credit_packages
order by sort_order asc;
```
