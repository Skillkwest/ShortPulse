-- Roll back generation recovery-state columns and indexes.

drop index if exists public.ai_generations_recovery_scan_idx;
drop index if exists public.ai_generations_user_request_id_unique_idx;

alter table public.ai_generations
    drop constraint if exists ai_generations_recovery_state_check;

alter table public.ai_generations
    drop column if exists last_media_detected_at,
    drop column if exists next_recovery_at,
    drop column if exists last_recovery_at,
    drop column if exists recovery_attempts,
    drop column if exists recovery_state,
    drop column if exists failure_reason_code;
