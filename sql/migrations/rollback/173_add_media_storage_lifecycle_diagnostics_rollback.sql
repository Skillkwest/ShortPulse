-- Roll back media storage lifecycle aggregate diagnostic RPC.

drop function if exists public.get_media_storage_lifecycle_summary(integer);
drop table if exists public.voice_source_lifecycle;
