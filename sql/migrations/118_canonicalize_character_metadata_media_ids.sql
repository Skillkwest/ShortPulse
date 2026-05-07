-- Canonicalize Character Manager metadata linkage ids onto character_media_id keys.
-- This removes legacy profile/preset media id keys from characters.metadata now that
-- Character Manager writes persist exclusively through character_media_assets.

begin;

with profile_metadata_updates as (
    select
        c.id,
        c.user_id,
        jsonb_strip_nulls(
            (
                case
                    when nullif(trim(coalesce(c.metadata->>'profile_image_character_media_id', '')), '') is null
                         and nullif(trim(coalesce(c.metadata->>'profile_image_media_file_id', '')), '') is not null
                    then jsonb_set(
                        coalesce(c.metadata, '{}'::jsonb),
                        '{profile_image_character_media_id}',
                        to_jsonb(trim(c.metadata->>'profile_image_media_file_id')),
                        true
                    )
                    else coalesce(c.metadata, '{}'::jsonb)
                end
            ) - 'profile_image_media_file_id'
        ) as next_metadata
    from public.characters as c
)
update public.characters as c
set metadata = profile_metadata_updates.next_metadata
from profile_metadata_updates
where c.id = profile_metadata_updates.id
  and c.user_id = profile_metadata_updates.user_id
  and c.metadata is distinct from profile_metadata_updates.next_metadata;

with preset_metadata_updates as (
    select
        c.id,
        c.user_id,
        jsonb_set(
            coalesce(c.metadata, '{}'::jsonb),
            '{character_sheet_presets_v1,presets}',
            (
                select jsonb_object_agg(
                    preset_entry.preset_id,
                    case
                        when jsonb_typeof(preset_entry.preset_value) = 'object' then (
                            select jsonb_object_agg(
                                zone_entry.zone_key,
                                case
                                    when jsonb_typeof(zone_entry.zone_value) = 'object' then
                                        jsonb_strip_nulls(
                                            jsonb_set(
                                                (
                                                    zone_entry.zone_value
                                                    - 'media_file_id'
                                                    - 'mediaFileId'
                                                    - 'media_fileId'
                                                ),
                                                '{character_media_id}',
                                                to_jsonb(
                                                    coalesce(
                                                        nullif(trim(coalesce(zone_entry.zone_value->>'character_media_id', '')), ''),
                                                        nullif(trim(coalesce(zone_entry.zone_value->>'media_file_id', '')), ''),
                                                        nullif(trim(coalesce(zone_entry.zone_value->>'mediaFileId', '')), ''),
                                                        nullif(trim(coalesce(zone_entry.zone_value->>'media_fileId', '')), ''),
                                                        ''
                                                    )
                                                ),
                                                coalesce(
                                                    nullif(trim(coalesce(zone_entry.zone_value->>'character_media_id', '')), ''),
                                                    nullif(trim(coalesce(zone_entry.zone_value->>'media_file_id', '')), ''),
                                                    nullif(trim(coalesce(zone_entry.zone_value->>'mediaFileId', '')), ''),
                                                    nullif(trim(coalesce(zone_entry.zone_value->>'media_fileId', '')), '')
                                                ) is not null
                                            )
                                        )
                                    else zone_entry.zone_value
                                end
                            )
                            from jsonb_each(coalesce(preset_entry.preset_value, '{}'::jsonb)) as zone_entry(zone_key, zone_value)
                        )
                        else preset_entry.preset_value
                    end
                )
                from jsonb_each(coalesce(c.metadata->'character_sheet_presets_v1'->'presets', '{}'::jsonb))
                    as preset_entry(preset_id, preset_value)
            ),
            true
        ) as next_metadata
    from public.characters as c
    where jsonb_typeof(c.metadata->'character_sheet_presets_v1'->'presets') = 'object'
)
update public.characters as c
set metadata = preset_metadata_updates.next_metadata
from preset_metadata_updates
where c.id = preset_metadata_updates.id
  and c.user_id = preset_metadata_updates.user_id
  and c.metadata is distinct from preset_metadata_updates.next_metadata;

commit;
