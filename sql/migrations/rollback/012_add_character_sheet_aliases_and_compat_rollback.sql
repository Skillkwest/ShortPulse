-- Roll back character_sheet alias columns/triggers and restore strict legacy reference_pack integrity checks.

update characters
set metadata = coalesce(metadata, '{}'::jsonb)
    || jsonb_build_object('reference_pack_assignments', metadata->'character_sheet_assignments')
where metadata ? 'character_sheet_assignments'
  and not (metadata ? 'reference_pack_assignments');

update characters
set metadata = metadata - 'character_sheet_assignments'
where metadata ? 'character_sheet_assignments';

update media_files
set metadata = metadata - 'character_sheet_id'
where metadata ? 'character_sheet_id';

drop trigger if exists trg_characters_sync_character_sheet_aliases on characters;
drop function if exists sync_character_sheet_aliases_on_characters();

drop trigger if exists trg_character_reference_images_sync_character_sheet_aliases on character_reference_images;
drop function if exists sync_character_sheet_aliases_on_reference_images();

drop trigger if exists trg_character_generation_jobs_sync_character_sheet_aliases on character_generation_jobs;
drop function if exists sync_character_sheet_aliases_on_generation_jobs();

alter table characters
    drop constraint if exists characters_active_sheet_alias_sync_check;
alter table character_reference_images
    drop constraint if exists character_reference_images_sheet_alias_sync_check;
alter table character_generation_jobs
    drop constraint if exists character_generation_jobs_sheet_alias_sync_check;

alter table characters
    drop constraint if exists characters_active_character_sheet_fkey;
alter table character_reference_images
    drop constraint if exists character_reference_images_sheet_user_fkey;
alter table character_generation_jobs
    drop constraint if exists character_generation_jobs_sheet_user_fkey;

drop index if exists ux_character_reference_images_sheet_slot;
drop index if exists ix_character_reference_images_user_sheet_slot;
drop index if exists ix_character_generation_jobs_user_sheet_created;

alter table media_files
    drop constraint if exists media_files_character_reference_source_shape_check;
alter table media_files
    add constraint media_files_character_reference_source_shape_check
    check (
        source <> 'character_reference'
        or (
            lower(coalesce(file_type, '')) = 'image'
            and storage_path like user_id::text || '/characters/%'
            and coalesce(metadata->>'character_id', '') <> ''
            and coalesce(metadata->>'reference_pack_id', '') <> ''
            and coalesce(metadata->>'slot_key', '') in (
                'front_full',
                'side_profile',
                'back_full',
                'top_down',
                'front_left_34',
                'front_right_34',
                'back_left_34',
                'back_right_34',
                'portrait_close',
                'fullbody_wide'
            )
        )
    );

alter table character_reference_images
    drop constraint if exists character_reference_images_storage_scope_check;
alter table character_reference_images
    add constraint character_reference_images_storage_scope_check
    check (
        storage_path like user_id::text
            || '/characters/'
            || character_id::text
            || '/'
            || reference_pack_id::text
            || '/'
            || slot_key
            || '/%'
    );

create or replace function enforce_character_reference_image_media_integrity()
returns trigger
language plpgsql
as $$
declare
    linked_source text;
    linked_storage_path text;
    linked_metadata jsonb;
begin
    select mf.source, mf.storage_path, mf.metadata
    into linked_source, linked_storage_path, linked_metadata
    from media_files as mf
    where mf.id = new.media_file_id
      and mf.user_id = new.user_id;

    if not found then
        raise exception 'Character reference image must link to a media row owned by the same user.';
    end if;

    if linked_source <> 'character_reference' then
        raise exception 'Character reference image must link to media_files.source = character_reference.';
    end if;

    if linked_storage_path is distinct from new.storage_path then
        raise exception 'character_reference_images.storage_path must match media_files.storage_path for the linked media row.';
    end if;

    if coalesce(linked_metadata->>'character_id', '') <> new.character_id::text then
        raise exception 'character_reference media metadata.character_id must match character_reference_images.character_id.';
    end if;

    if coalesce(linked_metadata->>'reference_pack_id', '') <> new.reference_pack_id::text then
        raise exception 'character_reference media metadata.reference_pack_id must match character_reference_images.reference_pack_id.';
    end if;

    if coalesce(linked_metadata->>'slot_key', '') <> new.slot_key then
        raise exception 'character_reference media metadata.slot_key must match character_reference_images.slot_key.';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_character_reference_images_media_integrity on character_reference_images;
create trigger trg_character_reference_images_media_integrity
before insert or update of user_id, media_file_id, storage_path, character_id, reference_pack_id, slot_key
on character_reference_images
for each row execute function enforce_character_reference_image_media_integrity();

alter table character_generation_jobs
    drop column if exists character_sheet_id;

alter table character_reference_images
    drop column if exists character_sheet_id;

alter table characters
    drop column if exists active_character_sheet_id;
