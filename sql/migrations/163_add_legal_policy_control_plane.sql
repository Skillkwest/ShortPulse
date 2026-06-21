-- Add versioned legal-policy control-plane storage and service-role RPCs.
-- This becomes the shared authority for public policy pages and admin legal edits.

create table if not exists public.legal_policy_versions (
    id bigint generated always as identity primary key,
    slug text not null,
    version integer not null,
    markdown text not null,
    note text,
    created_by_user_id uuid references auth.users(id) on delete set null,
    created_by_email text,
    created_at timestamptz not null default now(),
    constraint legal_policy_versions_slug_check check (
        slug in ('terms', 'privacy', 'refund-policy')
    ),
    constraint legal_policy_versions_version_check check (version >= 1),
    constraint legal_policy_versions_markdown_check check (length(trim(markdown)) > 0)
);

create unique index if not exists ux_legal_policy_versions_slug_version
    on public.legal_policy_versions (slug, version);

create index if not exists ix_legal_policy_versions_slug_created
    on public.legal_policy_versions (slug, created_at desc, id desc);

create table if not exists public.legal_policy_runtime (
    slug text primary key,
    active_policy_version_id bigint not null references public.legal_policy_versions(id),
    last_known_safe_policy_version_id bigint references public.legal_policy_versions(id),
    updated_by_user_id uuid references auth.users(id) on delete set null,
    updated_by_email text,
    updated_at timestamptz not null default now(),
    constraint legal_policy_runtime_slug_check check (
        slug in ('terms', 'privacy', 'refund-policy')
    )
);

