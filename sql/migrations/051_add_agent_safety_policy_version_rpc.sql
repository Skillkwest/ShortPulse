-- Add control-plane RPC for creating new agent safety policy versions.

alter table public.agent_safety_policy_events
    drop constraint if exists agent_safety_policy_events_type_check;

alter table public.agent_safety_policy_events
    add constraint agent_safety_policy_events_type_check check (
        event_type in ('activate', 'rollback', 'cooldown_blocked', 'version_created')
    );

create or replace function public.create_agent_safety_policy_version(
    p_profile_id text,
    p_policy jsonb,
    p_note text default null,
    p_reason text default null,
    p_actor_user_id uuid default null,
    p_actor_email text default null,
    p_single_reviewer_ack boolean default false,
    p_source text default 'admin_api'
)
returns table (
    status text,
    active_profile_id text,
    active_policy_version integer,
    cooldown_until timestamptz,
    message text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_profile_id text;
    v_policy jsonb;
    v_note text;
    v_reason text;
    v_actor_email text;
    v_next_version integer;
    v_inserted_id bigint;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can create agent safety policy versions';
    end if;

    v_profile_id := lower(trim(coalesce(p_profile_id, '')));
    if v_profile_id not in ('prod_safe_v1', 'staging_lenient', 'dev_absolute_zero') then
        return query
        select 'profile_not_found'::text, null::text, null::integer, null::timestamptz, 'Unknown profile id.'::text;
        return;
    end if;

    if p_single_reviewer_ack is distinct from true then
        return query
        select 'rejected'::text, null::text, null::integer, null::timestamptz, 'singleReviewerAck is required.'::text;
        return;
    end if;

    if p_policy is null or jsonb_typeof(p_policy) <> 'object' then
        return query
        select 'rejected'::text, null::text, null::integer, null::timestamptz, 'policy must be a JSON object.'::text;
        return;
    end if;

    v_policy := p_policy;
    v_note := nullif(left(trim(coalesce(p_note, '')), 400), '');
    v_reason := nullif(left(trim(coalesce(p_reason, '')), 400), '');
    v_actor_email := nullif(left(trim(coalesce(p_actor_email, '')), 320), '');

    perform pg_advisory_xact_lock(hashtext('agent_safety_policy_versions'));

    select coalesce(max(version), 0) + 1
    into v_next_version
    from public.agent_safety_policy_versions
    where profile_id = v_profile_id;

    insert into public.agent_safety_policy_versions (
        profile_id,
        version,
        policy,
        is_enabled,
        note,
        created_by_user_id,
        created_by_email
    )
    values (
        v_profile_id,
        v_next_version,
        v_policy,
        true,
        v_note,
        p_actor_user_id,
        v_actor_email
    )
    returning id into v_inserted_id;

    insert into public.agent_safety_policy_events (
        event_type,
        from_policy_version_id,
        to_policy_version_id,
        actor_user_id,
        actor_email,
        reason,
        metadata
    )
    values (
        'version_created',
        null,
        v_inserted_id,
        p_actor_user_id,
        v_actor_email,
        v_reason,
        jsonb_build_object(
            'source', coalesce(p_source, 'admin_api'),
            'profile_id', v_profile_id,
            'version', v_next_version,
            'note', v_note
        )
    );

    return query
    select
        'created'::text,
        v_profile_id,
        v_next_version,
        null::timestamptz,
        null::text;
end;
$$;

revoke all on function public.create_agent_safety_policy_version(
    text,
    jsonb,
    text,
    text,
    uuid,
    text,
    boolean,
    text
) from public;
revoke all on function public.create_agent_safety_policy_version(
    text,
    jsonb,
    text,
    text,
    uuid,
    text,
    boolean,
    text
) from anon;
revoke all on function public.create_agent_safety_policy_version(
    text,
    jsonb,
    text,
    text,
    uuid,
    text,
    boolean,
    text
) from authenticated;
grant execute on function public.create_agent_safety_policy_version(
    text,
    jsonb,
    text,
    text,
    uuid,
    text,
    boolean,
    text
) to service_role;

