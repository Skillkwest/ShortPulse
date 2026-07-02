-- Keep media storage lifecycle diagnostics lintable by avoiding temp-table references.
-- Supabase linked lint parses function bodies without executing temp-table setup first.

create or replace function public.get_media_storage_lifecycle_summary(
    p_cleanup_ttl_days integer default 7
)
returns table (
    manifest_action text,
    manifest_reason text,
    safe_path_class text,
    object_count bigint,
    objects_missing_size_metadata bigint,
    total_mb numeric,
    oldest_object_created_at timestamptz,
    newest_object_created_at timestamptz,
    youngest_age_days integer,
    oldest_age_days integer,
    cleanup_ttl_days integer
)
language sql
security definer
set search_path = public, storage
as $$
with settings as (
    select least(greatest(coalesce(p_cleanup_ttl_days, 7), 1), 90)::integer as cleanup_ttl_days
),
storage_rows as (
    select
        o.id as object_id,
        o.bucket_id,
        btrim(coalesce(o.name, '')) as storage_path,
        o.created_at,
        case
            when coalesce(o.metadata->>'size', '') ~ '^[0-9]+$'
                then (o.metadata->>'size')::numeric
            else null::numeric
        end as object_bytes,
        split_part(btrim(coalesce(o.name, '')), '/', 1) as user_id_text,
        (
            coalesce(o.bucket_id = 'media_library', false)
            and split_part(btrim(coalesce(o.name, '')), '/', 1) ~*
                '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        ) as has_valid_media_user_prefix,
        floor(extract(epoch from (now() - o.created_at)) / 86400)::integer as age_days,
        (o.created_at < now() - make_interval(days => s.cleanup_ttl_days)) as older_than_ttl,
        s.cleanup_ttl_days
    from storage.objects o
    cross join settings s
),
classified_storage_rows as (
    select
        sr.object_id,
        sr.bucket_id,
        sr.storage_path,
        sr.created_at,
        sr.object_bytes,
        sr.user_id_text,
        sr.has_valid_media_user_prefix,
        case
            when sr.storage_path = '' then 'invalid_empty_path'
            when sr.bucket_id is distinct from 'media_library'
                then coalesce(sr.bucket_id, 'unknown_bucket') || '/out_of_scope'
            when sr.has_valid_media_user_prefix is not true
                then 'media_library/unscoped_or_invalid_user_prefix'
            when sr.storage_path like sr.user_id_text || '/upload-staging/images/reference/%'
                then 'media_library/upload_staging_reference_image'
            when sr.storage_path like sr.user_id_text || '/upload-staging/videos/reference/%'
                then 'media_library/upload_staging_reference_video'
            when sr.storage_path like sr.user_id_text || '/upload-staging/videos/motion-control/%'
                then 'media_library/upload_staging_motion_reference'
            when sr.storage_path like sr.user_id_text || '/upload-staging/product-image-assets/%'
                then 'media_library/upload_staging_product_image_asset'
            when sr.storage_path like sr.user_id_text || '/upload-staging/%'
                then 'media_library/upload_staging_other'
            when sr.storage_path like sr.user_id_text || '/variants/%'
                then 'media_library/variants'
            when sr.storage_path like sr.user_id_text || '/uploads/%/variants/%'
                then 'media_library/upload_variants'
            when sr.storage_path like sr.user_id_text || '/generations/%/variants/%'
                then 'media_library/generation_variants'
            when sr.storage_path like sr.user_id_text || '/generations/images/%'
                then 'media_library/generation_images'
            when sr.storage_path like sr.user_id_text || '/generations/videos/%'
                then 'media_library/generation_videos'
            when sr.storage_path like sr.user_id_text || '/generations/audio/%'
                then 'media_library/generation_audio'
            when sr.storage_path like sr.user_id_text || '/uploads/images/%'
                then 'media_library/upload_images'
            when sr.storage_path like sr.user_id_text || '/uploads/videos/%'
                then 'media_library/upload_videos'
            when sr.storage_path like sr.user_id_text || '/uploads/audio/%'
                then 'media_library/upload_audio'
            when sr.storage_path like sr.user_id_text || '/private/images/%'
                then 'media_library/private_images'
            when sr.storage_path like sr.user_id_text || '/images/reference/%'
                then 'media_library/transient_image_reference'
            when sr.storage_path like sr.user_id_text || '/videos/motion-control/%'
                then 'media_library/transient_motion_reference'
            when sr.storage_path like sr.user_id_text || '/voice-changer/source-audio/%'
                then 'media_library/voice_changer_source_audio'
            when sr.storage_path like sr.user_id_text || '/voice-changer/staged-audio/%'
                then 'media_library/voice_changer_staged_audio'
            when sr.storage_path like sr.user_id_text || '/voice-changer/source-video/%'
                then 'media_library/voice_changer_source_video'
            when sr.storage_path like sr.user_id_text || '/voice-clone/source-audio/%'
                then 'media_library/voice_clone_source_audio'
            when sr.storage_path like sr.user_id_text || '/characters/%'
                then 'media_library/character_assets'
            when sr.storage_path like sr.user_id_text || '/elements/%'
                then 'media_library/element_assets'
            when sr.storage_path like sr.user_id_text || '/images/%'
                then 'media_library/legacy_images'
            when sr.storage_path like sr.user_id_text || '/videos/%'
                then 'media_library/legacy_videos'
            when sr.storage_path like sr.user_id_text || '/audio/%'
                then 'media_library/legacy_audio'
            else 'media_library/other_user_scoped'
        end as safe_path_class,
        sr.age_days,
        sr.older_than_ttl,
        sr.cleanup_ttl_days
    from storage_rows sr
),
refs as (
    select mf.user_id, btrim(mf.storage_path) as storage_path, 'media_files.storage_path'::text as ref_source, true as blocks_cleanup, null::timestamptz as retention_until
    from public.media_files mf
    where nullif(btrim(coalesce(mf.storage_path, '')), '') is not null

    union all

    select mf.user_id, btrim(ref.storage_path) as storage_path, ref.ref_source, true as blocks_cleanup, null::timestamptz as retention_until
    from public.media_files mf
    cross join lateral (
        values
            (mf.thumb_variant_path, 'media_files.thumb_variant_path'),
            (mf.poster_variant_path, 'media_files.poster_variant_path'),
            (mf.preview_variant_path, 'media_files.preview_variant_path')
    ) as ref(storage_path, ref_source)
    where nullif(btrim(coalesce(ref.storage_path, '')), '') is not null

    union all

    select mav.user_id, btrim(mav.storage_path) as storage_path, 'media_asset_variants.storage_path'::text as ref_source, true as blocks_cleanup, null::timestamptz as retention_until
    from public.media_asset_variants mav
    where nullif(btrim(coalesce(mav.storage_path, '')), '') is not null

    union all

    select gp.user_id, btrim(ref.storage_path) as storage_path, ref.ref_source, true as blocks_cleanup, null::timestamptz as retention_until
    from public.generation_projection gp
    cross join lateral (
        values
            (gp.preview_storage_path, 'generation_projection.preview_storage_path'),
            (gp.full_storage_path, 'generation_projection.full_storage_path'),
            (gp.companion_art_storage_path, 'generation_projection.companion_art_storage_path')
    ) as ref(storage_path, ref_source)
    where nullif(btrim(coalesce(ref.storage_path, '')), '') is not null

    union all

    select gp.user_id, btrim(ref.storage_path) as storage_path, ref.ref_source, true as blocks_cleanup, null::timestamptz as retention_until
    from public.generation_publications gp
    cross join lateral (
        values
            (gp.preview_storage_path, 'generation_publications.preview_storage_path'),
            (gp.full_storage_path, 'generation_publications.full_storage_path')
    ) as ref(storage_path, ref_source)
    where nullif(btrim(coalesce(ref.storage_path, '')), '') is not null

    union all

    select podi.user_id, btrim(ref.storage_path) as storage_path, ref.ref_source, true as blocks_cleanup, null::timestamptz as retention_until
    from public.project_output_display_items podi
    cross join lateral (
        values
            (podi.preview_storage_path, 'project_output_display_items.preview_storage_path'),
            (podi.full_storage_path, 'project_output_display_items.full_storage_path'),
            (podi.preview_poster_storage_path, 'project_output_display_items.preview_poster_storage_path'),
            (podi.companion_art_storage_path, 'project_output_display_items.companion_art_storage_path')
    ) as ref(storage_path, ref_source)
    where nullif(btrim(coalesce(ref.storage_path, '')), '') is not null

    union all

    select cma.user_id, btrim(cma.storage_path) as storage_path, 'character_media_assets.storage_path'::text as ref_source, true as blocks_cleanup, null::timestamptz as retention_until
    from public.character_media_assets cma
    where nullif(btrim(coalesce(cma.storage_path, '')), '') is not null

    union all

    select ema.user_id, btrim(ema.storage_path) as storage_path, 'element_media_assets.storage_path'::text as ref_source, true as blocks_cleanup, null::timestamptz as retention_until
    from public.element_media_assets ema
    where nullif(btrim(coalesce(ema.storage_path, '')), '') is not null

    union all

    select uocv.user_id, btrim(uocv.sample_storage_path) as storage_path, 'user_owned_custom_voices.sample_storage_path'::text as ref_source, true as blocks_cleanup, null::timestamptz as retention_until
    from public.user_owned_custom_voices uocv
    where nullif(btrim(coalesce(uocv.sample_storage_path, '')), '') is not null

    union all

    select
        ml.user_id,
        btrim(ml.storage_path) as storage_path,
        case
            when ml.released_at is null then 'motion_reference_video_generation_leases.active'
            else 'motion_reference_video_generation_leases.released'
        end as ref_source,
        (ml.released_at is null) as blocks_cleanup,
        null::timestamptz as retention_until
    from public.motion_reference_video_generation_leases ml
    where nullif(btrim(coalesce(ml.storage_path, '')), '') is not null

    union all

    select
        mr.user_id,
        btrim(mr.storage_path) as storage_path,
        case
            when mr.deleted_at is null then 'motion_reference_video_retirements.pending'
            else 'motion_reference_video_retirements.deleted'
        end as ref_source,
        false as blocks_cleanup,
        null::timestamptz as retention_until
    from public.motion_reference_video_retirements mr
    where nullif(btrim(coalesce(mr.storage_path, '')), '') is not null

    union all

    select
        vsl.user_id,
        btrim(vsl.storage_path) as storage_path,
        'voice_source_lifecycle.' || vsl.lifecycle_state as ref_source,
        (
            vsl.lifecycle_state = 'submitted'
            or vsl.retention_until is null
            or vsl.retention_until >= now()
        ) as blocks_cleanup,
        vsl.retention_until
    from public.voice_source_lifecycle vsl
    where nullif(btrim(coalesce(vsl.storage_path, '')), '') is not null
),
ref_summary as (
    select
        r.storage_path,
        count(*)::bigint as reference_count,
        count(*) filter (where r.blocks_cleanup)::bigint as blocking_reference_count,
        count(*) filter (
            where r.ref_source = 'motion_reference_video_generation_leases.active'
        )::bigint as active_motion_lease_count,
        count(*) filter (
            where r.ref_source = 'motion_reference_video_retirements.pending'
        )::bigint as pending_motion_retirement_count,
        count(*) filter (
            where r.ref_source like 'voice_source_lifecycle.%'
        )::bigint as voice_source_lifecycle_count,
        count(*) filter (
            where r.ref_source = 'voice_source_lifecycle.submitted'
        )::bigint as active_voice_source_lifecycle_count,
        count(*) filter (
            where r.ref_source in (
                'voice_source_lifecycle.terminal_success',
                'voice_source_lifecycle.terminal_failure',
                'voice_source_lifecycle.retained_for_custom_voice'
            )
        )::bigint as terminal_voice_source_lifecycle_count,
        count(*) filter (
            where r.ref_source like 'voice_source_lifecycle.%'
              and r.retention_until is not null
              and r.retention_until < now()
        )::bigint as expired_voice_source_lifecycle_count,
        max(r.retention_until) filter (
            where r.ref_source like 'voice_source_lifecycle.%'
        ) as voice_source_retention_until,
        string_agg(distinct r.ref_source, ', ' order by r.ref_source) as reference_sources
    from refs r
    group by r.storage_path
),
classified as (
    select
        sr.*,
        coalesce(rs.reference_count, 0) as reference_count,
        coalesce(rs.blocking_reference_count, 0) as blocking_reference_count,
        coalesce(rs.active_motion_lease_count, 0) as active_motion_lease_count,
        coalesce(rs.pending_motion_retirement_count, 0) as pending_motion_retirement_count,
        coalesce(rs.voice_source_lifecycle_count, 0) as voice_source_lifecycle_count,
        coalesce(rs.active_voice_source_lifecycle_count, 0)
            as active_voice_source_lifecycle_count,
        coalesce(rs.terminal_voice_source_lifecycle_count, 0)
            as terminal_voice_source_lifecycle_count,
        coalesce(rs.expired_voice_source_lifecycle_count, 0)
            as expired_voice_source_lifecycle_count,
        rs.voice_source_retention_until,
        coalesce(rs.reference_sources, '') as reference_sources
    from classified_storage_rows sr
    left join ref_summary rs
      on rs.storage_path = sr.storage_path
),
manifest as (
    select
        c.*,
        case
            when c.bucket_id is distinct from 'media_library' then 'out_of_scope_bucket'
            when c.storage_path = ''
              or c.has_valid_media_user_prefix is not true then 'integrity_problem'
            when c.blocking_reference_count > 0 then 'protected_referenced'
            when c.safe_path_class in (
                'media_library/generation_images',
                'media_library/generation_videos',
                'media_library/generation_audio',
                'media_library/variants',
                'media_library/upload_variants',
                'media_library/generation_variants',
                'media_library/upload_images',
                'media_library/upload_videos',
                'media_library/upload_audio',
                'media_library/private_images',
                'media_library/legacy_images',
                'media_library/legacy_videos',
                'media_library/legacy_audio',
                'media_library/character_assets',
                'media_library/element_assets',
                'media_library/other_user_scoped'
            ) then 'protected_durable_or_ambiguous'
            when c.safe_path_class in (
                'media_library/voice_changer_source_audio',
                'media_library/voice_changer_staged_audio',
                'media_library/voice_changer_source_video',
                'media_library/voice_clone_source_audio'
            )
              and c.voice_source_lifecycle_count > 0
              and c.terminal_voice_source_lifecycle_count > 0
              and c.expired_voice_source_lifecycle_count = c.voice_source_lifecycle_count
              and c.voice_source_retention_until < now()
                then 'delete_candidate'
            when c.safe_path_class in (
                'media_library/voice_changer_source_audio',
                'media_library/voice_changer_staged_audio',
                'media_library/voice_changer_source_video',
                'media_library/voice_clone_source_audio'
            ) then 'manual_review_required'
            when c.safe_path_class = 'media_library/transient_motion_reference'
              and c.active_motion_lease_count = 0
              and c.pending_motion_retirement_count > 0
              and c.older_than_ttl
                then 'delete_candidate'
            when c.safe_path_class = 'media_library/transient_motion_reference'
                then 'manual_review_required'
            when c.safe_path_class in (
                'media_library/upload_staging_reference_image',
                'media_library/upload_staging_reference_video',
                'media_library/upload_staging_motion_reference',
                'media_library/upload_staging_product_image_asset',
                'media_library/upload_staging_other',
                'media_library/transient_image_reference'
            )
              and c.reference_count = 0
              and c.older_than_ttl
                then 'delete_candidate'
            when c.safe_path_class in (
                'media_library/upload_staging_reference_image',
                'media_library/upload_staging_reference_video',
                'media_library/upload_staging_motion_reference',
                'media_library/upload_staging_product_image_asset',
                'media_library/upload_staging_other',
                'media_library/transient_image_reference'
            ) then 'manual_review_required'
            else 'manual_review_required'
        end as manifest_action,
        case
            when c.bucket_id is distinct from 'media_library' then 'not media_library'
            when c.storage_path = '' then 'empty storage path'
            when c.has_valid_media_user_prefix is not true then 'invalid media_library user prefix'
            when c.blocking_reference_count > 0 then 'blocking references: ' || c.reference_sources
            when c.safe_path_class = 'media_library/transient_motion_reference'
              and c.active_motion_lease_count = 0
              and c.pending_motion_retirement_count > 0
                then 'retired motion reference with no active lease and older than TTL'
            when c.safe_path_class like 'media_library/upload_staging_%'
              and c.reference_count = 0
                then 'unreferenced staged upload older than TTL'
            when c.safe_path_class = 'media_library/transient_image_reference'
              and c.reference_count = 0
                then 'unreferenced transient reference image older than TTL'
            when c.safe_path_class in (
                'media_library/voice_changer_source_audio',
                'media_library/voice_changer_staged_audio',
                'media_library/voice_changer_source_video',
                'media_library/voice_clone_source_audio'
            )
              and c.voice_source_lifecycle_count > 0
              and c.terminal_voice_source_lifecycle_count > 0
              and c.expired_voice_source_lifecycle_count = c.voice_source_lifecycle_count
                then 'voice source lifecycle retention elapsed'
            when c.safe_path_class in (
                'media_library/voice_changer_source_audio',
                'media_library/voice_changer_staged_audio',
                'media_library/voice_changer_source_video',
                'media_library/voice_clone_source_audio'
            )
              and c.voice_source_lifecycle_count > 0
                then 'voice source lifecycle proof exists but retention is active'
            when c.safe_path_class in (
                'media_library/voice_changer_source_audio',
                'media_library/voice_changer_staged_audio',
                'media_library/voice_changer_source_video',
                'media_library/voice_clone_source_audio'
            ) then 'voice source namespace requires workflow/custom-voice review'
            else 'protected or ambiguous storage class'
        end as manifest_reason
    from classified c
),
grouped_manifest as (
    select
        m.manifest_action,
        m.manifest_reason,
        m.safe_path_class,
        count(*)::bigint as object_count,
        count(*) filter (where m.object_bytes is null)::bigint as objects_missing_size_metadata,
        round(coalesce(sum(m.object_bytes), 0) / 1048576.0, 3) as total_mb,
        min(m.created_at) as oldest_object_created_at,
        max(m.created_at) as newest_object_created_at,
        min(m.age_days) as youngest_age_days,
        max(m.age_days) as oldest_age_days,
        m.cleanup_ttl_days
    from manifest m
    group by
        m.manifest_action,
        m.manifest_reason,
        m.safe_path_class,
        m.cleanup_ttl_days
)
select
    gm.manifest_action,
    gm.manifest_reason,
    gm.safe_path_class,
    gm.object_count,
    gm.objects_missing_size_metadata,
    gm.total_mb,
    gm.oldest_object_created_at,
    gm.newest_object_created_at,
    gm.youngest_age_days,
    gm.oldest_age_days,
    gm.cleanup_ttl_days
from grouped_manifest gm
order by
    case gm.manifest_action
        when 'delete_candidate' then 0
        when 'manual_review_required' then 1
        when 'integrity_problem' then 2
        when 'protected_referenced' then 3
        when 'protected_durable_or_ambiguous' then 4
        else 5
    end,
    gm.total_mb desc,
    gm.object_count desc,
    gm.safe_path_class asc,
    gm.manifest_reason asc;
$$;

comment on function public.get_media_storage_lifecycle_summary(integer)
is 'Service-role-only aggregate media storage lifecycle diagnostic. Returns counts/bytes by lifecycle class without raw paths or user ids.';

revoke all on function public.get_media_storage_lifecycle_summary(integer) from public;
revoke all on function public.get_media_storage_lifecycle_summary(integer) from anon;
revoke all on function public.get_media_storage_lifecycle_summary(integer) from authenticated;
grant execute on function public.get_media_storage_lifecycle_summary(integer) to service_role;
