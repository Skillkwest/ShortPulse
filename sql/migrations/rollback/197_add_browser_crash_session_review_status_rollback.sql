alter table public.browser_crash_sessions
    drop constraint if exists browser_crash_sessions_review_status_check;

drop index if exists public.browser_crash_sessions_review_status_last_seen_idx;

alter table public.browser_crash_sessions
    drop column if exists review_note,
    drop column if exists reviewed_by_email,
    drop column if exists reviewed_by,
    drop column if exists reviewed_at,
    drop column if exists review_status;
