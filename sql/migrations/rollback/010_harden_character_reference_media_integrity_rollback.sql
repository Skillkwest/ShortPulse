-- Roll back strict Character Manager media integrity constraints and trigger.

drop trigger if exists trg_character_reference_images_media_integrity on character_reference_images;
drop function if exists enforce_character_reference_image_media_integrity();

alter table character_reference_images
    drop constraint if exists character_reference_images_storage_scope_check;
alter table character_reference_images
    add constraint character_reference_images_storage_scope_check
    check (storage_path like user_id::text || '/characters/%');

alter table media_files
    drop constraint if exists media_files_character_reference_source_shape_check;

alter table media_files
    drop constraint if exists media_files_source_check;
alter table media_files
    add constraint media_files_source_check
    check (
        source in ('upload', 'private_upload', 'ai_studio', 'character_reference', 'character_generation')
    );
