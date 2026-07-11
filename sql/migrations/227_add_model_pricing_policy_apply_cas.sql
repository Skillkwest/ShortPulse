-- Add a compare-and-swap apply signature for model-pricing policy activation.
-- The legacy signature remains temporarily available for deployed-call ordering.

create or replace function public.apply_model_pricing_policy(
    p_policy jsonb,
    p_expected_active_policy_version_id bigint,
    p_custom_rows jsonb default '{"schemaVersion":1,"rowsByModel":{}}'::jsonb,
    p_note text default null,
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
    v_current public.model_pricing_policy_versions%rowtype;
    v_inserted_id bigint;
    v_next_version integer;
    v_policy jsonb;
    v_custom_rows jsonb;
    v_note text;
    v_reason text;
    v_actor_email text;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can apply model pricing policy';
    end if;

    if p_policy is null or jsonb_typeof(p_policy) <> 'object' then
        return query
        select 'rejected'::text, null::integer, null::bigint, 'policy must be a JSON object.'::text;
        return;
    end if;

    if p_custom_rows is null or jsonb_typeof(p_custom_rows) <> 'object' then
        return query
        select 'rejected'::text, null::integer, null::bigint, 'custom_rows must be a JSON object.'::text;
        return;
    end if;

    if p_expected_active_policy_version_id is null then
        return query
        select 'rejected'::text, null::integer, null::bigint,
            'expected active policy version id is required.'::text;
        return;
    end if;

    v_policy := p_policy;
    v_custom_rows := p_custom_rows;
    v_note := nullif(left(trim(coalesce(p_note, '')), 400), '');
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
        select 'not_initialized'::text, null::integer, null::bigint,
            'Model pricing control plane is not initialized.'::text;
        return;
    end if;

    select *
    into v_current
    from public.model_pricing_policy_versions
    where id = v_runtime.active_policy_version_id;

    if v_runtime.active_policy_version_id is distinct from p_expected_active_policy_version_id then
        return query
        select 'rejected'::text, v_current.version, v_current.id,
            'Active model pricing policy changed. Refresh and review the candidate again.'::text;
        return;
    end if;

    if found
       and v_current.policy = v_policy
       and coalesce(v_current.custom_rows, '{"schemaVersion":1,"rowsByModel":{}}'::jsonb) = v_custom_rows then
        return query
        select 'activated'::text, v_current.version, v_current.id,
            'Submitted policy already matches the active version.'::text;
        return;
    end if;

    select coalesce(max(version), 0) + 1
    into v_next_version
    from public.model_pricing_policy_versions;

    insert into public.model_pricing_policy_versions (
        version,
        policy,
        custom_rows,
        note,
        created_by_user_id,
        created_by_email
    )
    values (
        v_next_version,
        v_policy,
        v_custom_rows,
        v_note,
        p_actor_user_id,
        v_actor_email
    )
    returning id into v_inserted_id;

    update public.model_pricing_policy_runtime
    set active_policy_version_id = v_inserted_id,
        last_known_safe_policy_version_id = v_runtime.active_policy_version_id,
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
        'apply',
        v_runtime.active_policy_version_id,
        v_inserted_id,
        p_actor_user_id,
        v_actor_email,
        v_reason,
        v_note,
        left(trim(coalesce(p_source, 'admin_api')), 64),
        jsonb_build_object(
            'version', v_next_version,
            'expected_active_policy_version_id', p_expected_active_policy_version_id
        )
    );

    return query
    select 'activated'::text, v_next_version, v_inserted_id, null::text;
end;
$$;

revoke all on function public.apply_model_pricing_policy(
    jsonb,
    bigint,
    jsonb,
    text,
    text,
    uuid,
    text,
    text
) from public;
revoke all on function public.apply_model_pricing_policy(
    jsonb,
    bigint,
    jsonb,
    text,
    text,
    uuid,
    text,
    text
) from anon;
revoke all on function public.apply_model_pricing_policy(
    jsonb,
    bigint,
    jsonb,
    text,
    text,
    uuid,
    text,
    text
) from authenticated;
grant execute on function public.apply_model_pricing_policy(
    jsonb,
    bigint,
    jsonb,
    text,
    text,
    uuid,
    text,
    text
) to service_role;
