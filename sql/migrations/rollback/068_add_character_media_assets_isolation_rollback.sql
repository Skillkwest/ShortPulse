-- Rollback for 068_add_character_media_assets_isolation.sql
-- Best-effort rollback: removes Character Media V2 schema additions.

-- Restore legacy integrity trigger contract (media_files-only linkage).
create or replace function public.enforce_character_reference_image_media_integrity()
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
    from public.media_files as mf
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

drop trigger if exists trg_character_reference_images_media_integrity on public.character_reference_images;
create trigger trg_character_reference_images_media_integrity
before insert or update of user_id, media_file_id, storage_path, character_id, character_sheet_id, reference_pack_id, slot_key
on public.character_reference_images
for each row execute function public.enforce_character_reference_image_media_integrity();

-- Restore media-files foreign key posture.
alter table public.character_reference_images
    drop constraint if exists character_reference_images_character_media_user_fkey;
alter table public.character_quick_swap_items
    drop constraint if exists character_quick_swap_items_character_media_user_fkey;

alter table public.character_reference_images
    drop constraint if exists character_reference_images_media_reference_required_check;
alter table public.character_quick_swap_items
    drop constraint if exists character_quick_swap_items_media_reference_required_check;

alter table public.character_reference_images
    drop constraint if exists character_reference_images_media_user_fkey;
alter table public.character_reference_images
    add constraint character_reference_images_media_user_fkey
    foreign key (media_file_id, user_id) references public.media_files (id, user_id) on delete cascade;

alter table public.character_quick_swap_items
    drop constraint if exists character_quick_swap_items_media_user_fkey;
alter table public.character_quick_swap_items
    add constraint character_quick_swap_items_media_user_fkey
    foreign key (media_file_id, user_id) references public.media_files (id, user_id) on delete cascade;

drop index if exists public.ux_character_quick_swap_items_character_media_v2;
drop index if exists public.ix_character_reference_images_character_media;
drop index if exists public.ix_character_quick_swap_items_character_media;

alter table public.character_reference_images
    drop column if exists character_media_id;
alter table public.character_quick_swap_items
    drop column if exists character_media_id;

drop policy if exists modify_character_media_assets_isolation on public.character_media_assets;
drop policy if exists select_character_media_assets_isolation on public.character_media_assets;
drop trigger if exists trg_character_media_assets_updated_at on public.character_media_assets;
drop table if exists public.character_media_assets;
