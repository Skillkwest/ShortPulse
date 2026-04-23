-- Billing + credit foundations for ShortPulse.
-- Adds plan metadata, Stripe package catalogs, per-user billing profiles,
-- and an append-only credit ledger with balance enforcement.

-- Plan catalog
create table if not exists billing_plans (
    id text primary key,
    display_name text not null unique,
    monthly_price_cents integer not null check (monthly_price_cents >= 0),
    monthly_credits_cents integer not null check (monthly_credits_cents >= 0),
    storage_limit_bytes bigint not null check (storage_limit_bytes >= 0),
    stripe_price_id text unique,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

insert into billing_plans (
    id,
    display_name,
    monthly_price_cents,
    monthly_credits_cents,
    storage_limit_bytes,
    stripe_price_id,
    is_active
)
values
    ('free', 'Free', 0, 100, 1::bigint * 1024 * 1024 * 1024, null, true),
    ('media', 'Media', 1200, 600, 25::bigint * 1024 * 1024 * 1024, null, true),
    ('studio', 'Studio', 3900, 3000, 100::bigint * 1024 * 1024 * 1024, null, true),
    ('business', 'Business', 12900, 12000, 500::bigint * 1024 * 1024 * 1024, null, true)
on conflict (id) do update
set display_name = excluded.display_name,
    monthly_price_cents = excluded.monthly_price_cents,
    monthly_credits_cents = excluded.monthly_credits_cents,
    storage_limit_bytes = excluded.storage_limit_bytes,
    is_active = excluded.is_active;

alter table billing_plans enable row level security;
drop policy if exists select_billing_plans_public on billing_plans;
create policy select_billing_plans_public on billing_plans
    for select using (true);

-- Versioned recurring offers (public acquisition catalog separate from subscriber contracts)
create table if not exists billing_plan_offers (
    id text primary key,
    plan_id text not null references billing_plans(id) on delete cascade,
    offer_name text not null,
    recurring_price_cents integer not null check (recurring_price_cents >= 0),
    monthly_credits_cents integer not null check (monthly_credits_cents >= 0),
    storage_limit_bytes bigint not null check (storage_limit_bytes >= 0),
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

insert into billing_plan_offers (
    id,
    plan_id,
    offer_name,
    recurring_price_cents,
    monthly_credits_cents,
    storage_limit_bytes,
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
    p.storage_limit_bytes,
    p.stripe_price_id,
    p.is_active,
    p.is_active,
    now()
from billing_plans p
on conflict (id) do update
set offer_name = excluded.offer_name,
    recurring_price_cents = excluded.recurring_price_cents,
    monthly_credits_cents = excluded.monthly_credits_cents,
    storage_limit_bytes = excluded.storage_limit_bytes,
    stripe_price_id = excluded.stripe_price_id,
    acquisition_enabled = excluded.acquisition_enabled,
    is_active = excluded.is_active;

insert into billing_plan_offers (
    id,
    plan_id,
    offer_name,
    recurring_price_cents,
    monthly_credits_cents,
    storage_limit_bytes,
    stripe_price_id,
    acquisition_enabled,
    is_active,
    effective_start_at
)
values
    ('media__internal_comp', 'media', 'Media Internal Comp', 0, 600, 25::bigint * 1024 * 1024 * 1024, null, false, true, now()),
    ('studio__internal_comp', 'studio', 'Studio Internal Comp', 0, 3000, 100::bigint * 1024 * 1024 * 1024, null, false, true, now()),
    ('business__internal_comp', 'business', 'Business Internal Comp', 0, 12000, 500::bigint * 1024 * 1024 * 1024, null, false, true, now())
on conflict (id) do update
set offer_name = excluded.offer_name,
    recurring_price_cents = excluded.recurring_price_cents,
    monthly_credits_cents = excluded.monthly_credits_cents,
    storage_limit_bytes = excluded.storage_limit_bytes,
    stripe_price_id = excluded.stripe_price_id,
    acquisition_enabled = excluded.acquisition_enabled,
    is_active = excluded.is_active;

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

-- Credit package catalog (one-time top-ups via Stripe Checkout)
create table if not exists billing_credit_packages (
    id text primary key,
    display_name text not null unique,
    credit_amount_cents integer not null check (credit_amount_cents > 0),
    price_cents integer not null check (price_cents > 0),
    stripe_price_id text unique,
    is_active boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

insert into billing_credit_packages (id, display_name, credit_amount_cents, price_cents, stripe_price_id, is_active, sort_order)
values
    ('starter_500', 'Starter 500', 500, 700, null, true, 10),
    ('growth_2000', 'Growth 2,000', 2000, 2600, null, true, 20),
    ('scale_6000', 'Scale 6,000', 6000, 7800, null, true, 30),
    ('studio_10000', 'Studio 10,000', 10000, 10000, null, true, 40)
on conflict (id) do update
set display_name = excluded.display_name,
    credit_amount_cents = excluded.credit_amount_cents,
    price_cents = excluded.price_cents,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

alter table billing_credit_packages enable row level security;
drop policy if exists select_credit_packages_public on billing_credit_packages;
create policy select_credit_packages_public on billing_credit_packages
    for select using (true);

-- Per-user billing profile
create table if not exists billing_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    plan_id text not null references billing_plans(id) default 'free',
    stripe_customer_id text unique,
    stripe_subscription_id text unique,
    subscription_status text not null default 'inactive',
    current_period_end timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_billing_profiles_plan on billing_profiles (plan_id);
create index if not exists ix_billing_profiles_subscription_status on billing_profiles (subscription_status);

alter table billing_profiles enable row level security;
drop policy if exists select_billing_profiles_isolation on billing_profiles;
create policy select_billing_profiles_isolation on billing_profiles
    for select using (user_id = auth.uid());
drop policy if exists modify_billing_profiles_isolation on billing_profiles;
drop policy if exists insert_billing_profiles_isolation on billing_profiles;
drop policy if exists service_role_manage_billing_profiles on billing_profiles;
create policy service_role_manage_billing_profiles on billing_profiles
    for all to service_role
    using (true)
    with check (true);

create or replace function set_billing_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_billing_profiles_updated_at on billing_profiles;
create trigger trg_billing_profiles_updated_at
before update on billing_profiles
for each row execute function set_billing_profile_updated_at();

-- Historical/current subscriber contracts
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
    storage_limit_bytes bigint not null check (storage_limit_bytes >= 0),
    currency text not null default 'usd' check (currency = lower(currency)),
    billing_interval text not null default 'month' check (billing_interval in ('month')),
    status text not null default 'inactive',
    contract_source text not null default 'stripe' check (contract_source in ('stripe', 'internal_comp')),
    current_period_start timestamptz,
    current_period_end timestamptz,
    cancel_at_period_end boolean not null default false,
    granted_by_user_id uuid references auth.users(id) on delete set null,
    grant_reason text,
    updated_by_user_id uuid references auth.users(id) on delete set null,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_billing_subscription_contracts_user on billing_subscription_contracts (user_id, created_at desc);
create index if not exists ix_billing_subscription_contracts_plan on billing_subscription_contracts (plan_id);
create index if not exists ix_billing_subscription_contracts_status on billing_subscription_contracts (status);
create index if not exists ix_billing_subscription_contracts_contract_source on billing_subscription_contracts (contract_source, status);
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
    storage_limit_bytes,
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
    p.storage_limit_bytes,
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

-- Recurring storage add-on catalog
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

-- Event log for Stripe webhooks (idempotency)
create table if not exists stripe_event_log (
    id text primary key,
    event_type text not null,
    received_at timestamptz not null default now(),
    payload jsonb not null default '{}'::jsonb
);

alter table stripe_event_log enable row level security;
drop policy if exists service_role_manage_stripe_event_log on stripe_event_log;
create policy service_role_manage_stripe_event_log on stripe_event_log
    for all to service_role
    using (true)
    with check (true);

-- Credit balance table (kept in sync from ledger trigger).
-- Some legacy deployments already have ai_credit_balance as a view.
do $$
declare
    balance_relkind "char";
begin
    select c.relkind
      into balance_relkind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'ai_credit_balance';

    if balance_relkind is null then
        execute '
            create table ai_credit_balance (
                user_id uuid primary key references auth.users(id) on delete cascade,
                balance_cents bigint not null default 0,
                updated_at timestamptz not null default now()
            )';
        balance_relkind := 'r';
    end if;

    if balance_relkind in ('r', 'p') then
        execute 'alter table ai_credit_balance enable row level security';
        execute 'drop policy if exists select_ai_credit_balance_isolation on ai_credit_balance';
        execute 'create policy select_ai_credit_balance_isolation on ai_credit_balance
                 for select using (user_id = auth.uid())';
    else
        raise notice 'Skipping ai_credit_balance RLS policy setup because relation is a view/materialized view.';
    end if;
end
$$;

-- Append-only credit ledger
create table if not exists ai_credit_ledger (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    change_cents integer not null,
    reason text not null,
    source text not null default 'system',
    source_ref text,
    metadata jsonb not null default '{}'::jsonb,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now()
);

create index if not exists ix_ai_credit_ledger_user_created on ai_credit_ledger (user_id, created_at desc);
create unique index if not exists ux_ai_credit_ledger_source_ref
    on ai_credit_ledger (user_id, source, source_ref)
    where source_ref is not null;

alter table ai_credit_ledger enable row level security;
drop policy if exists select_ai_credit_ledger_isolation on ai_credit_ledger;
create policy select_ai_credit_ledger_isolation on ai_credit_ledger
    for select using (user_id = auth.uid());
drop policy if exists insert_ai_credit_ledger_user_debits on ai_credit_ledger;
create policy insert_ai_credit_ledger_user_debits on ai_credit_ledger
    for insert with check (
        user_id = auth.uid()
        and change_cents < 0
        and coalesce(created_by, auth.uid()) = auth.uid()
    );

create or replace function enforce_credit_ledger_insert()
returns trigger
language plpgsql
as $$
declare
    current_balance bigint;
begin
    if new.change_cents = 0 then
        raise exception 'Credit change cannot be zero';
    end if;

    -- Users can never self-credit; service/backend inserts are still allowed.
    if new.change_cents > 0 and auth.uid() is not null and auth.role() <> 'service_role' then
        raise exception 'Positive credit adjustments require privileged context';
    end if;

    select coalesce(balance_cents, 0)
      into current_balance
      from ai_credit_balance
     where user_id = new.user_id;

    current_balance := coalesce(current_balance, 0);
    if current_balance + new.change_cents < 0 then
        raise exception 'Insufficient credits';
    end if;

    if new.created_by is null and auth.uid() is not null then
        new.created_by := auth.uid();
    end if;

    return new;
end;
$$;

drop trigger if exists trg_enforce_credit_ledger_insert on ai_credit_ledger;
create trigger trg_enforce_credit_ledger_insert
before insert on ai_credit_ledger
for each row execute function enforce_credit_ledger_insert();

do $$
declare
    balance_relkind "char";
begin
    select c.relkind
      into balance_relkind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'ai_credit_balance';

    if balance_relkind in ('r', 'p') then
        execute '
            create or replace function apply_credit_balance_delta()
            returns trigger
            language plpgsql
            as $fn$
            begin
                insert into ai_credit_balance (user_id, balance_cents, updated_at)
                values (new.user_id, new.change_cents, now())
                on conflict (user_id) do update
                  set balance_cents = ai_credit_balance.balance_cents + excluded.balance_cents,
                      updated_at = now();
                return new;
            end;
            $fn$';

        execute 'drop trigger if exists trg_apply_credit_balance_delta on ai_credit_ledger';
        execute 'create trigger trg_apply_credit_balance_delta
                 after insert on ai_credit_ledger
                 for each row execute function apply_credit_balance_delta()';
    else
        execute 'drop trigger if exists trg_apply_credit_balance_delta on ai_credit_ledger';
        raise notice 'Skipping apply_credit_balance_delta trigger because ai_credit_balance is not a table.';
    end if;
end
$$;

-- New user bootstrap: billing profile + starter credit allocation
create or replace function handle_new_user_billing_setup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    desired_plan text;
    starter_credits integer;
    has_profiles_table boolean;
    has_plans_table boolean;
    has_balance_table boolean;
    has_ledger_table boolean;
    has_source_ref_index boolean;
    has_app_error_logs_table boolean;
    existing_error_id uuid;
    error_fingerprint text;
    exception_message text;
    exception_state text;
    exception_detail text;
    exception_hint text;
begin
    -- Never trust client-provided metadata for plan assignment at signup.
    desired_plan := 'free';

    select exists (
        select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = 'billing_profiles'
           and c.relkind in ('r', 'p')
    ) into has_profiles_table;

    select exists (
        select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = 'billing_plans'
           and c.relkind in ('r', 'p')
    ) into has_plans_table;

    select exists (
        select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = 'ai_credit_balance'
           and c.relkind in ('r', 'p')
    ) into has_balance_table;

    select exists (
        select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = 'ai_credit_ledger'
           and c.relkind in ('r', 'p')
    ) into has_ledger_table;

    if not has_profiles_table or not has_plans_table then
        raise notice 'Skipping billing bootstrap because billing tables are missing.';
        return new;
    end if;

    -- Self-heal baseline plan metadata if `free` was accidentally removed.
    insert into billing_plans (id, display_name, monthly_price_cents, monthly_credits_cents, stripe_price_id, is_active)
    values (desired_plan, 'Free', 0, 100, null, true)
    on conflict (id) do update
      set display_name = excluded.display_name,
          monthly_price_cents = excluded.monthly_price_cents,
          monthly_credits_cents = excluded.monthly_credits_cents,
          is_active = true;

    insert into billing_profiles (user_id, plan_id, subscription_status)
    values (new.id, desired_plan, 'active')
    on conflict (user_id) do update
      set plan_id = excluded.plan_id,
          subscription_status = coalesce(billing_profiles.subscription_status, excluded.subscription_status);

    if has_balance_table then
        insert into ai_credit_balance (user_id, balance_cents)
        values (new.id, 0)
        on conflict (user_id) do nothing;
    end if;

    if not has_ledger_table then
        raise notice 'Skipping starter credit seed because ai_credit_ledger table is missing.';
        return new;
    end if;

    select monthly_credits_cents into starter_credits
      from billing_plans
     where id = desired_plan;

    if coalesce(starter_credits, 0) > 0 then
        select exists (
            select 1
              from pg_indexes
             where schemaname = 'public'
               and tablename = 'ai_credit_ledger'
               and indexname = 'ux_ai_credit_ledger_source_ref'
        ) into has_source_ref_index;

        if has_source_ref_index then
            insert into ai_credit_ledger (user_id, change_cents, reason, source, source_ref, metadata)
            values (
                new.id,
                starter_credits,
                'Initial plan allocation',
                'signup_seed',
                new.id::text,
                jsonb_build_object('plan_id', desired_plan)
            )
            on conflict (user_id, source, source_ref) do nothing;
        else
            insert into ai_credit_ledger (user_id, change_cents, reason, source, source_ref, metadata)
            select
                new.id,
                starter_credits,
                'Initial plan allocation',
                'signup_seed',
                new.id::text,
                jsonb_build_object('plan_id', desired_plan)
            where not exists (
                select 1
                from ai_credit_ledger l
                where l.user_id = new.id
                  and l.source = 'signup_seed'
                  and l.source_ref = new.id::text
            );
        end if;
    end if;

    return new;
exception
    when others then
        get stacked diagnostics
            exception_message = message_text,
            exception_state = returned_sqlstate,
            exception_detail = pg_exception_detail,
            exception_hint = pg_exception_hint;

        begin
            select exists (
                select 1
                  from pg_class c
                  join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public'
                   and c.relname = 'app_error_logs'
                   and c.relkind in ('r', 'p')
            ) into has_app_error_logs_table;

            if has_app_error_logs_table then
                error_fingerprint := md5(
                    coalesce(exception_state, '') || '|handle_new_user_billing_setup|' || coalesce(exception_message, '')
                );

                select id
                  into existing_error_id
                  from app_error_logs
                 where fingerprint = error_fingerprint
                   and source = 'db.trigger.handle_new_user_billing_setup'
                   and status = 'open'
                   and user_id is not distinct from new.id
                 order by last_seen_at desc
                 limit 1;

                if existing_error_id is not null then
                    update app_error_logs
                       set last_seen_at = now(),
                           occurrences_count = greatest(coalesce(occurrences_count, 1), 1) + 1,
                           severity = 'high',
                           message = left(coalesce(exception_message, 'Unknown trigger failure'), 600),
                           route = '/auth',
                           endpoint = 'auth.users',
                           http_status = 500,
                           user_email = coalesce(new.email, user_email),
                           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
                               'trigger_function', 'handle_new_user_billing_setup',
                               'trigger_table', 'auth.users',
                               'sqlstate', exception_state,
                               'detail', exception_detail,
                               'hint', exception_hint
                           )
                     where id = existing_error_id;
                else
                    insert into app_error_logs (
                        fingerprint,
                        source,
                        scope,
                        severity,
                        status,
                        message,
                        route,
                        endpoint,
                        http_status,
                        user_id,
                        user_email,
                        metadata,
                        first_seen_at,
                        last_seen_at
                    )
                    values (
                        error_fingerprint,
                        'db.trigger.handle_new_user_billing_setup',
                        'app',
                        'high',
                        'open',
                        left(coalesce(exception_message, 'Unknown trigger failure'), 600),
                        '/auth',
                        'auth.users',
                        500,
                        new.id,
                        new.email,
                        jsonb_build_object(
                            'trigger_function', 'handle_new_user_billing_setup',
                            'trigger_table', 'auth.users',
                            'sqlstate', exception_state,
                            'detail', exception_detail,
                            'hint', exception_hint
                        ),
                        now(),
                        now()
                    );
                end if;
            end if;
        exception
            when others then
                raise warning 'app_error_logs write failed in handle_new_user_billing_setup for user %: %', new.id, sqlerrm;
        end;

        raise warning 'handle_new_user_billing_setup failed for user %: %', new.id, coalesce(exception_message, sqlerrm);
        return new;
end;
$$;

revoke all on function public.handle_new_user_billing_setup() from public;

drop trigger if exists on_auth_user_created_billing_setup on auth.users;
create trigger on_auth_user_created_billing_setup
after insert on auth.users
for each row execute function handle_new_user_billing_setup();

-- Backfill existing users if this script is applied after users already exist.
insert into billing_profiles (user_id, plan_id, subscription_status)
select
    u.id,
    'free'::text as plan_id,
    'active'::text as subscription_status
from auth.users u
left join billing_profiles bp on bp.user_id = u.id
where bp.user_id is null;

do $$
begin
    if exists (
        select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = 'ai_credit_balance'
           and c.relkind in ('r', 'p')
    ) then
        insert into ai_credit_balance (user_id, balance_cents)
        select u.id, 0
        from auth.users u
        left join ai_credit_balance cb on cb.user_id = u.id
        where cb.user_id is null;
    else
        raise notice 'Skipping ai_credit_balance backfill because relation is not a table.';
    end if;
end
$$;

insert into ai_credit_ledger (user_id, change_cents, reason, source, source_ref, metadata)
select
    bp.user_id,
    p.monthly_credits_cents,
    'Initial plan allocation',
    'signup_seed',
    bp.user_id::text,
    jsonb_build_object('plan_id', bp.plan_id, 'backfilled', true)
from billing_profiles bp
join billing_plans p on p.id = bp.plan_id
left join ai_credit_ledger l
  on l.user_id = bp.user_id
 and l.source = 'signup_seed'
 and l.source_ref = bp.user_id::text
where l.id is null
  and p.monthly_credits_cents > 0;