create table if not exists public.legal_policy_events (
    id bigint generated always as identity primary key,
    slug text not null,
    event_type text not null,
    from_policy_version_id bigint references public.legal_policy_versions(id),
    to_policy_version_id bigint references public.legal_policy_versions(id),
    actor_user_id uuid references auth.users(id) on delete set null,
    actor_email text,
    reason text,
    note text,
    source text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint legal_policy_events_slug_check check (
        slug in ('terms', 'privacy', 'refund-policy')
    ),
    constraint legal_policy_events_type_check check (
        event_type in ('publish', 'rollback')
    ),
    constraint legal_policy_events_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index if not exists ix_legal_policy_events_slug_created
    on public.legal_policy_events (slug, created_at desc, id desc);

alter table public.legal_policy_versions enable row level security;
alter table public.legal_policy_runtime enable row level security;
alter table public.legal_policy_events enable row level security;

revoke all on public.legal_policy_versions from public, anon, authenticated;
revoke all on public.legal_policy_runtime from public, anon, authenticated;
revoke all on public.legal_policy_events from public, anon, authenticated;

grant select, insert, update, delete on public.legal_policy_versions to service_role;
grant select, insert, update, delete on public.legal_policy_runtime to service_role;
grant select, insert, update, delete on public.legal_policy_events to service_role;

grant usage, select, update on sequence public.legal_policy_versions_id_seq to service_role;
grant usage, select, update on sequence public.legal_policy_events_id_seq to service_role;

create or replace function public.get_active_legal_policy(p_slug text)
returns table (
    active_policy_version integer,
    active_policy_version_id bigint,
    markdown text,
    note text,
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
        raise exception 'Only service_role can read legal policy control plane';
    end if;

    if p_slug not in ('terms', 'privacy', 'refund-policy') then
        raise exception 'Invalid legal policy slug';
    end if;

    return query
    select
        active.version,
        active.id,
        active.markdown,
        active.note,
        runtime.updated_at,
        runtime.updated_by_user_id,
        runtime.updated_by_email
    from public.legal_policy_runtime runtime
    join public.legal_policy_versions active
      on active.id = runtime.active_policy_version_id
     and active.slug = runtime.slug
    where runtime.slug = p_slug
    limit 1;
end;
$$;

create or replace function public.publish_legal_policy(
    p_slug text,
    p_markdown text,
    p_expected_updated_at timestamptz default null,
    p_note text default null,
    p_actor_user_id uuid default null,
    p_actor_email text default null,
    p_source text default 'admin_api'
)
returns table (
    status text,
    active_policy_version integer,
    active_policy_version_id bigint,
    updated_at timestamptz,
    message text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_runtime public.legal_policy_runtime%rowtype;
    v_current public.legal_policy_versions%rowtype;
    v_inserted_id bigint;
    v_next_version integer;
    v_markdown text;
    v_note text;
    v_actor_email text;
    v_source text;
    v_updated_at timestamptz;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can publish legal policies';
    end if;

    if p_slug not in ('terms', 'privacy', 'refund-policy') then
        return query
        select 'rejected'::text, null::integer, null::bigint, null::timestamptz, 'Invalid legal policy slug.'::text;
        return;
    end if;

    v_markdown := trim(coalesce(p_markdown, ''));
    if length(v_markdown) = 0 then
        return query
        select 'rejected'::text, null::integer, null::bigint, null::timestamptz, 'Legal policy markdown cannot be empty.'::text;
        return;
    end if;

    v_note := nullif(left(trim(coalesce(p_note, '')), 400), '');
    v_actor_email := nullif(left(trim(coalesce(p_actor_email, '')), 320), '');
    v_source := nullif(left(trim(coalesce(p_source, 'admin_api')), 80), '');

    perform pg_advisory_xact_lock(hashtext('legal_policy_runtime:' || p_slug));

    select *
    into v_runtime
    from public.legal_policy_runtime
    where slug = p_slug
    for update;

    if not found then
        return query
        select 'not_initialized'::text, null::integer, null::bigint, null::timestamptz, 'Legal policy control plane is not initialized.'::text;
        return;
    end if;

    if p_expected_updated_at is distinct from v_runtime.updated_at then
        return query
        select 'stale'::text, null::integer, null::bigint, v_runtime.updated_at, 'Legal policy changed since it was loaded.'::text;
        return;
    end if;

    select *
    into v_current
    from public.legal_policy_versions
    where id = v_runtime.active_policy_version_id
      and slug = p_slug;

    if found and v_current.markdown = v_markdown then
        return query
        select 'activated'::text, v_current.version, v_current.id, v_runtime.updated_at, 'Submitted policy already matches the active version.'::text;
        return;
    end if;

    select coalesce(max(version), 0) + 1
    into v_next_version
    from public.legal_policy_versions
    where slug = p_slug;

    insert into public.legal_policy_versions (
        slug,
        version,
        markdown,
        note,
        created_by_user_id,
        created_by_email
    )
    values (
        p_slug,
        v_next_version,
        v_markdown,
        v_note,
        p_actor_user_id,
        v_actor_email
    )
    returning id into v_inserted_id;

    v_updated_at := now();

    update public.legal_policy_runtime
    set
        active_policy_version_id = v_inserted_id,
        last_known_safe_policy_version_id = coalesce(v_runtime.active_policy_version_id, v_inserted_id),
        updated_by_user_id = p_actor_user_id,
        updated_by_email = v_actor_email,
        updated_at = v_updated_at
    where slug = p_slug;

    insert into public.legal_policy_events (
        slug,
        event_type,
        from_policy_version_id,
        to_policy_version_id,
        actor_user_id,
        actor_email,
        note,
        source
    )
    values (
        p_slug,
        'publish',
        v_runtime.active_policy_version_id,
        v_inserted_id,
        p_actor_user_id,
        v_actor_email,
        v_note,
        v_source
    );

    return query
    select 'activated'::text, v_next_version, v_inserted_id, v_updated_at, 'Legal policy published.'::text;
end;
$$;

revoke all on function public.get_active_legal_policy(text) from public, anon, authenticated;
revoke all on function public.publish_legal_policy(text, text, timestamptz, text, uuid, text, text)
    from public, anon, authenticated;

grant execute on function public.get_active_legal_policy(text) to service_role;
grant execute on function public.publish_legal_policy(text, text, timestamptz, text, uuid, text, text)
    to service_role;
