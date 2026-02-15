-- Secure, per-user media storage bucket with RLS.
-- Creates a private "media_library" bucket and ensures every object path starts with the user's auth.uid().
-- Canonical SQL operations runbook: docs/sops/sop_sql_migration_operations.md

insert into storage.buckets (id, name, public)
values ('media_library', 'media_library', false)
on conflict (id) do nothing;

-- Note: Supabase manages `storage.objects` ownership. In many environments this role
-- cannot run `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on that table.
-- RLS is expected to already be enabled for storage.objects.
-- Verification query (run separately if needed):
-- select c.relrowsecurity
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'storage' and c.relname = 'objects';

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
