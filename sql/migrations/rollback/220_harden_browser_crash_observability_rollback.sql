drop function if exists public.list_browser_crash_sessions_v2(integer, integer, text, text, text, timestamptz);
drop function if exists public.record_browser_crash_session_event_v1(text, uuid, text, text, text, text, text, text, text, text, text, jsonb, timestamptz, boolean);
drop trigger if exists browser_crash_session_transition_guard_trigger on public.browser_crash_sessions;
drop function if exists public.browser_crash_session_transition_guard();
alter table public.browser_crash_sessions
    drop constraint if exists browser_crash_sessions_high_memory_sample_count_check,
    drop column if exists peer_abandoned_at,
    drop column if exists visible_severe_stall_at,
    drop column if exists high_memory_last_at,
    drop column if exists high_memory_first_at,
    drop column if exists high_memory_sample_count,
    drop column if exists max_heap_used_to_limit_ratio,
    drop column if exists max_used_js_heap_size;
