-- Add service-role-only admin global stats RPCs for generation usage analytics.

create or replace function public.get_admin_global_stats_summary()
returns table (
    total_generate_clicks bigint,
    generate_clicks_last_24h bigint,
    generate_clicks_last_7d bigint,
    total_generations bigint,
    generations_last_24h bigint,
    generations_last_7d bigint,
    successful_generations bigint,
    failed_generations bigint,
    pending_generations bigint,
    running_generations bigint,
    unique_models bigint,
    unique_generation_users bigint,
    unique_click_users bigint,
    last_generate_click_at timestamptz,
    last_generation_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can read admin global stats summary';
    end if;

    return query
    with click_stats as (
        select
            count(*)::bigint as total_generate_clicks,
            count(*) filter (
                where occurred_at >= now() - interval '24 hours'
            )::bigint as generate_clicks_last_24h,
            count(*) filter (
                where occurred_at >= now() - interval '7 days'
            )::bigint as generate_clicks_last_7d,
            count(distinct user_id)::bigint as unique_click_users,
            max(occurred_at) as last_generate_click_at
        from public.app_error_events
        where source = 'telemetry.ai_studio.generate_clicked'
    ),
    generation_stats as (
        select
            count(*)::bigint as total_generations,
            count(*) filter (
                where created_at >= now() - interval '24 hours'
            )::bigint as generations_last_24h,
            count(*) filter (
                where created_at >= now() - interval '7 days'
            )::bigint as generations_last_7d,
            count(*) filter (
                where status = 'success'
            )::bigint as successful_generations,
            count(*) filter (
                where status in ('fail', 'failed')
            )::bigint as failed_generations,
            count(*) filter (
                where status = 'pending'
            )::bigint as pending_generations,
            count(*) filter (
                where status = 'running'
            )::bigint as running_generations,
            count(distinct nullif(trim(coalesce(model_id, '')), ''))::bigint as unique_models,
            count(distinct user_id)::bigint as unique_generation_users,
            max(created_at) as last_generation_at
        from public.ai_generations
    )
    select
        click_stats.total_generate_clicks,
        click_stats.generate_clicks_last_24h,
        click_stats.generate_clicks_last_7d,
        generation_stats.total_generations,
        generation_stats.generations_last_24h,
        generation_stats.generations_last_7d,
        generation_stats.successful_generations,
        generation_stats.failed_generations,
        generation_stats.pending_generations,
        generation_stats.running_generations,
        generation_stats.unique_models,
        generation_stats.unique_generation_users,
        click_stats.unique_click_users,
        click_stats.last_generate_click_at,
        generation_stats.last_generation_at
    from click_stats
    cross join generation_stats;
end;
$$;

create or replace function public.list_admin_model_usage_stats(
    p_limit integer default 50
)
returns table (
    model_id text,
    generate_clicks bigint,
    generate_clicks_last_24h bigint,
    generate_clicks_last_7d bigint,
    generations_started bigint,
    generations_last_24h bigint,
    generations_last_7d bigint,
    successful_generations bigint,
    failed_generations bigint,
    pending_generations bigint,
    running_generations bigint,
    unique_generation_users bigint,
    unique_click_users bigint,
    last_generate_click_at timestamptz,
    last_generation_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can read admin model usage stats';
    end if;

    return query
    with click_stats as (
        select
            coalesce(nullif(trim(coalesce(metadata->>'model_id', '')), ''), 'unknown') as model_id,
            count(*)::bigint as generate_clicks,
            count(*) filter (
                where occurred_at >= now() - interval '24 hours'
            )::bigint as generate_clicks_last_24h,
            count(*) filter (
                where occurred_at >= now() - interval '7 days'
            )::bigint as generate_clicks_last_7d,
            count(distinct user_id)::bigint as unique_click_users,
            max(occurred_at) as last_generate_click_at
        from public.app_error_events
        where source = 'telemetry.ai_studio.generate_clicked'
        group by 1
    ),
    generation_stats as (
        select
            coalesce(nullif(trim(coalesce(model_id, '')), ''), 'unknown') as model_id,
            count(*)::bigint as generations_started,
            count(*) filter (
                where created_at >= now() - interval '24 hours'
            )::bigint as generations_last_24h,
            count(*) filter (
                where created_at >= now() - interval '7 days'
            )::bigint as generations_last_7d,
            count(*) filter (
                where status = 'success'
            )::bigint as successful_generations,
            count(*) filter (
                where status in ('fail', 'failed')
            )::bigint as failed_generations,
            count(*) filter (
                where status = 'pending'
            )::bigint as pending_generations,
            count(*) filter (
                where status = 'running'
            )::bigint as running_generations,
            count(distinct user_id)::bigint as unique_generation_users,
            max(created_at) as last_generation_at
        from public.ai_generations
        group by 1
    )
    select
        coalesce(generation_stats.model_id, click_stats.model_id) as model_id,
        coalesce(click_stats.generate_clicks, 0::bigint) as generate_clicks,
        coalesce(click_stats.generate_clicks_last_24h, 0::bigint) as generate_clicks_last_24h,
        coalesce(click_stats.generate_clicks_last_7d, 0::bigint) as generate_clicks_last_7d,
        coalesce(generation_stats.generations_started, 0::bigint) as generations_started,
        coalesce(generation_stats.generations_last_24h, 0::bigint) as generations_last_24h,
        coalesce(generation_stats.generations_last_7d, 0::bigint) as generations_last_7d,
        coalesce(generation_stats.successful_generations, 0::bigint) as successful_generations,
        coalesce(generation_stats.failed_generations, 0::bigint) as failed_generations,
        coalesce(generation_stats.pending_generations, 0::bigint) as pending_generations,
        coalesce(generation_stats.running_generations, 0::bigint) as running_generations,
        coalesce(generation_stats.unique_generation_users, 0::bigint) as unique_generation_users,
        coalesce(click_stats.unique_click_users, 0::bigint) as unique_click_users,
        click_stats.last_generate_click_at,
        generation_stats.last_generation_at
    from generation_stats
    full outer join click_stats
      on click_stats.model_id = generation_stats.model_id
    order by
        coalesce(generation_stats.generations_started, 0::bigint) desc,
        coalesce(click_stats.generate_clicks, 0::bigint) desc,
        generation_stats.last_generation_at desc nulls last,
        click_stats.last_generate_click_at desc nulls last,
        coalesce(generation_stats.model_id, click_stats.model_id) asc
    limit v_limit;
end;
$$;

revoke all on function public.get_admin_global_stats_summary() from public, anon, authenticated;
grant execute on function public.get_admin_global_stats_summary() to service_role;

revoke all on function public.list_admin_model_usage_stats(integer) from public, anon, authenticated;
grant execute on function public.list_admin_model_usage_stats(integer) to service_role;
