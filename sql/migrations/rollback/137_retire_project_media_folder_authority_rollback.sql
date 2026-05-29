-- Structural rollback for migration 137.
-- This restores the retired project-folder schema surfaces only. Historical
-- project-folder data is not reconstructed by this rollback because migration
-- 136 already migrated that authority into the global folder tables.

DO $$
BEGIN
  IF to_regclass('public.projects') IS NULL THEN
    RAISE EXCEPTION 'public.projects table is required before rolling back migration 137';
  END IF;
  IF to_regclass('public.media_files') IS NULL THEN
    RAISE EXCEPTION 'public.media_files table is required before rolling back migration 137';
  END IF;
  IF to_regclass('public.media_prompts') IS NULL THEN
    RAISE EXCEPTION 'public.media_prompts table is required before rolling back migration 137';
  END IF;
END;
$$;

create table if not exists public.project_media_folders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_folder_id uuid null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint project_media_folders_name_normalized_check check (
    name = btrim(name)
    and char_length(name) between 1 and 64
  ),
  constraint project_media_folders_parent_not_self_check check (
    parent_folder_id is null or parent_folder_id <> id
  ),
  constraint project_media_folders_project_scope_fk
    foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade
);

create unique index if not exists ux_project_media_folders_id_scope
  on public.project_media_folders (id, project_id, user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_media_folders_parent_scope_fk'
      AND conrelid = 'public.project_media_folders'::regclass
  ) THEN
    alter table public.project_media_folders
      add constraint project_media_folders_parent_scope_fk
      foreign key (parent_folder_id, project_id, user_id)
      references public.project_media_folders (id, project_id, user_id)
      on delete cascade;
  END IF;
END;
$$;

