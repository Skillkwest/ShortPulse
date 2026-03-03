-- Hotfix AI Studio session upsert ambiguity in PL/pgSQL.
-- Resolves SQLSTATE 42702 (`column reference "user_id" is ambiguous`) while
-- preserving function contract, retention behavior, and grant posture.

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
#variable_conflict use_column
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

    delete from public.ai_studio_sessions sessions
     where sessions.user_id = p_user_id
       and sessions.expires_at <= v_now;

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
