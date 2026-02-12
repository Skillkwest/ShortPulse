-- Roll back private media source support.

update media_files
set source = 'upload'
where source = 'private_upload';

alter table media_files
    drop constraint if exists media_files_source_check;
alter table media_files
    add constraint media_files_source_check
    check (source in ('upload', 'ai_studio'));
