-- Add AI Studio session persistence foundation.
-- Introduces user-scoped session snapshots + service-role-only RPCs for save/get/list/prune.

create table if not exists public.ai_studio_sessions (
    user_id uuid not null references auth.users(id) on delete cascade,
    session_id uuid not null,
    title text,
    schema_version integer not null default 1,
    snapshot jsonb not null default '{}'::jsonb,
    save_seq bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '180 days'),
    constraint ai_studio_sessions_pkey primary key (user_id, session_id),
    constraint ai_studio_sessions_snapshot_object_check check (jsonb_typeof(snapshot) = 'object'),
    constraint ai_studio_sessions_schema_version_check check (schema_version between 1 and 100),
    constraint ai_studio_sessions_title_length_check check (title is null or char_length(title) <= 120)
);

create index if not exists ai_studio_sessions_user_updated_idx
    on public.ai_studio_sessions (user_id, updated_at desc, session_id desc);

create index if not exists ai_studio_sessions_user_expires_idx
    on public.ai_studio_sessions (user_id, expires_at);

alter table public.ai_studio_sessions enable row level security;

drop policy if exists ai_studio_sessions_select_own on public.ai_studio_sessions;
create policy ai_studio_sessions_select_own
    on public.ai_studio_sessions
    for select
    using (auth.uid() = user_id);

drop policy if exists ai_studio_sessions_insert_own on public.ai_studio_sessions;
create policy ai_studio_sessions_insert_own
    on public.ai_studio_sessions
    for insert
    with check (auth.uid() = user_id);

drop policy if exists ai_studio_sessions_update_own on public.ai_studio_sessions;
create policy ai_studio_sessions_update_own
    on public.ai_studio_sessions
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists ai_studio_sessions_delete_own on public.ai_studio_sessions;
create policy ai_studio_sessions_delete_own
    on public.ai_studio_sessions
    for delete
    using (auth.uid() = user_id);

create or replace function public.upsert_ai_studio_session_snapshot(
    p_user_id uuid,
    p_session_id uuid,
    p_snapshot jsonb,
    p_schema_version integer default 1,
    p_title text default null,
    p_ttl interval default interval '180 days',
    p_user_cap integer default 100
)
returns table (
    user_id uuid,
    session_id uuid,
    title text,
    schema_version integer,
    save_seq bigint,
    updated_at timestamptz,
    expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_now timestamptz;
    v_ttl interval;
    v_row_cap integer;
    v_schema_version integer;
    v_title text;
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;

    if p_session_id is null then
        raise exception 'Session id is required';
    end if;

    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can upsert AI Studio sessions';
    end if;

    if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
        raise exception 'Session snapshot must be a JSON object';
    end if;

    v_schema_version := least(greatest(coalesce(p_schema_version, 1), 1), 100);
    v_title := nullif(left(btrim(coalesce(p_title, '')), 120), '');
    v_row_cap := least(greatest(coalesce(p_user_cap, 100), 1), 100);

    v_ttl := coalesce(p_ttl, interval '180 days');
    if v_ttl < interval '1 day' then
        v_ttl := interval '1 day';
    elsif v_ttl > interval '365 days' then
        v_ttl := interval '365 days';
    end if;

    v_now := now();

    -- Serialize per-user upsert + prune to keep retention deterministic under contention.
    perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':ai_studio_sessions'));

    delete from public.ai_studio_sessions
     where user_id = p_user_id
       and expires_at <= v_now;

    insert into public.ai_studio_sessions (
        user_id,
        session_id,
        title,
        schema_version,
        snapshot,
        save_seq,
        created_at,
        updated_at,
        expires_at
    )
    values (
        p_user_id,
        p_session_id,
        v_title,
        v_schema_version,
        p_snapshot,
        1,
        v_now,
        v_now,
        v_now + v_ttl
    )
    on conflict (user_id, session_id) do update
    set title = excluded.title,
        schema_version = excluded.schema_version,
        snapshot = excluded.snapshot,
        save_seq = public.ai_studio_sessions.save_seq + 1,
        updated_at = v_now,
        expires_at = v_now + v_ttl;

    with overflow as (
        select sessions.session_id
          from public.ai_studio_sessions sessions
         where sessions.user_id = p_user_id
         order by
            (sessions.session_id = p_session_id) desc,
            sessions.updated_at desc,
            sessions.session_id desc
         offset v_row_cap
    )
    delete from public.ai_studio_sessions sessions
    using overflow
     where sessions.user_id = p_user_id
       and sessions.session_id = overflow.session_id;

    return query
    select
        sessions.user_id,
        sessions.session_id,
        sessions.title,
        sessions.schema_version,
        sessions.save_seq,
        sessions.updated_at,
        sessions.expires_at
      from public.ai_studio_sessions sessions
     where sessions.user_id = p_user_id
       and sessions.session_id = p_session_id
     limit 1;
