-- Harden storage entitlement helper RPC grants.
-- These helpers accept an explicit user id and read billing entitlement rows under
-- SECURITY DEFINER, so direct customer execution would bypass per-user RLS.

revoke all on function public.resolve_media_storage_base_limit_bytes(uuid) from public;
revoke all on function public.resolve_media_storage_base_limit_bytes(uuid) from anon;
revoke all on function public.resolve_media_storage_base_limit_bytes(uuid) from authenticated;
grant execute on function public.resolve_media_storage_base_limit_bytes(uuid) to service_role;

revoke all on function public.resolve_media_storage_addon_limit_bytes(uuid) from public;
revoke all on function public.resolve_media_storage_addon_limit_bytes(uuid) from anon;
revoke all on function public.resolve_media_storage_addon_limit_bytes(uuid) from authenticated;
grant execute on function public.resolve_media_storage_addon_limit_bytes(uuid) to service_role;

grant execute on function public.get_media_storage_quota_summary() to authenticated, service_role;
