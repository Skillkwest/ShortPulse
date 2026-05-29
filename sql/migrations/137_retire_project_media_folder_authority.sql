-- Retire the obsolete project-scoped Media Library folder authority after the
-- global folder cutover has been verified in production.

drop function if exists public.get_project_media_folder_item_counts(uuid, uuid, uuid[]);

drop table if exists public.project_media_folder_canvas_states;
drop table if exists public.project_media_folder_prompt_items;
drop table if exists public.project_media_folder_media_items;

drop trigger if exists trg_project_media_folders_cycle_guard on public.project_media_folders;
drop trigger if exists project_media_folder_hierarchy_cycle_guard on public.project_media_folders;
drop function if exists public.enforce_project_media_folder_hierarchy_cycle_guard();

drop table if exists public.project_media_folders;
