-- Add a service-role-only admin stats helper for generation breakdowns by
-- user, model, and media type without exposing customer-owned generation rows
-- to browser roles.

create or replace function public.get_admin_generation_breakdown_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_payload jsonb;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can read admin generation breakdown stats';
    end if;

    with generation_rows as materialized (
        select
            g.id,
            g.user_id,
            g.created_at,
            g.status,
            coalesce(nullif(trim(coalesce(g.model_id, '')), ''), 'unknown') as model_id,
            coalesce(nullif(trim(coalesce(g.mode, '')), ''), 'unknown') as mode,
            case
                when lower(coalesce(g.mode, '')) = 'image' then 'image'
                when lower(coalesce(g.mode, '')) = 'video' then 'video'
                when lower(coalesce(g.mode, '')) in ('audio', 'sound') then 'audio'
                else 'unknown'
            end as media_type
        from public.ai_generations g
    ),
    summary as (
        select
            count(*)::bigint as accepted_total,
            count(*) filter (where created_at >= now() - interval '24 hours')::bigint as accepted_last_24h,
            count(*) filter (where created_at >= now() - interval '7 days')::bigint as accepted_last_7d,
            count(*) filter (where status = 'success')::bigint as successful_total,
            count(*) filter (where status = 'success' and created_at >= now() - interval '24 hours')::bigint as successful_last_24h,
            count(*) filter (where status = 'success' and created_at >= now() - interval '7 days')::bigint as successful_last_7d,
            count(*) filter (where status in ('fail', 'failed'))::bigint as failed_total,
            count(*) filter (where status in ('fail', 'failed') and created_at >= now() - interval '24 hours')::bigint as failed_last_24h,
            count(*) filter (where status in ('fail', 'failed') and created_at >= now() - interval '7 days')::bigint as failed_last_7d,
            count(*) filter (where media_type = 'image')::bigint as image_total,
            count(*) filter (where media_type = 'image' and created_at >= now() - interval '24 hours')::bigint as image_last_24h,
            count(*) filter (where media_type = 'image' and created_at >= now() - interval '7 days')::bigint as image_last_7d,
            count(*) filter (where media_type = 'video')::bigint as video_total,
            count(*) filter (where media_type = 'video' and created_at >= now() - interval '24 hours')::bigint as video_last_24h,
            count(*) filter (where media_type = 'video' and created_at >= now() - interval '7 days')::bigint as video_last_7d,
            count(*) filter (where media_type = 'audio')::bigint as audio_total,
            count(*) filter (where media_type = 'audio' and created_at >= now() - interval '24 hours')::bigint as audio_last_24h,
            count(*) filter (where media_type = 'audio' and created_at >= now() - interval '7 days')::bigint as audio_last_7d,
            count(*) filter (where media_type = 'unknown')::bigint as unknown_total,
            count(*) filter (where media_type = 'unknown' and created_at >= now() - interval '24 hours')::bigint as unknown_last_24h,
            count(*) filter (where media_type = 'unknown' and created_at >= now() - interval '7 days')::bigint as unknown_last_7d,
            count(distinct user_id)::bigint as unique_users,
            count(distinct model_id)::bigint as unique_models,
            max(created_at) as last_generation_at
        from generation_rows
    ),
    user_rows as (
        select
            g.user_id,
            nullif(trim(au.email), '') as email,
            count(*)::bigint as accepted_total,
            count(*) filter (where g.created_at >= now() - interval '24 hours')::bigint as accepted_last_24h,
            count(*) filter (where g.created_at >= now() - interval '7 days')::bigint as accepted_last_7d,
            count(*) filter (where g.status = 'success')::bigint as successful_total,
            count(*) filter (where g.status = 'success' and g.created_at >= now() - interval '24 hours')::bigint as successful_last_24h,
            count(*) filter (where g.status = 'success' and g.created_at >= now() - interval '7 days')::bigint as successful_last_7d,
            count(*) filter (where g.status in ('fail', 'failed'))::bigint as failed_total,
            count(*) filter (where g.status in ('fail', 'failed') and g.created_at >= now() - interval '24 hours')::bigint as failed_last_24h,
            count(*) filter (where g.status in ('fail', 'failed') and g.created_at >= now() - interval '7 days')::bigint as failed_last_7d,
            count(*) filter (where g.media_type = 'image')::bigint as image_total,
            count(*) filter (where g.media_type = 'image' and g.created_at >= now() - interval '24 hours')::bigint as image_last_24h,
            count(*) filter (where g.media_type = 'image' and g.created_at >= now() - interval '7 days')::bigint as image_last_7d,
            count(*) filter (where g.media_type = 'video')::bigint as video_total,
            count(*) filter (where g.media_type = 'video' and g.created_at >= now() - interval '24 hours')::bigint as video_last_24h,
            count(*) filter (where g.media_type = 'video' and g.created_at >= now() - interval '7 days')::bigint as video_last_7d,
            count(*) filter (where g.media_type = 'audio')::bigint as audio_total,
            count(*) filter (where g.media_type = 'audio' and g.created_at >= now() - interval '24 hours')::bigint as audio_last_24h,
            count(*) filter (where g.media_type = 'audio' and g.created_at >= now() - interval '7 days')::bigint as audio_last_7d,
            count(*) filter (where g.media_type = 'unknown')::bigint as unknown_total,
            count(*) filter (where g.media_type = 'unknown' and g.created_at >= now() - interval '24 hours')::bigint as unknown_last_24h,
            count(*) filter (where g.media_type = 'unknown' and g.created_at >= now() - interval '7 days')::bigint as unknown_last_7d,
            count(distinct g.model_id)::bigint as unique_models,
            max(g.created_at) as last_generation_at
        from generation_rows g
        left join auth.users au
          on au.id = g.user_id
        group by g.user_id, au.email
        order by accepted_total desc, last_generation_at desc nulls last, g.user_id asc
        limit 200
    ),
    model_media_type_rows as (
        select
            model_id,
            media_type,
            count(*)::bigint as accepted_total,
            count(*) filter (where created_at >= now() - interval '24 hours')::bigint as accepted_last_24h,
            count(*) filter (where created_at >= now() - interval '7 days')::bigint as accepted_last_7d,
            count(*) filter (where status = 'success')::bigint as successful_total,
            count(*) filter (where status = 'success' and created_at >= now() - interval '24 hours')::bigint as successful_last_24h,
            count(*) filter (where status = 'success' and created_at >= now() - interval '7 days')::bigint as successful_last_7d,
            count(*) filter (where status in ('fail', 'failed'))::bigint as failed_total,
            count(*) filter (where status in ('fail', 'failed') and created_at >= now() - interval '24 hours')::bigint as failed_last_24h,
            count(*) filter (where status in ('fail', 'failed') and created_at >= now() - interval '7 days')::bigint as failed_last_7d,
            count(distinct user_id)::bigint as unique_users,
            max(created_at) as last_generation_at
        from generation_rows
        group by model_id, media_type
        order by accepted_total desc, last_generation_at desc nulls last, model_id asc, media_type asc
        limit 200
    )
    select jsonb_build_object(
        'summary',
        jsonb_build_object(
            'acceptedGenerations', jsonb_build_object('total', s.accepted_total, 'last24h', s.accepted_last_24h, 'last7d', s.accepted_last_7d),
            'successfulGenerations', jsonb_build_object('total', s.successful_total, 'last24h', s.successful_last_24h, 'last7d', s.successful_last_7d),
            'failedGenerations', jsonb_build_object('total', s.failed_total, 'last24h', s.failed_last_24h, 'last7d', s.failed_last_7d),
            'imageGenerations', jsonb_build_object('total', s.image_total, 'last24h', s.image_last_24h, 'last7d', s.image_last_7d),
            'videoGenerations', jsonb_build_object('total', s.video_total, 'last24h', s.video_last_24h, 'last7d', s.video_last_7d),
            'audioGenerations', jsonb_build_object('total', s.audio_total, 'last24h', s.audio_last_24h, 'last7d', s.audio_last_7d),
            'unknownGenerations', jsonb_build_object('total', s.unknown_total, 'last24h', s.unknown_last_24h, 'last7d', s.unknown_last_7d),
            'uniqueUsers', s.unique_users,
            'uniqueModels', s.unique_models,
            'lastGenerationAt', s.last_generation_at
        ),
        'users',
        coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'userId', user_id,
                    'email', email,
                    'acceptedGenerations', jsonb_build_object('total', accepted_total, 'last24h', accepted_last_24h, 'last7d', accepted_last_7d),
                    'successfulGenerations', jsonb_build_object('total', successful_total, 'last24h', successful_last_24h, 'last7d', successful_last_7d),
                    'failedGenerations', jsonb_build_object('total', failed_total, 'last24h', failed_last_24h, 'last7d', failed_last_7d),
                    'imageGenerations', jsonb_build_object('total', image_total, 'last24h', image_last_24h, 'last7d', image_last_7d),
                    'videoGenerations', jsonb_build_object('total', video_total, 'last24h', video_last_24h, 'last7d', video_last_7d),
                    'audioGenerations', jsonb_build_object('total', audio_total, 'last24h', audio_last_24h, 'last7d', audio_last_7d),
                    'unknownGenerations', jsonb_build_object('total', unknown_total, 'last24h', unknown_last_24h, 'last7d', unknown_last_7d),
                    'uniqueModels', unique_models,
                    'lastGenerationAt', last_generation_at
                )
                order by accepted_total desc, last_generation_at desc nulls last, user_id asc
            )
            from user_rows
        ), '[]'::jsonb),
        'modelMediaTypes',
        coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'modelId', model_id,
                    'mediaType', media_type,
                    'acceptedGenerations', jsonb_build_object('total', accepted_total, 'last24h', accepted_last_24h, 'last7d', accepted_last_7d),
                    'successfulGenerations', jsonb_build_object('total', successful_total, 'last24h', successful_last_24h, 'last7d', successful_last_7d),
                    'failedGenerations', jsonb_build_object('total', failed_total, 'last24h', failed_last_24h, 'last7d', failed_last_7d),
                    'uniqueUsers', unique_users,
                    'lastGenerationAt', last_generation_at
                )
                order by accepted_total desc, last_generation_at desc nulls last, model_id asc, media_type asc
            )
            from model_media_type_rows
        ), '[]'::jsonb)
    )
      into v_payload
      from summary s;

    return v_payload;
end;
$$;

revoke all on function public.get_admin_generation_breakdown_v1() from public;
revoke all on function public.get_admin_generation_breakdown_v1() from anon;
revoke all on function public.get_admin_generation_breakdown_v1() from authenticated;
grant execute on function public.get_admin_generation_breakdown_v1() to service_role;
