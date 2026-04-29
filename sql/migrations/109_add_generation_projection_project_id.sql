alter table public.generation_projection
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists ix_generation_projection_user_project_updated
  on public.generation_projection (user_id, project_id, updated_at desc)
  where project_id is not null;
