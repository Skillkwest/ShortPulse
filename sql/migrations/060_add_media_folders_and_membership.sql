-- Add user-owned Media Library folders and membership junction tables.
-- Supports multi-folder assignment for media files and saved prompts.

DO $$
BEGIN
  IF to_regclass('public.media_files') IS NULL THEN
    RAISE EXCEPTION 'public.media_files table is required before applying migration 060';
  END IF;
  IF to_regclass('public.media_prompts') IS NULL THEN
    RAISE EXCEPTION 'public.media_prompts table is required before applying migration 060';
  END IF;
END;
$$;

create table if not exists public.media_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint media_folders_name_normalized_check check (
    name = btrim(name)
    and char_length(name) between 1 and 64
  )
);

create unique index if not exists ix_media_folders_user_name_unique_ci
  on public.media_folders (user_id, lower(name));
create unique index if not exists ix_media_folders_id_user
  on public.media_folders (id, user_id);
create index if not exists ix_media_folders_user_created
  on public.media_folders (user_id, created_at desc);

alter table public.media_folders enable row level security;

drop policy if exists select_media_folders_isolation on public.media_folders;
create policy select_media_folders_isolation
  on public.media_folders
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_media_folders_isolation on public.media_folders;
create policy insert_media_folders_isolation
  on public.media_folders
  for insert
  with check (auth.uid() = user_id);

drop policy if exists update_media_folders_isolation on public.media_folders;
create policy update_media_folders_isolation
  on public.media_folders
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists delete_media_folders_isolation on public.media_folders;
create policy delete_media_folders_isolation
  on public.media_folders
  for delete
  using (auth.uid() = user_id);

create unique index if not exists ix_media_files_id_user
  on public.media_files (id, user_id);
create unique index if not exists ix_media_prompts_id_user
  on public.media_prompts (id, user_id);

create table if not exists public.media_folder_media_items (
  folder_id uuid not null,
  media_file_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint media_folder_media_items_pk primary key (folder_id, media_file_id),
  constraint media_folder_media_items_folder_fk
    foreign key (folder_id)
    references public.media_folders(id)
    on delete cascade,
  constraint media_folder_media_items_media_file_fk
    foreign key (media_file_id)
    references public.media_files(id)
    on delete cascade,
  constraint media_folder_media_items_folder_scope_fk
    foreign key (folder_id, user_id)
    references public.media_folders(id, user_id)
    on delete cascade,
  constraint media_folder_media_items_media_scope_fk
    foreign key (media_file_id, user_id)
    references public.media_files(id, user_id)
    on delete cascade
);

create index if not exists ix_media_folder_media_items_user_folder
  on public.media_folder_media_items (user_id, folder_id);
create index if not exists ix_media_folder_media_items_user_media
  on public.media_folder_media_items (user_id, media_file_id);

alter table public.media_folder_media_items enable row level security;

drop policy if exists select_media_folder_media_items_isolation on public.media_folder_media_items;
create policy select_media_folder_media_items_isolation
  on public.media_folder_media_items
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_media_folder_media_items_isolation on public.media_folder_media_items;
create policy insert_media_folder_media_items_isolation
  on public.media_folder_media_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists delete_media_folder_media_items_isolation on public.media_folder_media_items;
create policy delete_media_folder_media_items_isolation
  on public.media_folder_media_items
  for delete
  using (auth.uid() = user_id);

create table if not exists public.media_folder_prompt_items (
  folder_id uuid not null,
  prompt_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint media_folder_prompt_items_pk primary key (folder_id, prompt_id),
  constraint media_folder_prompt_items_folder_fk
    foreign key (folder_id)
    references public.media_folders(id)
    on delete cascade,
  constraint media_folder_prompt_items_prompt_fk
    foreign key (prompt_id)
    references public.media_prompts(id)
    on delete cascade,
  constraint media_folder_prompt_items_folder_scope_fk
    foreign key (folder_id, user_id)
    references public.media_folders(id, user_id)
    on delete cascade,
  constraint media_folder_prompt_items_prompt_scope_fk
    foreign key (prompt_id, user_id)
    references public.media_prompts(id, user_id)
    on delete cascade
);

create index if not exists ix_media_folder_prompt_items_user_folder
  on public.media_folder_prompt_items (user_id, folder_id);
create index if not exists ix_media_folder_prompt_items_user_prompt
  on public.media_folder_prompt_items (user_id, prompt_id);

alter table public.media_folder_prompt_items enable row level security;

drop policy if exists select_media_folder_prompt_items_isolation on public.media_folder_prompt_items;
create policy select_media_folder_prompt_items_isolation
  on public.media_folder_prompt_items
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_media_folder_prompt_items_isolation on public.media_folder_prompt_items;
create policy insert_media_folder_prompt_items_isolation
  on public.media_folder_prompt_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists delete_media_folder_prompt_items_isolation on public.media_folder_prompt_items;
create policy delete_media_folder_prompt_items_isolation
  on public.media_folder_prompt_items
  for delete
  using (auth.uid() = user_id);
