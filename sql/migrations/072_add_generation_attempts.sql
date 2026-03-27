-- Add explicit provider-attempt lineage for generation requests.
-- This is additive and keeps ai_generations as the transitional request table.

create table if not exists public.generation_attempts (
    id uuid primary key default gen_random_uuid(),
    generation_id uuid not null references public.ai_generations(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    attempt_number integer not null,
    provider text not null,
    model_id text not null,
    provider_request_id text,
    status text not null,
    dispatch_source text not null,
    submit_route text,
    queue_id uuid,
    submitted_at timestamptz,
    started_at timestamptz,
    completed_at timestamptz,
    last_observed_at timestamptz,
    failure_reason_code text,
    error_message text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint generation_attempts_attempt_number_positive_check
      check (attempt_number >= 1),
    constraint generation_attempts_status_check
      check (status in ('created', 'submitted', 'running', 'succeeded', 'failed', 'timed_out', 'abandoned')),
    constraint generation_attempts_dispatch_source_check
      check (dispatch_source in ('direct_submit', 'queued_submit', 'admin_replay', 'reconciler'))
);

create unique index if not exists ux_generation_attempts_generation_attempt_number
    on public.generation_attempts (generation_id, attempt_number);

create unique index if not exists ux_generation_attempts_provider_request
    on public.generation_attempts (user_id, provider_request_id)
    where provider_request_id is not null;

create index if not exists ix_generation_attempts_user_generation_created
    on public.generation_attempts (user_id, generation_id, created_at desc);

alter table public.generation_attempts enable row level security;

drop policy if exists select_generation_attempts_isolation on public.generation_attempts;
create policy select_generation_attempts_isolation
    on public.generation_attempts
    for select
    using (user_id = auth.uid());

drop policy if exists modify_generation_attempts_isolation on public.generation_attempts;
create policy modify_generation_attempts_isolation
    on public.generation_attempts
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
