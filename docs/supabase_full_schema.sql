-- Frontend-only Supabase schema for ShortPulse
-- Creates the tables used by the client (saved_creators, media_files) and secures the media bucket.

-- Saved creators
create table if not exists saved_creators (
    id uuid primary key default gen_random_uuid(),
    handle text not null,
    platform text not null, -- instagram | tiktok | youtube
    followers integer default 0,
    avg_views integer default 0,
    user_id uuid not null default auth.uid(),
    created_at timestamptz not null default now()
);

create index if not exists ix_saved_creators_handle on saved_creators (handle);
create index if not exists ix_saved_creators_user_platform on saved_creators (user_id, platform);

alter table saved_creators enable row level security;
drop policy if exists select_saved_creators_isolation on saved_creators;
create policy select_saved_creators_isolation on saved_creators
    for select using (user_id = auth.uid());
drop policy if exists modify_saved_creators_isolation on saved_creators;
create policy modify_saved_creators_isolation on saved_creators
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Media files (metadata aligned to the media library UI)
create table if not exists media_files (
    id uuid primary key default gen_random_uuid(),
    filename text not null,
    storage_path text not null,
    file_type text not null,
    file_size bigint,
    user_id uuid not null default auth.uid(),
    created_at timestamptz not null default now()
);

create index if not exists ix_media_files_user_created on media_files (user_id, created_at desc);

alter table media_files enable row level security;
drop policy if exists select_media_files_isolation on media_files;
create policy select_media_files_isolation on media_files
    for select using (user_id = auth.uid());
drop policy if exists modify_media_files_isolation on media_files;
create policy modify_media_files_isolation on media_files
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Storage bucket and RLS for media uploads
insert into storage.buckets (id, name, public)
values ('media_library', 'media_library', false)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

drop policy if exists media_access_select on storage.objects;
create policy media_access_select on storage.objects
    for select using (
        bucket_id = 'media_library'
        and (
            auth.role() = 'service_role'
            or coalesce((storage.foldername(name))[1], '') = auth.uid()::text
        )
    );

drop policy if exists media_access_insert on storage.objects;
create policy media_access_insert on storage.objects
    for insert with check (
        bucket_id = 'media_library'
        and (
            auth.role() = 'service_role'
            or coalesce((storage.foldername(name))[1], '') = auth.uid()::text
        )
    );

drop policy if exists media_access_update on storage.objects;
create policy media_access_update on storage.objects
    for update using (
        bucket_id = 'media_library'
        and (
            auth.role() = 'service_role'
            or coalesce((storage.foldername(name))[1], '') = auth.uid()::text
        )
    ) with check (
        bucket_id = 'media_library'
        and (
            auth.role() = 'service_role'
            or coalesce((storage.foldername(name))[1], '') = auth.uid()::text
        )
    );

drop policy if exists media_access_delete on storage.objects;
create policy media_access_delete on storage.objects
    for delete using (
        bucket_id = 'media_library'
        and (
            auth.role() = 'service_role'
            or coalesce((storage.foldername(name))[1], '') = auth.uid()::text
        )
    );
