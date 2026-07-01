-- Add service-role-only media storage lifecycle proof and aggregate diagnostics.

create table if not exists public.voice_source_lifecycle (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    storage_path text not null,
    source_path_class text not null,
    workflow_kind text not null,
    source_kind text not null,
    lifecycle_key text not null,
    lifecycle_state text not null,
    source_ref text,
    generation_id uuid,
    provider_request_id text,
    provider_voice_id text,
    retention_until timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint voice_source_lifecycle_source_path_class_check
        check (source_path_class in (
            'voice_changer_source_audio',
            'voice_changer_source_video',
            'voice_clone_source_audio'
        )),
    constraint voice_source_lifecycle_workflow_kind_check
        check (workflow_kind in ('voice_changer', 'voice_clone')),
    constraint voice_source_lifecycle_source_kind_check
        check (source_kind in ('audio', 'video')),
    constraint voice_source_lifecycle_state_check
        check (lifecycle_state in (
            'staged',
            'submitted',
            'terminal_success',
            'terminal_failure',
            'retained_for_custom_voice'
        )),
    constraint voice_source_lifecycle_key_not_blank_check
        check (length(btrim(lifecycle_key)) > 0),
    constraint voice_source_lifecycle_path_not_blank_check
        check (length(btrim(storage_path)) > 0),
    constraint voice_source_lifecycle_unique_usage
        unique (user_id, storage_path, workflow_kind, lifecycle_key)
);

create index if not exists voice_source_lifecycle_path_idx
    on public.voice_source_lifecycle (storage_path);

create index if not exists voice_source_lifecycle_active_idx
    on public.voice_source_lifecycle (storage_path, lifecycle_state)
    where lifecycle_state = 'submitted';

create index if not exists voice_source_lifecycle_retention_idx
    on public.voice_source_lifecycle (retention_until)
    where retention_until is not null;

alter table public.voice_source_lifecycle enable row level security;

revoke all on table public.voice_source_lifecycle from public;
revoke all on table public.voice_source_lifecycle from anon;
revoke all on table public.voice_source_lifecycle from authenticated;
grant all on table public.voice_source_lifecycle to service_role;

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
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
    v_cleanup_ttl_days integer := least(greatest(coalesce(p_cleanup_ttl_days, 7), 1), 90);
