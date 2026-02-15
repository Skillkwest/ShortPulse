-- Add explicit private media source support for Media Library Private tab.
-- Keeps existing bucket/policies and adds a constrained source value for stable filtering.

update media_files
set source = 'upload'
where source is null;

update media_files
set source = 'private_upload'
where source = 'upload'
  and position('/private/' in storage_path) > 0;

alter table media_files
    drop constraint if exists media_files_source_check;
alter table media_files
    add constraint media_files_source_check
    check (
        source in (
            'upload',
            'private_upload',
            'ai_studio',
            'character_reference',
            'character_generation'
        )
    );
