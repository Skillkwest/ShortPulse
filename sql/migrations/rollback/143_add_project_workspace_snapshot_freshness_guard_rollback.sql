drop trigger if exists trg_project_workspace_states_preserve_newest_snapshot
    on public.project_workspace_states;

drop function if exists public.project_workspace_states_preserve_newest_snapshot();

drop index if exists public.ix_project_workspace_states_user_snapshot_updated;

alter table if exists public.project_workspace_states
    drop column if exists snapshot_updated_at;
