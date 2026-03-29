-- Add real parent/child hierarchy support to Media Library folders.
-- Keeps All Media virtual while allowing custom folders to nest under one another.

DO $$
BEGIN
  IF to_regclass('public.media_folders') IS NULL THEN
    RAISE EXCEPTION 'public.media_folders table is required before applying migration 073';
  END IF;
END;
$$;

alter table public.media_folders
  add column if not exists parent_folder_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'media_folders_parent_scope_fk'
      and conrelid = 'public.media_folders'::regclass
  ) then
    alter table public.media_folders
      add constraint media_folders_parent_scope_fk
      foreign key (parent_folder_id, user_id)
      references public.media_folders (id, user_id)
      on delete cascade;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'media_folders_parent_not_self_check'
      and conrelid = 'public.media_folders'::regclass
  ) then
    alter table public.media_folders
      add constraint media_folders_parent_not_self_check
      check (parent_folder_id is null or parent_folder_id <> id);
  end if;
end;
$$;

drop index if exists ix_media_folders_user_name_unique_ci;

create unique index if not exists ix_media_folders_user_parent_name_unique_ci
  on public.media_folders (
    user_id,
    coalesce(parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

create index if not exists ix_media_folders_user_parent_created
  on public.media_folders (user_id, parent_folder_id, created_at asc, id);

create or replace function public.enforce_media_folder_hierarchy_cycle_guard()
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
    from public.media_folders
    where id = new.parent_folder_id
      and user_id = new.user_id
    union all
    select parent_row.id, parent_row.parent_folder_id
    from public.media_folders parent_row
    inner join ancestor_chain chain
      on parent_row.id = chain.parent_folder_id
    where parent_row.user_id = new.user_id
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

drop trigger if exists trg_media_folders_cycle_guard on public.media_folders;

create trigger trg_media_folders_cycle_guard
before insert or update of parent_folder_id
on public.media_folders
for each row
execute function public.enforce_media_folder_hierarchy_cycle_guard();