end;
$$;

create or replace function public.get_ai_studio_session_snapshot(
    p_user_id uuid,
    p_session_id uuid
)
returns table (
    user_id uuid,
    session_id uuid,
    title text,
    schema_version integer,
    save_seq bigint,
    snapshot jsonb,
    updated_at timestamptz,
    expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;

    if p_session_id is null then
        raise exception 'Session id is required';
    end if;

    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can read AI Studio sessions';
    end if;

    return query
    select
        sessions.user_id,
        sessions.session_id,
        sessions.title,
        sessions.schema_version,
        sessions.save_seq,
        sessions.snapshot,
        sessions.updated_at,
        sessions.expires_at
      from public.ai_studio_sessions sessions
     where sessions.user_id = p_user_id
       and sessions.session_id = p_session_id
       and sessions.expires_at > now()
     limit 1;
end;
$$;

create or replace function public.list_ai_studio_sessions(
    p_user_id uuid,
    p_limit integer default 20,
    p_cursor_updated_at timestamptz default null,
    p_cursor_session_id uuid default null
)
returns table (
    session_id uuid,
    title text,
    schema_version integer,
    save_seq bigint,
    updated_at timestamptz,
    expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_limit integer;
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;

    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can list AI Studio sessions';
    end if;

    if p_cursor_updated_at is not null and p_cursor_session_id is null then
        raise exception 'Cursor session id is required when cursor timestamp is provided';
    end if;

    v_limit := least(greatest(coalesce(p_limit, 20), 1), 50);

    return query
    select
        sessions.session_id,
        sessions.title,
        sessions.schema_version,
        sessions.save_seq,
        sessions.updated_at,
        sessions.expires_at
      from public.ai_studio_sessions sessions
     where sessions.user_id = p_user_id
       and sessions.expires_at > now()
       and (
            p_cursor_updated_at is null
            or (sessions.updated_at, sessions.session_id) < (p_cursor_updated_at, p_cursor_session_id)
       )
     order by sessions.updated_at desc, sessions.session_id desc
     limit v_limit;
end;
$$;

create or replace function public.prune_ai_studio_sessions_expired(
    p_limit integer default 10000
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_limit integer;
    v_deleted integer;
begin
    v_limit := least(greatest(coalesce(p_limit, 10000), 1), 50000);

    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can prune AI Studio sessions';
    end if;

    with expired as (
        select sessions.user_id, sessions.session_id
          from public.ai_studio_sessions sessions
         where sessions.expires_at <= now()
         order by sessions.expires_at asc, sessions.user_id asc, sessions.session_id asc
         limit v_limit
    )
    delete from public.ai_studio_sessions sessions
    using expired
     where sessions.user_id = expired.user_id
       and sessions.session_id = expired.session_id;

    get diagnostics v_deleted = row_count;
    return v_deleted;
end;
$$;

revoke all on function public.upsert_ai_studio_session_snapshot(
    uuid,
    uuid,
    jsonb,
    integer,
    text,
    interval,
    integer
) from public;
revoke all on function public.upsert_ai_studio_session_snapshot(
    uuid,
    uuid,
    jsonb,
    integer,
    text,
    interval,
    integer
) from anon;
revoke all on function public.upsert_ai_studio_session_snapshot(
    uuid,
    uuid,
    jsonb,
    integer,
    text,
    interval,
    integer
) from authenticated;
grant execute on function public.upsert_ai_studio_session_snapshot(
    uuid,
    uuid,
    jsonb,
    integer,
    text,
    interval,
    integer
) to service_role;

revoke all on function public.get_ai_studio_session_snapshot(uuid, uuid) from public;
revoke all on function public.get_ai_studio_session_snapshot(uuid, uuid) from anon;
revoke all on function public.get_ai_studio_session_snapshot(uuid, uuid) from authenticated;
grant execute on function public.get_ai_studio_session_snapshot(uuid, uuid) to service_role;

revoke all on function public.list_ai_studio_sessions(
    uuid,
    integer,
    timestamptz,
    uuid
) from public;
revoke all on function public.list_ai_studio_sessions(
    uuid,
    integer,
    timestamptz,
    uuid
) from anon;
revoke all on function public.list_ai_studio_sessions(
    uuid,
    integer,
    timestamptz,
    uuid
) from authenticated;
grant execute on function public.list_ai_studio_sessions(
    uuid,
    integer,
    timestamptz,
    uuid
) to service_role;

revoke all on function public.prune_ai_studio_sessions_expired(integer) from public;
revoke all on function public.prune_ai_studio_sessions_expired(integer) from anon;
revoke all on function public.prune_ai_studio_sessions_expired(integer) from authenticated;
grant execute on function public.prune_ai_studio_sessions_expired(integer) to service_role;
