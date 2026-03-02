-- Add AI Studio agent safety control-plane persistence foundation.
-- Introduces profile-version catalog, singleton runtime state, audit events, and service-role RPCs.

create table if not exists public.agent_safety_policy_versions (
    id bigint generated always as identity primary key,
    profile_id text not null,
    version integer not null default 1,
    policy jsonb not null default '{}'::jsonb,
    is_enabled boolean not null default true,
    note text,
    created_by_user_id uuid references auth.users(id) on delete set null,
    created_by_email text,
    created_at timestamptz not null default now(),
    constraint agent_safety_policy_versions_profile_check check (
        profile_id in ('prod_safe_v1', 'staging_lenient', 'dev_absolute_zero')
    ),
    constraint agent_safety_policy_versions_version_check check (version >= 1),
    constraint agent_safety_policy_versions_policy_object_check check (jsonb_typeof(policy) = 'object')
);

create unique index if not exists ux_agent_safety_policy_versions_profile_version
    on public.agent_safety_policy_versions (profile_id, version);

create index if not exists ix_agent_safety_policy_versions_profile_created
    on public.agent_safety_policy_versions (profile_id, created_at desc, id desc);

create table if not exists public.agent_safety_policy_runtime (
    singleton boolean primary key default true check (singleton),
    active_policy_version_id bigint not null references public.agent_safety_policy_versions(id),
    last_known_safe_policy_version_id bigint
        references public.agent_safety_policy_versions(id),
    cooldown_until timestamptz,
    updated_by_user_id uuid references auth.users(id) on delete set null,
    updated_by_email text,
    updated_at timestamptz not null default now()
);

