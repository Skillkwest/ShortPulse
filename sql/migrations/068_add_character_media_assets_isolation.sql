-- Character Media Isolation V2 foundation.
-- Adds character-owned asset table and compatibility columns for gradual cutover from media_files coupling.

create table if not exists public.character_media_assets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid(),
    character_id uuid not null,
    asset_kind text not null,
    storage_path text not null,
    filename text not null,
    file_type text not null,
    file_size bigint not null default 0,
    width integer,
    height integer,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint character_media_assets_asset_kind_check
        check (asset_kind in ('profile', 'sheet_slot', 'sheet_preset', 'quickswap')),
    constraint character_media_assets_storage_scope_check
        check (storage_path like user_id::text || '/characters/' || character_id::text || '/%'),
    constraint character_media_assets_character_user_fkey
        foreign key (character_id, user_id) references public.characters (id, user_id) on delete cascade
);

create unique index if not exists ux_character_media_assets_user_storage_path
    on public.character_media_assets (user_id, storage_path);
create unique index if not exists ux_character_media_assets_id_user
    on public.character_media_assets (id, user_id);
create index if not exists ix_character_media_assets_user_character_kind_created
    on public.character_media_assets (user_id, character_id, asset_kind, created_at desc);
create index if not exists ix_character_media_assets_user_character_created
    on public.character_media_assets (user_id, character_id, created_at desc);

alter table public.character_media_assets enable row level security;

drop policy if exists select_character_media_assets_isolation on public.character_media_assets;
create policy select_character_media_assets_isolation on public.character_media_assets
    for select using (user_id = auth.uid());

drop policy if exists modify_character_media_assets_isolation on public.character_media_assets;
create policy modify_character_media_assets_isolation on public.character_media_assets
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists trg_character_media_assets_updated_at on public.character_media_assets;
create trigger trg_character_media_assets_updated_at
before update on public.character_media_assets
for each row execute function public.set_character_manager_updated_at();

alter table public.character_reference_images
    add column if not exists character_media_id uuid;
alter table public.character_quick_swap_items
    add column if not exists character_media_id uuid;

alter table public.character_reference_images
    alter column media_file_id drop not null;
alter table public.character_quick_swap_items
    alter column media_file_id drop not null;

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

alter table public.character_reference_images
    drop constraint if exists character_reference_images_character_media_user_fkey;
alter table public.character_reference_images
    add constraint character_reference_images_character_media_user_fkey
    foreign key (character_media_id, user_id) references public.character_media_assets (id, user_id) on delete cascade;

alter table public.character_quick_swap_items
    drop constraint if exists character_quick_swap_items_character_media_user_fkey;
alter table public.character_quick_swap_items
    add constraint character_quick_swap_items_character_media_user_fkey
    foreign key (character_media_id, user_id) references public.character_media_assets (id, user_id) on delete cascade;

alter table public.character_reference_images
    drop constraint if exists character_reference_images_media_reference_required_check;
alter table public.character_reference_images
    add constraint character_reference_images_media_reference_required_check
    check (media_file_id is not null or character_media_id is not null);

alter table public.character_quick_swap_items
    drop constraint if exists character_quick_swap_items_media_reference_required_check;
alter table public.character_quick_swap_items
    add constraint character_quick_swap_items_media_reference_required_check
    check (media_file_id is not null or character_media_id is not null);

create index if not exists ix_character_reference_images_character_media
    on public.character_reference_images (character_media_id);
create index if not exists ix_character_quick_swap_items_character_media
    on public.character_quick_swap_items (character_media_id);
create unique index if not exists ux_character_quick_swap_items_character_media_v2
    on public.character_quick_swap_items (character_id, character_media_id)
    where character_media_id is not null;

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
    linked_character_id uuid;
    linked_asset_kind text;
begin
    if new.character_media_id is not null then
        select cma.character_id, cma.asset_kind, cma.storage_path, cma.metadata
        into linked_character_id, linked_asset_kind, linked_storage_path, linked_metadata
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
    end if;

    if new.media_file_id is null then
        raise exception 'Character reference image must link to media_files or character_media_assets.';
    end if;

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
before insert or update of user_id, media_file_id, character_media_id, storage_path, character_id, character_sheet_id, reference_pack_id, slot_key
on public.character_reference_images
for each row execute function public.enforce_character_reference_image_media_integrity();

