-- Add service-role-only Supabase usage snapshots for Admin Storage economics.
-- These rows are operator/provider usage evidence, not customer entitlement authority.

create table if not exists public.admin_storage_usage_snapshots (
    id uuid primary key default gen_random_uuid(),
    snapshot_month date not null,
    captured_at timestamptz not null default now(),
    source text not null default 'manual'
        check (source in ('manual', 'supabase_usage_page', 'supabase_export', 'api_import')),
    supabase_plan text,
    compute_plan text not null default 'medium',
    compute_monthly_cost_cents integer not null default 6000
        check (compute_monthly_cost_cents >= 0),
    storage_used_gb numeric(14, 3) not null default 0
        check (storage_used_gb >= 0),
    storage_included_gb numeric(14, 3) not null default 100
        check (storage_included_gb >= 0),
    uncached_egress_gb numeric(14, 3) not null default 0
        check (uncached_egress_gb >= 0),
    cached_egress_gb numeric(14, 3) not null default 0
        check (cached_egress_gb >= 0),
    uncached_egress_included_gb numeric(14, 3) not null default 250
        check (uncached_egress_included_gb >= 0),
    cached_egress_included_gb numeric(14, 3) not null default 250
        check (cached_egress_included_gb >= 0),
    observed_storage_overage_cost_cents integer
        check (observed_storage_overage_cost_cents is null or observed_storage_overage_cost_cents >= 0),
    observed_uncached_egress_overage_cost_cents integer
        check (observed_uncached_egress_overage_cost_cents is null or observed_uncached_egress_overage_cost_cents >= 0),
    observed_cached_egress_overage_cost_cents integer
        check (observed_cached_egress_overage_cost_cents is null or observed_cached_egress_overage_cost_cents >= 0),
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint admin_storage_usage_snapshots_month_start_check
        check (snapshot_month = date_trunc('month', snapshot_month)::date)
);

create index if not exists ix_admin_storage_usage_snapshots_latest
    on public.admin_storage_usage_snapshots (snapshot_month desc, captured_at desc);

alter table public.admin_storage_usage_snapshots enable row level security;

drop policy if exists service_role_manage_admin_storage_usage_snapshots
    on public.admin_storage_usage_snapshots;
create policy service_role_manage_admin_storage_usage_snapshots
    on public.admin_storage_usage_snapshots
    for all to service_role
    using (true)
    with check (true);

revoke all on table public.admin_storage_usage_snapshots from public;
revoke all on table public.admin_storage_usage_snapshots from anon;
revoke all on table public.admin_storage_usage_snapshots from authenticated;
grant select, insert, update, delete on table public.admin_storage_usage_snapshots to service_role;

create or replace function public.set_admin_storage_usage_snapshots_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_admin_storage_usage_snapshots_updated_at
    on public.admin_storage_usage_snapshots;
create trigger trg_admin_storage_usage_snapshots_updated_at
before update on public.admin_storage_usage_snapshots
for each row execute function public.set_admin_storage_usage_snapshots_updated_at();

revoke all on function public.set_admin_storage_usage_snapshots_updated_at() from public;
revoke all on function public.set_admin_storage_usage_snapshots_updated_at() from anon;
revoke all on function public.set_admin_storage_usage_snapshots_updated_at() from authenticated;
grant execute on function public.set_admin_storage_usage_snapshots_updated_at() to service_role;
