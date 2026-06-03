-- Roll back large-project output display records and checkpoint revision support.

drop table if exists public.project_output_display_items;

drop function if exists public.project_output_display_items_preserve_newest_source();

drop index if exists public.ix_project_workspace_states_user_checkpoint_revision;

alter table public.project_workspace_states
    drop column if exists checkpoint_revision;

create or replace function public.project_workspace_states_preserve_newest_snapshot()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'INSERT' then
        if new.snapshot_updated_at is null then
            new.snapshot_updated_at := coalesce(new.updated_at, timezone('utc', now()));
        end if;
        return new;
    end if;

    if new.snapshot_updated_at is null then
        new.snapshot_updated_at := old.snapshot_updated_at;
    end if;

    if old.snapshot_updated_at is not null
        and new.snapshot_updated_at is not null
        and new.snapshot_updated_at <= old.snapshot_updated_at then
        new.user_id := old.user_id;
        new.schema_version := old.schema_version;
        new.snapshot := old.snapshot;
        new.snapshot_updated_at := old.snapshot_updated_at;
        new.created_at := old.created_at;
        new.updated_at := old.updated_at;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_project_workspace_states_preserve_newest_snapshot
    on public.project_workspace_states;

create trigger trg_project_workspace_states_preserve_newest_snapshot
before insert or update on public.project_workspace_states
for each row
execute function public.project_workspace_states_preserve_newest_snapshot();
