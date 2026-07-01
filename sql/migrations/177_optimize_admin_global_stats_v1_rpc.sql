-- Optimize the admin global stats v1 RPC so /api/admin/stats/global can serve
-- the same overview, models, workflows, assets, and project analytics payload
-- while avoiding repeated TOAST-heavy generation metadata reads.

create or replace function public.get_admin_global_stats_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_payload jsonb;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can read admin global stats v1';
    end if;

    with click_events as (
        select
            user_id,
            occurred_at,
            coalesce(nullif(trim(coalesce(metadata->>'selected_tool', metadata->>'tool', '')), ''), 'unknown') as selected_tool,
            coalesce(nullif(trim(coalesce(metadata->>'mode', '')), ''), 'unknown') as mode,
            coalesce(nullif(trim(coalesce(metadata->>'model_id', '')), ''), 'unknown') as model_id,
            case
                when jsonb_typeof(metadata->'has_style') = 'boolean'
                    then (metadata->>'has_style')::boolean
                when lower(coalesce(metadata->>'has_style', '')) in ('true', 't', '1', 'yes')
                    then true
                else false
            end as has_style,
            case
                when jsonb_typeof(metadata->'is_character_mode') = 'boolean'
                    then (metadata->>'is_character_mode')::boolean
                when lower(coalesce(metadata->>'is_character_mode', '')) in ('true', 't', '1', 'yes')
                    then true
                else false
            end as is_character_mode,
            case
                when coalesce(metadata->>'reference_count', '') ~ '^[0-9]+$'
                    then greatest((metadata->>'reference_count')::integer, 0)
                else 0
            end as reference_count
        from public.app_error_events
        where source = 'telemetry.ai_studio.generate_clicked'
    ),
    generation_rows as materialized (
        select
            id,
            user_id,
            created_at,
            status,
            coalesce(nullif(trim(coalesce(model_id, '')), ''), 'unknown') as model_id,
            coalesce(nullif(trim(coalesce(mode, '')), ''), 'unknown') as mode
        from public.ai_generations
    ),
    saved_generation_rows as materialized (
        select
            g.user_id,
            g.model_id,
            g.mode,
            mf.source_ref as generation_id,
            max(mf.created_at) as saved_at
        from public.media_files mf
        join generation_rows g
          on g.id = mf.source_ref
         and g.user_id = mf.user_id
        where mf.source = 'ai_studio'
          and mf.source_ref is not null
        group by g.user_id, g.model_id, g.mode, mf.source_ref
    ),
    projection_generation_rows as materialized (
        select
            g.id as generation_id,
            g.mode,
            g.created_at,
            case
                when jsonb_typeof(gp.style_context->'applied') = 'boolean'
                    then (gp.style_context->>'applied')::boolean
                when lower(coalesce(gp.style_context->>'applied', '')) in ('true', 't', '1', 'yes')
                    then true
                else false
            end as style_applied,
            case
                when jsonb_typeof(gp.character_context->'applied') = 'boolean'
                    then (gp.character_context->>'applied')::boolean
                when lower(coalesce(gp.character_context->>'applied', '')) in ('true', 't', '1', 'yes')
                    then true
                else false
            end as character_mode_applied,
            case
                when jsonb_typeof(gp.generation_replay->'referenceInputs') = 'array'
                    then jsonb_array_length(gp.generation_replay->'referenceInputs') > 0
                else false
            end as has_reference_inputs
        from public.generation_projection gp
        join generation_rows g
          on g.id = gp.generation_id
         and g.user_id = gp.user_id
    ),
    overview_clicks as (
        select
            count(*)::bigint as total_generate_clicks,
            count(*) filter (where occurred_at >= now() - interval '24 hours')::bigint as generate_clicks_last_24h,
            count(*) filter (where occurred_at >= now() - interval '7 days')::bigint as generate_clicks_last_7d,
            count(distinct user_id)::bigint as unique_click_users,
            max(occurred_at) as last_generate_click_at
        from click_events
    ),
    overview_generations as (
        select
            count(*)::bigint as total_generations,
            count(*) filter (where created_at >= now() - interval '24 hours')::bigint as generations_last_24h,
            count(*) filter (where created_at >= now() - interval '7 days')::bigint as generations_last_7d,
            count(*) filter (where status = 'success')::bigint as successful_generations_total,
            count(*) filter (where status = 'success' and created_at >= now() - interval '24 hours')::bigint as successful_generations_last_24h,
            count(*) filter (where status = 'success' and created_at >= now() - interval '7 days')::bigint as successful_generations_last_7d,
            count(*) filter (where status in ('fail', 'failed'))::bigint as failed_generations_total,
            count(*) filter (where status in ('fail', 'failed') and created_at >= now() - interval '24 hours')::bigint as failed_generations_last_24h,
            count(*) filter (where status in ('fail', 'failed') and created_at >= now() - interval '7 days')::bigint as failed_generations_last_7d,
            count(*) filter (where status = 'pending')::bigint as pending_generations,
            count(*) filter (where status = 'running')::bigint as running_generations,
            count(distinct model_id)::bigint as unique_models,
            count(distinct user_id)::bigint as unique_generation_users,
            max(created_at) as last_generation_at
        from generation_rows
    ),
    overview_saves as (
        select
            count(*)::bigint as total_saved_generations,
            count(*) filter (where saved_at >= now() - interval '24 hours')::bigint as saved_generations_last_24h,
            count(*) filter (where saved_at >= now() - interval '7 days')::bigint as saved_generations_last_7d,
            count(distinct user_id)::bigint as unique_saving_users,
            max(saved_at) as last_saved_generation_at
        from saved_generation_rows
    ),
    overview_projects as (
        select
            count(*)::bigint as total_project_attached_generations,
            count(*) filter (where created_at >= now() - interval '24 hours')::bigint as project_attached_generations_last_24h,
            count(*) filter (where created_at >= now() - interval '7 days')::bigint as project_attached_generations_last_7d
        from public.project_generation_items
    ),
    model_click_stats as (
        select
            model_id,
            count(*)::bigint as generate_clicks_total,
            count(*) filter (where occurred_at >= now() - interval '24 hours')::bigint as generate_clicks_last_24h,
            count(*) filter (where occurred_at >= now() - interval '7 days')::bigint as generate_clicks_last_7d,
            count(distinct user_id)::bigint as unique_click_users,
            max(occurred_at) as last_generate_click_at
        from click_events
        group by model_id
    ),
    model_generation_stats as (
        select
            model_id,
            count(*)::bigint as accepted_generations_total,
            count(*) filter (where created_at >= now() - interval '24 hours')::bigint as accepted_generations_last_24h,
            count(*) filter (where created_at >= now() - interval '7 days')::bigint as accepted_generations_last_7d,
            count(*) filter (where status = 'success')::bigint as successful_generations_total,
            count(*) filter (where status = 'success' and created_at >= now() - interval '24 hours')::bigint as successful_generations_last_24h,
            count(*) filter (where status = 'success' and created_at >= now() - interval '7 days')::bigint as successful_generations_last_7d,
            count(*) filter (where status in ('fail', 'failed'))::bigint as failed_generations_total,
            count(*) filter (where status in ('fail', 'failed') and created_at >= now() - interval '24 hours')::bigint as failed_generations_last_24h,
            count(*) filter (where status in ('fail', 'failed') and created_at >= now() - interval '7 days')::bigint as failed_generations_last_7d,
            count(*) filter (where status = 'pending')::bigint as pending_generations,
            count(*) filter (where status = 'running')::bigint as running_generations,
            count(distinct user_id)::bigint as unique_generation_users,
            max(created_at) as last_generation_at
        from generation_rows
        group by model_id
    ),
    model_save_stats as (
        select
            model_id,
            count(*)::bigint as saved_generations_total,
            count(*) filter (where saved_at >= now() - interval '24 hours')::bigint as saved_generations_last_24h,
            count(*) filter (where saved_at >= now() - interval '7 days')::bigint as saved_generations_last_7d,
            count(distinct user_id)::bigint as unique_saving_users,
            max(saved_at) as last_saved_generation_at
        from saved_generation_rows
        group by model_id
    ),
    model_rows as (
        select
            coalesce(gs.model_id, cs.model_id, ss.model_id) as model_id,
            coalesce(cs.generate_clicks_total, 0::bigint) as generate_clicks_total,
            coalesce(cs.generate_clicks_last_24h, 0::bigint) as generate_clicks_last_24h,
            coalesce(cs.generate_clicks_last_7d, 0::bigint) as generate_clicks_last_7d,
            coalesce(gs.accepted_generations_total, 0::bigint) as accepted_generations_total,
            coalesce(gs.accepted_generations_last_24h, 0::bigint) as accepted_generations_last_24h,
            coalesce(gs.accepted_generations_last_7d, 0::bigint) as accepted_generations_last_7d,
            coalesce(gs.successful_generations_total, 0::bigint) as successful_generations_total,
            coalesce(gs.successful_generations_last_24h, 0::bigint) as successful_generations_last_24h,
            coalesce(gs.successful_generations_last_7d, 0::bigint) as successful_generations_last_7d,
            coalesce(gs.failed_generations_total, 0::bigint) as failed_generations_total,
            coalesce(gs.failed_generations_last_24h, 0::bigint) as failed_generations_last_24h,
            coalesce(gs.failed_generations_last_7d, 0::bigint) as failed_generations_last_7d,
            coalesce(ss.saved_generations_total, 0::bigint) as saved_generations_total,
            coalesce(ss.saved_generations_last_24h, 0::bigint) as saved_generations_last_24h,
            coalesce(ss.saved_generations_last_7d, 0::bigint) as saved_generations_last_7d,
            coalesce(gs.pending_generations, 0::bigint) as pending_generations,
            coalesce(gs.running_generations, 0::bigint) as running_generations,
            coalesce(gs.unique_generation_users, 0::bigint) as unique_generation_users,
            coalesce(cs.unique_click_users, 0::bigint) as unique_click_users,
            coalesce(ss.unique_saving_users, 0::bigint) as unique_saving_users,
            cs.last_generate_click_at,
            gs.last_generation_at,
            ss.last_saved_generation_at
        from model_generation_stats gs
        full outer join model_click_stats cs
          on cs.model_id = gs.model_id
        full outer join model_save_stats ss
          on ss.model_id = coalesce(gs.model_id, cs.model_id)
    ),
    workflow_tool_rows as (
        select
            selected_tool as tool_key,
            count(*)::bigint as generate_clicks_total,
            count(*) filter (where occurred_at >= now() - interval '24 hours')::bigint as generate_clicks_last_24h,
            count(*) filter (where occurred_at >= now() - interval '7 days')::bigint as generate_clicks_last_7d,
            count(*) filter (where has_style)::bigint as style_clicks_total,
            count(*) filter (where has_style and occurred_at >= now() - interval '24 hours')::bigint as style_clicks_last_24h,
            count(*) filter (where has_style and occurred_at >= now() - interval '7 days')::bigint as style_clicks_last_7d,
            count(*) filter (where is_character_mode)::bigint as character_mode_clicks_total,
            count(*) filter (where is_character_mode and occurred_at >= now() - interval '24 hours')::bigint as character_mode_clicks_last_24h,
            count(*) filter (where is_character_mode and occurred_at >= now() - interval '7 days')::bigint as character_mode_clicks_last_7d,
            count(*) filter (where reference_count > 0)::bigint as reference_assisted_clicks_total,
            count(*) filter (where reference_count > 0 and occurred_at >= now() - interval '24 hours')::bigint as reference_assisted_clicks_last_24h,
            count(*) filter (where reference_count > 0 and occurred_at >= now() - interval '7 days')::bigint as reference_assisted_clicks_last_7d,
            count(distinct user_id)::bigint as unique_click_users,
            max(occurred_at) as last_generate_click_at
        from click_events
        group by selected_tool
    ),
    workflow_mode_click_stats as (
        select
            mode as mode_key,
            count(*)::bigint as generate_clicks_total,
            count(*) filter (where occurred_at >= now() - interval '24 hours')::bigint as generate_clicks_last_24h,
            count(*) filter (where occurred_at >= now() - interval '7 days')::bigint as generate_clicks_last_7d
        from click_events
        group by mode
    ),
    workflow_mode_generation_stats as (
        select
            mode as mode_key,
            count(*)::bigint as accepted_generations_total,
            count(*) filter (where created_at >= now() - interval '24 hours')::bigint as accepted_generations_last_24h,
            count(*) filter (where created_at >= now() - interval '7 days')::bigint as accepted_generations_last_7d,
            count(*) filter (where status = 'success')::bigint as successful_generations_total,
            count(*) filter (where status = 'success' and created_at >= now() - interval '24 hours')::bigint as successful_generations_last_24h,
            count(*) filter (where status = 'success' and created_at >= now() - interval '7 days')::bigint as successful_generations_last_7d,
            count(*) filter (where status in ('fail', 'failed'))::bigint as failed_generations_total,
            count(*) filter (where status in ('fail', 'failed') and created_at >= now() - interval '24 hours')::bigint as failed_generations_last_24h,
            count(*) filter (where status in ('fail', 'failed') and created_at >= now() - interval '7 days')::bigint as failed_generations_last_7d,
            max(created_at) as last_generation_at
        from generation_rows
        group by mode
    ),
    workflow_mode_projection_stats as (
        select
            mode as mode_key,
            count(*) filter (where style_applied)::bigint as style_applied_total,
            count(*) filter (where style_applied and created_at >= now() - interval '24 hours')::bigint as style_applied_last_24h,
            count(*) filter (where style_applied and created_at >= now() - interval '7 days')::bigint as style_applied_last_7d,
            count(*) filter (where character_mode_applied)::bigint as character_mode_total,
            count(*) filter (where character_mode_applied and created_at >= now() - interval '24 hours')::bigint as character_mode_last_24h,
            count(*) filter (where character_mode_applied and created_at >= now() - interval '7 days')::bigint as character_mode_last_7d,
            count(*) filter (where has_reference_inputs)::bigint as reference_assisted_total,
            count(*) filter (where has_reference_inputs and created_at >= now() - interval '24 hours')::bigint as reference_assisted_last_24h,
            count(*) filter (where has_reference_inputs and created_at >= now() - interval '7 days')::bigint as reference_assisted_last_7d
        from projection_generation_rows
        group by mode
    ),
    workflow_mode_rows as (
        select
            coalesce(gs.mode_key, cs.mode_key, ps.mode_key) as mode_key,
            coalesce(cs.generate_clicks_total, 0::bigint) as generate_clicks_total,
            coalesce(cs.generate_clicks_last_24h, 0::bigint) as generate_clicks_last_24h,
            coalesce(cs.generate_clicks_last_7d, 0::bigint) as generate_clicks_last_7d,
            coalesce(gs.accepted_generations_total, 0::bigint) as accepted_generations_total,
            coalesce(gs.accepted_generations_last_24h, 0::bigint) as accepted_generations_last_24h,
            coalesce(gs.accepted_generations_last_7d, 0::bigint) as accepted_generations_last_7d,
            coalesce(gs.successful_generations_total, 0::bigint) as successful_generations_total,
            coalesce(gs.successful_generations_last_24h, 0::bigint) as successful_generations_last_24h,
            coalesce(gs.successful_generations_last_7d, 0::bigint) as successful_generations_last_7d,
            coalesce(gs.failed_generations_total, 0::bigint) as failed_generations_total,
            coalesce(gs.failed_generations_last_24h, 0::bigint) as failed_generations_last_24h,
            coalesce(gs.failed_generations_last_7d, 0::bigint) as failed_generations_last_7d,
            coalesce(ps.style_applied_total, 0::bigint) as style_applied_total,
            coalesce(ps.style_applied_last_24h, 0::bigint) as style_applied_last_24h,
            coalesce(ps.style_applied_last_7d, 0::bigint) as style_applied_last_7d,
            coalesce(ps.character_mode_total, 0::bigint) as character_mode_total,
            coalesce(ps.character_mode_last_24h, 0::bigint) as character_mode_last_24h,
            coalesce(ps.character_mode_last_7d, 0::bigint) as character_mode_last_7d,
            coalesce(ps.reference_assisted_total, 0::bigint) as reference_assisted_total,
            coalesce(ps.reference_assisted_last_24h, 0::bigint) as reference_assisted_last_24h,
            coalesce(ps.reference_assisted_last_7d, 0::bigint) as reference_assisted_last_7d,
            gs.last_generation_at
        from workflow_mode_generation_stats gs
        full outer join workflow_mode_click_stats cs
          on cs.mode_key = gs.mode_key
        full outer join workflow_mode_projection_stats ps
          on ps.mode_key = coalesce(gs.mode_key, cs.mode_key)
    ),
    workflow_highlights as (
        select
            count(*) filter (where style_applied)::bigint as style_applied_generations_total,
            count(*) filter (where style_applied and created_at >= now() - interval '24 hours')::bigint as style_applied_generations_last_24h,
            count(*) filter (where style_applied and created_at >= now() - interval '7 days')::bigint as style_applied_generations_last_7d,
            count(*) filter (where character_mode_applied)::bigint as character_mode_generations_total,
            count(*) filter (where character_mode_applied and created_at >= now() - interval '24 hours')::bigint as character_mode_generations_last_24h,
            count(*) filter (where character_mode_applied and created_at >= now() - interval '7 days')::bigint as character_mode_generations_last_7d,
            count(*) filter (where has_reference_inputs)::bigint as reference_assisted_generations_total,
            count(*) filter (where has_reference_inputs and created_at >= now() - interval '24 hours')::bigint as reference_assisted_generations_last_24h,
            count(*) filter (where has_reference_inputs and created_at >= now() - interval '7 days')::bigint as reference_assisted_generations_last_7d
        from projection_generation_rows
    ),
    workflow_click_highlights as (
        select
            count(*) filter (where has_style)::bigint as style_clicks_total,
            count(*) filter (where has_style and occurred_at >= now() - interval '24 hours')::bigint as style_clicks_last_24h,
            count(*) filter (where has_style and occurred_at >= now() - interval '7 days')::bigint as style_clicks_last_7d,
            count(*) filter (where is_character_mode)::bigint as character_mode_clicks_total,
            count(*) filter (where is_character_mode and occurred_at >= now() - interval '24 hours')::bigint as character_mode_clicks_last_24h,
            count(*) filter (where is_character_mode and occurred_at >= now() - interval '7 days')::bigint as character_mode_clicks_last_7d,
            count(*) filter (where reference_count > 0)::bigint as reference_assisted_clicks_total,
            count(*) filter (where reference_count > 0 and occurred_at >= now() - interval '24 hours')::bigint as reference_assisted_clicks_last_24h,
            count(*) filter (where reference_count > 0 and occurred_at >= now() - interval '7 days')::bigint as reference_assisted_clicks_last_7d
        from click_events
    ),
    asset_event_rows as (
        select
            event_type,
            count(*)::bigint as total_count,
            count(*) filter (where created_at >= now() - interval '24 hours')::bigint as last_24h_count,
            count(*) filter (where created_at >= now() - interval '7 days')::bigint as last_7d_count,
            count(distinct user_id)::bigint as unique_users,
            max(created_at) as last_event_at
        from public.media_events
        group by event_type
    ),
    autosave_summary as (
        select
            count(*) filter (where metadata->>'autosave_decision' = 'auto_persisted')::bigint as auto_persisted_total,
            count(*) filter (
                where metadata->>'autosave_decision' = 'auto_persisted'
                  and created_at >= now() - interval '24 hours'
            )::bigint as auto_persisted_last_24h,
            count(*) filter (
                where metadata->>'autosave_decision' = 'auto_persisted'
                  and created_at >= now() - interval '7 days'
            )::bigint as auto_persisted_last_7d,
            count(*) filter (where metadata->>'autosave_decision' = 'autosave_skipped')::bigint as autosave_skipped_total,
            count(*) filter (
                where metadata->>'autosave_decision' = 'autosave_skipped'
                  and created_at >= now() - interval '24 hours'
            )::bigint as autosave_skipped_last_24h,
            count(*) filter (
                where metadata->>'autosave_decision' = 'autosave_skipped'
                  and created_at >= now() - interval '7 days'
            )::bigint as autosave_skipped_last_7d
        from public.ai_generations
    ),
    project_summary as (
        select
            (select count(*)::bigint from public.projects) as projects_created_total,
            (select count(*)::bigint from public.projects where created_at >= now() - interval '24 hours') as projects_created_last_24h,
            (select count(*)::bigint from public.projects where created_at >= now() - interval '7 days') as projects_created_last_7d,
            (select count(distinct project_id)::bigint from public.project_generation_items) as active_projects_with_generations_total,
            (select count(distinct project_id)::bigint from public.project_generation_items where created_at >= now() - interval '24 hours') as active_projects_with_generations_last_24h,
            (select count(distinct project_id)::bigint from public.project_generation_items where created_at >= now() - interval '7 days') as active_projects_with_generations_last_7d,
            (select count(*)::bigint from public.project_generation_items) as attached_generations_total,
            (select count(*)::bigint from public.project_generation_items where created_at >= now() - interval '24 hours') as attached_generations_last_24h,
            (select count(*)::bigint from public.project_generation_items where created_at >= now() - interval '7 days') as attached_generations_last_7d,
            (select count(*)::bigint from public.project_media_items) as attached_media_total,
            (select count(*)::bigint from public.project_media_items where created_at >= now() - interval '24 hours') as attached_media_last_24h,
            (select count(*)::bigint from public.project_media_items where created_at >= now() - interval '7 days') as attached_media_last_7d,
            (select count(*)::bigint from public.project_prompt_items) as attached_prompts_total,
            (select count(*)::bigint from public.project_prompt_items where created_at >= now() - interval '24 hours') as attached_prompts_last_24h,
            (select count(*)::bigint from public.project_prompt_items where created_at >= now() - interval '7 days') as attached_prompts_last_7d
    ),
    project_generation_counts as (
        select
            project_id,
            count(*)::bigint as total_count,
            count(*) filter (where created_at >= now() - interval '24 hours')::bigint as last_24h_count,
            count(*) filter (where created_at >= now() - interval '7 days')::bigint as last_7d_count,
            max(updated_at) as last_generation_at
        from public.project_generation_items
        group by project_id
    ),
    project_media_counts as (
        select
            project_id,
            count(*)::bigint as total_count,
            count(*) filter (where created_at >= now() - interval '24 hours')::bigint as last_24h_count,
            count(*) filter (where created_at >= now() - interval '7 days')::bigint as last_7d_count,
            max(updated_at) as last_media_at
        from public.project_media_items
        group by project_id
    ),
    project_prompt_counts as (
        select
            project_id,
            count(*)::bigint as total_count,
            count(*) filter (where created_at >= now() - interval '24 hours')::bigint as last_24h_count,
            count(*) filter (where created_at >= now() - interval '7 days')::bigint as last_7d_count,
            max(updated_at) as last_prompt_at
        from public.project_prompt_items
        group by project_id
    ),
    project_leaderboard_rows as (
        select
            p.id as project_id,
            p.title,
            p.updated_at,
            greatest(
                p.updated_at,
                coalesce(pgc.last_generation_at, p.updated_at),
                coalesce(pmc.last_media_at, p.updated_at),
                coalesce(ppc.last_prompt_at, p.updated_at)
            ) as last_activity_at,
            coalesce(pgc.total_count, 0::bigint) as generation_total,
            coalesce(pgc.last_24h_count, 0::bigint) as generation_last_24h,
            coalesce(pgc.last_7d_count, 0::bigint) as generation_last_7d,
            coalesce(pmc.total_count, 0::bigint) as media_total,
            coalesce(pmc.last_24h_count, 0::bigint) as media_last_24h,
            coalesce(pmc.last_7d_count, 0::bigint) as media_last_7d,
            coalesce(ppc.total_count, 0::bigint) as prompt_total,
            coalesce(ppc.last_24h_count, 0::bigint) as prompt_last_24h,
            coalesce(ppc.last_7d_count, 0::bigint) as prompt_last_7d
        from public.projects p
        left join project_generation_counts pgc
          on pgc.project_id = p.id
        left join project_media_counts pmc
          on pmc.project_id = p.id
        left join project_prompt_counts ppc
          on ppc.project_id = p.id
    )
    select jsonb_build_object(
        'overview',
        jsonb_build_object(
            'generateClicks', jsonb_build_object(
                'total', oc.total_generate_clicks,
                'last24h', oc.generate_clicks_last_24h,
                'last7d', oc.generate_clicks_last_7d
            ),
            'acceptedGenerations', jsonb_build_object(
                'total', og.total_generations,
                'last24h', og.generations_last_24h,
                'last7d', og.generations_last_7d
            ),
            'successfulGenerations', jsonb_build_object(
                'total', og.successful_generations_total,
                'last24h', og.successful_generations_last_24h,
                'last7d', og.successful_generations_last_7d
            ),
            'failedGenerations', jsonb_build_object(
                'total', og.failed_generations_total,
                'last24h', og.failed_generations_last_24h,
                'last7d', og.failed_generations_last_7d
            ),
            'savedGenerations', jsonb_build_object(
                'total', os.total_saved_generations,
                'last24h', os.saved_generations_last_24h,
                'last7d', os.saved_generations_last_7d
            ),
            'projectAttachedGenerations', jsonb_build_object(
                'total', op.total_project_attached_generations,
                'last24h', op.project_attached_generations_last_24h,
                'last7d', op.project_attached_generations_last_7d
            ),
            'pendingGenerations', og.pending_generations,
            'runningGenerations', og.running_generations,
            'uniqueModels', og.unique_models,
            'uniqueGenerationUsers', og.unique_generation_users,
            'uniqueClickUsers', oc.unique_click_users,
            'uniqueSavingUsers', os.unique_saving_users,
            'lastGenerateClickAt', oc.last_generate_click_at,
            'lastGenerationAt', og.last_generation_at,
            'lastSavedGenerationAt', os.last_saved_generation_at
        ),
        'models',
        coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'modelId', model_id,
                    'generateClicks', jsonb_build_object(
                        'total', generate_clicks_total,
                        'last24h', generate_clicks_last_24h,
                        'last7d', generate_clicks_last_7d
                    ),
                    'acceptedGenerations', jsonb_build_object(
                        'total', accepted_generations_total,
                        'last24h', accepted_generations_last_24h,
                        'last7d', accepted_generations_last_7d
                    ),
                    'successfulGenerations', jsonb_build_object(
                        'total', successful_generations_total,
                        'last24h', successful_generations_last_24h,
                        'last7d', successful_generations_last_7d
                    ),
                    'failedGenerations', jsonb_build_object(
                        'total', failed_generations_total,
                        'last24h', failed_generations_last_24h,
                        'last7d', failed_generations_last_7d
                    ),
                    'savedGenerations', jsonb_build_object(
                        'total', saved_generations_total,
                        'last24h', saved_generations_last_24h,
                        'last7d', saved_generations_last_7d
                    ),
                    'pendingGenerations', pending_generations,
                    'runningGenerations', running_generations,
                    'uniqueGenerationUsers', unique_generation_users,
                    'uniqueClickUsers', unique_click_users,
                    'uniqueSavingUsers', unique_saving_users,
                    'lastGenerateClickAt', last_generate_click_at,
                    'lastGenerationAt', last_generation_at,
                    'lastSavedGenerationAt', last_saved_generation_at
                )
                order by
                    accepted_generations_total desc,
                    generate_clicks_total desc,
                    saved_generations_total desc,
                    last_generation_at desc nulls last,
                    model_id asc
            )
            from model_rows
        ), '[]'::jsonb),
        'workflows',
        jsonb_build_object(
            'byTool',
            coalesce((
                select jsonb_agg(
                    jsonb_build_object(
                        'toolKey', tool_key,
                        'generateClicks', jsonb_build_object(
                            'total', generate_clicks_total,
                            'last24h', generate_clicks_last_24h,
                            'last7d', generate_clicks_last_7d
                        ),
                        'styleClicks', jsonb_build_object(
                            'total', style_clicks_total,
                            'last24h', style_clicks_last_24h,
                            'last7d', style_clicks_last_7d
                        ),
                        'characterModeClicks', jsonb_build_object(
                            'total', character_mode_clicks_total,
                            'last24h', character_mode_clicks_last_24h,
                            'last7d', character_mode_clicks_last_7d
                        ),
                        'referenceAssistedClicks', jsonb_build_object(
                            'total', reference_assisted_clicks_total,
                            'last24h', reference_assisted_clicks_last_24h,
                            'last7d', reference_assisted_clicks_last_7d
                        ),
                        'uniqueClickUsers', unique_click_users,
                        'lastGenerateClickAt', last_generate_click_at
                    )
                    order by generate_clicks_total desc, last_generate_click_at desc nulls last, tool_key asc
                )
                from workflow_tool_rows
            ), '[]'::jsonb),
            'byMode',
            coalesce((
                select jsonb_agg(
                    jsonb_build_object(
                        'modeKey', mode_key,
                        'generateClicks', jsonb_build_object(
                            'total', generate_clicks_total,
                            'last24h', generate_clicks_last_24h,
                            'last7d', generate_clicks_last_7d
                        ),
                        'acceptedGenerations', jsonb_build_object(
                            'total', accepted_generations_total,
                            'last24h', accepted_generations_last_24h,
                            'last7d', accepted_generations_last_7d
                        ),
                        'successfulGenerations', jsonb_build_object(
                            'total', successful_generations_total,
                            'last24h', successful_generations_last_24h,
                            'last7d', successful_generations_last_7d
                        ),
                        'failedGenerations', jsonb_build_object(
                            'total', failed_generations_total,
                            'last24h', failed_generations_last_24h,
                            'last7d', failed_generations_last_7d
                        ),
                        'styleAppliedGenerations', jsonb_build_object(
                            'total', style_applied_total,
                            'last24h', style_applied_last_24h,
                            'last7d', style_applied_last_7d
                        ),
                        'characterModeGenerations', jsonb_build_object(
                            'total', character_mode_total,
                            'last24h', character_mode_last_24h,
                            'last7d', character_mode_last_7d
                        ),
                        'referenceAssistedGenerations', jsonb_build_object(
                            'total', reference_assisted_total,
                            'last24h', reference_assisted_last_24h,
                            'last7d', reference_assisted_last_7d
                        ),
                        'lastGenerationAt', last_generation_at
                    )
                    order by accepted_generations_total desc, generate_clicks_total desc, mode_key asc
                )
                from workflow_mode_rows
            ), '[]'::jsonb),
            'highlights',
            jsonb_build_object(
                'styleAppliedGenerations', jsonb_build_object(
                    'total', wh.style_applied_generations_total,
                    'last24h', wh.style_applied_generations_last_24h,
                    'last7d', wh.style_applied_generations_last_7d
                ),
                'characterModeGenerations', jsonb_build_object(
                    'total', wh.character_mode_generations_total,
                    'last24h', wh.character_mode_generations_last_24h,
                    'last7d', wh.character_mode_generations_last_7d
                ),
                'referenceAssistedGenerations', jsonb_build_object(
                    'total', wh.reference_assisted_generations_total,
                    'last24h', wh.reference_assisted_generations_last_24h,
                    'last7d', wh.reference_assisted_generations_last_7d
                ),
                'styleClicks', jsonb_build_object(
                    'total', wch.style_clicks_total,
                    'last24h', wch.style_clicks_last_24h,
                    'last7d', wch.style_clicks_last_7d
                ),
                'characterModeClicks', jsonb_build_object(
                    'total', wch.character_mode_clicks_total,
                    'last24h', wch.character_mode_clicks_last_24h,
                    'last7d', wch.character_mode_clicks_last_7d
                ),
                'referenceAssistedClicks', jsonb_build_object(
                    'total', wch.reference_assisted_clicks_total,
                    'last24h', wch.reference_assisted_clicks_last_24h,
                    'last7d', wch.reference_assisted_clicks_last_7d
                )
            )
        ),
        'assets',
        jsonb_build_object(
            'events',
            coalesce((
                select jsonb_agg(
                    jsonb_build_object(
                        'eventType', event_type,
                        'count', jsonb_build_object(
                            'total', total_count,
                            'last24h', last_24h_count,
                            'last7d', last_7d_count
                        ),
                        'uniqueUsers', unique_users,
                        'lastEventAt', last_event_at
                    )
                    order by total_count desc, last_event_at desc nulls last, event_type asc
                )
                from asset_event_rows
            ), '[]'::jsonb),
            'autosave',
            jsonb_build_object(
                'autoPersisted', jsonb_build_object(
                    'total', aus.auto_persisted_total,
                    'last24h', aus.auto_persisted_last_24h,
                    'last7d', aus.auto_persisted_last_7d
                ),
                'autosaveSkipped', jsonb_build_object(
                    'total', aus.autosave_skipped_total,
                    'last24h', aus.autosave_skipped_last_24h,
                    'last7d', aus.autosave_skipped_last_7d
                )
            )
        ),
        'projects',
        jsonb_build_object(
            'summary',
            jsonb_build_object(
                'projectsCreated', jsonb_build_object(
                    'total', ps.projects_created_total,
                    'last24h', ps.projects_created_last_24h,
                    'last7d', ps.projects_created_last_7d
                ),
                'activeProjectsWithGenerations', jsonb_build_object(
                    'total', ps.active_projects_with_generations_total,
                    'last24h', ps.active_projects_with_generations_last_24h,
                    'last7d', ps.active_projects_with_generations_last_7d
                ),
                'attachedGenerations', jsonb_build_object(
                    'total', ps.attached_generations_total,
                    'last24h', ps.attached_generations_last_24h,
                    'last7d', ps.attached_generations_last_7d
                ),
                'attachedMedia', jsonb_build_object(
                    'total', ps.attached_media_total,
                    'last24h', ps.attached_media_last_24h,
                    'last7d', ps.attached_media_last_7d
                ),
                'attachedPrompts', jsonb_build_object(
                    'total', ps.attached_prompts_total,
                    'last24h', ps.attached_prompts_last_24h,
                    'last7d', ps.attached_prompts_last_7d
                )
            ),
            'leaderboard',
            coalesce((
                select jsonb_agg(
                    jsonb_build_object(
                        'projectId', project_id,
                        'title', title,
                        'generationCount', jsonb_build_object(
                            'total', generation_total,
                            'last24h', generation_last_24h,
                            'last7d', generation_last_7d
                        ),
                        'mediaCount', jsonb_build_object(
                            'total', media_total,
                            'last24h', media_last_24h,
                            'last7d', media_last_7d
                        ),
                        'promptCount', jsonb_build_object(
                            'total', prompt_total,
                            'last24h', prompt_last_24h,
                            'last7d', prompt_last_7d
                        ),
                        'updatedAt', updated_at,
                        'lastActivityAt', last_activity_at
                    )
                    order by generation_total desc, media_total desc, prompt_total desc, last_activity_at desc nulls last, title asc
                )
                from project_leaderboard_rows
            ), '[]'::jsonb)
        )
    )
    into v_payload
    from overview_clicks oc
    cross join overview_generations og
    cross join overview_saves os
    cross join overview_projects op
    cross join workflow_highlights wh
    cross join workflow_click_highlights wch
    cross join autosave_summary aus
    cross join project_summary ps;

    return coalesce(v_payload, '{}'::jsonb);
end;
$$;

revoke all on function public.get_admin_global_stats_v1() from public, anon, authenticated;
grant execute on function public.get_admin_global_stats_v1() to service_role;
