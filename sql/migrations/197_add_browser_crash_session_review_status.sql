-- Add operator review state for browser crash-session evidence.
--
-- Crash evidence status remains separate from review state so resolving a row
-- clears the admin work queue without deleting or reclassifying the session.

alter table public.browser_crash_sessions
    add column if not exists review_status text not null default 'open',
    add column if not exists reviewed_at timestamptz,
    add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
    add column if not exists reviewed_by_email text,
    add column if not exists review_note text;

alter table public.browser_crash_sessions
    drop constraint if exists browser_crash_sessions_review_status_check;

alter table public.browser_crash_sessions
    add constraint browser_crash_sessions_review_status_check check (
        review_status in ('open', 'resolved', 'ignored')
    );

create index if not exists browser_crash_sessions_review_status_last_seen_idx
    on public.browser_crash_sessions (review_status, last_seen_at desc);

comment on column public.browser_crash_sessions.review_status is
    'Operator review state for admin crash-session triage: open, resolved, or ignored.';
comment on column public.browser_crash_sessions.reviewed_at is
    'Timestamp when an admin last resolved, ignored, or reopened this crash-session row.';
comment on column public.browser_crash_sessions.reviewed_by is
    'Admin auth user id that last changed crash-session review state.';
comment on column public.browser_crash_sessions.reviewed_by_email is
    'Snapshot admin email that last changed crash-session review state.';
comment on column public.browser_crash_sessions.review_note is
    'Optional admin note for crash-session review state changes.';
