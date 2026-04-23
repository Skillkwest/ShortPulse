-- Add internal comp contract support for admin-managed recurring access without Stripe.

alter table billing_subscription_contracts
    add column if not exists contract_source text not null default 'stripe'
        check (contract_source in ('stripe', 'internal_comp')),
    add column if not exists granted_by_user_id uuid references auth.users(id) on delete set null,
    add column if not exists grant_reason text,
    add column if not exists updated_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists ix_billing_subscription_contracts_contract_source
    on billing_subscription_contracts (contract_source, status);

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
values
    ('media__internal_comp', 'media', 'Media Internal Comp', 0, 600, null, false, true, now()),
    ('studio__internal_comp', 'studio', 'Studio Internal Comp', 0, 3000, null, false, true, now()),
    ('business__internal_comp', 'business', 'Business Internal Comp', 0, 12000, null, false, true, now())
on conflict (id) do update
set offer_name = excluded.offer_name,
    recurring_price_cents = excluded.recurring_price_cents,
    monthly_credits_cents = excluded.monthly_credits_cents,
    stripe_price_id = excluded.stripe_price_id,
    acquisition_enabled = excluded.acquisition_enabled,
    is_active = excluded.is_active;
