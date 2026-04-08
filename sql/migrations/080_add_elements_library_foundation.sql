-- Add Elements library foundational schema with isolated per-user persistence.

create table if not exists public.elements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid(),
    name text not null,
    alias text not null default '',
    status text not null default 'draft',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint elements_status_check
        check (status in ('draft', 'ready', 'archived'))
);

create unique index if not exists ux_elements_id_user
    on public.elements (id, user_id);
create index if not exists ix_elements_user_status_updated
    on public.elements (user_id, status, updated_at desc);

create table if not exists public.element_reference_sets (
    id uuid primary key default gen_random_uuid(),
    element_id uuid not null,
    user_id uuid not null default auth.uid(),
    set_key text not null,
    label text not null,
    description text not null default '',
    asset_type text not null default 'image',
    deck_reference_urls jsonb not null default '[]'::jsonb,
    image_reference_urls jsonb not null default '[]'::jsonb,
    video_reference_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint element_reference_sets_set_key_check
        check (set_key in ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10')),
    constraint element_reference_sets_asset_type_check
        check (asset_type in ('image', 'video')),
    constraint element_reference_sets_element_user_fkey
        foreign key (element_id, user_id) references public.elements (id, user_id) on delete cascade,
    constraint element_reference_sets_urls_shape_check
        check (
            jsonb_typeof(deck_reference_urls) = 'array'
            and jsonb_typeof(image_reference_urls) = 'array'
        )
);

create unique index if not exists ux_element_reference_sets_element_key
    on public.element_reference_sets (element_id, set_key);
create unique index if not exists ux_element_reference_sets_id_user
    on public.element_reference_sets (id, user_id);
create index if not exists ix_element_reference_sets_user_element_updated
    on public.element_reference_sets (user_id, element_id, updated_at desc);

create table if not exists public.element_media_assets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid(),
    element_id uuid not null,
    asset_kind text not null,
    storage_path text not null,
    filename text not null,
    file_type text not null,
    file_size bigint not null default 0,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint element_media_assets_asset_kind_check
        check (asset_kind in ('profile')),
    constraint element_media_assets_storage_scope_check
        check (storage_path like user_id::text || '/elements/' || element_id::text || '/%'),
    constraint element_media_assets_element_user_fkey
        foreign key (element_id, user_id) references public.elements (id, user_id) on delete cascade
);

create unique index if not exists ux_element_media_assets_user_storage_path
    on public.element_media_assets (user_id, storage_path);
create unique index if not exists ux_element_media_assets_id_user
    on public.element_media_assets (id, user_id);
create index if not exists ix_element_media_assets_user_element_kind_created
    on public.element_media_assets (user_id, element_id, asset_kind, created_at desc);

create or replace function public.set_elements_library_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_elements_updated_at on public.elements;
create trigger trg_elements_updated_at
before update on public.elements
for each row execute function public.set_elements_library_updated_at();

drop trigger if exists trg_element_reference_sets_updated_at on public.element_reference_sets;
create trigger trg_element_reference_sets_updated_at
before update on public.element_reference_sets
for each row execute function public.set_elements_library_updated_at();

drop trigger if exists trg_element_media_assets_updated_at on public.element_media_assets;
create trigger trg_element_media_assets_updated_at
before update on public.element_media_assets
for each row execute function public.set_elements_library_updated_at();

alter table public.elements enable row level security;
alter table public.element_reference_sets enable row level security;
alter table public.element_media_assets enable row level security;

drop policy if exists select_elements_isolation on public.elements;
create policy select_elements_isolation on public.elements
    for select using (user_id = auth.uid());

drop policy if exists modify_elements_isolation on public.elements;
create policy modify_elements_isolation on public.elements
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists select_element_reference_sets_isolation on public.element_reference_sets;
create policy select_element_reference_sets_isolation on public.element_reference_sets
    for select using (user_id = auth.uid());

drop policy if exists modify_element_reference_sets_isolation on public.element_reference_sets;
create policy modify_element_reference_sets_isolation on public.element_reference_sets
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists select_element_media_assets_isolation on public.element_media_assets;
create policy select_element_media_assets_isolation on public.element_media_assets
    for select using (user_id = auth.uid());

drop policy if exists modify_element_media_assets_isolation on public.element_media_assets;
create policy modify_element_media_assets_isolation on public.element_media_assets
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
