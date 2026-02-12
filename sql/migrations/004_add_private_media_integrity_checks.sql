-- Enforce private media semantics so tab/source classification cannot drift.
-- Requires migration 003 (private_upload source value) to be applied first.

update media_files
set source = 'private_upload'
where source = 'upload'
  and storage_path like user_id::text || '/private/images/%';

update media_files
set source = 'upload'
where source = 'private_upload'
  and (
    storage_path not like user_id::text || '/private/images/%'
    or lower(coalesce(file_type, '')) <> 'image'
  );

alter table media_files
    drop constraint if exists media_files_private_source_shape_check;
alter table media_files
    add constraint media_files_private_source_shape_check
    check (
        source <> 'private_upload'
        or (
            lower(coalesce(file_type, '')) = 'image'
            and storage_path like user_id::text || '/private/images/%'
        )
    );

alter table media_files
    drop constraint if exists media_files_private_path_source_check;
alter table media_files
    add constraint media_files_private_path_source_check
    check (
        storage_path not like user_id::text || '/private/images/%'
        or source = 'private_upload'
    );
