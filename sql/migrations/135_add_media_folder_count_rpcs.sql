-- Aggregated folder item counts for Media Library folder listing.
-- Keeps folder-list APIs from materializing every membership row in application memory.

create or replace function public.get_media_folder_item_counts(
  p_user_id uuid,
  p_folder_ids uuid[]
)
returns table(folder_id uuid, item_count bigint)
language sql
security definer
set search_path = public
as $$
  with requested as (
    select distinct requested_folder_id as folder_id
    from unnest(coalesce(p_folder_ids, array[]::uuid[])) as requested(requested_folder_id)
  ),
  media_counts as (
    select m.folder_id, count(*)::bigint as item_count
    from public.media_folder_media_items m
    join requested r on r.folder_id = m.folder_id
    where m.user_id = p_user_id
    group by m.folder_id
  ),
  prompt_counts as (
    select p.folder_id, count(*)::bigint as item_count
    from public.media_folder_prompt_items p
    join requested r on r.folder_id = p.folder_id
    where p.user_id = p_user_id
    group by p.folder_id
  )
  select
    r.folder_id,
    coalesce(m.item_count, 0) + coalesce(p.item_count, 0) as item_count
  from requested r
  left join media_counts m on m.folder_id = r.folder_id
  left join prompt_counts p on p.folder_id = r.folder_id;
$$;

revoke all on function public.get_media_folder_item_counts(uuid, uuid[]) from public;
revoke all on function public.get_media_folder_item_counts(uuid, uuid[]) from anon;
revoke all on function public.get_media_folder_item_counts(uuid, uuid[]) from authenticated;
grant execute on function public.get_media_folder_item_counts(uuid, uuid[]) to service_role;

create or replace function public.get_project_media_folder_item_counts(
  p_user_id uuid,
  p_project_id uuid,
  p_folder_ids uuid[]
)
returns table(folder_id uuid, item_count bigint)
language sql
security definer
set search_path = public
as $$
  with requested as (
    select distinct requested_folder_id as folder_id
    from unnest(coalesce(p_folder_ids, array[]::uuid[])) as requested(requested_folder_id)
  ),
  media_counts as (
    select m.folder_id, count(*)::bigint as item_count
    from public.project_media_folder_media_items m
    join requested r on r.folder_id = m.folder_id
    where m.user_id = p_user_id
      and m.project_id = p_project_id
    group by m.folder_id
  ),
  prompt_counts as (
    select p.folder_id, count(*)::bigint as item_count
    from public.project_media_folder_prompt_items p
    join requested r on r.folder_id = p.folder_id
    where p.user_id = p_user_id
      and p.project_id = p_project_id
    group by p.folder_id
  )
  select
    r.folder_id,
    coalesce(m.item_count, 0) + coalesce(p.item_count, 0) as item_count
  from requested r
  left join media_counts m on m.folder_id = r.folder_id
  left join prompt_counts p on p.folder_id = r.folder_id;
$$;

revoke all on function public.get_project_media_folder_item_counts(uuid, uuid, uuid[]) from public;
revoke all on function public.get_project_media_folder_item_counts(uuid, uuid, uuid[]) from anon;
revoke all on function public.get_project_media_folder_item_counts(uuid, uuid, uuid[]) from authenticated;
grant execute on function public.get_project_media_folder_item_counts(uuid, uuid, uuid[]) to service_role;
