-- Add project-owned generation association rows so project reopen can refresh
-- generated-output delivery from project-associated generations only.

create unique index if not exists ux_ai_generations_id_user
  on public.ai_generations (id, user_id);

create table if not exists public.project_generation_items (
    project_id uuid not null,
    generation_id uuid not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint project_generation_items_pk primary key (project_id, generation_id),
    constraint project_generation_items_project_fk
      foreign key (project_id)
      references public.projects(id)
      on delete cascade,
    constraint project_generation_items_generation_fk
      foreign key (generation_id)
      references public.ai_generations(id)
      on delete cascade,
    constraint project_generation_items_project_scope_fk
      foreign key (project_id, user_id)
      references public.projects(id, user_id)
      on delete cascade,
    constraint project_generation_items_generation_scope_fk
      foreign key (generation_id, user_id)
      references public.ai_generations(id, user_id)
      on delete cascade
);

create index if not exists ix_project_generation_items_user_project
  on public.project_generation_items (user_id, project_id, updated_at desc);

create index if not exists ix_project_generation_items_user_generation
  on public.project_generation_items (user_id, generation_id);

alter table public.project_generation_items enable row level security;

drop policy if exists select_project_generation_items_isolation on public.project_generation_items;
create policy select_project_generation_items_isolation
  on public.project_generation_items
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_project_generation_items_isolation on public.project_generation_items;
create policy insert_project_generation_items_isolation
  on public.project_generation_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists update_project_generation_items_isolation on public.project_generation_items;
create policy update_project_generation_items_isolation
  on public.project_generation_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists delete_project_generation_items_isolation on public.project_generation_items;
create policy delete_project_generation_items_isolation
  on public.project_generation_items
  for delete
  using (auth.uid() = user_id);
