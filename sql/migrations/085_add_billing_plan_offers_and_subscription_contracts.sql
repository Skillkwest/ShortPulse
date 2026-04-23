-- Adds versioned billing offers and historical subscriber contracts.
-- This separates public acquisition pricing from per-user recurring commercial terms.

create table if not exists billing_plan_offers (
    id text primary key,
    plan_id text not null references billing_plans(id) on delete cascade,
    offer_name text not null,
    recurring_price_cents integer not null check (recurring_price_cents >= 0),
    monthly_credits_cents integer not null check (monthly_credits_cents >= 0),
    stripe_price_id text unique,
    currency text not null default 'usd' check (currency = lower(currency)),
    billing_interval text not null default 'month' check (billing_interval in ('month')),
    acquisition_enabled boolean not null default false,
    is_active boolean not null default true,
    effective_start_at timestamptz,
    effective_end_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_billing_plan_offers_plan on billing_plan_offers (plan_id);
create unique index if not exists ux_billing_plan_offers_current_acquisition
    on billing_plan_offers (plan_id)
    where acquisition_enabled = true and is_active = true and effective_end_at is null;

alter table billing_plan_offers enable row level security;
drop policy if exists select_billing_plan_offers_public on billing_plan_offers;
create policy select_billing_plan_offers_public on billing_plan_offers
    for select using (true);
drop policy if exists service_role_manage_billing_plan_offers on billing_plan_offers;
create policy service_role_manage_billing_plan_offers on billing_plan_offers
    for all to service_role
    using (true)
    with check (true);

create or replace function set_billing_plan_offer_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_billing_plan_offers_updated_at on billing_plan_offers;
create trigger trg_billing_plan_offers_updated_at
before update on billing_plan_offers
for each row execute function set_billing_plan_offer_updated_at();

insert into billing_plan_offers (
    id,
    plan_id,
    offer_name,
    recurring_price_cents,
    monthly_credits_cents,
    stripe_price_id,
    acquisition_enabled,
    is_active,
    effective_start_at
)
select
    p.id || '__current',
    p.id,
    p.display_name || ' Current Offer',
    p.monthly_price_cents,
    p.monthly_credits_cents,
    p.stripe_price_id,
    p.is_active,
    p.is_active,
    now()
from billing_plans p
on conflict (id) do update
set offer_name = excluded.offer_name,
    recurring_price_cents = excluded.recurring_price_cents,
    monthly_credits_cents = excluded.monthly_credits_cents,
    stripe_price_id = excluded.stripe_price_id,
    acquisition_enabled = excluded.acquisition_enabled,
    is_active = excluded.is_active;

create table if not exists billing_subscription_contracts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    plan_id text not null references billing_plans(id),
    offer_id text references billing_plan_offers(id),
    stripe_customer_id text,
    stripe_subscription_id text,
    stripe_price_id text,
    recurring_price_cents integer not null check (recurring_price_cents >= 0),
    monthly_credits_cents integer not null check (monthly_credits_cents >= 0),
    currency text not null default 'usd' check (currency = lower(currency)),
    billing_interval text not null default 'month' check (billing_interval in ('month')),
    status text not null default 'inactive',
    current_period_start timestamptz,
    current_period_end timestamptz,
    cancel_at_period_end boolean not null default false,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_billing_subscription_contracts_user on billing_subscription_contracts (user_id, created_at desc);
create index if not exists ix_billing_subscription_contracts_plan on billing_subscription_contracts (plan_id);
create index if not exists ix_billing_subscription_contracts_status on billing_subscription_contracts (status);
create unique index if not exists ux_billing_subscription_contracts_current_user
    on billing_subscription_contracts (user_id)
    where ended_at is null;
create unique index if not exists ux_billing_subscription_contracts_current_subscription
    on billing_subscription_contracts (stripe_subscription_id)
    where stripe_subscription_id is not null and ended_at is null;

alter table billing_subscription_contracts enable row level security;
drop policy if exists select_billing_subscription_contracts_isolation on billing_subscription_contracts;
create policy select_billing_subscription_contracts_isolation on billing_subscription_contracts
    for select using (user_id = auth.uid());
drop policy if exists service_role_manage_billing_subscription_contracts on billing_subscription_contracts;
create policy service_role_manage_billing_subscription_contracts on billing_subscription_contracts
    for all to service_role
    using (true)
    with check (true);

create or replace function set_billing_subscription_contract_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_billing_subscription_contracts_updated_at on billing_subscription_contracts;
create trigger trg_billing_subscription_contracts_updated_at
before update on billing_subscription_contracts
for each row execute function set_billing_subscription_contract_updated_at();

insert into billing_subscription_contracts (
    user_id,
    plan_id,
    offer_id,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    recurring_price_cents,
    monthly_credits_cents,
    status,
    current_period_end,
    started_at,
    ended_at
)
select
    bp.user_id,
    bp.plan_id,
    p.id || '__current',
    bp.stripe_customer_id,
    bp.stripe_subscription_id,
    p.stripe_price_id,
    p.monthly_price_cents,
    p.monthly_credits_cents,
    bp.subscription_status,
    bp.current_period_end,
    coalesce(bp.created_at, now()),
    case
        when bp.subscription_status in ('canceled', 'inactive') then coalesce(bp.current_period_end, bp.updated_at, now())
        else null
    end
from billing_profiles bp
join billing_plans p on p.id = bp.plan_id
where (
        bp.plan_id <> 'free'
        or bp.stripe_customer_id is not null
        or bp.stripe_subscription_id is not null
        or bp.subscription_status <> 'inactive'
    )
    and not exists (
        select 1
        from billing_subscription_contracts existing
        where existing.user_id = bp.user_id
          and existing.ended_at is null
    );
