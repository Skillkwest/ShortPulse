-- Restore one global Media Library folder authority across project and non-project surfaces.
-- Imports existing project-scoped folders into the global folder tables while preserving
-- folder ids so memberships and folder-canvas state can move onto the canonical path.

DO $$
BEGIN
  IF to_regclass('public.media_folders') IS NULL THEN
    RAISE EXCEPTION 'public.media_folders table is required before applying migration 136';
  END IF;
  IF to_regclass('public.media_folder_media_items') IS NULL THEN
    RAISE EXCEPTION 'public.media_folder_media_items table is required before applying migration 136';
  END IF;
  IF to_regclass('public.media_folder_prompt_items') IS NULL THEN
    RAISE EXCEPTION 'public.media_folder_prompt_items table is required before applying migration 136';
  END IF;
  IF to_regclass('public.media_folder_canvas_states') IS NULL THEN
    RAISE EXCEPTION 'public.media_folder_canvas_states table is required before applying migration 136';
  END IF;
  IF to_regclass('public.project_media_folders') IS NULL THEN
    RAISE EXCEPTION 'public.project_media_folders table is required before applying migration 136';
  END IF;
  IF to_regclass('public.project_media_folder_media_items') IS NULL THEN
    RAISE EXCEPTION 'public.project_media_folder_media_items table is required before applying migration 136';
  END IF;
  IF to_regclass('public.project_media_folder_prompt_items') IS NULL THEN
    RAISE EXCEPTION 'public.project_media_folder_prompt_items table is required before applying migration 136';
  END IF;
  IF to_regclass('public.project_media_folder_canvas_states') IS NULL THEN
    RAISE EXCEPTION 'public.project_media_folder_canvas_states table is required before applying migration 136';
  END IF;
END;
$$;

create temporary table if not exists pg_temp.project_media_folder_import_queue (
  folder_id uuid primary key,
  user_id uuid not null,
  parent_folder_id uuid null,
  name text not null,
  project_id uuid not null,
  project_title text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  depth integer not null
) on commit drop;

truncate table pg_temp.project_media_folder_import_queue;

with recursive project_folder_tree as (
  select
    folder.id as folder_id,
    folder.user_id,
    folder.parent_folder_id,
    folder.name,
    folder.project_id,
    coalesce(nullif(btrim(project.title), ''), 'Project') as project_title,
    folder.created_at,
    folder.updated_at,
    0 as depth
  from public.project_media_folders folder
  inner join public.projects project
    on project.id = folder.project_id
   and project.user_id = folder.user_id
  where folder.parent_folder_id is null

  union all

  select
    child.id as folder_id,
    child.user_id,
    child.parent_folder_id,
    child.name,
    child.project_id,
    tree.project_title,
    child.created_at,
    child.updated_at,
    tree.depth + 1 as depth
  from public.project_media_folders child
  inner join project_folder_tree tree
    on tree.folder_id = child.parent_folder_id
   and tree.project_id = child.project_id
   and tree.user_id = child.user_id
)
insert into pg_temp.project_media_folder_import_queue (
  folder_id,
  user_id,
  parent_folder_id,
  name,
  project_id,
  project_title,
  created_at,
  updated_at,
  depth
)
select
  folder_id,
  user_id,
  parent_folder_id,
  name,
  project_id,
  project_title,
  created_at,
  updated_at,
  depth
from project_folder_tree;

