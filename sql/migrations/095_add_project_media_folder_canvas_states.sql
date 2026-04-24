-- Add project-scoped Media Library folder canvas persistence.
-- Legacy user-scoped folder canvas persistence remains in place for non-project surfaces.

DO $$
BEGIN
  IF to_regclass('public.projects') IS NULL THEN
    RAISE EXCEPTION 'public.projects table is required before applying migration 095';
  END IF;
  IF to_regclass('public.project_media_folders') IS NULL THEN
    RAISE EXCEPTION 'public.project_media_folders table is required before applying migration 095';
  END IF;
END;
$$;

create table if not exists public.project_media_folder_canvas_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  folder_id uuid not null,
  schema_version integer not null default 1,
  snapshot jsonb not null default '{}'::jsonb,
  save_seq integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint project_media_folder_canvas_states_pk primary key (user_id, project_id, folder_id),
  constraint project_media_folder_canvas_states_project_fk
    foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade,
  constraint project_media_folder_canvas_states_folder_fk
    foreign key (folder_id, project_id, user_id)
    references public.project_media_folders(id, project_id, user_id)
    on delete cascade,
  constraint project_media_folder_canvas_states_schema_version_check
    check (schema_version >= 1),
  constraint project_media_folder_canvas_states_save_seq_check
    check (save_seq >= 1)
);

create index if not exists ix_project_media_folder_canvas_states_project_updated
  on public.project_media_folder_canvas_states (user_id, project_id, updated_at desc, folder_id);

alter table public.project_media_folder_canvas_states enable row level security;

drop policy if exists select_project_media_folder_canvas_states_isolation
  on public.project_media_folder_canvas_states;
create policy select_project_media_folder_canvas_states_isolation
  on public.project_media_folder_canvas_states
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_project_media_folder_canvas_states_isolation
  on public.project_media_folder_canvas_states;
create policy insert_project_media_folder_canvas_states_isolation
  on public.project_media_folder_canvas_states
  for insert
  with check (auth.uid() = user_id);

drop policy if exists update_project_media_folder_canvas_states_isolation
  on public.project_media_folder_canvas_states;
create policy update_project_media_folder_canvas_states_isolation
  on public.project_media_folder_canvas_states
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists delete_project_media_folder_canvas_states_isolation
  on public.project_media_folder_canvas_states;
create policy delete_project_media_folder_canvas_states_isolation
  on public.project_media_folder_canvas_states
  for delete
  using (auth.uid() = user_id);
