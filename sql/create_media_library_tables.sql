-- Media library tables (media_files, media_prompts, ai_generations, media_events).
-- Run this after auth is configured; run storage policies separately via sql/storage_policies.sql.

create table if not exists media_files (
    id uuid primary key default gen_random_uuid(),
    filename text not null,
    storage_path text not null,
    file_type text not null,
    file_size bigint,
    source text not null default 'upload', -- upload | private_upload | ai_studio
    source_ref uuid,
    prompt_id uuid,
    metadata jsonb not null default '{}'::jsonb,
    user_id uuid not null default auth.uid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table media_files
    drop constraint if exists media_files_source_check;
alter table media_files
    add constraint media_files_source_check
    check (source in ('upload', 'private_upload', 'ai_studio'));

alter table media_files
    drop constraint if exists media_files_storage_scope_check;
alter table media_files
    add constraint media_files_storage_scope_check
    check (storage_path like user_id::text || '/%');

alter table media_files
    drop constraint if exists media_files_storage_path_shape_check;
alter table media_files
    add constraint media_files_storage_path_shape_check
    check (
        storage_path <> ''
        and storage_path not like '/%'
        and position(chr(92) in storage_path) = 0
        and storage_path !~ '(^|/)\.\.(/|$)'
    );

alter table media_files
    drop constraint if exists media_files_private_source_shape_check;
alter table media_files
    add constraint media_files_private_source_shape_check
    check (
        source <> 'private_upload'
        or (
            lower(coalesce(file_type, '')) = 'image'
            and storage_path like user_id::text || '/private/images/%'
        )
    );

alter table media_files
    drop constraint if exists media_files_private_path_source_check;
alter table media_files
    add constraint media_files_private_path_source_check
    check (
        storage_path not like user_id::text || '/private/images/%'
        or source = 'private_upload'
    );

create index if not exists ix_media_files_user_created on media_files (user_id, created_at desc);
create index if not exists ix_media_files_user_source_created on media_files (user_id, source, created_at desc);

alter table media_files enable row level security;
drop policy if exists select_media_files_isolation on media_files;
create policy select_media_files_isolation on media_files
    for select using (user_id = auth.uid());
drop policy if exists modify_media_files_isolation on media_files;
create policy modify_media_files_isolation on media_files
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists media_prompts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid(),
    title text,
    prompt_text text not null,
    mode text not null, -- text | image | video
    model_id text,
    source text not null default 'manual', -- manual | ai_studio | agent
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_media_prompts_user_created on media_prompts (user_id, created_at desc);

alter table media_prompts enable row level security;
drop policy if exists select_media_prompts_isolation on media_prompts;
create policy select_media_prompts_isolation on media_prompts
    for select using (user_id = auth.uid());
drop policy if exists modify_media_prompts_isolation on media_prompts;
create policy modify_media_prompts_isolation on media_prompts
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists ai_generations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid(),
    mode text not null, -- image | video
    provider text not null, -- fal | kei | ...
    model_id text not null,
    prompt_text text not null,
    aspect text,
    duration_seconds int,
    resolution text,
    request_id text,
    status text not null default 'pending', -- pending | running | success | fail
    error_message text,
    created_at timestamptz not null default now(),
    completed_at timestamptz,
    metadata jsonb not null default '{}'::jsonb
);

create index if not exists ix_ai_generations_user_created on ai_generations (user_id, created_at desc);

alter table ai_generations enable row level security;
drop policy if exists select_ai_generations_isolation on ai_generations;
create policy select_ai_generations_isolation on ai_generations
    for select using (user_id = auth.uid());
drop policy if exists modify_ai_generations_isolation on ai_generations;
create policy modify_ai_generations_isolation on ai_generations
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists media_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid(),
    event_type text not null, -- upload | delete | rename | prompt_saved | generation_saved | generation_failed
    entity_type text not null, -- media_file | media_prompt | ai_generation
    entity_id uuid not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists ix_media_events_user_created on media_events (user_id, created_at desc);

alter table media_events enable row level security;
drop policy if exists select_media_events_isolation on media_events;
create policy select_media_events_isolation on media_events
    for select using (user_id = auth.uid());
drop policy if exists insert_media_events_isolation on media_events;
create policy insert_media_events_isolation on media_events
    for insert with check (user_id = auth.uid());

alter table media_files
    drop constraint if exists fk_media_files_prompt;
alter table media_files
    add constraint fk_media_files_prompt
    foreign key (prompt_id) references media_prompts(id) on delete set null;

alter table media_files
    drop constraint if exists fk_media_files_generation;
alter table media_files
    add constraint fk_media_files_generation
    foreign key (source_ref) references ai_generations(id) on delete set null;
