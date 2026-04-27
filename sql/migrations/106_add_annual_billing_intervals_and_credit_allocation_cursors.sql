-- Add annual billing interval support for plan offers/contracts and track monthly credit allocation
-- cursors for annual Stripe subscriptions.

alter table public.billing_plan_offers
    drop constraint if exists billing_plan_offers_billing_interval_check;

alter table public.billing_plan_offers
    add constraint billing_plan_offers_billing_interval_check
    check (billing_interval in ('month', 'year'));

drop index if exists public.ux_billing_plan_offers_current_acquisition;

create unique index if not exists ux_billing_plan_offers_current_acquisition
    on public.billing_plan_offers (plan_id, billing_interval)
    where acquisition_enabled = true and is_active = true and effective_end_at is null;

alter table public.billing_subscription_contracts
    drop constraint if exists billing_subscription_contracts_billing_interval_check;

alter table public.billing_subscription_contracts
    add constraint billing_subscription_contracts_billing_interval_check
    check (billing_interval in ('month', 'year'));

alter table public.billing_subscription_contracts
    add column if not exists last_credit_grant_at timestamptz,
    add column if not exists next_credit_grant_at timestamptz;

create index if not exists ix_billing_subscription_contracts_next_credit_grant
    on public.billing_subscription_contracts (next_credit_grant_at)
    where ended_at is null
      and status = 'active'
      and billing_interval = 'year'
      and contract_source = 'stripe';
