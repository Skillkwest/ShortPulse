-- Backfill media variant hint columns and dimension hints from existing metadata/variant rows.
-- Safe and idempotent: only fills missing values.

with metadata_dimensions as (
    select
        mf.id,
        case
            when coalesce(mf.metadata ->> 'width', '') ~ '^[0-9]+$'
                then (mf.metadata ->> 'width')::integer
            else null
        end as width_hint,
        case
            when coalesce(mf.metadata ->> 'height', '') ~ '^[0-9]+$'
                then (mf.metadata ->> 'height')::integer
            else null
        end as height_hint,
        case
            when coalesce(mf.metadata ->> 'duration_seconds', '') ~ '^[0-9]+([.][0-9]+)?$'
                then (mf.metadata ->> 'duration_seconds')::numeric
            else null
        end as duration_hint
    from media_files mf
)
update media_files mf
set
    width = coalesce(mf.width, md.width_hint),
    height = coalesce(mf.height, md.height_hint),
    duration_seconds = coalesce(mf.duration_seconds, md.duration_hint)
from metadata_dimensions md
where mf.id = md.id
  and (
      (mf.width is null and md.width_hint is not null)
      or (mf.height is null and md.height_hint is not null)
      or (mf.duration_seconds is null and md.duration_hint is not null)
  );

update media_files mf
set
    thumb_variant_path = coalesce(
        mf.thumb_variant_path,
        nullif(trim(mf.metadata #>> '{thumb_variant_path}'), ''),
        nullif(trim(mf.metadata #>> '{variant_paths,thumb}'), ''),
        nullif(trim(mf.metadata #>> '{variantPaths,thumb}'), '')
    ),
    poster_variant_path = coalesce(
        mf.poster_variant_path,
        nullif(trim(mf.metadata #>> '{poster_variant_path}'), ''),
        nullif(trim(mf.metadata #>> '{variant_paths,poster}'), ''),
        nullif(trim(mf.metadata #>> '{variantPaths,poster}'), '')
    ),
    preview_variant_path = coalesce(
        mf.preview_variant_path,
        nullif(trim(mf.metadata #>> '{preview_variant_path}'), ''),
        nullif(trim(mf.metadata #>> '{variant_paths,preview}'), ''),
        nullif(trim(mf.metadata #>> '{variantPaths,preview}'), '')
    )
where mf.thumb_variant_path is null
   or mf.poster_variant_path is null
   or mf.preview_variant_path is null;

with variant_hints as (
    select
        v.media_file_id,
        max(v.storage_path) filter (
            where v.status = 'ready' and v.variant_kind in ('thumb_240', 'thumb_480')
        ) as thumb_path,
        max(v.storage_path) filter (
            where v.status = 'ready' and v.variant_kind = 'poster_720'
        ) as poster_path,
        max(v.storage_path) filter (
            where v.status = 'ready' and v.variant_kind = 'preview_loop_360p'
        ) as preview_path
    from media_asset_variants v
    group by v.media_file_id
)
update media_files mf
set
    thumb_variant_path = coalesce(mf.thumb_variant_path, vh.thumb_path),
    poster_variant_path = coalesce(mf.poster_variant_path, vh.poster_path),
    preview_variant_path = coalesce(mf.preview_variant_path, vh.preview_path)
from variant_hints vh
where mf.id = vh.media_file_id
  and (
      (mf.thumb_variant_path is null and vh.thumb_path is not null)
      or (mf.poster_variant_path is null and vh.poster_path is not null)
      or (mf.preview_variant_path is null and vh.preview_path is not null)
  );

update media_files mf
set processing_status = 'ready'
where mf.processing_status <> 'failed'
  and (
      (
          lower(coalesce(mf.file_type, '')) like 'image%'
          and nullif(trim(coalesce(mf.thumb_variant_path, '')), '') is not null
      )
      or (
          lower(coalesce(mf.file_type, '')) like 'video%'
          and nullif(trim(coalesce(mf.poster_variant_path, '')), '') is not null
          and nullif(trim(coalesce(mf.preview_variant_path, '')), '') is not null
      )
  );
