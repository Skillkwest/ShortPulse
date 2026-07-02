-- Add a service-role-only media storage basename resolver.
--
-- This keeps legacy preview repair from depending on route-local direct
-- PostgREST access to storage.objects while preserving the existing broad
-- user-scoped basename lookup behavior.

create or replace function public.resolve_media_storage_object_by_basename(
    p_user_id uuid,
    p_basename text
)
returns text
language sql
stable
security definer
set search_path = public, storage
as $$
with normalized as (
    select
        btrim(coalesce(p_basename, '')) as basename,
        p_user_id::text as user_id_text
),
valid_input as (
    select *
    from normalized
    where basename <> ''
      and position('/' in basename) = 0
      and position(chr(92) in basename) = 0
      and position('%' in basename) = 0
      and position('_' in basename) = 0
),
matches as (
    select o.name
    from storage.objects o
    join valid_input i on true
    where o.bucket_id = 'media_library'
      and o.name like i.user_id_text || '/%'
      and lower(o.name) like lower(i.user_id_text || '/%/' || i.basename)
      and lower(right(o.name, length('/' || i.basename))) = lower('/' || i.basename)
    order by o.created_at desc nulls last, o.name asc
    limit 1
)
select name from matches;
$$;

comment on function public.resolve_media_storage_object_by_basename(uuid, text)
    is 'Service-role-only helper that resolves one user-scoped media_library object by basename for legacy preview repair without exposing storage.objects directly.';

revoke all on function public.resolve_media_storage_object_by_basename(uuid, text) from public;
revoke all on function public.resolve_media_storage_object_by_basename(uuid, text) from anon;
revoke all on function public.resolve_media_storage_object_by_basename(uuid, text) from authenticated;
grant execute on function public.resolve_media_storage_object_by_basename(uuid, text) to service_role;
