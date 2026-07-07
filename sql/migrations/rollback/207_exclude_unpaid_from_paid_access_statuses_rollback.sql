-- Restore the pre-207 status policy where Stripe `unpaid` subscriptions count
-- as current paid-access and storage entitlement rows.

create or replace function public.user_has_paid_media_library_access(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.billing_subscription_contracts c
    where c.user_id = target_user_id
      and c.ended_at is null
      and lower(coalesce(c.plan_id, 'free')) <> 'free'
      and lower(coalesce(c.status, 'active')) in ('active', 'trialing', 'past_due', 'unpaid')
  );
$$;

revoke all on function public.user_has_paid_media_library_access(uuid) from public;
grant execute on function public.user_has_paid_media_library_access(uuid) to authenticated;
grant execute on function public.user_has_paid_media_library_access(uuid) to service_role;

drop index if exists public.billing_subscription_storage_addons_one_current_per_user_idx;
create unique index if not exists billing_subscription_storage_addons_one_current_per_user_idx
    on public.billing_subscription_storage_addons (user_id)
    where ended_at is null
      and lower(status) in ('active', 'trialing', 'past_due', 'unpaid');

alter table public.billing_subscription_storage_addons
    drop constraint if exists billing_subscription_storage_addons_current_quantity_one_check;
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
grant execute on function public.resolve_media_storage_addon_limit_bytes(uuid) to service_role;
