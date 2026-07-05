-- Allow same-timestamp project workspace saves when the checkpoint structure changes.

do $$
begin
    if to_regclass('public.project_workspace_states') is null then
        raise exception 'public.project_workspace_states table is required before applying migration 198';
    end if;

    if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'project_workspace_states'
          and column_name = 'snapshot_updated_at'
    ) then
        raise exception 'public.project_workspace_states.snapshot_updated_at is required before applying migration 198';
    end if;

    if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'project_workspace_states'
          and column_name = 'checkpoint_revision'
    ) then
        raise exception 'public.project_workspace_states.checkpoint_revision is required before applying migration 198';
    end if;
end $$;

create or replace function public.project_workspace_states_preserve_newest_snapshot()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'INSERT' then
        if new.snapshot_updated_at is null then
            new.snapshot_updated_at := coalesce(new.updated_at, timezone('utc', now()));
        end if;
        if new.checkpoint_revision is null or new.checkpoint_revision < 1 then
            new.checkpoint_revision := 1;
        end if;
        return new;
    end if;

    if new.snapshot_updated_at is null then
        new.snapshot_updated_at := old.snapshot_updated_at;
    end if;

    if old.snapshot_updated_at is not null
        and new.snapshot_updated_at is not null
        and new.snapshot_updated_at < old.snapshot_updated_at then
        new.user_id := old.user_id;
        new.schema_version := old.schema_version;
        new.snapshot := old.snapshot;
        new.snapshot_updated_at := old.snapshot_updated_at;
        new.checkpoint_revision := old.checkpoint_revision;
        new.created_at := old.created_at;
        new.updated_at := old.updated_at;
        return new;
    end if;

    new.project_id := old.project_id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;

    if new.snapshot is not distinct from old.snapshot then
        new.snapshot := old.snapshot;
        new.checkpoint_revision := old.checkpoint_revision;
        return new;
    end if;

    if new.checkpoint_revision is null or new.checkpoint_revision <= old.checkpoint_revision then
        new.checkpoint_revision := old.checkpoint_revision + 1;
    end if;

    return new;
end;
$$;
