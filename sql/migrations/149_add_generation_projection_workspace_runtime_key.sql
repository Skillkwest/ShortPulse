-- Add bounded workspace/session ownership for generated-output restore.

alter table public.generation_projection
  add column if not exists workspace_runtime_key text;

alter table public.generation_projection
  drop constraint if exists generation_projection_workspace_runtime_key_check;

alter table public.generation_projection
  add constraint generation_projection_workspace_runtime_key_check
  check (
    workspace_runtime_key is null
    or (
      btrim(workspace_runtime_key) = workspace_runtime_key
      and char_length(workspace_runtime_key) between 1 and 160
    )
  );

create index if not exists ix_generation_projection_user_workspace_runtime_updated
  on public.generation_projection (user_id, workspace_runtime_key, updated_at desc)
  where workspace_runtime_key is not null;
