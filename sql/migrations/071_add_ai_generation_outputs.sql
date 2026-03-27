-- Canonical persisted output rows for ai_generations.
-- This is additive and coexists with ai_generations.metadata/media_files compatibility fields
-- during the transition to server-authoritative generation output records.

create table if not exists public.ai_generation_outputs (
    id uuid primary key default gen_random_uuid(),
    generation_id uuid not null references public.ai_generations(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    output_index integer not null,
    provider_request_id text,
    result_url text not null,
    media_file_id uuid references public.media_files(id) on delete set null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ai_generation_outputs_output_index_non_negative_check
      check (output_index >= 0)
);

create unique index if not exists ux_ai_generation_outputs_generation_index
    on public.ai_generation_outputs (generation_id, output_index);

create index if not exists ix_ai_generation_outputs_user_generation_index
    on public.ai_generation_outputs (user_id, generation_id, output_index);

create index if not exists ix_ai_generation_outputs_provider_request
    on public.ai_generation_outputs (user_id, provider_request_id)
    where provider_request_id is not null;

alter table public.ai_generation_outputs enable row level security;

drop policy if exists select_ai_generation_outputs_isolation on public.ai_generation_outputs;
create policy select_ai_generation_outputs_isolation
    on public.ai_generation_outputs
    for select
    using (user_id = auth.uid());

drop policy if exists modify_ai_generation_outputs_isolation on public.ai_generation_outputs;
create policy modify_ai_generation_outputs_isolation
    on public.ai_generation_outputs
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
