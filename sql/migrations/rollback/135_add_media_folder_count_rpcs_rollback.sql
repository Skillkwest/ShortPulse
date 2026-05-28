-- Roll back aggregated folder item count RPCs.

drop function if exists public.get_project_media_folder_item_counts(uuid, uuid, uuid[]);
drop function if exists public.get_media_folder_item_counts(uuid, uuid[]);
