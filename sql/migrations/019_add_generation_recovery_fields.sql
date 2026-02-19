-- Add minimal recovery-state columns and indexes for Fal reliability reconciler workflows.

alter table public.ai_generations
    add column if not exists failure_reason_code text;

alter table public.ai_generations
    add column if not exists recovery_state text;

alter table public.ai_generations
    add column if not exists recovery_attempts integer not null default 0;

alter table public.ai_generations
    add column if not exists last_recovery_at timestamptz;

alter table public.ai_generations
    add column if not exists next_recovery_at timestamptz;

alter table public.ai_generations
    add column if not exists last_media_detected_at timestamptz;

update public.ai_generations
set recovery_state = 'none'
where recovery_state is null;

alter table public.ai_generations
    alter column recovery_state set default 'none';

alter table public.ai_generations
    alter column recovery_state set not null;

alter table public.ai_generations
    drop constraint if exists ai_generations_recovery_state_check;

alter table public.ai_generations
    add constraint ai_generations_recovery_state_check
    check (recovery_state in ('none', 'queued', 'recovering', 'recovered', 'exhausted'));

create unique index if not exists ai_generations_user_request_id_unique_idx
    on public.ai_generations (user_id, request_id)
    where request_id is not null;

create index if not exists ai_generations_recovery_scan_idx
    on public.ai_generations (recovery_state, next_recovery_at, created_at);
