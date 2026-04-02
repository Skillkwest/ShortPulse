-- Add additive projection/publication/observation scaffolding for the unified generation pipeline.
-- This keeps ai_generations as the transitional request shell while introducing the server-owned
-- read and publication layers required for later cutover.

alter table public.ai_generation_outputs
    add column if not exists generation_attempt_id uuid references public.generation_attempts(id) on delete set null;

create index if not exists ix_ai_generation_outputs_attempt_index
    on public.ai_generation_outputs (generation_attempt_id, output_index)
    where generation_attempt_id is not null;

create table if not exists public.generation_observation_inbox (
    id uuid primary key default gen_random_uuid(),
    generation_id uuid references public.ai_generations(id) on delete cascade,
    generation_attempt_id uuid references public.generation_attempts(id) on delete set null,
    user_id uuid references auth.users(id) on delete cascade,
    provider text not null,
    provider_request_id text,
    observation_source text not null,
    observation_type text not null,
    idempotency_key text not null,
    payload jsonb not null default '{}'::jsonb,
    processing_state text not null default 'pending',
    processing_error text,
    observed_at timestamptz not null default now(),
    processed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint generation_observation_inbox_source_check
      check (observation_source in ('webhook', 'poll', 'replay', 'reconciler')),
    constraint generation_observation_inbox_processing_state_check
      check (processing_state in ('pending', 'processed', 'ignored', 'failed')),
    constraint generation_observation_inbox_payload_object_check
      check (jsonb_typeof(payload) = 'object')
);

create unique index if not exists ux_generation_observation_inbox_idempotency_key
    on public.generation_observation_inbox (idempotency_key);

create index if not exists ix_generation_observation_inbox_processing_state_observed
    on public.generation_observation_inbox (processing_state, observed_at asc);

create index if not exists ix_generation_observation_inbox_provider_request
    on public.generation_observation_inbox (provider, provider_request_id, observed_at desc)
    where provider_request_id is not null;

alter table public.generation_observation_inbox enable row level security;
revoke all on public.generation_observation_inbox from anon, authenticated;

create table if not exists public.generation_publications (
    id uuid primary key default gen_random_uuid(),
    generation_id uuid not null references public.ai_generations(id) on delete cascade,
    generation_attempt_id uuid references public.generation_attempts(id) on delete set null,
    generation_output_id uuid not null references public.ai_generation_outputs(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    publication_state text not null default 'pending',
    reusable boolean not null default true,
    visible_in_ai_studio boolean not null default true,
    visible_in_reference_grid boolean not null default true,
    owned_media_file_id uuid references public.media_files(id) on delete set null,
    preview_url text,
    full_url text,
    preview_storage_path text,
    full_storage_path text,
    published_at timestamptz,
    archived_at timestamptz,
    archive_reason text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint generation_publications_state_check
      check (publication_state in ('pending', 'published', 'archived', 'suppressed')),
    constraint generation_publications_metadata_object_check
      check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists ux_generation_publications_output
    on public.generation_publications (generation_output_id);

create index if not exists ix_generation_publications_user_generation
    on public.generation_publications (user_id, generation_id, created_at desc);

create index if not exists ix_generation_publications_reference_grid_visible
    on public.generation_publications (user_id, visible_in_reference_grid, publication_state, created_at desc);

alter table public.generation_publications enable row level security;

drop policy if exists select_generation_publications_isolation on public.generation_publications;
create policy select_generation_publications_isolation
    on public.generation_publications
    for select
    using (user_id = auth.uid());

drop policy if exists modify_generation_publications_isolation on public.generation_publications;
create policy modify_generation_publications_isolation
    on public.generation_publications
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create table if not exists public.generation_projection (
    generation_id uuid primary key references public.ai_generations(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    request_id text,
    provider text,
    provider_request_id text,
    latest_attempt_id uuid references public.generation_attempts(id) on delete set null,
    status text,
    task_state text,
    queue_state text,
    display_prompt text,
    model_id text,
    preview_url text,
    preview_storage_path text,
    full_storage_path text,
    error_message text,
    error_message_short text,
    error_detail text,
    save_state text,
    hidden_in_reference_grid boolean not null default false,
    reference_grid_visible boolean not null default true,
    publication_state text,
    result_urls jsonb not null default '[]'::jsonb,
    saved_media_ids jsonb not null default '[]'::jsonb,
    generation_replay jsonb not null default '{}'::jsonb,
    character_context jsonb not null default '{}'::jsonb,
    style_context jsonb not null default '{}'::jsonb,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint generation_projection_result_urls_array_check
      check (jsonb_typeof(result_urls) = 'array'),
    constraint generation_projection_saved_media_ids_array_check
      check (jsonb_typeof(saved_media_ids) = 'array'),
    constraint generation_projection_generation_replay_object_check
      check (jsonb_typeof(generation_replay) = 'object'),
    constraint generation_projection_character_context_object_check
      check (jsonb_typeof(character_context) = 'object'),
    constraint generation_projection_style_context_object_check
      check (jsonb_typeof(style_context) = 'object')
);

create index if not exists ix_generation_projection_user_updated
    on public.generation_projection (user_id, updated_at desc);

create index if not exists ix_generation_projection_request_id
    on public.generation_projection (user_id, request_id)
    where request_id is not null;

alter table public.generation_projection enable row level security;

drop policy if exists select_generation_projection_isolation on public.generation_projection;
create policy select_generation_projection_isolation
    on public.generation_projection
    for select
    using (user_id = auth.uid());

drop policy if exists modify_generation_projection_isolation on public.generation_projection;
create policy modify_generation_projection_isolation
    on public.generation_projection
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

