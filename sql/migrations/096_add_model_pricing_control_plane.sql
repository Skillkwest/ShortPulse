-- Add versioned model-pricing control-plane storage and service-role RPCs.
-- This becomes the shared authority for admin model-pricing edits, AI Studio estimates, and server billing.

create table if not exists public.model_pricing_policy_versions (
    id bigint generated always as identity primary key,
    version integer not null,
    policy jsonb not null default '{}'::jsonb,
    note text,
    created_by_user_id uuid references auth.users(id) on delete set null,
    created_by_email text,
    created_at timestamptz not null default now(),
    constraint model_pricing_policy_versions_version_check check (version >= 1),
    constraint model_pricing_policy_versions_policy_object_check check (jsonb_typeof(policy) = 'object')
);

create unique index if not exists ux_model_pricing_policy_versions_version
    on public.model_pricing_policy_versions (version);

create index if not exists ix_model_pricing_policy_versions_created
    on public.model_pricing_policy_versions (created_at desc, id desc);

create table if not exists public.model_pricing_policy_runtime (
    singleton boolean primary key default true check (singleton),
    active_policy_version_id bigint not null references public.model_pricing_policy_versions(id),
    last_known_safe_policy_version_id bigint
        references public.model_pricing_policy_versions(id),
    updated_by_user_id uuid references auth.users(id) on delete set null,
    updated_by_email text,
    updated_at timestamptz not null default now()
);

create table if not exists public.model_pricing_policy_events (
    id bigint generated always as identity primary key,
    event_type text not null,
    from_policy_version_id bigint references public.model_pricing_policy_versions(id),
    to_policy_version_id bigint references public.model_pricing_policy_versions(id),
    actor_user_id uuid references auth.users(id) on delete set null,
    actor_email text,
    reason text,
    note text,
    source text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint model_pricing_policy_events_type_check check (
        event_type in ('apply', 'rollback')
    ),
    constraint model_pricing_policy_events_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index if not exists ix_model_pricing_policy_events_created
    on public.model_pricing_policy_events (created_at desc, id desc);

alter table public.model_pricing_policy_versions enable row level security;
alter table public.model_pricing_policy_runtime enable row level security;
alter table public.model_pricing_policy_events enable row level security;

insert into public.model_pricing_policy_versions (
    version,
    policy,
    note,
    created_by_email
)
select
    1,
    jsonb_build_object(
        'schemaVersion', 1,
        'global', jsonb_build_object(
            'creditUsdScale', 100,
            'markupBps', 300,
            'defaultRoundingMode', 'nearest-5',
            'defaultRoundingIncrement', 5,
            'exceptionRoundingModelIds', jsonb_build_array(
                'fal-ai/flux-2/klein/9b',
                'fal-ai/bria/background/remove'
            )
        ),
        'perModel', jsonb_build_object()
    ),
    'baseline_seed_v1',
    'system_seed'
where not exists (
    select 1
    from public.model_pricing_policy_versions existing
    where existing.version = 1
);

with seed_version as (
    select id
    from public.model_pricing_policy_versions
    where version = 1
    order by id desc
    limit 1
)
insert into public.model_pricing_policy_runtime (
    singleton,
    active_policy_version_id,
    last_known_safe_policy_version_id,
    updated_by_email
)
select
    true,
    seed_version.id,
    seed_version.id,
    'system_seed'
from seed_version
where not exists (
    select 1
    from public.model_pricing_policy_runtime runtime
    where runtime.singleton = true
);

create or replace function public.get_active_model_pricing_policy()
returns table (
    active_policy_version integer,
    active_policy jsonb,
    active_policy_version_id bigint,
    last_known_safe_policy_version integer,
    last_known_safe_policy_version_id bigint,
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
        raise exception 'Only service_role can read model pricing control plane';
    end if;

    return query
    select
        active.version,
        active.policy,
        active.id,
        safe.version,
        safe.id,
        runtime.updated_at,
        runtime.updated_by_user_id,
        runtime.updated_by_email
    from public.model_pricing_policy_runtime runtime
    join public.model_pricing_policy_versions active
      on active.id = runtime.active_policy_version_id
    left join public.model_pricing_policy_versions safe
      on safe.id = runtime.last_known_safe_policy_version_id
    where runtime.singleton = true
    limit 1;
end;
$$;

create or replace function public.apply_model_pricing_policy(
    p_policy jsonb,
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

    v_policy := p_policy;
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
        select 'not_initialized'::text, null::integer, null::bigint, 'Model pricing control plane is not initialized.'::text;
        return;
    end if;

    select *
    into v_current
    from public.model_pricing_policy_versions
    where id = v_runtime.active_policy_version_id;

    if found and v_current.policy = v_policy then
        return query
        select 'activated'::text, v_current.version, v_current.id, 'Submitted policy already matches the active version.'::text;
        return;
    end if;

    select coalesce(max(version), 0) + 1
    into v_next_version
    from public.model_pricing_policy_versions;

    insert into public.model_pricing_policy_versions (
        version,
        policy,
        note,
        created_by_user_id,
        created_by_email
    )
    values (
        v_next_version,
        v_policy,
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
            'version', v_next_version
        )
    );

    return query
    select 'activated'::text, v_next_version, v_inserted_id, null::text;
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

revoke all on function public.get_active_model_pricing_policy() from public;
revoke all on function public.get_active_model_pricing_policy() from anon;
revoke all on function public.get_active_model_pricing_policy() from authenticated;
grant execute on function public.get_active_model_pricing_policy() to service_role;

revoke all on function public.apply_model_pricing_policy(
    jsonb,
    text,
    text,
    uuid,
    text,
    text
) from public;
revoke all on function public.apply_model_pricing_policy(
    jsonb,
    text,
    text,
    uuid,
    text,
    text
) from anon;
revoke all on function public.apply_model_pricing_policy(
    jsonb,
    text,
    text,
    uuid,
    text,
    text
) from authenticated;
grant execute on function public.apply_model_pricing_policy(
    jsonb,
    text,
    text,
    uuid,
    text,
    text
) to service_role;

revoke all on function public.rollback_model_pricing_policy(
    text,
    uuid,
    text,
    text
) from public;
revoke all on function public.rollback_model_pricing_policy(
    text,
    uuid,
    text,
    text
) from anon;
revoke all on function public.rollback_model_pricing_policy(
    text,
    uuid,
    text,
    text
) from authenticated;
grant execute on function public.rollback_model_pricing_policy(
    text,
    uuid,
    text,
    text
) to service_role;
