-- Harden Character Manager media integrity and per-character storage organization.
-- Enforces consistent source/path/metadata shape and prevents cross-table drift.

update media_files as mf
set source = 'character_reference'
from character_reference_images as cri
where mf.id = cri.media_file_id
  and mf.user_id = cri.user_id
  and mf.source is distinct from 'character_reference';

update media_files as mf
set file_type = case
        when coalesce(trim(mf.file_type), '') = '' then 'image'
        else lower(trim(mf.file_type))
    end,
    metadata = coalesce(mf.metadata, '{}'::jsonb)
        || jsonb_build_object(
            'character_id', cri.character_id::text,
            'reference_pack_id', cri.reference_pack_id::text,
            'slot_key', cri.slot_key
        )
from character_reference_images as cri
where mf.id = cri.media_file_id
  and mf.user_id = cri.user_id;

alter table media_files
    drop constraint if exists media_files_source_check;
alter table media_files
    add constraint media_files_source_check
    check (
        source in ('upload', 'private_upload', 'ai_studio', 'character_reference', 'character_generation')
    );

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
