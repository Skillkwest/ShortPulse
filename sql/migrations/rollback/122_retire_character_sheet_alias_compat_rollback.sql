-- Reintroduce legacy Character Sheet alias compatibility after migration 122.
-- Forward-first repo policy still applies; use only in a controlled rollback window.

alter table public.characters
    add column if not exists active_reference_pack_id uuid;
alter table public.character_reference_images
    add column if not exists reference_pack_id uuid;
alter table public.character_generation_jobs
    add column if not exists reference_pack_id uuid;

update public.characters
set active_reference_pack_id = active_character_sheet_id
where active_reference_pack_id is null
  and active_character_sheet_id is not null;

update public.character_reference_images
set reference_pack_id = character_sheet_id
where reference_pack_id is null
  and character_sheet_id is not null;

update public.character_generation_jobs
set reference_pack_id = character_sheet_id
where reference_pack_id is null
  and character_sheet_id is not null;

update public.characters
set metadata = coalesce(metadata, '{}'::jsonb)
    || jsonb_build_object('reference_pack_assignments', metadata->'character_sheet_assignments')
where metadata ? 'character_sheet_assignments'
  and not (metadata ? 'reference_pack_assignments');

update public.media_files
set metadata = coalesce(metadata, '{}'::jsonb)
    || jsonb_build_object('reference_pack_id', metadata->'character_sheet_id')
where source = 'character_reference'
  and coalesce(metadata->>'character_sheet_id', '') <> ''
  and not (metadata ? 'reference_pack_id');

alter table public.characters
    drop constraint if exists characters_active_reference_pack_fkey;
alter table public.characters
    add constraint characters_active_reference_pack_fkey
    foreign key (active_reference_pack_id, id)
    references public.character_reference_packs (id, character_id)
    on delete restrict;

alter table public.character_reference_images
    drop constraint if exists character_reference_images_pack_user_fkey;
alter table public.character_reference_images
    add constraint character_reference_images_pack_user_fkey
    foreign key (reference_pack_id, user_id) references public.character_reference_packs (id, user_id) on delete cascade;

alter table public.character_generation_jobs
    drop constraint if exists character_generation_jobs_pack_user_fkey;
alter table public.character_generation_jobs
    add constraint character_generation_jobs_pack_user_fkey
    foreign key (reference_pack_id, user_id) references public.character_reference_packs (id, user_id) on delete cascade;

create unique index if not exists ux_character_reference_images_pack_slot
    on public.character_reference_images (reference_pack_id, slot_key);
create index if not exists ix_character_reference_images_user_pack_slot
    on public.character_reference_images (user_id, reference_pack_id, slot_key);

alter table public.characters
    drop constraint if exists characters_active_sheet_alias_sync_check;
alter table public.characters
    add constraint characters_active_sheet_alias_sync_check
    check (active_character_sheet_id is not distinct from active_reference_pack_id);

alter table public.character_reference_images
    drop constraint if exists character_reference_images_sheet_alias_sync_check;
alter table public.character_reference_images
    add constraint character_reference_images_sheet_alias_sync_check
    check (character_sheet_id = reference_pack_id);

alter table public.character_generation_jobs
    drop constraint if exists character_generation_jobs_sheet_alias_sync_check;
alter table public.character_generation_jobs
    add constraint character_generation_jobs_sheet_alias_sync_check
    check (character_sheet_id = reference_pack_id);

create or replace function public.sync_character_sheet_aliases_on_characters()
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

create or replace function public.sync_character_sheet_aliases_on_reference_images()
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

create or replace function public.sync_character_sheet_aliases_on_generation_jobs()
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

drop trigger if exists trg_character_reference_images_media_integrity on public.character_reference_images;

drop trigger if exists trg_characters_sync_character_sheet_aliases on public.characters;
create trigger trg_characters_sync_character_sheet_aliases
before insert or update of active_character_sheet_id, active_reference_pack_id, metadata
on public.characters
for each row execute function public.sync_character_sheet_aliases_on_characters();

drop trigger if exists trg_character_reference_images_sync_character_sheet_aliases on public.character_reference_images;
create trigger trg_character_reference_images_sync_character_sheet_aliases
before insert or update of character_sheet_id, reference_pack_id
on public.character_reference_images
for each row execute function public.sync_character_sheet_aliases_on_reference_images();

drop trigger if exists trg_character_generation_jobs_sync_character_sheet_aliases on public.character_generation_jobs;
create trigger trg_character_generation_jobs_sync_character_sheet_aliases
before insert or update of character_sheet_id, reference_pack_id
on public.character_generation_jobs
for each row execute function public.sync_character_sheet_aliases_on_generation_jobs();

create trigger trg_character_reference_images_media_integrity
before insert or update of user_id, media_file_id, character_media_id, storage_path, character_id, character_sheet_id, reference_pack_id, slot_key
on public.character_reference_images
for each row execute function public.enforce_character_reference_image_media_integrity();

alter table public.media_files
    drop constraint if exists media_files_character_reference_source_shape_check;
alter table public.media_files
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
