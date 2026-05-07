-- Retire legacy Character Manager row-level media_files linkage.
-- Backfills remaining slot/QuickSwap rows onto character_media_assets, then requires character_media_id.

with slot_asset_rows as (
    select distinct
        cri.user_id,
        cri.character_id,
        cri.storage_path,
        coalesce(nullif(mf.filename, ''), substring(cri.storage_path from '([^/]+)$'), 'character-slot.jpg') as filename,
        coalesce(nullif(mf.file_type, ''), 'image') as file_type,
        greatest(coalesce(mf.file_size, 0), 0) as file_size,
        jsonb_build_object(
            'legacy_media_file_id', mf.id,
            'backfill_source', 'character_reference_images'
        ) as metadata
    from public.character_reference_images as cri
    join public.media_files as mf
      on mf.id = cri.media_file_id
     and mf.user_id = cri.user_id
    where cri.character_media_id is null
      and cri.media_file_id is not null
), quickswap_asset_rows as (
    select distinct
        q.user_id,
        q.character_id,
        q.storage_path,
        coalesce(nullif(mf.filename, ''), substring(q.storage_path from '([^/]+)$'), 'quickswap-image.jpg') as filename,
        coalesce(nullif(mf.file_type, ''), 'image') as file_type,
        greatest(coalesce(mf.file_size, 0), 0) as file_size,
        jsonb_build_object(
            'legacy_media_file_id', mf.id,
            'backfill_source', 'character_quick_swap_items'
        ) as metadata
    from public.character_quick_swap_items as q
    join public.media_files as mf
      on mf.id = q.media_file_id
     and mf.user_id = q.user_id
    where q.character_media_id is null
      and q.media_file_id is not null
)
insert into public.character_media_assets (
    user_id,
    character_id,
    asset_kind,
    storage_path,
    filename,
    file_type,
    file_size,
    metadata
)
select
    row_data.user_id,
    row_data.character_id,
    row_data.asset_kind,
    row_data.storage_path,
    row_data.filename,
    row_data.file_type,
    row_data.file_size,
    row_data.metadata
from (
    select user_id, character_id, 'sheet_slot'::text as asset_kind, storage_path, filename, file_type, file_size, metadata
    from slot_asset_rows
    union all
    select user_id, character_id, 'quickswap'::text as asset_kind, storage_path, filename, file_type, file_size, metadata
    from quickswap_asset_rows
) as row_data
where row_data.storage_path like row_data.user_id::text || '/characters/' || row_data.character_id::text || '/%'
on conflict (user_id, storage_path) do nothing;

update public.character_reference_images as cri
set character_media_id = cma.id
from public.character_media_assets as cma
where cri.character_media_id is null
  and cri.user_id = cma.user_id
  and cri.character_id = cma.character_id
  and cri.storage_path = cma.storage_path
  and cma.asset_kind = 'sheet_slot';

update public.character_quick_swap_items as q
set character_media_id = cma.id
from public.character_media_assets as cma
where q.character_media_id is null
  and q.user_id = cma.user_id
  and q.character_id = cma.character_id
  and q.storage_path = cma.storage_path
  and cma.asset_kind = 'quickswap';

do $$
begin
    if exists (
        select 1
        from public.character_reference_images
        where character_media_id is null
    ) then
        raise exception 'Character reference images still contain rows without character_media_id after migration 119.';
    end if;

    if exists (
        select 1
        from public.character_quick_swap_items
        where character_media_id is null
    ) then
        raise exception 'Character quick swap items still contain rows without character_media_id after migration 119.';
    end if;
end;
$$;

update public.character_reference_images
set media_file_id = null
where character_media_id is not null
  and media_file_id is not null;

update public.character_quick_swap_items
set media_file_id = null
where character_media_id is not null
  and media_file_id is not null;

alter table public.character_reference_images
    drop constraint if exists character_reference_images_media_reference_required_check;
alter table public.character_reference_images
    add constraint character_reference_images_media_reference_required_check
    check (character_media_id is not null);

alter table public.character_quick_swap_items
    drop constraint if exists character_quick_swap_items_media_reference_required_check;
alter table public.character_quick_swap_items
    add constraint character_quick_swap_items_media_reference_required_check
    check (character_media_id is not null);

alter table public.character_reference_images
    drop constraint if exists character_reference_images_media_user_fkey;
alter table public.character_quick_swap_items
    drop constraint if exists character_quick_swap_items_media_user_fkey;

drop index if exists public.ix_character_reference_images_media_file;
drop index if exists public.ix_character_quick_swap_items_media_file;
drop index if exists public.ux_character_quick_swap_items_character_media;

create or replace function public.enforce_character_reference_image_media_integrity()
returns trigger
language plpgsql
as $$
declare
    linked_storage_path text;
    linked_character_id uuid;
    linked_asset_kind text;
begin
    if new.character_media_id is null then
        raise exception 'Character reference image must link to character_media_assets.';
    end if;

    select cma.character_id, cma.asset_kind, cma.storage_path
    into linked_character_id, linked_asset_kind, linked_storage_path
    from public.character_media_assets as cma
    where cma.id = new.character_media_id
      and cma.user_id = new.user_id;

    if not found then
        raise exception 'Character reference image must link to a character media row owned by the same user.';
    end if;

    if linked_character_id is distinct from new.character_id then
        raise exception 'character_reference_images.character_id must match linked character_media_assets.character_id.';
    end if;

    if linked_asset_kind <> 'sheet_slot' then
        raise exception 'character_reference_images must link to character_media_assets.asset_kind = sheet_slot.';
    end if;

    if linked_storage_path is distinct from new.storage_path then
        raise exception 'character_reference_images.storage_path must match character_media_assets.storage_path for the linked media row.';
    end if;

    return new;
end;
$$;

create or replace function public.enforce_character_quick_swap_item_media_integrity()
returns trigger
language plpgsql
as $$
declare
    linked_storage_path text;
    linked_character_id uuid;
    linked_asset_kind text;
begin
    if new.character_media_id is null then
        raise exception 'Character quick swap item must link to character_media_assets.';
    end if;

    select cma.character_id, cma.asset_kind, cma.storage_path
    into linked_character_id, linked_asset_kind, linked_storage_path
    from public.character_media_assets as cma
    where cma.id = new.character_media_id
      and cma.user_id = new.user_id;

    if not found then
        raise exception 'Character quick swap item must link to a character media row owned by the same user.';
    end if;

    if linked_character_id is distinct from new.character_id then
        raise exception 'character_quick_swap_items.character_id must match linked character_media_assets.character_id.';
    end if;

    if linked_asset_kind <> 'quickswap' then
        raise exception 'character_quick_swap_items must link to character_media_assets.asset_kind = quickswap.';
    end if;

    if linked_storage_path is distinct from new.storage_path then
        raise exception 'character_quick_swap_items.storage_path must match character_media_assets.storage_path for the linked media row.';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_character_quick_swap_items_media_integrity on public.character_quick_swap_items;
create trigger trg_character_quick_swap_items_media_integrity
before insert or update of user_id, character_media_id, storage_path, character_id
on public.character_quick_swap_items
for each row execute function public.enforce_character_quick_swap_item_media_integrity();
