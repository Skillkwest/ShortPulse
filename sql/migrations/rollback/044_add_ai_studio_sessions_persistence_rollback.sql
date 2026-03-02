-- Rollback AI Studio session persistence foundation.

drop function if exists public.prune_ai_studio_sessions_expired(integer);
drop function if exists public.list_ai_studio_sessions(uuid, integer, timestamptz, uuid);
drop function if exists public.get_ai_studio_session_snapshot(uuid, uuid);
drop function if exists public.upsert_ai_studio_session_snapshot(
    uuid,
    uuid,
    jsonb,
    integer,
    text,
    interval,
    integer
);

drop table if exists public.ai_studio_sessions;
