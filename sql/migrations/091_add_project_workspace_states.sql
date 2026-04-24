-- Add project-owned AI Studio workspace persistence.
-- This creates one durable workspace snapshot row per user-owned project.

create table if not exists public.project_workspace_states (
    project_id uuid primary key references public.projects(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    schema_version integer not null default 2,
    snapshot jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint project_workspace_states_snapshot_object_check
      check (jsonb_typeof(snapshot) = 'object'),
    constraint project_workspace_states_schema_version_check
      check (schema_version between 1 and 100),
    constraint project_workspace_states_project_user_fkey
      foreign key (project_id, user_id)
      references public.projects (id, user_id)
      on delete cascade
);

create unique index if not exists ix_project_workspace_states_project_user
    on public.project_workspace_states (project_id, user_id);

create index if not exists ix_project_workspace_states_user_updated
    on public.project_workspace_states (user_id, updated_at desc);

alter table public.project_workspace_states enable row level security;

drop policy if exists select_project_workspace_states_isolation on public.project_workspace_states;
create policy select_project_workspace_states_isolation
    on public.project_workspace_states
    for select
    using (user_id = auth.uid());

drop policy if exists insert_project_workspace_states_isolation on public.project_workspace_states;
create policy insert_project_workspace_states_isolation
    on public.project_workspace_states
    for insert
    with check (user_id = auth.uid());

drop policy if exists update_project_workspace_states_isolation on public.project_workspace_states;
create policy update_project_workspace_states_isolation
    on public.project_workspace_states
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists delete_project_workspace_states_isolation on public.project_workspace_states;
create policy delete_project_workspace_states_isolation
    on public.project_workspace_states
    for delete
    using (user_id = auth.uid());
