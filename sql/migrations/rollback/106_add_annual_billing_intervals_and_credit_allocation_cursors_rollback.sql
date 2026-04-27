-- Roll back annual billing interval support for plan offers/contracts and annual credit allocation
-- cursors.

drop index if exists public.ix_billing_subscription_contracts_next_credit_grant;

delete from public.billing_plan_offers
where billing_interval = 'year';

update public.billing_subscription_contracts
set billing_interval = 'month',
    last_credit_grant_at = null,
    next_credit_grant_at = null
where billing_interval = 'year';

alter table public.billing_subscription_contracts
    drop constraint if exists billing_subscription_contracts_billing_interval_check;

alter table public.billing_subscription_contracts
    add constraint billing_subscription_contracts_billing_interval_check
    check (billing_interval in ('month'));

alter table public.billing_subscription_contracts
    drop column if exists last_credit_grant_at,
    drop column if exists next_credit_grant_at;

drop index if exists public.ux_billing_plan_offers_current_acquisition;

create unique index if not exists ux_billing_plan_offers_current_acquisition
    on public.billing_plan_offers (plan_id)
    where acquisition_enabled = true and is_active = true and effective_end_at is null;

alter table public.billing_plan_offers
    drop constraint if exists billing_plan_offers_billing_interval_check;

alter table public.billing_plan_offers
    add constraint billing_plan_offers_billing_interval_check
    check (billing_interval in ('month'));
