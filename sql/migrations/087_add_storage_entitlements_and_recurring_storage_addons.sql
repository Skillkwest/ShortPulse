-- Adds storage entitlements to billing plans/contracts, recurring storage add-ons,
-- and quota helpers/enforcement for canonical media rows.

alter table billing_plans
    add column if not exists storage_limit_bytes bigint not null default (1024::bigint * 1024 * 1024)
    check (storage_limit_bytes >= 0);

update billing_plans
set storage_limit_bytes = case id
    when 'free' then 1::bigint * 1024 * 1024 * 1024
    when 'media' then 25::bigint * 1024 * 1024 * 1024
    when 'studio' then 100::bigint * 1024 * 1024 * 1024
    when 'business' then 500::bigint * 1024 * 1024 * 1024
    else storage_limit_bytes
end;

alter table billing_plan_offers
    add column if not exists storage_limit_bytes bigint not null default 0
    check (storage_limit_bytes >= 0);

update billing_plan_offers offer
set storage_limit_bytes = plan.storage_limit_bytes
from billing_plans plan
where plan.id = offer.plan_id;

alter table billing_subscription_contracts
    add column if not exists storage_limit_bytes bigint not null default 0
    check (storage_limit_bytes >= 0);

update billing_subscription_contracts contract
set storage_limit_bytes = coalesce(
    (
        select offer.storage_limit_bytes
        from billing_plan_offers offer
        where offer.id = contract.offer_id
        limit 1
    ),
    plan.storage_limit_bytes,
    contract.storage_limit_bytes
)
from billing_plans plan
where plan.id = contract.plan_id;

