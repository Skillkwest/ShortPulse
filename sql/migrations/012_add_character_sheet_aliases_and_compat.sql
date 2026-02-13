-- Add character_sheet naming aliases with backward compatibility for legacy reference_pack fields.
-- Safe to re-run: guarded by IF EXISTS / IF NOT EXISTS where possible.

alter table characters
    add column if not exists active_character_sheet_id uuid;

alter table character_reference_images
    add column if not exists character_sheet_id uuid;

alter table character_generation_jobs
    add column if not exists character_sheet_id uuid;

update characters
set active_character_sheet_id = active_reference_pack_id
where active_character_sheet_id is null
  and active_reference_pack_id is not null;

update character_reference_images
set character_sheet_id = reference_pack_id
where character_sheet_id is null;

update character_generation_jobs
set character_sheet_id = reference_pack_id
where character_sheet_id is null;

alter table character_reference_images
    alter column character_sheet_id set not null;

alter table character_generation_jobs
    alter column character_sheet_id set not null;

alter table characters
    drop constraint if exists characters_active_character_sheet_fkey;
alter table characters
    add constraint characters_active_character_sheet_fkey
    foreign key (active_character_sheet_id, id)
    references character_reference_packs (id, character_id)
    on delete restrict;

alter table character_reference_images
    drop constraint if exists character_reference_images_sheet_user_fkey;
alter table character_reference_images
    add constraint character_reference_images_sheet_user_fkey
    foreign key (character_sheet_id, user_id) references character_reference_packs (id, user_id) on delete cascade;

alter table character_generation_jobs
    drop constraint if exists character_generation_jobs_sheet_user_fkey;
alter table character_generation_jobs
    add constraint character_generation_jobs_sheet_user_fkey
    foreign key (character_sheet_id, user_id) references character_reference_packs (id, user_id) on delete cascade;

create unique index if not exists ux_character_reference_images_sheet_slot
    on character_reference_images (character_sheet_id, slot_key);
create index if not exists ix_character_reference_images_user_sheet_slot
    on character_reference_images (user_id, character_sheet_id, slot_key);
create index if not exists ix_character_generation_jobs_user_sheet_created
    on character_generation_jobs (user_id, character_sheet_id, created_at desc);

alter table characters
    drop constraint if exists characters_active_sheet_alias_sync_check;
alter table characters
    add constraint characters_active_sheet_alias_sync_check
    check (active_character_sheet_id is not distinct from active_reference_pack_id);

alter table character_reference_images
    drop constraint if exists character_reference_images_sheet_alias_sync_check;
alter table character_reference_images
    add constraint character_reference_images_sheet_alias_sync_check
    check (character_sheet_id = reference_pack_id);

alter table character_generation_jobs
    drop constraint if exists character_generation_jobs_sheet_alias_sync_check;
alter table character_generation_jobs
    add constraint character_generation_jobs_sheet_alias_sync_check
    check (character_sheet_id = reference_pack_id);

update characters
set metadata = coalesce(metadata, '{}'::jsonb)
    || jsonb_build_object('character_sheet_assignments', metadata->'reference_pack_assignments')
where metadata ? 'reference_pack_assignments'
  and not (metadata ? 'character_sheet_assignments');

update characters
set metadata = coalesce(metadata, '{}'::jsonb)
    || jsonb_build_object('reference_pack_assignments', metadata->'character_sheet_assignments')
where metadata ? 'character_sheet_assignments'
  and not (metadata ? 'reference_pack_assignments');

create or replace function sync_character_sheet_aliases_on_characters()
returns trigger
language plpgsql
as $$
begin
    if new.active_character_sheet_id is null and new.active_reference_pack_id is not null then
        new.active_character_sheet_id := new.active_reference_pack_id;
    elsif new.active_reference_pack_id is null and new.active_character_sheet_id is not null then
        new.active_reference_pack_id := new.active_character_sheet_id;
    elsif new.active_character_sheet_id is distinct from new.active_reference_pack_id then
        new.active_reference_pack_id := new.active_character_sheet_id;
    end if;

    new.metadata := coalesce(new.metadata, '{}'::jsonb);
    if new.metadata ? 'character_sheet_assignments' then
        new.metadata := jsonb_set(
            new.metadata,
            '{reference_pack_assignments}',
            new.metadata->'character_sheet_assignments',
            true
        );
    elsif new.metadata ? 'reference_pack_assignments' then
        new.metadata := jsonb_set(
            new.metadata,
            '{character_sheet_assignments}',
            new.metadata->'reference_pack_assignments',
            true
        );
    end if;

    return new;
end;
$$;

