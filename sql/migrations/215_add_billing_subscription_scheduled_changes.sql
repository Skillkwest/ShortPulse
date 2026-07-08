-- Track Stripe subscription schedules that will change a customer's base plan
-- at a future period boundary. This table is a webhook-owned projection only:
-- current entitlements remain in billing_subscription_contracts until Stripe
-- changes the active subscription item.

create table if not exists public.billing_subscription_scheduled_changes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source_kind text not null default 'stripe_subscription_schedule' check (
        source_kind = 'stripe_subscription_schedule'
    ),
    status text not null default 'active' check (
        status in ('active', 'applied', 'canceled', 'released', 'completed', 'aborted')
    ),
    change_kind text not null check (
        change_kind in ('scheduled_downgrade', 'scheduled_interval_change')
    ),
    stripe_customer_id text not null,
    stripe_subscription_id text not null,
    stripe_schedule_id text not null,
    current_plan_id text,
    current_offer_id text,
    current_billing_interval text check (
        current_billing_interval is null or current_billing_interval in ('month', 'year')
    ),
    current_stripe_price_id text,
    target_plan_id text not null,
    target_offer_id text,
    target_billing_interval text not null check (target_billing_interval in ('month', 'year')),
    target_stripe_price_id text not null,
    target_recurring_price_cents integer not null default 0,
    target_monthly_credits_cents integer not null default 0,
    target_storage_limit_bytes bigint not null default 0,
    target_max_concurrent_generations integer not null default 0,
    effective_at timestamptz not null,
    current_benefits_end_at timestamptz,
    schedule_phase_start_at timestamptz,
    schedule_phase_end_at timestamptz,
    applied_at timestamptz,
    canceled_at timestamptz,
    released_at timestamptz,
    completed_at timestamptz,
    aborted_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_billing_subscription_scheduled_changes_user_status
    on public.billing_subscription_scheduled_changes (user_id, status, effective_at);

create index if not exists ix_billing_subscription_scheduled_changes_subscription
    on public.billing_subscription_scheduled_changes (
        stripe_subscription_id,
        status,
        effective_at
    );

create unique index if not exists ux_billing_subscription_scheduled_changes_schedule
    on public.billing_subscription_scheduled_changes (stripe_schedule_id);

create unique index if not exists ux_billing_subscription_scheduled_changes_active_subscription
    on public.billing_subscription_scheduled_changes (stripe_subscription_id)
    where status = 'active';

create or replace function public.set_billing_subscription_scheduled_change_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_billing_subscription_scheduled_changes_updated_at
    on public.billing_subscription_scheduled_changes;
create trigger trg_billing_subscription_scheduled_changes_updated_at
before update on public.billing_subscription_scheduled_changes
for each row
execute function public.set_billing_subscription_scheduled_change_updated_at();

alter table public.billing_subscription_scheduled_changes enable row level security;

drop policy if exists service_role_manage_billing_subscription_scheduled_changes
    on public.billing_subscription_scheduled_changes;
create policy service_role_manage_billing_subscription_scheduled_changes
    on public.billing_subscription_scheduled_changes
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

revoke all on table public.billing_subscription_scheduled_changes from public, anon, authenticated;
grant all on table public.billing_subscription_scheduled_changes to service_role;

revoke all on function public.set_billing_subscription_scheduled_change_updated_at()
    from public, anon, authenticated;
grant execute on function public.set_billing_subscription_scheduled_change_updated_at()
    to service_role;