create table if not exists billing_storage_addons (
    id text primary key,
    display_name text not null unique,
    storage_limit_bytes bigint not null check (storage_limit_bytes > 0),
    monthly_price_cents integer not null check (monthly_price_cents > 0),
    stripe_price_id text unique,
    is_active boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

insert into billing_storage_addons (
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

alter table billing_storage_addons enable row level security;
drop policy if exists select_billing_storage_addons_public on billing_storage_addons;
create policy select_billing_storage_addons_public on billing_storage_addons
    for select using (true);
drop policy if exists service_role_manage_billing_storage_addons on billing_storage_addons;
create policy service_role_manage_billing_storage_addons on billing_storage_addons
    for all to service_role
    using (true)
    with check (true);

create table if not exists billing_storage_addon_offers (
    id text primary key,
    storage_addon_id text not null references billing_storage_addons(id) on delete cascade,
    offer_name text not null,
    storage_limit_bytes bigint not null check (storage_limit_bytes > 0),
    recurring_price_cents integer not null check (recurring_price_cents >= 0),
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

create index if not exists ix_billing_storage_addon_offers_addon
    on billing_storage_addon_offers (storage_addon_id);
create unique index if not exists ux_billing_storage_addon_offers_current_acquisition
    on billing_storage_addon_offers (storage_addon_id)
    where acquisition_enabled = true and is_active = true and effective_end_at is null;

insert into billing_storage_addon_offers (
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
select
    addon.id || '__current',
    addon.id,
    addon.display_name || ' Current Offer',
    addon.storage_limit_bytes,
    addon.monthly_price_cents,
    addon.stripe_price_id,
    addon.is_active,
    addon.is_active,
    now()
from billing_storage_addons addon
on conflict (id) do update
set offer_name = excluded.offer_name,
    storage_limit_bytes = excluded.storage_limit_bytes,
    recurring_price_cents = excluded.recurring_price_cents,
    stripe_price_id = excluded.stripe_price_id,
    acquisition_enabled = excluded.acquisition_enabled,
    is_active = excluded.is_active;

alter table billing_storage_addon_offers enable row level security;
drop policy if exists select_billing_storage_addon_offers_public on billing_storage_addon_offers;
create policy select_billing_storage_addon_offers_public on billing_storage_addon_offers
    for select using (true);
drop policy if exists service_role_manage_billing_storage_addon_offers on billing_storage_addon_offers;
create policy service_role_manage_billing_storage_addon_offers on billing_storage_addon_offers
    for all to service_role
    using (true)
    with check (true);

create or replace function set_billing_storage_addon_offer_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_billing_storage_addon_offers_updated_at on billing_storage_addon_offers;
create trigger trg_billing_storage_addon_offers_updated_at
before update on billing_storage_addon_offers
for each row execute function set_billing_storage_addon_offer_updated_at();

create table if not exists billing_subscription_storage_addons (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    storage_addon_id text not null references billing_storage_addons(id),
    offer_id text references billing_storage_addon_offers(id),
    stripe_customer_id text,
    stripe_subscription_id text,
    stripe_subscription_item_id text,
    stripe_price_id text,
    storage_limit_bytes bigint not null check (storage_limit_bytes > 0),
    quantity integer not null default 1 check (quantity > 0),
    recurring_price_cents integer not null check (recurring_price_cents >= 0),
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

create index if not exists ix_billing_subscription_storage_addons_user
    on billing_subscription_storage_addons (user_id, created_at desc);
create index if not exists ix_billing_subscription_storage_addons_subscription
    on billing_subscription_storage_addons (stripe_subscription_id);
create index if not exists ix_billing_subscription_storage_addons_status
    on billing_subscription_storage_addons (status);
create unique index if not exists ux_billing_subscription_storage_addons_current_item
    on billing_subscription_storage_addons (stripe_subscription_item_id)
    where stripe_subscription_item_id is not null and ended_at is null;

alter table billing_subscription_storage_addons enable row level security;
drop policy if exists select_billing_subscription_storage_addons_isolation on billing_subscription_storage_addons;
create policy select_billing_subscription_storage_addons_isolation on billing_subscription_storage_addons
    for select using (user_id = auth.uid());
drop policy if exists service_role_manage_billing_subscription_storage_addons on billing_subscription_storage_addons;
create policy service_role_manage_billing_subscription_storage_addons on billing_subscription_storage_addons
    for all to service_role
    using (true)
    with check (true);

create or replace function set_billing_subscription_storage_addon_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_billing_subscription_storage_addons_updated_at on billing_subscription_storage_addons;
create trigger trg_billing_subscription_storage_addons_updated_at
before update on billing_subscription_storage_addons
for each row execute function set_billing_subscription_storage_addon_updated_at();

create or replace function resolve_media_storage_base_limit_bytes(p_user_id uuid)
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

    select contract.storage_limit_bytes
    into v_limit
    from billing_subscription_contracts contract
    where contract.user_id = p_user_id
      and contract.ended_at is null
    order by contract.created_at desc
    limit 1;

    if v_limit is not null then
        return greatest(v_limit, 0);
    end if;

    select plan.storage_limit_bytes
    into v_limit
    from billing_profiles profile
    join billing_plans plan on plan.id = profile.plan_id
    where profile.user_id = p_user_id
    limit 1;

    if v_limit is not null then
        return greatest(v_limit, 0);
    end if;

    select storage_limit_bytes
    into v_limit
    from billing_plans
    where id = 'free'
    limit 1;

    return greatest(coalesce(v_limit, 0), 0);
end;
$$;

create or replace function resolve_media_storage_addon_limit_bytes(p_user_id uuid)
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
    from billing_subscription_storage_addons addon
    where addon.user_id = p_user_id
      and addon.ended_at is null
      and addon.status in ('active', 'trialing', 'past_due', 'unpaid');

    return greatest(coalesce(v_limit, 0), 0);
end;
$$;

create or replace function get_media_storage_quota_summary()
returns table (
    used_bytes bigint,
    base_limit_bytes bigint,
    addon_limit_bytes bigint,
    total_limit_bytes bigint,
    remaining_bytes bigint,
    is_over_limit boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
    v_user_id uuid := auth.uid();
    v_used_bytes bigint := 0;
    v_base_limit_bytes bigint := 0;
    v_addon_limit_bytes bigint := 0;
    v_total_limit_bytes bigint := 0;
begin
    if v_user_id is null then
        return query
        select
            0::bigint,
            0::bigint,
            0::bigint,
            0::bigint,
            0::bigint,
            false;
        return;
    end if;

    select coalesce(sum(file_size), 0)::bigint
    into v_used_bytes
    from media_files
    where user_id = v_user_id;

    v_base_limit_bytes := resolve_media_storage_base_limit_bytes(v_user_id);
    v_addon_limit_bytes := resolve_media_storage_addon_limit_bytes(v_user_id);
    v_total_limit_bytes := greatest(v_base_limit_bytes + v_addon_limit_bytes, 0);

    return query
    select
        v_used_bytes,
        v_base_limit_bytes,
        v_addon_limit_bytes,
        v_total_limit_bytes,
        greatest(v_total_limit_bytes - v_used_bytes, 0),
        v_used_bytes > v_total_limit_bytes;
end;
$$;

grant execute on function resolve_media_storage_base_limit_bytes(uuid) to authenticated, service_role;
grant execute on function resolve_media_storage_addon_limit_bytes(uuid) to authenticated, service_role;
grant execute on function get_media_storage_quota_summary() to authenticated, service_role;

create or replace function enforce_media_storage_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_used_bytes bigint := 0;
    v_total_limit_bytes bigint := 0;
    v_incoming_bytes bigint := greatest(coalesce(new.file_size, 0), 0);
begin
    if new.user_id is null then
        return new;
    end if;

    v_total_limit_bytes :=
        resolve_media_storage_base_limit_bytes(new.user_id) +
        resolve_media_storage_addon_limit_bytes(new.user_id);

    select coalesce(sum(file_size), 0)::bigint
    into v_used_bytes
    from media_files
    where user_id = new.user_id
      and (tg_op <> 'UPDATE' or id <> new.id);

    if v_used_bytes + v_incoming_bytes > v_total_limit_bytes then
        raise exception 'Media storage limit exceeded'
            using
                errcode = 'P0001',
                detail = format(
                    'used_bytes=%s incoming_bytes=%s limit_bytes=%s',
                    v_used_bytes,
                    v_incoming_bytes,
                    v_total_limit_bytes
                ),
                hint = 'Upgrade your plan, add recurring storage, or delete media before uploading more files.';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_media_files_enforce_storage_quota on media_files;
create trigger trg_media_files_enforce_storage_quota
before insert or update of user_id, file_size
on media_files
for each row
execute function enforce_media_storage_quota();
