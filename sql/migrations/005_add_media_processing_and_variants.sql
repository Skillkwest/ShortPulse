-- Add media processing columns and derivative variant table for optimized listing/render paths.
-- This migration is idempotent and safe to re-run.

alter table media_files
    add column if not exists processing_status text not null default 'ready';
alter table media_files
    add column if not exists width integer;
alter table media_files
    add column if not exists height integer;
alter table media_files
    add column if not exists duration_seconds numeric;
alter table media_files
    add column if not exists poster_variant_path text;
alter table media_files
    add column if not exists thumb_variant_path text;
alter table media_files
    add column if not exists preview_variant_path text;

alter table media_files
    drop constraint if exists media_files_processing_status_check;
alter table media_files
    add constraint media_files_processing_status_check
    check (processing_status in ('pending', 'processing', 'ready', 'failed'));

alter table media_files
    drop constraint if exists media_files_variant_hint_scope_check;
alter table media_files
    add constraint media_files_variant_hint_scope_check
    check (
        (thumb_variant_path is null or thumb_variant_path like user_id::text || '/%')
        and (poster_variant_path is null or poster_variant_path like user_id::text || '/%')
        and (preview_variant_path is null or preview_variant_path like user_id::text || '/%')
    );

create index if not exists ix_media_files_user_processing_created
    on media_files (user_id, processing_status, created_at desc);
create index if not exists ix_media_files_user_source_processing_created
    on media_files (user_id, source, processing_status, created_at desc);
create unique index if not exists ux_media_files_id_user
    on media_files (id, user_id);

create table if not exists media_asset_variants (
    id uuid primary key default gen_random_uuid(),
    media_file_id uuid not null references media_files(id) on delete cascade,
    user_id uuid not null default auth.uid(),
    variant_kind text not null,
    storage_path text not null,
    mime_type text not null,
    width integer,
    height integer,
    duration_seconds numeric,
    byte_size bigint,
    status text not null default 'ready',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint media_asset_variants_status_check
      check (status in ('pending', 'ready', 'failed'))
);

alter table media_asset_variants
    drop constraint if exists media_asset_variants_variant_kind_check;
alter table media_asset_variants
    add constraint media_asset_variants_variant_kind_check
    check (
        variant_kind in (
            'original',
            'thumb_240',
            'thumb_480',
            'poster_720',
            'preview_loop_360p',
            'playback_720p'
        )
    );

alter table media_asset_variants
    drop constraint if exists media_asset_variants_storage_scope_check;
alter table media_asset_variants
    add constraint media_asset_variants_storage_scope_check
    check (storage_path like user_id::text || '/%');

alter table media_asset_variants
    drop constraint if exists media_asset_variants_media_file_user_fkey;
alter table media_asset_variants
    add constraint media_asset_variants_media_file_user_fkey
    foreign key (media_file_id, user_id) references media_files (id, user_id) on delete cascade;

create unique index if not exists ux_media_asset_variants_file_kind
    on media_asset_variants (media_file_id, variant_kind);
create index if not exists ix_media_asset_variants_user_kind_status_created
    on media_asset_variants (user_id, variant_kind, status, created_at desc);
create index if not exists ix_media_asset_variants_file_status_updated
    on media_asset_variants (media_file_id, status, updated_at desc);
create index if not exists ix_media_asset_variants_storage_path
    on media_asset_variants (storage_path);

create or replace function set_media_asset_variants_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_media_asset_variants_updated_at on media_asset_variants;
create trigger trg_media_asset_variants_updated_at
before update on media_asset_variants
for each row execute function set_media_asset_variants_updated_at();

alter table media_asset_variants enable row level security;

drop policy if exists select_media_asset_variants_isolation on media_asset_variants;
create policy select_media_asset_variants_isolation on media_asset_variants
    for select using (user_id = auth.uid());

drop policy if exists insert_media_asset_variants_isolation on media_asset_variants;
create policy insert_media_asset_variants_isolation on media_asset_variants
    for insert with check (user_id = auth.uid());

drop policy if exists update_media_asset_variants_isolation on media_asset_variants;
create policy update_media_asset_variants_isolation on media_asset_variants
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists delete_media_asset_variants_isolation on media_asset_variants;
create policy delete_media_asset_variants_isolation on media_asset_variants
    for delete using (user_id = auth.uid());
