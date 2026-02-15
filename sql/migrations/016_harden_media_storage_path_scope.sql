-- Harden media_files storage path scope to prevent cross-user object references.
-- Uses NOT VALID to avoid breaking legacy rows while still enforcing new writes/updates.

alter table media_files
    drop constraint if exists media_files_storage_scope_check;
alter table media_files
    add constraint media_files_storage_scope_check
    check (storage_path like user_id::text || '/%')
    not valid;

do $$
begin
    if not exists (
        select 1
        from media_files
        where storage_path not like user_id::text || '/%'
    ) then
        alter table media_files validate constraint media_files_storage_scope_check;
    end if;
end;
$$;
