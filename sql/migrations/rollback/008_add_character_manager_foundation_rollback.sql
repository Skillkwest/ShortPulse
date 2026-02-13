-- Roll back Character Manager foundational schema and media source support.

drop trigger if exists trg_character_generation_jobs_updated_at on character_generation_jobs;
drop trigger if exists trg_character_reference_images_updated_at on character_reference_images;
drop trigger if exists trg_character_reference_packs_updated_at on character_reference_packs;
drop trigger if exists trg_characters_updated_at on characters;
drop function if exists set_character_manager_updated_at();

drop table if exists character_generation_jobs;
drop table if exists character_reference_images;

alter table if exists characters
    drop constraint if exists characters_active_reference_pack_fkey;

drop table if exists character_reference_packs;
drop table if exists characters;

update media_files
set source = 'upload'
where source = 'character_reference';

update media_files
set source = 'upload'
where source = 'character_generation';

alter table media_files
    drop constraint if exists media_files_source_check;
alter table media_files
    add constraint media_files_source_check
    check (source in ('upload', 'private_upload', 'ai_studio'));
