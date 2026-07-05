-- Add account-linked browser crash/freeze session records for Admin crash forensics.
--
-- `browser_crash_sessions` is the durable session-health authority. It stores one
-- compact row per authenticated browser tab/session, while routine heartbeats
-- update the row instead of appending high-volume telemetry events.

create table if not exists public.browser_crash_sessions (
    id uuid primary key default gen_random_uuid(),
    browser_session_id text not null,
    user_id uuid references auth.users(id) on delete set null,
    user_email text,
    status text not null default 'active',
    confidence text not null default 'none',
    last_event text not null default 'session_start',
    route text,
    build_id text,
    client_release text,
    client_environment text,
    user_agent text,
    host text,
    vercel_id text,
    metadata jsonb not null default '{}'::jsonb,
    started_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    ended_at timestamptz,
    suspected_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint browser_crash_sessions_status_check check (
        status in (
            'active',
            'clean_closed',
            'possible_ungraceful_exit',
            'probable_freeze_or_crash',
            'confirmed_crash'
        )
    ),
    constraint browser_crash_sessions_confidence_check check (
        confidence in ('none', 'low', 'medium', 'high')
    ),
    constraint browser_crash_sessions_session_id_check check (length(trim(browser_session_id)) > 0)
);

create unique index if not exists browser_crash_sessions_user_session_uidx
    on public.browser_crash_sessions (user_id, browser_session_id);
create index if not exists browser_crash_sessions_status_last_seen_idx
    on public.browser_crash_sessions (status, last_seen_at desc);
create index if not exists browser_crash_sessions_user_last_seen_idx
    on public.browser_crash_sessions (user_id, last_seen_at desc);
create index if not exists browser_crash_sessions_suspected_idx
    on public.browser_crash_sessions (suspected_at desc)
    where suspected_at is not null;
create index if not exists browser_crash_sessions_created_idx
    on public.browser_crash_sessions (created_at desc);

alter table public.browser_crash_sessions enable row level security;

revoke all on table public.browser_crash_sessions from public;
revoke all on table public.browser_crash_sessions from anon;
revoke all on table public.browser_crash_sessions from authenticated;
grant select, insert, update, delete on table public.browser_crash_sessions to service_role;

comment on table public.browser_crash_sessions is
    'Service-role-only browser session health rows used to investigate authenticated user freezes, crashes, tab discards, and ungraceful exits.';
comment on column public.browser_crash_sessions.browser_session_id is
    'Client-generated per-tab session id used to correlate heartbeats, lifecycle events, and next-load abandoned-session evidence.';
comment on column public.browser_crash_sessions.status is
    'Crash-session state: active, clean_closed, possible_ungraceful_exit, probable_freeze_or_crash, or confirmed_crash.';
comment on column public.browser_crash_sessions.confidence is
    'Operator confidence that the row represents a browser freeze/crash rather than a normal close.';
comment on column public.browser_crash_sessions.metadata is
    'Sanitized low-cardinality browser, pressure, route, and lifecycle evidence. No prompts, DOM text, signed URLs, or form values.';
