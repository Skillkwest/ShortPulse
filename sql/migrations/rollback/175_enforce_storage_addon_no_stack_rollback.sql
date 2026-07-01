-- Roll back recurring storage add-on catalog updates and no-stack database constraints.

alter table public.billing_subscription_storage_addons
    drop constraint if exists billing_subscription_storage_addons_current_quantity_one_check;

drop index if exists public.billing_subscription_storage_addons_one_current_per_user_idx;

with plan_storage(plan_id, storage_limit_bytes) as (
    values
        ('free', 0::bigint),
        ('starter', 1::bigint * 1024 * 1024 * 1024),
        ('media', 25::bigint * 1024 * 1024 * 1024),
        ('studio', 100::bigint * 1024 * 1024 * 1024),
        ('business', 500::bigint * 1024 * 1024 * 1024)
)
update public.billing_plans plan
set storage_limit_bytes = plan_storage.storage_limit_bytes
from plan_storage
where plan.id = plan_storage.plan_id;

with plan_storage(plan_id, storage_limit_bytes) as (
    values
        ('free', 0::bigint),
        ('starter', 1::bigint * 1024 * 1024 * 1024),
        ('media', 25::bigint * 1024 * 1024 * 1024),
        ('studio', 100::bigint * 1024 * 1024 * 1024),
        ('business', 500::bigint * 1024 * 1024 * 1024)
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
    ('storage_25gb', 'Extra 25 GB', 25::bigint * 1024 * 1024 * 1024, 500, null, true, 10),
    ('storage_100gb', 'Extra 100 GB', 100::bigint * 1024 * 1024 * 1024, 1500, null, true, 20),
    ('storage_500gb', 'Extra 500 GB', 500::bigint * 1024 * 1024 * 1024, 4900, null, true, 30)
on conflict (id) do update
set display_name = excluded.display_name,
    storage_limit_bytes = excluded.storage_limit_bytes,
    monthly_price_cents = excluded.monthly_price_cents,
    stripe_price_id = excluded.stripe_price_id,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

update public.billing_storage_addons
set is_active = false
where id in ('storage_10gb', 'storage_50gb', 'storage_250gb');

delete from public.billing_storage_addon_offers
where id in (
    'storage_10gb__pending_stripe',
    'storage_50gb__pending_stripe',
    'storage_100gb__20260701_pending_stripe',
    'storage_250gb__pending_stripe',
    'storage_500gb__manual_review'
)
and stripe_price_id is null
and acquisition_enabled = false;

update public.billing_storage_addon_offers
set acquisition_enabled = true,
    is_active = true,
    effective_end_at = null,
    updated_at = now()
where id in ('storage_25gb__current', 'storage_100gb__current', 'storage_500gb__current');

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

    select coalesce(sum(addon.storage_limit_bytes * addon.quantity), 0)::bigint
    into v_limit
    from public.billing_subscription_storage_addons addon
    where addon.user_id = p_user_id
      and addon.ended_at is null
      and addon.status in ('active', 'trialing', 'past_due', 'unpaid');

    return greatest(coalesce(v_limit, 0), 0);
end;
$$;

revoke all on function public.resolve_media_storage_addon_limit_bytes(uuid) from public;
revoke all on function public.resolve_media_storage_addon_limit_bytes(uuid) from anon;
revoke all on function public.resolve_media_storage_addon_limit_bytes(uuid) from authenticated;
grant execute on function public.resolve_media_storage_addon_limit_bytes(uuid) to service_role;
