-- Add project-owned media/prompt association tables without changing global library ownership.

create table if not exists public.project_media_items (
    project_id uuid not null,
    media_file_id uuid not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint project_media_items_pk primary key (project_id, media_file_id),
    constraint project_media_items_project_fk
      foreign key (project_id)
      references public.projects(id)
      on delete cascade,
    constraint project_media_items_media_file_fk
      foreign key (media_file_id)
      references public.media_files(id)
      on delete cascade,
    constraint project_media_items_project_scope_fk
      foreign key (project_id, user_id)
      references public.projects(id, user_id)
      on delete cascade,
    constraint project_media_items_media_scope_fk
      foreign key (media_file_id, user_id)
      references public.media_files(id, user_id)
      on delete cascade
);

create index if not exists ix_project_media_items_user_project
  on public.project_media_items (user_id, project_id, updated_at desc);

create index if not exists ix_project_media_items_user_media
  on public.project_media_items (user_id, media_file_id);

alter table public.project_media_items enable row level security;

drop policy if exists select_project_media_items_isolation on public.project_media_items;
create policy select_project_media_items_isolation
  on public.project_media_items
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_project_media_items_isolation on public.project_media_items;
create policy insert_project_media_items_isolation
  on public.project_media_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists update_project_media_items_isolation on public.project_media_items;
create policy update_project_media_items_isolation
  on public.project_media_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists delete_project_media_items_isolation on public.project_media_items;
create policy delete_project_media_items_isolation
  on public.project_media_items
  for delete
  using (auth.uid() = user_id);

create table if not exists public.project_prompt_items (
    project_id uuid not null,
    prompt_id uuid not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint project_prompt_items_pk primary key (project_id, prompt_id),
    constraint project_prompt_items_project_fk
      foreign key (project_id)
      references public.projects(id)
      on delete cascade,
    constraint project_prompt_items_prompt_fk
      foreign key (prompt_id)
      references public.media_prompts(id)
      on delete cascade,
    constraint project_prompt_items_project_scope_fk
      foreign key (project_id, user_id)
      references public.projects(id, user_id)
      on delete cascade,
    constraint project_prompt_items_prompt_scope_fk
      foreign key (prompt_id, user_id)
      references public.media_prompts(id, user_id)
      on delete cascade
);

create index if not exists ix_project_prompt_items_user_project
  on public.project_prompt_items (user_id, project_id, updated_at desc);

create index if not exists ix_project_prompt_items_user_prompt
  on public.project_prompt_items (user_id, prompt_id);

alter table public.project_prompt_items enable row level security;

drop policy if exists select_project_prompt_items_isolation on public.project_prompt_items;
create policy select_project_prompt_items_isolation
  on public.project_prompt_items
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_project_prompt_items_isolation on public.project_prompt_items;
create policy insert_project_prompt_items_isolation
  on public.project_prompt_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists update_project_prompt_items_isolation on public.project_prompt_items;
create policy update_project_prompt_items_isolation
  on public.project_prompt_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists delete_project_prompt_items_isolation on public.project_prompt_items;
create policy delete_project_prompt_items_isolation
  on public.project_prompt_items
  for delete
  using (auth.uid() = user_id);
