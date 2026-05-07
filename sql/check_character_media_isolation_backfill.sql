-- Diagnose Character Media Isolation V2 migration completeness.
-- Read-only script: no persistent schema or data changes.

with character_asset_counts as (
    select
        asset_kind,
        count(*) as row_count
    from public.character_media_assets
    group by asset_kind
)
select *
from character_asset_counts
order by asset_kind asc;

with reference_rows as (
    select
        count(*) as total_rows,
        count(*) filter (where character_media_id is not null) as with_character_media_id,
        count(*) filter (where media_file_id is not null) as with_legacy_media_file_id,
        count(*) filter (where media_file_id is null and character_media_id is null) as invalid_rows
    from public.character_reference_images
)
select *
from reference_rows;

with quickswap_rows as (
    select
        count(*) as total_rows,
        count(*) filter (where character_media_id is not null) as with_character_media_id,
        count(*) filter (where media_file_id is not null) as with_legacy_media_file_id,
        count(*) filter (where media_file_id is null and character_media_id is null) as invalid_rows
    from public.character_quick_swap_items
)
select *
from quickswap_rows;

with unmapped_reference_rows as (
    select
        cri.id,
        cri.user_id,
        cri.character_id,
        cri.character_sheet_id,
        cri.slot_key,
        cri.media_file_id,
        cri.storage_path,
        cri.updated_at
    from public.character_reference_images cri
    where cri.character_media_id is null
)
select *
from unmapped_reference_rows
order by updated_at desc
limit 200;

with unmapped_quickswap_rows as (
    select
        q.id,
        q.user_id,
        q.character_id,
        q.media_file_id,
        q.storage_path,
        q.status,
        q.created_at
    from public.character_quick_swap_items q
    where q.character_media_id is null
)
select *
from unmapped_quickswap_rows
order by created_at desc
limit 200;

with profile_refs as (
    select
        c.id as character_id,
        c.user_id,
        nullif(trim(coalesce(c.metadata->>'profile_image_storage_path', '')), '') as profile_image_storage_path,
        nullif(trim(coalesce(c.metadata->>'profile_image_character_media_id', '')), '') as profile_image_character_media_id,
        nullif(trim(coalesce(c.metadata->>'profile_image_media_file_id', '')), '') as legacy_profile_image_media_file_id
    from public.characters c
)
select
    count(*) filter (where profile_image_storage_path is not null) as profile_rows_with_storage,
    count(*) filter (
        where profile_image_storage_path is not null
          and profile_image_character_media_id is not null
    ) as profile_rows_with_character_media_id,
    count(*) filter (
        where profile_image_storage_path is not null
          and profile_image_character_media_id is null
    ) as profile_rows_missing_character_media_id,
    count(*) filter (
        where legacy_profile_image_media_file_id is not null
    ) as profile_rows_with_legacy_media_file_id
from profile_refs;

with preset_rows as (
    select
        c.id as character_id,
        c.user_id,
        nullif(trim(coalesce(zone_ref.value->>'storage_path', '')), '') as storage_path,
        nullif(trim(coalesce(zone_ref.value->>'character_media_id', '')), '') as character_media_id,
        nullif(
            trim(
                coalesce(
                    zone_ref.value->>'media_file_id',
                    zone_ref.value->>'mediaFileId',
                    zone_ref.value->>'media_fileId',
                    ''
                )
            ),
            ''
        ) as legacy_media_file_id
    from public.characters c
    cross join lateral jsonb_each(
        coalesce(c.metadata->'character_sheet_presets_v1'->'presets', '{}'::jsonb)
    ) as preset_entry(preset_id, preset_value)
    cross join lateral jsonb_each(coalesce(preset_entry.preset_value, '{}'::jsonb)) as zone_ref(zone_key, value)
    where jsonb_typeof(zone_ref.value) = 'object'
)
select
    count(*) as preset_reference_rows,
    count(*) filter (where storage_path is not null) as preset_rows_with_storage,
    count(*) filter (
        where storage_path is not null
          and character_media_id is not null
    ) as preset_rows_with_media_id,
    count(*) filter (
        where storage_path is not null
          and character_media_id is null
    ) as preset_rows_missing_media_id,
    count(*) filter (
        where legacy_media_file_id is not null
    ) as preset_rows_with_legacy_media_file_id
from preset_rows;
