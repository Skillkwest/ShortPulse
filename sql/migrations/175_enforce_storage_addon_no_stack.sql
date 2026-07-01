-- Update storage entitlements/catalog and enforce one current billable recurring storage add-on per user.
-- Run sql/check_billing_storage_addon_no_stack_drift.sql before applying this migration.

do $$
declare
    v_stacked_users bigint;
    v_quantity_rows bigint;
begin
    select count(*)::bigint
    into v_stacked_users
    from (
        select user_id
        from public.billing_subscription_storage_addons
        where ended_at is null
          and lower(status) in ('active', 'trialing', 'past_due', 'unpaid')
        group by user_id
        having count(*) > 1
    ) stacked;

    if coalesce(v_stacked_users, 0) > 0 then
        raise exception 'Cannot enforce storage add-on no-stack guard: % users have multiple current billable storage add-ons', v_stacked_users;
    end if;

    select count(*)::bigint
    into v_quantity_rows
    from public.billing_subscription_storage_addons
    where ended_at is null
      and lower(status) in ('active', 'trialing', 'past_due', 'unpaid')
      and quantity is distinct from 1;

    if coalesce(v_quantity_rows, 0) > 0 then
        raise exception 'Cannot enforce storage add-on no-stack guard: % current billable storage add-on rows have quantity other than one', v_quantity_rows;
    end if;
end $$;

with plan_storage(plan_id, storage_limit_bytes) as (
    values
        ('free', 0::bigint),
        ('starter', 5::bigint * 1024 * 1024 * 1024),
        ('media', 25::bigint * 1024 * 1024 * 1024),
        ('studio', 75::bigint * 1024 * 1024 * 1024),
        ('business', 150::bigint * 1024 * 1024 * 1024)
)
update public.billing_plans plan
set storage_limit_bytes = plan_storage.storage_limit_bytes
from plan_storage
where plan.id = plan_storage.plan_id;

with plan_storage(plan_id, storage_limit_bytes) as (
    values
        ('free', 0::bigint),
        ('starter', 5::bigint * 1024 * 1024 * 1024),
        ('media', 25::bigint * 1024 * 1024 * 1024),
        ('studio', 75::bigint * 1024 * 1024 * 1024),
        ('business', 150::bigint * 1024 * 1024 * 1024)
)
update public.billing_plan_offers offer
set storage_limit_bytes = plan_storage.storage_limit_bytes,
    updated_at = now()
from plan_storage
where offer.plan_id = plan_storage.plan_id
  and offer.is_active = true
  and offer.effective_end_at is null
  and (
      offer.acquisition_enabled = true
      or offer.id in ('media__internal_comp', 'studio__internal_comp', 'business__internal_comp')
  );

insert into public.billing_storage_addons (
    id,
    display_name,
    storage_limit_bytes,
    monthly_price_cents,
    stripe_price_id,
    is_active,
    sort_order
)
values
    ('storage_10gb', 'Extra 10 GB', 10::bigint * 1024 * 1024 * 1024, 700, null, true, 10),
    ('storage_50gb', 'Extra 50 GB', 50::bigint * 1024 * 1024 * 1024, 2900, null, true, 20),
    ('storage_100gb', 'Extra 100 GB', 100::bigint * 1024 * 1024 * 1024, 5900, null, true, 30),
    ('storage_250gb', 'Extra 250 GB', 250::bigint * 1024 * 1024 * 1024, 14900, null, true, 40),
    ('storage_500gb', 'Extra 500 GB', 500::bigint * 1024 * 1024 * 1024, 29900, null, true, 50)
on conflict (id) do update
set display_name = excluded.display_name,
    storage_limit_bytes = excluded.storage_limit_bytes,
    monthly_price_cents = excluded.monthly_price_cents,
    stripe_price_id = excluded.stripe_price_id,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

update public.billing_storage_addons
set is_active = false,
    sort_order = 90
where id = 'storage_25gb';

update public.billing_storage_addon_offers
set acquisition_enabled = false,
    effective_end_at = coalesce(effective_end_at, now()),
    updated_at = now()
where acquisition_enabled = true
  and is_active = true
  and effective_end_at is null;

insert into public.billing_storage_addon_offers (
    id,
    storage_addon_id,
    offer_name,
    storage_limit_bytes,
    recurring_price_cents,
    stripe_price_id,
    acquisition_enabled,
    is_active,
    effective_start_at
)
values
    ('storage_10gb__pending_stripe', 'storage_10gb', 'Extra 10 GB Pending Stripe Price', 10::bigint * 1024 * 1024 * 1024, 700, null, false, true, null),
    ('storage_50gb__pending_stripe', 'storage_50gb', 'Extra 50 GB Pending Stripe Price', 50::bigint * 1024 * 1024 * 1024, 2900, null, false, true, null),
    ('storage_100gb__20260701_pending_stripe', 'storage_100gb', 'Extra 100 GB Pending Stripe Price', 100::bigint * 1024 * 1024 * 1024, 5900, null, false, true, null),
    ('storage_250gb__pending_stripe', 'storage_250gb', 'Extra 250 GB Pending Stripe Price', 250::bigint * 1024 * 1024 * 1024, 14900, null, false, true, null),
    ('storage_500gb__manual_review', 'storage_500gb', 'Extra 500 GB Manual Review', 500::bigint * 1024 * 1024 * 1024, 29900, null, false, true, null)
on conflict (id) do update
set offer_name = excluded.offer_name,
    storage_limit_bytes = excluded.storage_limit_bytes,
    recurring_price_cents = excluded.recurring_price_cents,
    stripe_price_id = excluded.stripe_price_id,
    acquisition_enabled = false,
    is_active = excluded.is_active,
    effective_start_at = excluded.effective_start_at,
    updated_at = now();

create unique index if not exists billing_subscription_storage_addons_one_current_per_user_idx
    on public.billing_subscription_storage_addons (user_id)
    where ended_at is null
      and lower(status) in ('active', 'trialing', 'past_due', 'unpaid');

alter table public.billing_subscription_storage_addons
    add constraint billing_subscription_storage_addons_current_quantity_one_check
    check (
        ended_at is not null
        or lower(status) not in ('active', 'trialing', 'past_due', 'unpaid')
        or quantity = 1
    );

create or replace function public.resolve_media_storage_addon_limit_bytes(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
stable
as $$
declare
    v_limit bigint;
begin
    if p_user_id is null then
        return 0;
    end if;

    select coalesce(sum(
        addon.storage_limit_bytes
        * case when addon.quantity > 0 then 1 else 0 end
    ), 0)::bigint
    into v_limit
    from public.billing_subscription_storage_addons addon
    where addon.user_id = p_user_id
      and addon.ended_at is null
      and lower(addon.status) in ('active', 'trialing', 'past_due', 'unpaid');

    return greatest(coalesce(v_limit, 0), 0);
end;
$$;

revoke all on function public.resolve_media_storage_addon_limit_bytes(uuid) from public;
revoke all on function public.resolve_media_storage_addon_limit_bytes(uuid) from anon;
revoke all on function public.resolve_media_storage_addon_limit_bytes(uuid) from authenticated;
grant execute on function public.resolve_media_storage_addon_limit_bytes(uuid) to service_role;
