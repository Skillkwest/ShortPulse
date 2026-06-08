-- Roll back bounded workspace/session ownership for generated-output restore.

drop index if exists public.ix_generation_projection_user_workspace_runtime_updated;

alter table public.generation_projection
  drop constraint if exists generation_projection_workspace_runtime_key_check;

alter table public.generation_projection
  drop column if exists workspace_runtime_key;
