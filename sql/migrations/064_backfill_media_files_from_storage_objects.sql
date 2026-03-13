-- Backfill missing durable media_files rows from storage.objects for All Media completeness.
-- Idempotent insert semantics: only inserts when (user_id, storage_path) is absent.
-- Excludes transient paths, character paths, and known/linked variant objects.

create temporary table if not exists _media_backfill_064_variant_paths (
    user_id uuid not null,
    storage_path text not null
) on commit drop;

truncate table _media_backfill_064_variant_paths;

do $$
begin
    if to_regclass('public.media_asset_variants') is not null then
        execute $sql$
            insert into _media_backfill_064_variant_paths (user_id, storage_path)
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
            insert into _media_backfill_064_variant_paths (user_id, storage_path)
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
            insert into _media_backfill_064_variant_paths (user_id, storage_path)
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
            insert into _media_backfill_064_variant_paths (user_id, storage_path)
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

with raw_objects as (
    select
        o.id as object_id,
        trim(o.name) as storage_path,
        split_part(trim(o.name), '/', 1) as user_id_text,
        o.created_at as object_created_at,
        coalesce(o.metadata, '{}'::jsonb) as object_metadata
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
        ro.user_id_text,
        case
            when ro.user_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                then ro.user_id_text::uuid
            else null
        end as user_id,
        ro.object_created_at,
        ro.object_metadata
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
), missing_candidates as (
    select
        co.object_id,
        co.user_id,
        co.storage_path,
        co.object_created_at,
        co.object_metadata,
        case
            when co.durable_class in ('private_images', 'uploads_images', 'legacy_images', 'generations_images')
                then 'image'
            when co.durable_class in ('uploads_videos', 'legacy_videos', 'generations_videos')
                then 'video'
            else null
        end as inferred_file_type,
        case
            when co.durable_class = 'private_images' then 'private_upload'
            when co.durable_class in ('generations_images', 'generations_videos') then 'ai_studio'
            when co.durable_class is not null then 'upload'
            else null
        end as inferred_source,
        case
            when coalesce(co.object_metadata->>'size', '') ~ '^[0-9]+$'
                then (co.object_metadata->>'size')::bigint
            else null
        end as inferred_file_size
    from classified_objects co
    left join public.media_files existing
      on existing.user_id = co.user_id
     and existing.storage_path = co.storage_path
    left join auth.users existing_user
      on existing_user.id = co.user_id
    left join (
        select distinct
            vp.user_id,
            vp.storage_path
        from _media_backfill_064_variant_paths vp
        where vp.storage_path <> ''
    ) variant_path
      on variant_path.user_id = co.user_id
     and variant_path.storage_path = co.storage_path
    where co.user_id is not null
      and existing_user.id is not null
      and co.durable_class is not null
      and co.is_transient_path = false
      and co.is_character_path = false
      and co.is_known_variant_path = false
      and variant_path.storage_path is null
      and existing.id is null
), deduped_candidates as (
    select distinct on (mc.user_id, mc.storage_path)
        mc.object_id,
        mc.user_id,
        mc.storage_path,
        mc.object_created_at,
        mc.inferred_file_type,
        mc.inferred_source,
        mc.inferred_file_size
    from missing_candidates mc
    order by mc.user_id, mc.storage_path, mc.object_created_at desc, mc.object_id desc
)
insert into public.media_files (
    user_id,
    filename,
    storage_path,
    file_type,
    file_size,
    source,
    source_ref,
    prompt_id,
    metadata,
    created_at,
    updated_at
)
select
    dc.user_id,
    coalesce(
        nullif(regexp_replace(dc.storage_path, '^.*/', ''), ''),
        'backfill-' || left(dc.object_id::text, 12)
    ) as filename,
    dc.storage_path,
    dc.inferred_file_type,
    dc.inferred_file_size,
    dc.inferred_source,
    null::uuid as source_ref,
    null::uuid as prompt_id,
    jsonb_strip_nulls(
        jsonb_build_object(
            'backfill_migration', '064_backfill_media_files_from_storage_objects',
            'backfill_storage_object_id', dc.object_id::text,
            'backfill_storage_object_created_at', dc.object_created_at
        )
    ) as metadata,
    coalesce(dc.object_created_at, timezone('utc', now())) as created_at,
    coalesce(dc.object_created_at, timezone('utc', now())) as updated_at
from deduped_candidates dc
where not exists (
    select 1
    from public.media_files existing
    where existing.user_id = dc.user_id
      and existing.storage_path = dc.storage_path
);
