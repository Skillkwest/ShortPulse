-- Track short-lived customer-initiated subscription-change intents for
-- Stripe Portal flows whose paid invoices do not include old-plan proration
-- lines. This table is proof of the requested change only; Stripe paid
-- invoices and billing_plan_offers remain the payment and catalog authorities.

create table if not exists public.billing_subscription_change_intents (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    intent_kind text not null check (intent_kind in ('full_price_upgrade')),
    status text not null default 'pending' check (
        status in ('pending', 'portal_created', 'completed', 'failed', 'expired')
    ),
    stripe_customer_id text not null,
    stripe_subscription_id text not null,
    stripe_portal_session_id text,
    stripe_invoice_id text,
    active_plan_id text,
    active_offer_id text,
    active_billing_interval text check (
        active_billing_interval is null or active_billing_interval in ('month', 'year')
    ),
    active_stripe_price_id text,
    target_plan_id text not null,
    target_offer_id text not null,
    target_billing_interval text not null check (target_billing_interval in ('month', 'year')),
    target_stripe_price_id text not null,
    metadata jsonb not null default '{}'::jsonb,
    expires_at timestamptz not null,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint billing_subscription_change_intents_expiry_check
        check (expires_at > created_at)
);

create index if not exists ix_billing_subscription_change_intents_lookup
    on public.billing_subscription_change_intents (
        user_id,
        stripe_subscription_id,
        target_stripe_price_id,
        status,
        expires_at desc
    );

create unique index if not exists ux_billing_subscription_change_intents_open
    on public.billing_subscription_change_intents (
        user_id,
        stripe_subscription_id,
        target_stripe_price_id
    )
    where status in ('pending', 'portal_created');

create or replace function public.set_billing_subscription_change_intent_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_billing_subscription_change_intents_updated_at
    on public.billing_subscription_change_intents;
create trigger trg_billing_subscription_change_intents_updated_at
before update on public.billing_subscription_change_intents
for each row
execute function public.set_billing_subscription_change_intent_updated_at();

alter table public.billing_subscription_change_intents enable row level security;

drop policy if exists service_role_manage_billing_subscription_change_intents
    on public.billing_subscription_change_intents;
create policy service_role_manage_billing_subscription_change_intents
    on public.billing_subscription_change_intents
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

revoke all on table public.billing_subscription_change_intents from public, anon, authenticated;
grant all on table public.billing_subscription_change_intents to service_role;

revoke all on function public.set_billing_subscription_change_intent_updated_at()
    from public, anon, authenticated;
grant execute on function public.set_billing_subscription_change_intent_updated_at()
    to service_role;
