-- Secure, per-user media storage bucket with RLS.
-- Creates a private "media_library" bucket and ensures every object path starts with the user's auth.uid().

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
