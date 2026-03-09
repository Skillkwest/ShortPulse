-- Roll back media folder and membership tables introduced in migration 060.

drop table if exists public.media_folder_prompt_items;
drop table if exists public.media_folder_media_items;
drop table if exists public.media_folders;

drop index if exists public.ix_media_prompts_id_user;
drop index if exists public.ix_media_files_id_user;
