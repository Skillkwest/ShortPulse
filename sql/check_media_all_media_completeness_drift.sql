-- Diagnose durable storage objects that should appear in All Media but are missing media_files rows.
-- Read-only diagnostic: only temporary tables are created.

create temporary table if not exists _media_drift_064_variant_paths (
    user_id uuid not null,
    storage_path text not null
) on commit drop;

truncate table _media_drift_064_variant_paths;

do $$
begin
    if to_regclass('public.media_asset_variants') is not null then
        execute $sql$
            insert into _media_drift_064_variant_paths (user_id, storage_path)
            select
                mav.user_id,
                trim(mav.storage_path)
            from public.media_asset_variants mav
            where mav.storage_path is not null
              and trim(mav.storage_path) <> '';
        $sql$;
    end if;

    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'media_files'
          and column_name = 'thumb_variant_path'
    ) then
        execute $sql$
            insert into _media_drift_064_variant_paths (user_id, storage_path)
            select
                mf.user_id,
                trim(mf.thumb_variant_path)
            from public.media_files mf
            where mf.thumb_variant_path is not null
              and trim(mf.thumb_variant_path) <> '';
        $sql$;
    end if;

    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'media_files'
          and column_name = 'poster_variant_path'
    ) then
        execute $sql$
            insert into _media_drift_064_variant_paths (user_id, storage_path)
            select
                mf.user_id,
                trim(mf.poster_variant_path)
            from public.media_files mf
            where mf.poster_variant_path is not null
              and trim(mf.poster_variant_path) <> '';
        $sql$;
    end if;

    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'media_files'
          and column_name = 'preview_variant_path'
    ) then
        execute $sql$
            insert into _media_drift_064_variant_paths (user_id, storage_path)
            select
                mf.user_id,
                trim(mf.preview_variant_path)
            from public.media_files mf
            where mf.preview_variant_path is not null
              and trim(mf.preview_variant_path) <> '';
        $sql$;
    end if;
end;
$$;

create temporary table if not exists _media_drift_064_missing_candidates (
    object_id uuid not null,
    user_id uuid not null,
    storage_path text not null,
    object_created_at timestamptz null,
    durable_class text not null,
    inferred_source text not null,
    inferred_file_type text not null
) on commit drop;

truncate table _media_drift_064_missing_candidates;

insert into _media_drift_064_missing_candidates (
    object_id,
    user_id,
    storage_path,
    object_created_at,
    durable_class,
    inferred_source,
    inferred_file_type
)
with raw_objects as (
    select
        o.id as object_id,
        trim(o.name) as storage_path,
        split_part(trim(o.name), '/', 1) as user_id_text,
        o.created_at as object_created_at
    from storage.objects o
    where o.bucket_id = 'media_library'
      and o.name is not null
      and trim(o.name) <> ''
      and trim(o.name) not like '%/'
      and position('/' in trim(o.name)) > 0
), scoped_objects as (
    select
        ro.object_id,
        ro.storage_path,
        case
            when ro.user_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                then ro.user_id_text::uuid
            else null
        end as user_id,
        ro.object_created_at
    from raw_objects ro
), classified_objects as (
    select
        so.*,
        case
            when so.user_id is null then null
            when so.storage_path like so.user_id::text || '/private/images/%' then 'private_images'
            when so.storage_path like so.user_id::text || '/uploads/images/%' then 'uploads_images'
            when so.storage_path like so.user_id::text || '/images/%' then 'legacy_images'
            when so.storage_path like so.user_id::text || '/uploads/videos/%' then 'uploads_videos'
            when so.storage_path like so.user_id::text || '/videos/%' then 'legacy_videos'
            when so.storage_path like so.user_id::text || '/generations/images/%' then 'generations_images'
            when so.storage_path like so.user_id::text || '/generations/videos/%' then 'generations_videos'
            else null
        end as durable_class,
        (
            so.storage_path like so.user_id::text || '/images/reference/%'
            or so.storage_path like so.user_id::text || '/videos/motion-control/%'
        ) as is_transient_path,
        (so.storage_path like so.user_id::text || '/characters/%') as is_character_path,
        (
            so.storage_path like so.user_id::text || '/variants/%'
            or so.storage_path like so.user_id::text || '/uploads/%/variants/%'
            or so.storage_path like so.user_id::text || '/generations/%/variants/%'
        ) as is_known_variant_path
    from scoped_objects so
)
select
    co.object_id,
    co.user_id,
    co.storage_path,
    co.object_created_at,
    co.durable_class,
    case
        when co.durable_class = 'private_images' then 'private_upload'
        when co.durable_class in ('generations_images', 'generations_videos') then 'ai_studio'
        else 'upload'
    end as inferred_source,
    case
        when co.durable_class in ('uploads_videos', 'legacy_videos', 'generations_videos')
            then 'video'
        else 'image'
    end as inferred_file_type
from classified_objects co
left join public.media_files existing
  on existing.user_id = co.user_id
 and existing.storage_path = co.storage_path
left join (
    select distinct
        vp.user_id,
        vp.storage_path
    from _media_drift_064_variant_paths vp
    where vp.storage_path <> ''
) variant_path
  on variant_path.user_id = co.user_id
 and variant_path.storage_path = co.storage_path
where co.user_id is not null
  and co.durable_class is not null
  and co.is_transient_path = false
  and co.is_character_path = false
  and co.is_known_variant_path = false
  and variant_path.storage_path is null
  and existing.id is null;

select
    durable_class,
    inferred_source,
    inferred_file_type,
    count(*) as missing_count
from _media_drift_064_missing_candidates
group by durable_class, inferred_source, inferred_file_type
order by missing_count desc, durable_class asc;

select
    user_id,
    storage_path,
    durable_class,
    inferred_source,
    inferred_file_type,
    object_created_at
from _media_drift_064_missing_candidates
order by object_created_at desc nulls last, user_id asc, storage_path asc
limit 200;
