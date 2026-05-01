-- Add admin-managed public dashboard offers.
-- Offers are read by server-side dashboard loaders and written only through admin APIs.

create table if not exists public.dashboard_offers (
    id uuid primary key default gen_random_uuid(),
    eyebrow text not null default 'Offer',
    title text not null,
    description text not null default '',
    offer_kind text not null default 'custom',
    discount_label text not null default '',
    target_label text not null default '',
    cta_label text not null default 'View offer',
    cta_href text not null default '/pricing',
    display_order integer not null default 0,
    is_active boolean not null default true,
    starts_at timestamptz,
    ends_at timestamptz,
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint dashboard_offers_kind_check check (
        offer_kind in ('model_pricing', 'plan', 'credit_package', 'storage_addon', 'custom')
    ),
    constraint dashboard_offers_eyebrow_format_check check (
        eyebrow = btrim(eyebrow)
        and char_length(eyebrow) between 1 and 32
    ),
    constraint dashboard_offers_title_format_check check (
        title = btrim(title)
        and char_length(title) between 1 and 72
    ),
    constraint dashboard_offers_description_format_check check (
        description = btrim(description)
        and char_length(description) <= 240
    ),
    constraint dashboard_offers_discount_label_format_check check (
        discount_label = btrim(discount_label)
        and char_length(discount_label) <= 64
    ),
    constraint dashboard_offers_target_label_format_check check (
        target_label = btrim(target_label)
        and char_length(target_label) <= 80
    ),
    constraint dashboard_offers_cta_label_format_check check (
        cta_label = btrim(cta_label)
        and char_length(cta_label) between 1 and 40
    ),
    constraint dashboard_offers_cta_href_format_check check (
        cta_href = btrim(cta_href)
        and char_length(cta_href) between 1 and 200
        and left(cta_href, 1) = '/'
        and left(cta_href, 2) <> '//'
    ),
    constraint dashboard_offers_window_order_check check (
        starts_at is null
        or ends_at is null
        or starts_at < ends_at
    )
);

create index if not exists ix_dashboard_offers_public_active
    on public.dashboard_offers (is_active, display_order asc, updated_at desc)
    where is_active = true;

create index if not exists ix_dashboard_offers_admin_order
    on public.dashboard_offers (display_order asc, updated_at desc);

create or replace function public.set_dashboard_offers_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists trg_dashboard_offers_updated_at on public.dashboard_offers;
create trigger trg_dashboard_offers_updated_at
before update on public.dashboard_offers
for each row execute function public.set_dashboard_offers_updated_at();

alter table public.dashboard_offers enable row level security;

drop policy if exists no_direct_dashboard_offers_access on public.dashboard_offers;
create policy no_direct_dashboard_offers_access
    on public.dashboard_offers
    for all
    using (false)
    with check (false);
