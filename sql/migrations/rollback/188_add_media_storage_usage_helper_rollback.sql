revoke all on function public.resolve_media_storage_usage_bytes(uuid) from public;
revoke all on function public.resolve_media_storage_usage_bytes(uuid) from anon;
revoke all on function public.resolve_media_storage_usage_bytes(uuid) from authenticated;
revoke all on function public.resolve_media_storage_usage_bytes(uuid) from service_role;
drop function if exists public.resolve_media_storage_usage_bytes(uuid);
