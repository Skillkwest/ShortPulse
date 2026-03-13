-- Roll back migration 064 by deleting only rows tagged by the backfill marker.

delete from public.media_files
where coalesce(metadata->>'backfill_migration', '') = '064_backfill_media_files_from_storage_objects'
  and coalesce(metadata->>'backfill_storage_object_id', '') <> '';
