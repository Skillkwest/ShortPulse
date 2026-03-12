-- Add per-folder Media Library canvas persistence.
-- Stores user-scoped custom-folder canvas snapshots independent from AI Studio session snapshots.

DO $$
BEGIN
  IF to_regclass('public.media_folders') IS NULL THEN
    RAISE EXCEPTION 'public.media_folders table is required before applying migration 063';
  END IF;
END;
$$;

create table if not exists public.media_folder_canvas_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid not null,
  schema_version integer not null default 1,
  snapshot jsonb not null default '{}'::jsonb,
  save_seq bigint not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint media_folder_canvas_states_pk primary key (user_id, folder_id),
  constraint media_folder_canvas_states_folder_scope_fk
    foreign key (folder_id, user_id)
    references public.media_folders(id, user_id)
    on delete cascade,
  constraint media_folder_canvas_states_schema_version_check
    check (schema_version between 1 and 100),
  constraint media_folder_canvas_states_snapshot_object_check
    check (jsonb_typeof(snapshot) = 'object')
);

create index if not exists ix_media_folder_canvas_states_user_updated
  on public.media_folder_canvas_states (user_id, updated_at desc, folder_id);

alter table public.media_folder_canvas_states enable row level security;

drop policy if exists select_media_folder_canvas_states_isolation on public.media_folder_canvas_states;
create policy select_media_folder_canvas_states_isolation
  on public.media_folder_canvas_states
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_media_folder_canvas_states_isolation on public.media_folder_canvas_states;
create policy insert_media_folder_canvas_states_isolation
  on public.media_folder_canvas_states
  for insert
  with check (auth.uid() = user_id);

drop policy if exists update_media_folder_canvas_states_isolation on public.media_folder_canvas_states;
create policy update_media_folder_canvas_states_isolation
  on public.media_folder_canvas_states
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists delete_media_folder_canvas_states_isolation on public.media_folder_canvas_states;
create policy delete_media_folder_canvas_states_isolation
  on public.media_folder_canvas_states
  for delete
  using (auth.uid() = user_id);