create table if not exists public.agent_safety_policy_events (
    id bigint generated always as identity primary key,
    event_type text not null,
    from_policy_version_id bigint references public.agent_safety_policy_versions(id),
    to_policy_version_id bigint references public.agent_safety_policy_versions(id),
    actor_user_id uuid references auth.users(id) on delete set null,
    actor_email text,
    reason text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint agent_safety_policy_events_type_check check (
        event_type in ('activate', 'rollback', 'cooldown_blocked')
    ),
    constraint agent_safety_policy_events_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index if not exists ix_agent_safety_policy_events_created
    on public.agent_safety_policy_events (created_at desc, id desc);

create index if not exists ix_agent_safety_policy_events_type_created
    on public.agent_safety_policy_events (event_type, created_at desc, id desc);

alter table public.agent_safety_policy_versions enable row level security;
alter table public.agent_safety_policy_runtime enable row level security;
alter table public.agent_safety_policy_events enable row level security;

with seed_rows (profile_id, policy) as (
    values
        (
            'prod_safe_v1'::text,
            jsonb_build_object(
                'text', jsonb_build_object('safe', 'allow', 'sexual_suggestive', 'rewrite', 'sexual_explicit', 'refuse'),
                'image', jsonb_build_object('safe', 'allow', 'sexual_suggestive', 'rewrite', 'sexual_explicit', 'refuse'),
                'video', jsonb_build_object('safe', 'allow', 'sexual_suggestive', 'rewrite', 'sexual_explicit', 'refuse')
            )
        ),
        (
            'staging_lenient'::text,
            jsonb_build_object(
                'text', jsonb_build_object('safe', 'allow', 'sexual_suggestive', 'rewrite', 'sexual_explicit', 'rewrite'),
                'image', jsonb_build_object('safe', 'allow', 'sexual_suggestive', 'rewrite', 'sexual_explicit', 'rewrite'),
                'video', jsonb_build_object('safe', 'allow', 'sexual_suggestive', 'rewrite', 'sexual_explicit', 'rewrite')
            )
        ),
        (
            'dev_absolute_zero'::text,
            jsonb_build_object(
                'text', jsonb_build_object('safe', 'allow', 'sexual_suggestive', 'allow', 'sexual_explicit', 'allow'),
                'image', jsonb_build_object('safe', 'allow', 'sexual_suggestive', 'allow', 'sexual_explicit', 'allow'),
                'video', jsonb_build_object('safe', 'allow', 'sexual_suggestive', 'allow', 'sexual_explicit', 'allow')
            )
        )
)
insert into public.agent_safety_policy_versions (
    profile_id,
    version,
    policy,
    is_enabled,
    note,
    created_by_email
)
select
    seed_rows.profile_id,
    1,
    seed_rows.policy,
    true,
    'baseline_seed_v1',
    'system_seed'
from seed_rows
where not exists (
    select 1
    from public.agent_safety_policy_versions existing
    where existing.profile_id = seed_rows.profile_id
      and existing.version = 1
);

with prod_seed as (
    select id
    from public.agent_safety_policy_versions
    where profile_id = 'prod_safe_v1'
      and version = 1
    order by id desc
    limit 1
)
insert into public.agent_safety_policy_runtime (
    singleton,
    active_policy_version_id,
    last_known_safe_policy_version_id,
    updated_by_email
)
select
    true,
    prod_seed.id,
    prod_seed.id,
    'system_seed'
from prod_seed
where not exists (
    select 1
    from public.agent_safety_policy_runtime runtime
    where runtime.singleton = true
);

create or replace function public.get_active_agent_safety_policy()
returns table (
    active_profile_id text,
    active_policy_version integer,
    active_policy jsonb,
    active_policy_version_id bigint,
    last_known_safe_profile_id text,
    last_known_safe_policy_version integer,
    last_known_safe_policy_version_id bigint,
    cooldown_until timestamptz,
    updated_at timestamptz,
    updated_by_user_id uuid,
    updated_by_email text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can read agent safety control plane';
    end if;

    return query
    select
        active.profile_id,
        active.version,
        active.policy,
        active.id,
        safe.profile_id,
        safe.version,
        safe.id,
        runtime.cooldown_until,
        runtime.updated_at,
        runtime.updated_by_user_id,
        runtime.updated_by_email
    from public.agent_safety_policy_runtime runtime
    join public.agent_safety_policy_versions active
      on active.id = runtime.active_policy_version_id
    left join public.agent_safety_policy_versions safe
      on safe.id = runtime.last_known_safe_policy_version_id
    where runtime.singleton = true
    limit 1;
end;
$$;

create or replace function public.activate_agent_safety_policy(
    p_profile_id text,
    p_reason text,
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
    v_reason text;
    v_actor_email text;
    v_runtime public.agent_safety_policy_runtime%rowtype;
    v_target public.agent_safety_policy_versions%rowtype;
    v_now timestamptz;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can activate agent safety policy';
    end if;

    v_profile_id := lower(trim(coalesce(p_profile_id, '')));
    if v_profile_id not in ('prod_safe_v1', 'staging_lenient', 'dev_absolute_zero') then
        return query select 'profile_not_found'::text, null::text, null::integer, null::timestamptz, 'Unknown profile id.'::text;
        return;
    end if;

    if p_single_reviewer_ack is distinct from true then
        return query select 'rejected'::text, null::text, null::integer, null::timestamptz, 'singleReviewerAck is required.'::text;
        return;
    end if;

    v_reason := left(trim(coalesce(p_reason, '')), 400);
    if v_reason = '' then
        v_reason := null;
    end if;
    v_actor_email := nullif(left(trim(coalesce(p_actor_email, '')), 320), '');
    v_now := now();

    perform pg_advisory_xact_lock(hashtext('agent_safety_policy_runtime'));

    select *
    into v_runtime
    from public.agent_safety_policy_runtime
    where singleton = true
    for update;

    if not found then
        return query select 'not_initialized'::text, null::text, null::integer, null::timestamptz, 'Runtime row is missing.'::text;
        return;
    end if;

    if v_runtime.cooldown_until is not null and v_runtime.cooldown_until > v_now then
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
            'cooldown_blocked',
            v_runtime.active_policy_version_id,
            null,
            p_actor_user_id,
            v_actor_email,
            v_reason,
            jsonb_build_object(
                'source', coalesce(p_source, 'admin_api'),
                'requested_profile_id', v_profile_id,
                'cooldown_until', v_runtime.cooldown_until
            )
        );

        return query
        select
            'cooldown_blocked'::text,
            null::text,
            null::integer,
            v_runtime.cooldown_until,
            'Activation blocked during cooldown window.'::text;
        return;
    end if;

    select *
    into v_target
    from public.agent_safety_policy_versions versions
    where versions.profile_id = v_profile_id
      and versions.is_enabled is true
    order by versions.version desc, versions.id desc
    limit 1;

    if not found then
        return query
        select
            'profile_not_found'::text,
            null::text,
            null::integer,
            v_runtime.cooldown_until,
            'No enabled policy version found for profile.'::text;
        return;
    end if;

    if v_runtime.active_policy_version_id = v_target.id then
        return query
        select
            'already_active'::text,
            v_target.profile_id,
            v_target.version,
            v_runtime.cooldown_until,
            null::text;
        return;
    end if;

    update public.agent_safety_policy_runtime runtime
    set active_policy_version_id = v_target.id,
        last_known_safe_policy_version_id = case
            when v_target.profile_id = 'prod_safe_v1' then v_target.id
            else runtime.last_known_safe_policy_version_id
        end,
        cooldown_until = null,
        updated_by_user_id = p_actor_user_id,
        updated_by_email = v_actor_email,
        updated_at = v_now
    where runtime.singleton = true;

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
        'activate',
        v_runtime.active_policy_version_id,
        v_target.id,
        p_actor_user_id,
        v_actor_email,
        v_reason,
        jsonb_build_object(
            'source', coalesce(p_source, 'admin_api'),
            'single_reviewer_ack', p_single_reviewer_ack
        )
    );

    return query
    select
        'activated'::text,
        v_target.profile_id,
        v_target.version,
        null::timestamptz,
        null::text;
end;
$$;

create or replace function public.rollback_agent_safety_policy(
    p_reason text,
    p_actor_user_id uuid default null,
    p_actor_email text default null,
    p_source text default 'manual',
    p_cooldown_hours integer default 24
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
    v_reason text;
    v_actor_email text;
    v_runtime public.agent_safety_policy_runtime%rowtype;
    v_target public.agent_safety_policy_versions%rowtype;
    v_now timestamptz;
    v_cooldown_hours integer;
    v_cooldown_until timestamptz;
    v_status text;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can rollback agent safety policy';
    end if;

    v_reason := left(trim(coalesce(p_reason, '')), 400);
    if v_reason = '' then
        v_reason := null;
    end if;
    v_actor_email := nullif(left(trim(coalesce(p_actor_email, '')), 320), '');
    v_now := now();
    v_cooldown_hours := least(greatest(coalesce(p_cooldown_hours, 24), 1), 168);
    v_cooldown_until := v_now + make_interval(hours => v_cooldown_hours);

    perform pg_advisory_xact_lock(hashtext('agent_safety_policy_runtime'));

    select *
    into v_runtime
    from public.agent_safety_policy_runtime
    where singleton = true
    for update;

    if not found then
        return query select 'not_initialized'::text, null::text, null::integer, null::timestamptz, 'Runtime row is missing.'::text;
        return;
    end if;

    if v_runtime.last_known_safe_policy_version_id is null then
        return query
        select
            'no_safe_target'::text,
            null::text,
            null::integer,
            null::timestamptz,
            'No last-known-safe policy version is available.'::text;
        return;
    end if;

    select *
    into v_target
    from public.agent_safety_policy_versions versions
    where versions.id = v_runtime.last_known_safe_policy_version_id
    limit 1;

    if not found then
        return query
        select
            'no_safe_target'::text,
            null::text,
            null::integer,
            null::timestamptz,
            'Configured last-known-safe policy version is missing.'::text;
        return;
    end if;

    v_status := case
        when v_runtime.active_policy_version_id = v_target.id then 'already_safe'
        else 'rolled_back'
    end;

    update public.agent_safety_policy_runtime runtime
    set active_policy_version_id = v_target.id,
        cooldown_until = v_cooldown_until,
        updated_by_user_id = p_actor_user_id,
        updated_by_email = v_actor_email,
        updated_at = v_now
    where runtime.singleton = true;

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
        'rollback',
        v_runtime.active_policy_version_id,
        v_target.id,
        p_actor_user_id,
        v_actor_email,
        v_reason,
        jsonb_build_object(
            'source', coalesce(p_source, 'manual'),
            'cooldown_hours', v_cooldown_hours
        )
    );

    return query
    select
        v_status,
        v_target.profile_id,
        v_target.version,
        v_cooldown_until,
        null::text;
end;
$$;

revoke all on table public.agent_safety_policy_versions from public;
revoke all on table public.agent_safety_policy_versions from anon;
revoke all on table public.agent_safety_policy_versions from authenticated;
grant all on table public.agent_safety_policy_versions to service_role;

revoke all on table public.agent_safety_policy_runtime from public;
revoke all on table public.agent_safety_policy_runtime from anon;
revoke all on table public.agent_safety_policy_runtime from authenticated;
grant all on table public.agent_safety_policy_runtime to service_role;

revoke all on table public.agent_safety_policy_events from public;
revoke all on table public.agent_safety_policy_events from anon;
revoke all on table public.agent_safety_policy_events from authenticated;
grant all on table public.agent_safety_policy_events to service_role;

grant usage, select on sequence public.agent_safety_policy_versions_id_seq to service_role;
grant usage, select on sequence public.agent_safety_policy_events_id_seq to service_role;
