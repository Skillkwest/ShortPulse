-- Character Sheet alias drift diagnostics.
-- Purpose: detect mismatch between canonical character_sheet_* fields and
-- legacy reference_pack_* aliases during the compatibility window, while
-- remaining safe after alias retirement migration 122 removes the legacy columns.
-- Safe to run repeatedly; read-only.

with column_state as (
    select
        exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'characters'
              and column_name = 'active_reference_pack_id'
        ) as has_characters_active_reference_pack_id,
        exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'character_reference_images'
              and column_name = 'reference_pack_id'
        ) as has_reference_images_reference_pack_id,
        exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'character_generation_jobs'
              and column_name = 'reference_pack_id'
        ) as has_generation_jobs_reference_pack_id
),
drift_counts as (
    select
        'characters.active_sheet_alias'::text as check_name,
        case
            when (select has_characters_active_reference_pack_id from column_state) then (
                select count(*)::bigint
                from characters
                where
                    (to_jsonb(characters)->>'active_character_sheet_id')
                        is distinct from (to_jsonb(characters)->>'active_reference_pack_id')
            )
            else 0::bigint
        end as mismatch_count

    union all

    select
        'character_reference_images.sheet_alias'::text as check_name,
        case
            when (select has_reference_images_reference_pack_id from column_state) then (
                select count(*)::bigint
                from character_reference_images
                where
                    (to_jsonb(character_reference_images)->>'character_sheet_id')
                        is distinct from (to_jsonb(character_reference_images)->>'reference_pack_id')
            )
            else 0::bigint
        end as mismatch_count

    union all

    select
        'character_generation_jobs.sheet_alias'::text as check_name,
        case
            when (select has_generation_jobs_reference_pack_id from column_state) then (
                select count(*)::bigint
                from character_generation_jobs
                where
                    (to_jsonb(character_generation_jobs)->>'character_sheet_id')
                        is distinct from (to_jsonb(character_generation_jobs)->>'reference_pack_id')
            )
            else 0::bigint
        end as mismatch_count

    union all

    select
        'characters.metadata_assignment_alias'::text as check_name,
        count(*)::bigint as mismatch_count
    from characters
    where
        (
            metadata ? 'character_sheet_assignments'
            and metadata ? 'reference_pack_assignments'
        )
        and metadata->'character_sheet_assignments'
            is distinct from metadata->'reference_pack_assignments'

    union all

    select
        'media_files.character_reference_metadata_alias'::text as check_name,
        count(*)::bigint as mismatch_count
    from media_files
    where source = 'character_reference'
      and coalesce(metadata->>'character_sheet_id', '') <> ''
      and coalesce(metadata->>'reference_pack_id', '') <> ''
      and metadata->>'character_sheet_id' is distinct from metadata->>'reference_pack_id'
)
select check_name, mismatch_count
from drift_counts
order by check_name;
