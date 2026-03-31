-- Roll back Media Library folder hierarchy support.

drop trigger if exists trg_media_folders_cycle_guard on public.media_folders;
drop function if exists public.enforce_media_folder_hierarchy_cycle_guard();

drop index if exists ix_media_folders_user_parent_created;
drop index if exists ix_media_folders_user_parent_name_unique_ci;

alter table public.media_folders
  drop constraint if exists media_folders_parent_not_self_check;

alter table public.media_folders
  drop constraint if exists media_folders_parent_scope_fk;

alter table public.media_folders
  drop column if exists parent_folder_id;

create unique index if not exists ix_media_folders_user_name_unique_ci
  on public.media_folders (user_id, lower(name));
