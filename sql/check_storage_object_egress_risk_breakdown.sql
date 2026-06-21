-- Storage object egress-risk breakdown.
-- Read-only diagnostic: no persistent schema or data changes.
--
-- Purpose:
--   Quantify storage.objects byte exposure by safe bucket/path class and
--   media-library tracking state without printing object names, user ids,
--   signed URLs, or secrets.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
--     -f sql/check_storage_object_egress_risk_breakdown.sql

with media_file_refs as (
    select
        trim(mf.storage_path) as storage_path,
        bool_or(true) as referenced_by_media_file,
        bool_or(false) as referenced_by_variant_row,
        bool_or(false) as referenced_by_variant_hint
    from public.media_files mf
    where mf.storage_path is not null
      and trim(mf.storage_path) <> ''
    group by trim(mf.storage_path)
),
media_file_variant_hints as (
    select trim(to_jsonb(mf)->>'thumb_variant_path') as storage_path
    from public.media_files mf
    where nullif(trim(coalesce(to_jsonb(mf)->>'thumb_variant_path', '')), '') is not null

    union all

    select trim(to_jsonb(mf)->>'poster_variant_path') as storage_path
    from public.media_files mf
    where nullif(trim(coalesce(to_jsonb(mf)->>'poster_variant_path', '')), '') is not null

    union all

    select trim(to_jsonb(mf)->>'preview_variant_path') as storage_path
    from public.media_files mf
    where nullif(trim(coalesce(to_jsonb(mf)->>'preview_variant_path', '')), '') is not null
),
media_variant_hint_refs as (
    select
        storage_path,
        bool_or(false) as referenced_by_media_file,
        bool_or(false) as referenced_by_variant_row,
        bool_or(true) as referenced_by_variant_hint
    from media_file_variant_hints
    where storage_path is not null
      and storage_path <> ''
    group by storage_path
),
media_asset_variant_refs as (
    select
        trim(mav.storage_path) as storage_path,
        bool_or(false) as referenced_by_media_file,
        bool_or(true) as referenced_by_variant_row,
        bool_or(false) as referenced_by_variant_hint
    from public.media_asset_variants mav
    where mav.storage_path is not null
      and trim(mav.storage_path) <> ''
    group by trim(mav.storage_path)
),
tracked_refs as (
    select
        storage_path,
        bool_or(referenced_by_media_file) as referenced_by_media_file,
        bool_or(referenced_by_variant_row) as referenced_by_variant_row,
        bool_or(referenced_by_variant_hint) as referenced_by_variant_hint
    from (
        select * from media_file_refs
        union all
        select * from media_variant_hint_refs
        union all
        select * from media_asset_variant_refs
    ) refs
    group by storage_path
),
storage_rows as (
    select
        o.bucket_id,
        trim(coalesce(o.name, '')) as storage_path,
        o.created_at,
        case
            when coalesce(o.metadata->>'size', '') ~ '^[0-9]+$'
                then (o.metadata->>'size')::numeric
            else null
        end as object_bytes
    from storage.objects o
),
classified as (
    select
        sr.bucket_id,
        case
            when sr.storage_path = '' then 'invalid_empty_path'
            when sr.bucket_id = 'media_library'
                 and split_part(sr.storage_path, '/', 1) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                then 'media_library/unscoped_or_invalid_user_prefix'
            when sr.bucket_id = 'media_library'
                 and sr.storage_path like split_part(sr.storage_path, '/', 1) || '/variants/%'
                then 'media_library/variants'
            when sr.bucket_id = 'media_library'
                 and sr.storage_path like split_part(sr.storage_path, '/', 1) || '/uploads/%/variants/%'
                then 'media_library/upload_variants'
            when sr.bucket_id = 'media_library'
                 and sr.storage_path like split_part(sr.storage_path, '/', 1) || '/generations/%/variants/%'
                then 'media_library/generation_variants'
            when sr.bucket_id = 'media_library'
                 and sr.storage_path like split_part(sr.storage_path, '/', 1) || '/generations/images/%'
                then 'media_library/generation_images'
            when sr.bucket_id = 'media_library'
                 and sr.storage_path like split_part(sr.storage_path, '/', 1) || '/generations/videos/%'
                then 'media_library/generation_videos'
            when sr.bucket_id = 'media_library'
                 and sr.storage_path like split_part(sr.storage_path, '/', 1) || '/generations/audio/%'
                then 'media_library/generation_audio'
            when sr.bucket_id = 'media_library'
                 and sr.storage_path like split_part(sr.storage_path, '/', 1) || '/uploads/images/%'
                then 'media_library/upload_images'
            when sr.bucket_id = 'media_library'
                 and sr.storage_path like split_part(sr.storage_path, '/', 1) || '/uploads/videos/%'
                then 'media_library/upload_videos'
            when sr.bucket_id = 'media_library'
                 and sr.storage_path like split_part(sr.storage_path, '/', 1) || '/uploads/audio/%'
                then 'media_library/upload_audio'
            when sr.bucket_id = 'media_library'
                 and sr.storage_path like split_part(sr.storage_path, '/', 1) || '/private/images/%'
                then 'media_library/private_images'
            when sr.bucket_id = 'media_library'
                 and sr.storage_path like split_part(sr.storage_path, '/', 1) || '/images/reference/%'
                then 'media_library/transient_image_reference'
            when sr.bucket_id = 'media_library'
                 and sr.storage_path like split_part(sr.storage_path, '/', 1) || '/videos/motion-control/%'
                then 'media_library/transient_motion_reference'
            when sr.bucket_id = 'media_library'
                 and sr.storage_path like split_part(sr.storage_path, '/', 1) || '/images/%'
                then 'media_library/legacy_images'
            when sr.bucket_id = 'media_library'
                 and sr.storage_path like split_part(sr.storage_path, '/', 1) || '/videos/%'
                then 'media_library/legacy_videos'
            when sr.bucket_id = 'media_library'
                 and sr.storage_path like split_part(sr.storage_path, '/', 1) || '/audio/%'
                then 'media_library/legacy_audio'
            when sr.bucket_id = 'media_library'
                 and sr.storage_path like split_part(sr.storage_path, '/', 1) || '/characters/%'
                then 'media_library/character_assets'
            when sr.bucket_id = 'media_library'
                then 'media_library/other_user_scoped'
            when sr.bucket_id = 'dashboard_tutorial_thumbnails'
                 and sr.storage_path like '%/display/%'
                then 'dashboard_tutorial_thumbnails/display_derivatives'
            when sr.bucket_id = 'dashboard_tutorial_thumbnails'
                 and sr.storage_path like '%/poster/%'
                then 'dashboard_tutorial_thumbnails/poster_derivatives'
            when sr.bucket_id = 'dashboard_tutorial_thumbnails'
                then 'dashboard_tutorial_thumbnails/source_or_other'
            else coalesce(sr.bucket_id, 'unknown_bucket') || '/unclassified'
        end as safe_path_class,
        case
            when sr.bucket_id <> 'media_library' then 'not_media_library'
            when coalesce(tr.referenced_by_media_file, false)
                 and coalesce(tr.referenced_by_variant_row, false)
                then 'tracked_original_and_variant'
            when coalesce(tr.referenced_by_media_file, false)
                then 'tracked_original'
            when coalesce(tr.referenced_by_variant_row, false)
                then 'tracked_variant_row'
            when coalesce(tr.referenced_by_variant_hint, false)
                then 'tracked_variant_hint_only'
            else 'untracked_by_media_tables'
        end as tracking_state,
        sr.object_bytes,
        sr.created_at
    from storage_rows sr
    left join tracked_refs tr
      on tr.storage_path = sr.storage_path
)
select
    bucket_id,
    safe_path_class,
    tracking_state,
    count(*)::bigint as object_count,
    count(*) filter (where object_bytes is null)::bigint as objects_missing_size_metadata,
    round(coalesce(sum(object_bytes), 0) / 1048576.0, 3) as total_mb,
    round(coalesce(avg(object_bytes), 0) / 1048576.0, 3) as avg_mb,
    round(coalesce(max(object_bytes), 0) / 1048576.0, 3) as max_mb,
    min(created_at) as oldest_object_created_at,
    max(created_at) as newest_object_created_at
from classified
group by bucket_id, safe_path_class, tracking_state
order by coalesce(sum(object_bytes), 0) desc, object_count desc, bucket_id asc, safe_path_class asc;
