-- Add service-role-only first-value funnel stats for /admin/stats Marketing.
-- This tracks the creation path from signup through first successful/saved value.

create or replace function public.get_admin_first_value_funnel_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_payload jsonb;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can read admin first-value funnel stats';
    end if;

    with signup_rows as (
        select
            user_id,
            created_at as signed_up_at
        from public.billing_profiles
        where user_id is not null
    ),
    project_event_rows as (
        select user_id, created_at
        from public.projects
        where user_id is not null
        union all
        select user_id, created_at
        from public.project_generation_items
        where user_id is not null
    ),
    project_first as (
        select
            user_id,
            min(created_at) as first_project_at
        from project_event_rows
        group by user_id
    ),
    generation_start_rows as (
        select user_id, occurred_at as created_at
        from public.app_error_events
        where source = 'telemetry.ai_studio.generate_clicked'
          and user_id is not null
        union all
        select user_id, created_at
        from public.ai_generations
        where user_id is not null
    ),
    generation_start_first as (
        select
            user_id,
            min(created_at) as first_generation_started_at
        from generation_start_rows
        group by user_id
    ),
    success_first as (
        select
            user_id,
            min(created_at) as first_success_at
        from public.ai_generations
        where user_id is not null
          and status = 'success'
        group by user_id
    ),
    saved_download_rows as (
        select
            events.user_id,
            events.created_at
        from public.media_events events
        left join public.media_files files
          on events.entity_type = 'media_file'
         and files.id = events.entity_id
        where events.user_id is not null
          and (
              events.event_type = 'generation_saved'
              or (
                  events.event_type = 'download'
                  and (
                      events.entity_type = 'ai_generation'
                      or files.source = 'ai_studio'
                      or events.metadata ? 'generation_id'
                      or events.metadata ? 'output_id'
                  )
              )
          )
    ),
    saved_download_first as (
        select
            user_id,
            min(created_at) as first_saved_or_downloaded_at
        from saved_download_rows
        group by user_id
    ),
    user_funnel as (
        select
            s.user_id,
            s.signed_up_at,
            case
                when pf.first_project_at >= s.signed_up_at then pf.first_project_at
                else null
            end as first_project_at,
            case
                when gsf.first_generation_started_at >= s.signed_up_at
                    then gsf.first_generation_started_at
                else null
            end as first_generation_started_at,
            case
                when sf.first_success_at >= s.signed_up_at then sf.first_success_at
                else null
            end as first_success_at,
            case
                when sdf.first_saved_or_downloaded_at >= s.signed_up_at
                    then sdf.first_saved_or_downloaded_at
                else null
            end as first_saved_or_downloaded_at
        from signup_rows s
        left join project_first pf
          on pf.user_id = s.user_id
        left join generation_start_first gsf
          on gsf.user_id = s.user_id
        left join success_first sf
          on sf.user_id = s.user_id
        left join saved_download_first sdf
          on sdf.user_id = s.user_id
    ),
    counts as (
        select
            count(*)::bigint as signed_up_total,
            count(*) filter (where signed_up_at >= now() - interval '24 hours')::bigint
                as signed_up_last_24h,
            count(*) filter (where signed_up_at >= now() - interval '7 days')::bigint
                as signed_up_last_7d,

            count(*) filter (where first_project_at is not null)::bigint
                as project_total,
            count(*) filter (
                where signed_up_at >= now() - interval '24 hours'
                  and first_project_at is not null
            )::bigint as project_last_24h,
            count(*) filter (
                where signed_up_at >= now() - interval '7 days'
                  and first_project_at is not null
            )::bigint as project_last_7d,

            count(*) filter (where first_generation_started_at is not null)::bigint
                as generation_started_total,
            count(*) filter (
                where signed_up_at >= now() - interval '24 hours'
                  and first_generation_started_at is not null
            )::bigint as generation_started_last_24h,
            count(*) filter (
                where signed_up_at >= now() - interval '7 days'
                  and first_generation_started_at is not null
            )::bigint as generation_started_last_7d,

            count(*) filter (where first_success_at is not null)::bigint
                as successful_output_total,
            count(*) filter (
                where signed_up_at >= now() - interval '24 hours'
                  and first_success_at is not null
            )::bigint as successful_output_last_24h,
            count(*) filter (
                where signed_up_at >= now() - interval '7 days'
                  and first_success_at is not null
            )::bigint as successful_output_last_7d,

            count(*) filter (where first_saved_or_downloaded_at is not null)::bigint
                as saved_or_downloaded_total,
            count(*) filter (
                where signed_up_at >= now() - interval '24 hours'
                  and first_saved_or_downloaded_at is not null
            )::bigint as saved_or_downloaded_last_24h,
            count(*) filter (
                where signed_up_at >= now() - interval '7 days'
                  and first_saved_or_downloaded_at is not null
            )::bigint as saved_or_downloaded_last_7d
        from user_funnel
    )
    select jsonb_build_object(
        'steps', jsonb_build_array(
            jsonb_build_object(
                'stepKey', 'signed_up',
                'label', 'Signed up',
                'tracked', true,
                'source', 'billing_profiles.created_at',
                'users', jsonb_build_object(
                    'total', coalesce(signed_up_total, 0),
                    'last24h', coalesce(signed_up_last_24h, 0),
                    'last7d', coalesce(signed_up_last_7d, 0)
                )
            ),
            jsonb_build_object(
                'stepKey', 'reached_workspace',
                'label', 'Reached dashboard or AI Studio',
                'tracked', false,
                'source', 'not instrumented',
                'users', jsonb_build_object('total', 0, 'last24h', 0, 'last7d', 0)
            ),
            jsonb_build_object(
                'stepKey', 'project_started',
                'label', 'Created or used project',
                'tracked', true,
                'source', 'projects + project_generation_items',
                'users', jsonb_build_object(
                    'total', coalesce(project_total, 0),
                    'last24h', coalesce(project_last_24h, 0),
                    'last7d', coalesce(project_last_7d, 0)
                )
            ),
            jsonb_build_object(
                'stepKey', 'generation_started',
                'label', 'Started first generation',
                'tracked', true,
                'source', 'telemetry.ai_studio.generate_clicked + ai_generations',
                'users', jsonb_build_object(
                    'total', coalesce(generation_started_total, 0),
                    'last24h', coalesce(generation_started_last_24h, 0),
                    'last7d', coalesce(generation_started_last_7d, 0)
                )
            ),
            jsonb_build_object(
                'stepKey', 'successful_output',
                'label', 'Got first successful output',
                'tracked', true,
                'source', 'ai_generations.status=success',
                'users', jsonb_build_object(
                    'total', coalesce(successful_output_total, 0),
                    'last24h', coalesce(successful_output_last_24h, 0),
                    'last7d', coalesce(successful_output_last_7d, 0)
                )
            ),
            jsonb_build_object(
                'stepKey', 'saved_or_downloaded',
                'label', 'Saved or downloaded output',
                'tracked', true,
                'source', 'media_events.generation_saved + generated media_events.download',
                'users', jsonb_build_object(
                    'total', coalesce(saved_or_downloaded_total, 0),
                    'last24h', coalesce(saved_or_downloaded_last_24h, 0),
                    'last7d', coalesce(saved_or_downloaded_last_7d, 0)
                )
            ),
            jsonb_build_object(
                'stepKey', 'reopened_output',
                'label', 'Reopened output',
                'tracked', false,
                'source', 'not instrumented',
                'users', jsonb_build_object('total', 0, 'last24h', 0, 'last7d', 0)
            )
        ),
        'gaps', jsonb_build_array(
            'Authenticated dashboard or AI Studio reach is not instrumented as a clean route-view event.',
            'Project-open without project creation or project-attached generation is not instrumented.',
            'Output reopen is not instrumented as a media event.'
        )
    )
    into v_payload
    from counts;

    return coalesce(
        v_payload,
        jsonb_build_object('steps', '[]'::jsonb, 'gaps', '[]'::jsonb)
    );
end;
$$;

revoke all on function public.get_admin_first_value_funnel_v1() from public;
revoke all on function public.get_admin_first_value_funnel_v1() from anon;
revoke all on function public.get_admin_first_value_funnel_v1() from authenticated;
grant execute on function public.get_admin_first_value_funnel_v1() to service_role;