begin
    drop table if exists pg_temp._media_storage_lifecycle_optional_refs;

    create temporary table _media_storage_lifecycle_optional_refs (
        user_id uuid,
        storage_path text not null,
        ref_source text not null,
        blocks_cleanup boolean not null,
        retention_until timestamptz
    ) on commit drop;

    if to_regclass('public.motion_reference_video_generation_leases') is not null then
        execute $sql$
            insert into pg_temp._media_storage_lifecycle_optional_refs (
                user_id,
                storage_path,
                ref_source,
                blocks_cleanup,
                retention_until
            )
            select
                ml.user_id,
                btrim(ml.storage_path) as storage_path,
                case
                    when ml.released_at is null
                        then 'motion_reference_video_generation_leases.active'
                    else 'motion_reference_video_generation_leases.released'
                end as ref_source,
                (ml.released_at is null) as blocks_cleanup,
                null::timestamptz as retention_until
            from public.motion_reference_video_generation_leases ml
            where nullif(btrim(coalesce(ml.storage_path, '')), '') is not null
        $sql$;
    end if;

    if to_regclass('public.motion_reference_video_retirements') is not null then
        execute $sql$
            insert into pg_temp._media_storage_lifecycle_optional_refs (
                user_id,
                storage_path,
                ref_source,
                blocks_cleanup,
                retention_until
            )
            select
                mr.user_id,
                btrim(mr.storage_path) as storage_path,
                case
                    when mr.deleted_at is null
                        then 'motion_reference_video_retirements.pending'
                    else 'motion_reference_video_retirements.deleted'
                end as ref_source,
                false as blocks_cleanup,
                null::timestamptz as retention_until
            from public.motion_reference_video_retirements mr
            where nullif(btrim(coalesce(mr.storage_path, '')), '') is not null
        $sql$;
    end if;

    if to_regclass('public.voice_source_lifecycle') is not null then
        execute $sql$
            insert into pg_temp._media_storage_lifecycle_optional_refs (
                user_id,
                storage_path,
                ref_source,
                blocks_cleanup,
                retention_until
            )
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
        $sql$;
    end if;

    return query
    with settings as (
        select v_cleanup_ttl_days as cleanup_ttl_days
    ),
    media_file_original_refs as (
        select
            mf.user_id,
            btrim(mf.storage_path) as storage_path,
            'media_files.storage_path'::text as ref_source,
            true as blocks_cleanup,
            null::timestamptz as retention_until
        from public.media_files mf
        where nullif(btrim(coalesce(mf.storage_path, '')), '') is not null
    ),
    media_file_variant_hint_refs as (
        select
            mf.user_id,
            btrim(ref.storage_path) as storage_path,
            ref.ref_source,
            true as blocks_cleanup,
            null::timestamptz as retention_until
        from public.media_files mf
        cross join lateral (
            values
                (to_jsonb(mf)->>'thumb_variant_path', 'media_files.thumb_variant_path'),
                (to_jsonb(mf)->>'poster_variant_path', 'media_files.poster_variant_path'),
                (to_jsonb(mf)->>'preview_variant_path', 'media_files.preview_variant_path')
        ) as ref(storage_path, ref_source)
        where nullif(btrim(coalesce(ref.storage_path, '')), '') is not null
    ),
    media_asset_variant_refs as (
        select
            mav.user_id,
            btrim(mav.storage_path) as storage_path,
            'media_asset_variants.storage_path'::text as ref_source,
            true as blocks_cleanup,
            null::timestamptz as retention_until
        from public.media_asset_variants mav
        where nullif(btrim(coalesce(mav.storage_path, '')), '') is not null
    ),
    generation_projection_refs as (
        select
            gp.user_id,
            btrim(ref.storage_path) as storage_path,
            ref.ref_source,
            true as blocks_cleanup,
            null::timestamptz as retention_until
        from public.generation_projection gp
        cross join lateral (
            values
                (gp.preview_storage_path, 'generation_projection.preview_storage_path'),
                (gp.full_storage_path, 'generation_projection.full_storage_path'),
                (
                    to_jsonb(gp)->>'companion_art_storage_path',
                    'generation_projection.companion_art_storage_path'
                )
        ) as ref(storage_path, ref_source)
        where nullif(btrim(coalesce(ref.storage_path, '')), '') is not null
    ),
    generation_publication_refs as (
        select
            gp.user_id,
            btrim(ref.storage_path) as storage_path,
            ref.ref_source,
            true as blocks_cleanup,
            null::timestamptz as retention_until
        from public.generation_publications gp
        cross join lateral (
            values
                (gp.preview_storage_path, 'generation_publications.preview_storage_path'),
                (gp.full_storage_path, 'generation_publications.full_storage_path')
        ) as ref(storage_path, ref_source)
        where nullif(btrim(coalesce(ref.storage_path, '')), '') is not null
    ),
    project_output_display_refs as (
        select
            podi.user_id,
            btrim(ref.storage_path) as storage_path,
            ref.ref_source,
            true as blocks_cleanup,
            null::timestamptz as retention_until
        from public.project_output_display_items podi
        cross join lateral (
            values
                (
                    podi.preview_storage_path,
                    'project_output_display_items.preview_storage_path'
                ),
                (podi.full_storage_path, 'project_output_display_items.full_storage_path'),
                (
                    podi.preview_poster_storage_path,
                    'project_output_display_items.preview_poster_storage_path'
                ),
                (
                    podi.companion_art_storage_path,
                    'project_output_display_items.companion_art_storage_path'
                )
        ) as ref(storage_path, ref_source)
        where nullif(btrim(coalesce(ref.storage_path, '')), '') is not null
    ),
    character_asset_refs as (
        select
            cma.user_id,
            btrim(cma.storage_path) as storage_path,
            'character_media_assets.storage_path'::text as ref_source,
            true as blocks_cleanup,
            null::timestamptz as retention_until
        from public.character_media_assets cma
        where nullif(btrim(coalesce(cma.storage_path, '')), '') is not null
    ),
    element_asset_refs as (
        select
            ema.user_id,
            btrim(ema.storage_path) as storage_path,
            'element_media_assets.storage_path'::text as ref_source,
            true as blocks_cleanup,
            null::timestamptz as retention_until
        from public.element_media_assets ema
        where nullif(btrim(coalesce(ema.storage_path, '')), '') is not null
    ),
    custom_voice_sample_refs as (
        select
            uocv.user_id,
            btrim(uocv.sample_storage_path) as storage_path,
            'user_owned_custom_voices.sample_storage_path'::text as ref_source,
            true as blocks_cleanup,
            null::timestamptz as retention_until
        from public.user_owned_custom_voices uocv
        where nullif(btrim(coalesce(uocv.sample_storage_path, '')), '') is not null
    ),
    optional_motion_reference_refs as (
        select
            user_id,
            storage_path,
            ref_source,
            blocks_cleanup,
            retention_until
        from pg_temp._media_storage_lifecycle_optional_refs
    ),
    all_refs as (
        select * from media_file_original_refs
        union all select * from media_file_variant_hint_refs
        union all select * from media_asset_variant_refs
        union all select * from generation_projection_refs
        union all select * from generation_publication_refs
        union all select * from project_output_display_refs
        union all select * from character_asset_refs
        union all select * from element_asset_refs
        union all select * from custom_voice_sample_refs
        union all select * from optional_motion_reference_refs
    ),
    ref_summary as (
        select
            storage_path,
            count(*)::bigint as reference_count,
            count(*) filter (where blocks_cleanup)::bigint as blocking_reference_count,
            count(*) filter (
                where ref_source = 'motion_reference_video_generation_leases.active'
            )::bigint as active_motion_lease_count,
            count(*) filter (
                where ref_source = 'motion_reference_video_retirements.pending'
            )::bigint as pending_motion_retirement_count,
            count(*) filter (
                where ref_source like 'voice_source_lifecycle.%'
            )::bigint as voice_source_lifecycle_count,
            count(*) filter (
                where ref_source = 'voice_source_lifecycle.submitted'
            )::bigint as active_voice_source_lifecycle_count,
            count(*) filter (
                where ref_source in (
                    'voice_source_lifecycle.terminal_success',
                    'voice_source_lifecycle.terminal_failure',
                    'voice_source_lifecycle.retained_for_custom_voice'
                )
            )::bigint as terminal_voice_source_lifecycle_count,
            count(*) filter (
                where ref_source like 'voice_source_lifecycle.%'
                  and retention_until is not null
                  and retention_until < now()
            )::bigint as expired_voice_source_lifecycle_count,
            max(retention_until) filter (
                where ref_source like 'voice_source_lifecycle.%'
            ) as voice_source_retention_until,
            string_agg(distinct ref_source, ', ' order by ref_source) as reference_sources
        from all_refs
        group by storage_path
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
                else null
            end as object_bytes
        from storage.objects o
    ),
    classified as (
        select
            sr.*,
            (
                sr.bucket_id = 'media_library'
                and split_part(sr.storage_path, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            ) as has_valid_media_user_prefix,
            case
                when sr.storage_path = '' then 'invalid_empty_path'
                when sr.bucket_id is distinct from 'media_library'
                    then coalesce(sr.bucket_id, 'unknown_bucket') || '/out_of_scope'
                when split_part(sr.storage_path, '/', 1) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                    then 'media_library/unscoped_or_invalid_user_prefix'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/upload-staging/images/reference/%'
                    then 'media_library/upload_staging_reference_image'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/upload-staging/videos/reference/%'
                    then 'media_library/upload_staging_reference_video'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/upload-staging/videos/motion-control/%'
                    then 'media_library/upload_staging_motion_reference'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/upload-staging/product-image-assets/%'
                    then 'media_library/upload_staging_product_image_asset'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/upload-staging/%'
                    then 'media_library/upload_staging_other'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/variants/%'
                    then 'media_library/variants'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/uploads/%/variants/%'
                    then 'media_library/upload_variants'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/generations/%/variants/%'
                    then 'media_library/generation_variants'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/generations/images/%'
                    then 'media_library/generation_images'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/generations/videos/%'
                    then 'media_library/generation_videos'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/generations/audio/%'
                    then 'media_library/generation_audio'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/uploads/images/%'
                    then 'media_library/upload_images'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/uploads/videos/%'
                    then 'media_library/upload_videos'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/uploads/audio/%'
                    then 'media_library/upload_audio'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/private/images/%'
                    then 'media_library/private_images'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/images/reference/%'
                    then 'media_library/transient_image_reference'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/videos/motion-control/%'
                    then 'media_library/transient_motion_reference'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/voice-changer/source-audio/%'
                    then 'media_library/voice_changer_source_audio'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/voice-changer/source-video/%'
                    then 'media_library/voice_changer_source_video'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/voice-clone/source-audio/%'
                    then 'media_library/voice_clone_source_audio'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/characters/%'
                    then 'media_library/character_assets'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/elements/%'
                    then 'media_library/element_assets'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/images/%'
                    then 'media_library/legacy_images'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/videos/%'
                    then 'media_library/legacy_videos'
                when sr.storage_path like split_part(sr.storage_path, '/', 1) || '/audio/%'
                    then 'media_library/legacy_audio'
                else 'media_library/other_user_scoped'
            end as safe_path_class,
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
        from storage_rows sr
        left join ref_summary rs
          on rs.storage_path = sr.storage_path
    ),
    manifest as (
        select
            c.*,
            floor(extract(epoch from (now() - c.created_at)) / 86400)::integer as age_days,
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
                    'media_library/voice_changer_source_video',
                    'media_library/voice_clone_source_audio'
                ) then 'manual_review_required'
                when c.safe_path_class = 'media_library/transient_motion_reference'
                  and c.active_motion_lease_count = 0
                  and c.pending_motion_retirement_count > 0
                  and c.created_at < now() - make_interval(days => settings.cleanup_ttl_days)
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
                  and c.created_at < now() - make_interval(days => settings.cleanup_ttl_days)
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
                    'media_library/voice_changer_source_video',
                    'media_library/voice_clone_source_audio'
                )
                  and c.voice_source_lifecycle_count > 0
                  and c.terminal_voice_source_lifecycle_count > 0
                  and c.expired_voice_source_lifecycle_count = c.voice_source_lifecycle_count
                    then 'voice source lifecycle retention elapsed'
                when c.safe_path_class in (
                    'media_library/voice_changer_source_audio',
                    'media_library/voice_changer_source_video',
                    'media_library/voice_clone_source_audio'
                )
                  and c.voice_source_lifecycle_count > 0
                    then 'voice source lifecycle proof exists but retention is active'
                when c.safe_path_class in (
                    'media_library/voice_changer_source_audio',
                    'media_library/voice_changer_source_video',
                    'media_library/voice_clone_source_audio'
                ) then 'voice source namespace requires workflow/custom-voice review'
                else 'protected or ambiguous storage class'
            end as manifest_reason,
            settings.cleanup_ttl_days
        from classified c
        cross join settings
    )
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
    order by
        case m.manifest_action
            when 'delete_candidate' then 0
            when 'manual_review_required' then 1
            when 'integrity_problem' then 2
            when 'protected_referenced' then 3
            when 'protected_durable_or_ambiguous' then 4
            else 5
        end,
        coalesce(sum(m.object_bytes), 0) desc,
        count(*) desc,
        m.safe_path_class asc,
        m.manifest_reason asc;
end;
$$;

comment on function public.get_media_storage_lifecycle_summary(integer)
is 'Service-role-only aggregate media storage lifecycle diagnostic. Returns counts/bytes by lifecycle class without raw paths or user ids.';

revoke all on function public.get_media_storage_lifecycle_summary(integer) from public;
revoke all on function public.get_media_storage_lifecycle_summary(integer) from anon;
revoke all on function public.get_media_storage_lifecycle_summary(integer) from authenticated;
grant execute on function public.get_media_storage_lifecycle_summary(integer) to service_role;