drop trigger if exists trg_characters_sync_character_sheet_aliases on characters;
create trigger trg_characters_sync_character_sheet_aliases
before insert or update of active_character_sheet_id, active_reference_pack_id, metadata
on characters
for each row execute function sync_character_sheet_aliases_on_characters();

create or replace function sync_character_sheet_aliases_on_reference_images()
returns trigger
language plpgsql
as $$
begin
    if new.character_sheet_id is null and new.reference_pack_id is not null then
        new.character_sheet_id := new.reference_pack_id;
    elsif new.reference_pack_id is null and new.character_sheet_id is not null then
        new.reference_pack_id := new.character_sheet_id;
    elsif new.character_sheet_id is distinct from new.reference_pack_id then
        new.reference_pack_id := new.character_sheet_id;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_character_reference_images_sync_character_sheet_aliases on character_reference_images;
create trigger trg_character_reference_images_sync_character_sheet_aliases
before insert or update of character_sheet_id, reference_pack_id
on character_reference_images
for each row execute function sync_character_sheet_aliases_on_reference_images();

create or replace function sync_character_sheet_aliases_on_generation_jobs()
returns trigger
language plpgsql
as $$
begin
    if new.character_sheet_id is null and new.reference_pack_id is not null then
        new.character_sheet_id := new.reference_pack_id;
    elsif new.reference_pack_id is null and new.character_sheet_id is not null then
        new.reference_pack_id := new.character_sheet_id;
    elsif new.character_sheet_id is distinct from new.reference_pack_id then
        new.reference_pack_id := new.character_sheet_id;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_character_generation_jobs_sync_character_sheet_aliases on character_generation_jobs;
create trigger trg_character_generation_jobs_sync_character_sheet_aliases
before insert or update of character_sheet_id, reference_pack_id
on character_generation_jobs
for each row execute function sync_character_sheet_aliases_on_generation_jobs();

update media_files as mf
set metadata = coalesce(mf.metadata, '{}'::jsonb)
    || jsonb_build_object(
        'character_sheet_id',
        coalesce(
            nullif(mf.metadata->>'character_sheet_id', ''),
            nullif(mf.metadata->>'reference_pack_id', ''),
            cri.character_sheet_id::text,
            cri.reference_pack_id::text
        ),
        'reference_pack_id',
        coalesce(
            nullif(mf.metadata->>'reference_pack_id', ''),
            nullif(mf.metadata->>'character_sheet_id', ''),
            cri.reference_pack_id::text,
            cri.character_sheet_id::text
        )
    )
from character_reference_images as cri
where mf.id = cri.media_file_id
  and mf.user_id = cri.user_id
  and mf.source = 'character_reference';

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
            and (
                coalesce(metadata->>'character_sheet_id', '') <> ''
                or coalesce(metadata->>'reference_pack_id', '') <> ''
            )
            and (
                coalesce(metadata->>'character_sheet_id', '') = ''
                or coalesce(metadata->>'reference_pack_id', '') = ''
                or metadata->>'character_sheet_id' = metadata->>'reference_pack_id'
            )
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
            || character_sheet_id::text
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
    linked_character_sheet_id text;
    linked_reference_pack_id text;
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

    linked_character_sheet_id := coalesce(linked_metadata->>'character_sheet_id', '');
    linked_reference_pack_id := coalesce(linked_metadata->>'reference_pack_id', '');

    if linked_character_sheet_id = '' and linked_reference_pack_id = '' then
        raise exception 'character_reference media metadata must include character_sheet_id or reference_pack_id.';
    end if;

    if linked_character_sheet_id <> '' and linked_character_sheet_id <> new.character_sheet_id::text then
        raise exception 'character_reference media metadata.character_sheet_id must match character_reference_images.character_sheet_id.';
    end if;

    if linked_reference_pack_id <> '' and linked_reference_pack_id <> new.reference_pack_id::text then
        raise exception 'character_reference media metadata.reference_pack_id must match character_reference_images.reference_pack_id.';
    end if;

    if linked_character_sheet_id <> ''
       and linked_reference_pack_id <> ''
       and linked_character_sheet_id <> linked_reference_pack_id then
        raise exception 'character_reference media metadata character_sheet_id/reference_pack_id must agree when both are present.';
    end if;

    if coalesce(linked_metadata->>'slot_key', '') <> new.slot_key then
        raise exception 'character_reference media metadata.slot_key must match character_reference_images.slot_key.';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_character_reference_images_media_integrity on character_reference_images;
create trigger trg_character_reference_images_media_integrity
before insert or update of user_id, media_file_id, storage_path, character_id, character_sheet_id, reference_pack_id, slot_key
on character_reference_images
for each row execute function enforce_character_reference_image_media_integrity();
