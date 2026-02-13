-- Character Sheet alias drift diagnostics.
-- Purpose: detect mismatch between canonical character_sheet_* fields and
-- legacy reference_pack_* aliases during the compatibility window.
-- Safe to run repeatedly; read-only.

with drift_counts as (
    select
        'characters.active_sheet_alias'::text as check_name,
        count(*)::bigint as mismatch_count
    from characters
    where active_character_sheet_id is distinct from active_reference_pack_id

    union all

    select
        'character_reference_images.sheet_alias'::text as check_name,
        count(*)::bigint as mismatch_count
    from character_reference_images
    where character_sheet_id is distinct from reference_pack_id

    union all

    select
        'character_generation_jobs.sheet_alias'::text as check_name,
        count(*)::bigint as mismatch_count
    from character_generation_jobs
    where character_sheet_id is distinct from reference_pack_id

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

