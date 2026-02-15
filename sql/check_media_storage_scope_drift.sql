-- Media storage scope drift diagnostics.
-- Purpose: detect media_files rows that can point outside the owning user namespace.
-- Safe to run repeatedly; read-only.

with drift_counts as (
    select
        'media_files.storage_path_not_user_scoped'::text as check_name,
        count(*)::bigint as mismatch_count
    from media_files
    where coalesce(storage_path, '') <> ''
      and storage_path not like user_id::text || '/%'

    union all

    select
        'media_files.storage_path_traversal_segment'::text as check_name,
        count(*)::bigint as mismatch_count
    from media_files
    where coalesce(storage_path, '') ~ '(^|/)\.\.(/|$)'

    union all

    select
        'media_files.storage_path_backslash'::text as check_name,
        count(*)::bigint as mismatch_count
    from media_files
    where position(chr(92) in coalesce(storage_path, '')) > 0
)
select check_name, mismatch_count
from drift_counts
order by check_name;

-- Optional inspection query for follow-up triage:
-- select id, user_id, source, storage_path, created_at
-- from media_files
-- where coalesce(storage_path, '') <> ''
--   and (
--       storage_path not like user_id::text || '/%'
--       or storage_path ~ '(^|/)\.\.(/|$)'
--       or position(chr(92) in storage_path) > 0
--   )
-- order by created_at desc
-- limit 200;
