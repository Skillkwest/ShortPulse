-- Roll back migration 136 by removing imported global folder rows that reused
-- historical project folder ids. Use only in an immediate controlled rollback window.

delete from public.media_folder_canvas_states
where folder_id in (
  select id
  from public.project_media_folders
);

delete from public.media_folder_media_items
where folder_id in (
  select id
  from public.project_media_folders
);

delete from public.media_folder_prompt_items
where folder_id in (
  select id
  from public.project_media_folders
);

delete from public.media_folders
where id in (
  select id
  from public.project_media_folders
);
