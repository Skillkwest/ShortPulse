-- Roll back migration 101 by restoring the pre-101 function definitions.
-- This intentionally returns the schema to the prior state for controlled
-- rollback windows, including the original lint-flagged definitions.

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

create or replace function public.rollback_model_pricing_policy(
    p_reason text default null,
    p_actor_user_id uuid default null,
    p_actor_email text default null,
    p_source text default 'admin_api'
)
returns table (
    status text,
    active_policy_version integer,
    active_policy_version_id bigint,
    message text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_runtime public.model_pricing_policy_runtime%rowtype;
    v_active public.model_pricing_policy_versions%rowtype;
    v_safe public.model_pricing_policy_versions%rowtype;
    v_reason text;
    v_actor_email text;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can rollback model pricing policy';
    end if;

    v_reason := nullif(left(trim(coalesce(p_reason, '')), 400), '');
    v_actor_email := nullif(left(trim(coalesce(p_actor_email, '')), 320), '');

    perform pg_advisory_xact_lock(hashtext('model_pricing_policy_runtime'));

    select *
    into v_runtime
    from public.model_pricing_policy_runtime
    where singleton = true
    for update;

    if not found then
        return query
        select 'not_initialized'::text, null::integer, null::bigint, 'Model pricing control plane is not initialized.'::text;
        return;
    end if;

    if v_runtime.last_known_safe_policy_version_id is null
       or v_runtime.last_known_safe_policy_version_id = v_runtime.active_policy_version_id then
        select version, id
        into v_active
        from public.model_pricing_policy_versions
        where id = v_runtime.active_policy_version_id;

        return query
        select 'already_safe'::text, v_active.version, v_active.id, 'Active policy is already the last-known-safe version.'::text;
        return;
    end if;

    select *
    into v_active
    from public.model_pricing_policy_versions
    where id = v_runtime.active_policy_version_id;

    select *
    into v_safe
    from public.model_pricing_policy_versions
    where id = v_runtime.last_known_safe_policy_version_id;

    update public.model_pricing_policy_runtime
    set active_policy_version_id = v_safe.id,
        last_known_safe_policy_version_id = v_active.id,
        updated_by_user_id = p_actor_user_id,
        updated_by_email = v_actor_email,
        updated_at = now()
    where singleton = true;

    insert into public.model_pricing_policy_events (
        event_type,
        from_policy_version_id,
        to_policy_version_id,
        actor_user_id,
        actor_email,
        reason,
        note,
        source,
        metadata
    )
    values (
        'rollback',
        v_active.id,
        v_safe.id,
        p_actor_user_id,
        v_actor_email,
        v_reason,
        null,
        left(trim(coalesce(p_source, 'admin_api')), 64),
        jsonb_build_object(
            'rolled_back_from_version', v_active.version,
            'restored_version', v_safe.version
        )
    );

    return query
    select 'rolled_back'::text, v_safe.version, v_safe.id, null::text;
end;
$$;
