-- Add admin-managed tutorial cards for the signed-in dashboard.
-- Tutorials are globally ordered, read by authenticated users, and written only through admin APIs.

create table if not exists public.dashboard_tutorials (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    youtube_url text not null,
    thumbnail_url text not null,
    thumbnail_media_type text not null default 'image',
    thumbnail_alt text not null default '',
    display_order integer not null default 0,
    is_active boolean not null default true,
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint dashboard_tutorials_title_format_check check (
        title = btrim(title)
        and char_length(title) between 1 and 120
    ),
    constraint dashboard_tutorials_youtube_url_format_check check (
        youtube_url = btrim(youtube_url)
        and char_length(youtube_url) between 1 and 500
        and youtube_url ~ '^https://'
    ),
    constraint dashboard_tutorials_thumbnail_url_format_check check (
        thumbnail_url = btrim(thumbnail_url)
        and char_length(thumbnail_url) between 1 and 1000
        and thumbnail_url ~ '^https://'
    ),
    constraint dashboard_tutorials_thumbnail_media_type_check check (
        thumbnail_media_type in ('image', 'video')
    ),
    constraint dashboard_tutorials_thumbnail_alt_format_check check (
        thumbnail_alt = btrim(thumbnail_alt)
        and char_length(thumbnail_alt) <= 160
    ),
    constraint dashboard_tutorials_display_order_check check (
        display_order >= 0
    )
);

create index if not exists ix_dashboard_tutorials_active_order
    on public.dashboard_tutorials (is_active, display_order asc, updated_at desc)
    where is_active = true;

create index if not exists ix_dashboard_tutorials_admin_order
    on public.dashboard_tutorials (display_order asc, updated_at desc);

create or replace function public.set_dashboard_tutorials_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists trg_dashboard_tutorials_updated_at on public.dashboard_tutorials;
create trigger trg_dashboard_tutorials_updated_at
before update on public.dashboard_tutorials
for each row execute function public.set_dashboard_tutorials_updated_at();

alter table public.dashboard_tutorials enable row level security;

drop policy if exists select_active_dashboard_tutorials on public.dashboard_tutorials;
create policy select_active_dashboard_tutorials
    on public.dashboard_tutorials
    for select
    using (auth.uid() is not null and is_active = true);

revoke all on public.dashboard_tutorials from public;
revoke all on public.dashboard_tutorials from anon;
revoke all on public.dashboard_tutorials from authenticated;
grant select, insert, update, delete on public.dashboard_tutorials to service_role;
