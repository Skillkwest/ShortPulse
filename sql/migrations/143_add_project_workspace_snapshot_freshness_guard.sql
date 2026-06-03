-- Add server-authoritative project workspace snapshot freshness tracking.
-- This prevents older autosave completions from overwriting newer durable workspace rows.

do $$
begin
    if to_regclass('public.project_workspace_states') is null then
        raise exception 'public.project_workspace_states table is required before applying migration 143';
    end if;
end;
$$;

alter table public.project_workspace_states
    add column if not exists snapshot_updated_at timestamptz;

update public.project_workspace_states
set snapshot_updated_at = coalesce(
    case
        when jsonb_typeof(snapshot) = 'object'
            and snapshot ? 'updatedAt'
            and coalesce(snapshot->>'updatedAt', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
        then (snapshot->>'updatedAt')::timestamptz
        else null
    end,
    updated_at,
    timezone('utc', now())
)
where snapshot_updated_at is null;

alter table public.project_workspace_states
    alter column snapshot_updated_at set default timezone('utc', now());

alter table public.project_workspace_states
    alter column snapshot_updated_at set not null;

create index if not exists ix_project_workspace_states_user_snapshot_updated
    on public.project_workspace_states (user_id, snapshot_updated_at desc);

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