DO $$
DECLARE
  source_row record;
  resolved_name text;
  title_suffix text;
  project_suffix text;
  numeric_suffix text;
  max_base_length integer;
  conflict_exists boolean;
  suffix_counter integer;
  root_uuid constant uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  FOR source_row IN
    select
      folder_id,
      user_id,
      parent_folder_id,
      name,
      project_id,
      project_title,
      created_at,
      updated_at,
      depth
    from pg_temp.project_media_folder_import_queue
    order by depth asc, created_at asc, folder_id asc
  LOOP
    if exists (
      select 1
      from public.media_folders folder
      where folder.id = source_row.folder_id
    ) then
      continue;
    end if;

    resolved_name := source_row.name;

    select exists(
      select 1
      from public.media_folders folder
      where folder.user_id = source_row.user_id
        and coalesce(folder.parent_folder_id, root_uuid) =
          coalesce(source_row.parent_folder_id, root_uuid)
        and lower(folder.name) = lower(resolved_name)
        and folder.id <> source_row.folder_id
    )
    into conflict_exists;

    if conflict_exists then
      title_suffix := format(' (%s)', source_row.project_title);
      max_base_length := greatest(1, 64 - char_length(title_suffix));
      resolved_name := left(source_row.name, max_base_length) || title_suffix;

      select exists(
        select 1
        from public.media_folders folder
        where folder.user_id = source_row.user_id
          and coalesce(folder.parent_folder_id, root_uuid) =
            coalesce(source_row.parent_folder_id, root_uuid)
          and lower(folder.name) = lower(resolved_name)
          and folder.id <> source_row.folder_id
      )
      into conflict_exists;

      if conflict_exists then
        project_suffix := format(
          ' (%s %s)',
          source_row.project_title,
          left(replace(source_row.project_id::text, '-', ''), 8)
        );
        max_base_length := greatest(1, 64 - char_length(project_suffix));
        resolved_name := left(source_row.name, max_base_length) || project_suffix;

        select exists(
          select 1
          from public.media_folders folder
          where folder.user_id = source_row.user_id
            and coalesce(folder.parent_folder_id, root_uuid) =
              coalesce(source_row.parent_folder_id, root_uuid)
            and lower(folder.name) = lower(resolved_name)
            and folder.id <> source_row.folder_id
        )
        into conflict_exists;

        suffix_counter := 2;
        while conflict_exists loop
          numeric_suffix := format('%s %s', project_suffix, suffix_counter);
          max_base_length := greatest(1, 64 - char_length(numeric_suffix));
          resolved_name := left(source_row.name, max_base_length) || numeric_suffix;

          select exists(
            select 1
            from public.media_folders folder
            where folder.user_id = source_row.user_id
              and coalesce(folder.parent_folder_id, root_uuid) =
                coalesce(source_row.parent_folder_id, root_uuid)
              and lower(folder.name) = lower(resolved_name)
              and folder.id <> source_row.folder_id
          )
          into conflict_exists;

          suffix_counter := suffix_counter + 1;
        end loop;
      end if;
    end if;

    insert into public.media_folders (
      id,
      user_id,
      name,
      parent_folder_id,
      created_at,
      updated_at
    )
    values (
      source_row.folder_id,
      source_row.user_id,
      resolved_name,
      source_row.parent_folder_id,
      source_row.created_at,
      source_row.updated_at
    )
    on conflict (id) do nothing;
  END LOOP;
END;
$$;

insert into public.media_folder_media_items (
  folder_id,
  media_file_id,
  user_id,
  created_at
)
select
  membership.folder_id,
  membership.media_file_id,
  membership.user_id,
  membership.created_at
from public.project_media_folder_media_items membership
inner join public.media_folders folder
  on folder.id = membership.folder_id
 and folder.user_id = membership.user_id
on conflict (folder_id, media_file_id) do nothing;

insert into public.media_folder_prompt_items (
  folder_id,
  prompt_id,
  user_id,
  created_at
)
select
  membership.folder_id,
  membership.prompt_id,
  membership.user_id,
  membership.created_at
from public.project_media_folder_prompt_items membership
inner join public.media_folders folder
  on folder.id = membership.folder_id
 and folder.user_id = membership.user_id
on conflict (folder_id, prompt_id) do nothing;

insert into public.media_folder_canvas_states (
  user_id,
  folder_id,
  schema_version,
  snapshot,
  save_seq,
  created_at,
  updated_at
)
select
  state.user_id,
  state.folder_id,
  state.schema_version,
  state.snapshot,
  state.save_seq,
  state.created_at,
  state.updated_at
from public.project_media_folder_canvas_states state
inner join public.media_folders folder
  on folder.id = state.folder_id
 and folder.user_id = state.user_id
on conflict (user_id, folder_id) do update
set
  schema_version = excluded.schema_version,
  snapshot = excluded.snapshot,
  save_seq = greatest(public.media_folder_canvas_states.save_seq, excluded.save_seq),
  created_at = least(public.media_folder_canvas_states.created_at, excluded.created_at),
  updated_at = greatest(public.media_folder_canvas_states.updated_at, excluded.updated_at);
