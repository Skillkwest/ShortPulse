-- Media storage scope drift diagnostics.
-- Purpose: detect storage paths that can point outside the owning user namespace.
-- Safe to run repeatedly; read-only.
-- Canonical remediation/run-order SOP: docs/sops/sop_sql_migration_operations.md

create temporary table if not exists media_storage_scope_drift_counts (
    check_name text primary key,
    mismatch_count bigint not null
) on commit drop;

truncate table media_storage_scope_drift_counts;

insert into media_storage_scope_drift_counts (check_name, mismatch_count)
select
    'media_files.storage_path_empty'::text as check_name,
    count(*)::bigint as mismatch_count
from media_files
where coalesce(storage_path, '') = ''

union all

select
    'media_files.storage_path_not_user_scoped'::text as check_name,
    count(*)::bigint as mismatch_count
from media_files
where coalesce(storage_path, '') <> ''
  and storage_path not like user_id::text || '/%'

union all

select
    'media_files.storage_path_leading_slash'::text as check_name,
    count(*)::bigint as mismatch_count
from media_files
where storage_path like '/%'

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
where position(chr(92) in coalesce(storage_path, '')) > 0;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'media_files'
          and column_name = 'thumb_variant_path'
    ) and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'media_files'
          and column_name = 'poster_variant_path'
    ) and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'media_files'
          and column_name = 'preview_variant_path'
    ) then
        execute $sql$
            insert into media_storage_scope_drift_counts (check_name, mismatch_count)
            select
                'media_files.variant_hint_invalid_shape'::text as check_name,
                count(*)::bigint as mismatch_count
            from media_files
            where
                (thumb_variant_path is not null and (
                    thumb_variant_path = ''
                    or thumb_variant_path not like user_id::text || '/%'
                    or thumb_variant_path like '/%'
                    or position(chr(92) in thumb_variant_path) > 0
                    or thumb_variant_path ~ '(^|/)\.\.(/|$)'
                ))
                or (poster_variant_path is not null and (
                    poster_variant_path = ''
                    or poster_variant_path not like user_id::text || '/%'
                    or poster_variant_path like '/%'
                    or position(chr(92) in poster_variant_path) > 0
                    or poster_variant_path ~ '(^|/)\.\.(/|$)'
                ))
                or (preview_variant_path is not null and (
                    preview_variant_path = ''
                    or preview_variant_path not like user_id::text || '/%'
                    or preview_variant_path like '/%'
                    or position(chr(92) in preview_variant_path) > 0
                    or preview_variant_path ~ '(^|/)\.\.(/|$)'
                ));
        $sql$;
    end if;

    if to_regclass('public.media_asset_variants') is not null then
        execute $sql$
            insert into media_storage_scope_drift_counts (check_name, mismatch_count)
            select
                'media_asset_variants.storage_path_invalid_shape'::text as check_name,
                count(*)::bigint as mismatch_count
            from media_asset_variants
            where
                coalesce(storage_path, '') = ''
                or storage_path not like user_id::text || '/%'
                or storage_path like '/%'
                or position(chr(92) in storage_path) > 0
                or storage_path ~ '(^|/)\.\.(/|$)';
        $sql$;
    end if;
end;
$$;

select check_name, mismatch_count
from media_storage_scope_drift_counts
order by check_name;

-- Optional inspection query for follow-up triage (media_files.storage_path):
-- select id, user_id, source, storage_path, created_at
-- from media_files
-- where (
--       coalesce(storage_path, '') = ''
--       or storage_path not like user_id::text || '/%'
--       or storage_path like '/%'
--       or storage_path ~ '(^|/)\.\.(/|$)'
--       or position(chr(92) in storage_path) > 0
--   )
-- order by created_at desc
-- limit 200;

-- Optional inspection query for variant hints (run only if hint columns exist):
-- select id, user_id, file_type, thumb_variant_path, poster_variant_path, preview_variant_path, created_at
-- from media_files
-- where
--     (thumb_variant_path is not null and (
--         thumb_variant_path = ''
--         or thumb_variant_path not like user_id::text || '/%'
--         or thumb_variant_path like '/%'
--         or position(chr(92) in thumb_variant_path) > 0
--         or thumb_variant_path ~ '(^|/)\.\.(/|$)'
--     ))
--     or (poster_variant_path is not null and (
--         poster_variant_path = ''
--         or poster_variant_path not like user_id::text || '/%'
--         or poster_variant_path like '/%'
--         or position(chr(92) in poster_variant_path) > 0
--         or poster_variant_path ~ '(^|/)\.\.(/|$)'
--     ))
--     or (preview_variant_path is not null and (
--         preview_variant_path = ''
--         or preview_variant_path not like user_id::text || '/%'
--         or preview_variant_path like '/%'
--         or position(chr(92) in preview_variant_path) > 0
--         or preview_variant_path ~ '(^|/)\.\.(/|$)'
--     ))
-- order by created_at desc
-- limit 200;

-- Optional inspection query for media_asset_variants (run only if table exists):
-- select id, media_file_id, user_id, variant_kind, storage_path, status, created_at
-- from media_asset_variants
-- where
--     coalesce(storage_path, '') = ''
--     or storage_path not like user_id::text || '/%'
--     or storage_path like '/%'
--     or position(chr(92) in storage_path) > 0
--     or storage_path ~ '(^|/)\.\.(/|$)'
-- order by created_at desc
-- limit 200;