create unique index if not exists ux_project_media_folders_project_parent_name_ci
  on public.project_media_folders (
    project_id,
    coalesce(parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

create index if not exists ix_project_media_folders_user_project_parent_created
  on public.project_media_folders (user_id, project_id, parent_folder_id, created_at asc, id);

alter table public.project_media_folders enable row level security;

drop policy if exists select_project_media_folders_isolation on public.project_media_folders;
create policy select_project_media_folders_isolation
  on public.project_media_folders
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_project_media_folders_isolation on public.project_media_folders;
create policy insert_project_media_folders_isolation
  on public.project_media_folders
  for insert
  with check (auth.uid() = user_id);

drop policy if exists update_project_media_folders_isolation on public.project_media_folders;
create policy update_project_media_folders_isolation
  on public.project_media_folders
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists delete_project_media_folders_isolation on public.project_media_folders;
create policy delete_project_media_folders_isolation
  on public.project_media_folders
  for delete
  using (auth.uid() = user_id);

create unique index if not exists ux_media_files_id_user
  on public.media_files (id, user_id);

create unique index if not exists ux_media_prompts_id_user
  on public.media_prompts (id, user_id);

create table if not exists public.project_media_folder_media_items (
  folder_id uuid not null,
  media_file_id uuid not null,
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint project_media_folder_media_items_pk primary key (folder_id, media_file_id),
  constraint project_media_folder_media_items_folder_fk
    foreign key (folder_id)
    references public.project_media_folders(id)
    on delete cascade,
  constraint project_media_folder_media_items_media_file_fk
    foreign key (media_file_id)
    references public.media_files(id)
    on delete cascade,
  constraint project_media_folder_media_items_folder_scope_fk
    foreign key (folder_id, project_id, user_id)
    references public.project_media_folders(id, project_id, user_id)
    on delete cascade,
  constraint project_media_folder_media_items_media_scope_fk
    foreign key (media_file_id, user_id)
    references public.media_files(id, user_id)
    on delete cascade
);

create index if not exists ix_project_media_folder_media_items_user_project_folder
  on public.project_media_folder_media_items (user_id, project_id, folder_id);

create index if not exists ix_project_media_folder_media_items_user_project_media
  on public.project_media_folder_media_items (user_id, project_id, media_file_id);

alter table public.project_media_folder_media_items enable row level security;

drop policy if exists select_project_media_folder_media_items_isolation on public.project_media_folder_media_items;
create policy select_project_media_folder_media_items_isolation
  on public.project_media_folder_media_items
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_project_media_folder_media_items_isolation on public.project_media_folder_media_items;
create policy insert_project_media_folder_media_items_isolation
  on public.project_media_folder_media_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists delete_project_media_folder_media_items_isolation on public.project_media_folder_media_items;
create policy delete_project_media_folder_media_items_isolation
  on public.project_media_folder_media_items
  for delete
  using (auth.uid() = user_id);

create table if not exists public.project_media_folder_prompt_items (
  folder_id uuid not null,
  prompt_id uuid not null,
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint project_media_folder_prompt_items_pk primary key (folder_id, prompt_id),
  constraint project_media_folder_prompt_items_folder_fk
    foreign key (folder_id)
    references public.project_media_folders(id)
    on delete cascade,
  constraint project_media_folder_prompt_items_prompt_fk
    foreign key (prompt_id)
    references public.media_prompts(id)
    on delete cascade,
  constraint project_media_folder_prompt_items_folder_scope_fk
    foreign key (folder_id, project_id, user_id)
    references public.project_media_folders(id, project_id, user_id)
    on delete cascade,
  constraint project_media_folder_prompt_items_prompt_scope_fk
    foreign key (prompt_id, user_id)
    references public.media_prompts(id, user_id)
    on delete cascade
);

create index if not exists ix_project_media_folder_prompt_items_user_project_folder
  on public.project_media_folder_prompt_items (user_id, project_id, folder_id);

create index if not exists ix_project_media_folder_prompt_items_user_project_prompt
  on public.project_media_folder_prompt_items (user_id, project_id, prompt_id);

alter table public.project_media_folder_prompt_items enable row level security;

drop policy if exists select_project_media_folder_prompt_items_isolation on public.project_media_folder_prompt_items;
create policy select_project_media_folder_prompt_items_isolation
  on public.project_media_folder_prompt_items
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_project_media_folder_prompt_items_isolation on public.project_media_folder_prompt_items;
create policy insert_project_media_folder_prompt_items_isolation
  on public.project_media_folder_prompt_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists delete_project_media_folder_prompt_items_isolation on public.project_media_folder_prompt_items;
create policy delete_project_media_folder_prompt_items_isolation
  on public.project_media_folder_prompt_items
  for delete
  using (auth.uid() = user_id);

create or replace function public.enforce_project_media_folder_hierarchy_cycle_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  creates_cycle boolean;
begin
  if tg_op <> 'INSERT' and tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.parent_folder_id is null then
    return new;
  end if;

  if new.parent_folder_id = new.id then
    raise exception 'Folder cannot be its own parent';
  end if;

  with recursive ancestor_chain as (
    select id, parent_folder_id
    from public.project_media_folders
    where id = new.parent_folder_id
      and project_id = new.project_id
      and user_id = new.user_id
    union all
    select parent_row.id, parent_row.parent_folder_id
    from public.project_media_folders parent_row
    inner join ancestor_chain chain
      on parent_row.id = chain.parent_folder_id
    where parent_row.project_id = new.project_id
      and parent_row.user_id = new.user_id
  )
  select exists(
    select 1
    from ancestor_chain
    where id = new.id
  )
  into creates_cycle;

  if creates_cycle then
    raise exception 'Folder hierarchy cannot contain cycles';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_project_media_folders_cycle_guard on public.project_media_folders;
create trigger trg_project_media_folders_cycle_guard
before insert or update of parent_folder_id
on public.project_media_folders
for each row
execute function public.enforce_project_media_folder_hierarchy_cycle_guard();

create table if not exists public.project_media_folder_canvas_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  folder_id uuid not null,
  schema_version integer not null default 1,
  snapshot jsonb not null default '{}'::jsonb,
  save_seq integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint project_media_folder_canvas_states_pk primary key (user_id, project_id, folder_id),
  constraint project_media_folder_canvas_states_project_fk
    foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade,
  constraint project_media_folder_canvas_states_folder_fk
    foreign key (folder_id, project_id, user_id)
    references public.project_media_folders(id, project_id, user_id)
    on delete cascade,
  constraint project_media_folder_canvas_states_schema_version_check
    check (schema_version >= 1),
  constraint project_media_folder_canvas_states_save_seq_check
    check (save_seq >= 1)
);

create index if not exists ix_project_media_folder_canvas_states_project_updated
  on public.project_media_folder_canvas_states (user_id, project_id, updated_at desc, folder_id);

alter table public.project_media_folder_canvas_states enable row level security;

drop policy if exists select_project_media_folder_canvas_states_isolation
  on public.project_media_folder_canvas_states;
create policy select_project_media_folder_canvas_states_isolation
  on public.project_media_folder_canvas_states
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_project_media_folder_canvas_states_isolation
  on public.project_media_folder_canvas_states;
create policy insert_project_media_folder_canvas_states_isolation
  on public.project_media_folder_canvas_states
  for insert
  with check (auth.uid() = user_id);

drop policy if exists update_project_media_folder_canvas_states_isolation
  on public.project_media_folder_canvas_states;
create policy update_project_media_folder_canvas_states_isolation
  on public.project_media_folder_canvas_states
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists delete_project_media_folder_canvas_states_isolation
  on public.project_media_folder_canvas_states;
create policy delete_project_media_folder_canvas_states_isolation
  on public.project_media_folder_canvas_states
  for delete
  using (auth.uid() = user_id);

create or replace function public.get_project_media_folder_item_counts(
  p_user_id uuid,
  p_project_id uuid,
  p_folder_ids uuid[]
)
returns table(folder_id uuid, item_count bigint)
language sql
security definer
set search_path = public
as $$
  with requested as (
    select distinct requested_folder_id as folder_id
    from unnest(coalesce(p_folder_ids, array[]::uuid[])) as requested(requested_folder_id)
  ),
  media_counts as (
    select m.folder_id, count(*)::bigint as item_count
    from public.project_media_folder_media_items m
    join requested r on r.folder_id = m.folder_id
    where m.user_id = p_user_id
      and m.project_id = p_project_id
    group by m.folder_id
  ),
  prompt_counts as (
    select p.folder_id, count(*)::bigint as item_count
    from public.project_media_folder_prompt_items p
    join requested r on r.folder_id = p.folder_id
    where p.user_id = p_user_id
      and p.project_id = p_project_id
    group by p.folder_id
  )
  select
    r.folder_id,
    coalesce(m.item_count, 0) + coalesce(p.item_count, 0) as item_count
  from requested r
  left join media_counts m on m.folder_id = r.folder_id
  left join prompt_counts p on p.folder_id = r.folder_id;
$$;

revoke all on function public.get_project_media_folder_item_counts(uuid, uuid, uuid[]) from public;
revoke all on function public.get_project_media_folder_item_counts(uuid, uuid, uuid[]) from anon;
revoke all on function public.get_project_media_folder_item_counts(uuid, uuid, uuid[]) from authenticated;
grant execute on function public.get_project_media_folder_item_counts(uuid, uuid, uuid[]) to service_role;
