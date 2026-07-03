-- Add a service-role-only aggregate helper for server-side media storage quota preflights.
-- Customer-facing quota reads continue to use get_media_storage_quota_summary(), which derives auth.uid().

create or replace function public.resolve_media_storage_usage_bytes(p_user_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
    select coalesce(sum(file_size), 0)::bigint
    from public.media_files
    where user_id = p_user_id;
$$;

revoke all on function public.resolve_media_storage_usage_bytes(uuid) from public;
revoke all on function public.resolve_media_storage_usage_bytes(uuid) from anon;
revoke all on function public.resolve_media_storage_usage_bytes(uuid) from authenticated;
grant execute on function public.resolve_media_storage_usage_bytes(uuid) to service_role;
