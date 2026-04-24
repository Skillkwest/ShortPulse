-- Roll back project-owned Media Library folders and membership tables.

drop trigger if exists trg_project_media_folders_cycle_guard on public.project_media_folders;
drop function if exists public.enforce_project_media_folder_hierarchy_cycle_guard();

drop table if exists public.project_media_folder_prompt_items;
drop table if exists public.project_media_folder_media_items;
drop table if exists public.project_media_folders;
