-- Remove the service-role-only media storage basename resolver.

drop function if exists public.resolve_media_storage_object_by_basename(uuid, text);
