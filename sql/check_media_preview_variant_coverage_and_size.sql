-- Diagnose Media Library preview performance risk by source class.
-- Read-only script: no persistent schema or data changes.

with normalized_media as (
    select
        mf.id,
        lower(coalesce(mf.source, 'unknown')) as source_class,
        case
            when lower(coalesce(mf.file_type, '')) like 'video%' then 'video'
            when lower(coalesce(mf.file_type, '')) like 'image%' then 'image'
            else 'other'
        end as media_kind,
        nullif(trim(coalesce(to_jsonb(mf)->>'thumb_variant_path', '')), '') as thumb_variant_path,
        nullif(trim(coalesce(to_jsonb(mf)->>'poster_variant_path', '')), '') as poster_variant_path,
        nullif(trim(coalesce(to_jsonb(mf)->>'preview_variant_path', '')), '') as preview_variant_path,
        case
            when coalesce(mf.file_size, 0) > 0 then mf.file_size
            when coalesce(mf.metadata->>'size', '') ~ '^[0-9]+$' then (mf.metadata->>'size')::bigint
            when coalesce(to_jsonb(mf)->>'size', '') ~ '^[0-9]+$' then (to_jsonb(mf)->>'size')::bigint
            else null
        end as effective_file_size
    from public.media_files mf
)
select
    source_class,
    media_kind,
    count(*) as total_rows
from normalized_media
where source_class in ('upload', 'private_upload', 'ai_studio')
  and media_kind in ('image', 'video')
group by source_class, media_kind
order by source_class asc, media_kind asc;

with normalized_media as (
    select
        lower(coalesce(mf.source, 'unknown')) as source_class,
        case
            when lower(coalesce(mf.file_type, '')) like 'video%' then 'video'
            when lower(coalesce(mf.file_type, '')) like 'image%' then 'image'
            else 'other'
        end as media_kind,
        nullif(trim(coalesce(to_jsonb(mf)->>'thumb_variant_path', '')), '') as thumb_variant_path,
        nullif(trim(coalesce(to_jsonb(mf)->>'poster_variant_path', '')), '') as poster_variant_path,
        nullif(trim(coalesce(to_jsonb(mf)->>'preview_variant_path', '')), '') as preview_variant_path
    from public.media_files mf
)
select
    source_class,
    media_kind,
    count(*) as total_rows,
    count(*) filter (where thumb_variant_path is not null) as with_thumb_variant,
    count(*) filter (where poster_variant_path is not null) as with_poster_variant,
    count(*) filter (where preview_variant_path is not null) as with_preview_variant,
    count(*) filter (
        where poster_variant_path is not null
          and preview_variant_path is not null
    ) as with_video_pair_variants,
    round(
        100.0 * count(*) filter (where thumb_variant_path is not null)::numeric
        / nullif(count(*), 0),
        2
    ) as thumb_variant_pct,
    round(
        100.0 * count(*) filter (
            where poster_variant_path is not null
              and preview_variant_path is not null
        )::numeric / nullif(count(*), 0),
        2
    ) as paired_video_variant_pct
from normalized_media
where source_class in ('upload', 'private_upload', 'ai_studio')
  and media_kind in ('image', 'video')
group by source_class, media_kind
order by source_class asc, media_kind asc;

with normalized_media as (
    select
        lower(coalesce(mf.source, 'unknown')) as source_class,
        case
            when lower(coalesce(mf.file_type, '')) like 'video%' then 'video'
            when lower(coalesce(mf.file_type, '')) like 'image%' then 'image'
            else 'other'
        end as media_kind,
        case
            when coalesce(mf.file_size, 0) > 0 then mf.file_size
            when coalesce(mf.metadata->>'size', '') ~ '^[0-9]+$' then (mf.metadata->>'size')::bigint
            when coalesce(to_jsonb(mf)->>'size', '') ~ '^[0-9]+$' then (to_jsonb(mf)->>'size')::bigint
            else null
        end as effective_file_size
    from public.media_files mf
)
select
    source_class,
    media_kind,
    count(*) as rows_with_size,
    percentile_cont(0.5) within group (order by effective_file_size)::bigint as p50_bytes,
    percentile_cont(0.9) within group (order by effective_file_size)::bigint as p90_bytes
from normalized_media
where source_class in ('upload', 'private_upload', 'ai_studio')
  and media_kind in ('image', 'video')
  and effective_file_size is not null
group by source_class, media_kind
order by source_class asc, media_kind asc;