with slot_asset_rows as (
    select distinct
        cri.user_id,
        cri.character_id,
        mf.storage_path,
        coalesce(nullif(mf.filename, ''), substring(mf.storage_path from '([^/]+)$'), 'character-slot.jpg') as filename,
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
), quickswap_asset_rows as (
    select distinct
        q.user_id,
        q.character_id,
        mf.storage_path,
        coalesce(nullif(mf.filename, ''), substring(mf.storage_path from '([^/]+)$'), 'quickswap-image.jpg') as filename,
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
), profile_asset_rows as (
    select distinct
        c.user_id,
        c.id as character_id,
        profile_storage.storage_path,
        coalesce(
            nullif(mf.filename, ''),
            substring(profile_storage.storage_path from '([^/]+)$'),
            'character-profile.jpg'
        ) as filename,
        coalesce(nullif(mf.file_type, ''), 'image') as file_type,
        greatest(coalesce(mf.file_size, 0), 0) as file_size,
        jsonb_strip_nulls(
            jsonb_build_object(
                'legacy_media_file_id', nullif(trim(coalesce(c.metadata->>'profile_image_media_file_id', '')), ''),
                'backfill_source', 'characters.profile_metadata'
            )
        ) as metadata
    from public.characters as c
    cross join lateral (
        select nullif(trim(coalesce(c.metadata->>'profile_image_storage_path', '')), '') as storage_path
    ) as profile_storage
    left join public.media_files as mf
      on mf.user_id = c.user_id
     and (
        mf.storage_path = profile_storage.storage_path
        or mf.id::text = nullif(trim(coalesce(c.metadata->>'profile_image_media_file_id', '')), '')
     )
    where profile_storage.storage_path is not null
), preset_asset_rows as (
    select distinct
        c.user_id,
        c.id as character_id,
        nullif(trim(coalesce(zone_ref.value->>'storage_path', '')), '') as storage_path,
        nullif(
            trim(
                coalesce(
                    zone_ref.value->>'character_media_id',
                    zone_ref.value->>'media_file_id',
                    ''
                )
            ),
            ''
        ) as legacy_media_id
    from public.characters as c
    cross join lateral jsonb_each(
        coalesce(c.metadata->'character_sheet_presets_v1'->'presets', '{}'::jsonb)
    ) as preset_entry(preset_id, preset_value)
    cross join lateral jsonb_each(coalesce(preset_entry.preset_value, '{}'::jsonb)) as zone_ref(zone_key, value)
    where jsonb_typeof(zone_ref.value) = 'object'
), preset_asset_rows_with_media as (
    select
        pr.user_id,
        pr.character_id,
        pr.storage_path,
        coalesce(nullif(mf.filename, ''), substring(pr.storage_path from '([^/]+)$'), 'character-preset.jpg') as filename,
        coalesce(nullif(mf.file_type, ''), 'image') as file_type,
        greatest(coalesce(mf.file_size, 0), 0) as file_size,
        jsonb_strip_nulls(
            jsonb_build_object(
                'legacy_media_file_id', pr.legacy_media_id,
                'backfill_source', 'characters.preset_metadata'
            )
        ) as metadata
    from preset_asset_rows as pr
    left join public.media_files as mf
      on mf.user_id = pr.user_id
     and (
        mf.storage_path = pr.storage_path
        or mf.id::text = pr.legacy_media_id
     )
    where pr.storage_path is not null
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
    union all
    select user_id, character_id, 'profile'::text as asset_kind, storage_path, filename, file_type, file_size, metadata
    from profile_asset_rows
    union all
    select user_id, character_id, 'sheet_preset'::text as asset_kind, storage_path, filename, file_type, file_size, metadata
    from preset_asset_rows_with_media
) as row_data
where row_data.storage_path like row_data.user_id::text || '/characters/' || row_data.character_id::text || '/%'
on conflict (user_id, storage_path) do nothing;

update public.character_reference_images as cri
set character_media_id = cma.id
from public.character_media_assets as cma
where cri.character_media_id is null
  and cri.user_id = cma.user_id
  and cri.character_id = cma.character_id
  and cri.storage_path = cma.storage_path;

update public.character_quick_swap_items as q
set character_media_id = cma.id
from public.character_media_assets as cma
where q.character_media_id is null
  and q.user_id = cma.user_id
  and q.character_id = cma.character_id
  and q.storage_path = cma.storage_path;

update public.characters as c
set metadata = jsonb_set(
    coalesce(c.metadata, '{}'::jsonb),
    '{profile_image_character_media_id}',
    to_jsonb(cma.id::text),
    true
)
from public.character_media_assets as cma
where c.user_id = cma.user_id
  and c.id = cma.character_id
  and cma.asset_kind = 'profile'
  and nullif(trim(coalesce(c.metadata->>'profile_image_storage_path', '')), '') = cma.storage_path
  and nullif(trim(coalesce(c.metadata->>'profile_image_character_media_id', '')), '') is null;
