-- Roll back app-owned dashboard tutorial thumbnail uploads.

alter table public.dashboard_tutorials
    drop constraint if exists dashboard_tutorials_thumbnail_source_check,
    drop constraint if exists dashboard_tutorials_thumbnail_content_type_check,
    drop constraint if exists dashboard_tutorials_thumbnail_file_size_check,
    drop constraint if exists dashboard_tutorials_thumbnail_storage_path_format_check,
    drop constraint if exists dashboard_tutorials_thumbnail_url_format_check;

update public.dashboard_tutorials
   set thumbnail_url = 'https://example.com/dashboard-tutorial-thumbnail-placeholder'
 where thumbnail_url is null;

alter table public.dashboard_tutorials
    alter column thumbnail_url set not null,
    add constraint dashboard_tutorials_thumbnail_url_format_check check (
        thumbnail_url = btrim(thumbnail_url)
        and char_length(thumbnail_url) between 1 and 1000
        and thumbnail_url ~ '^https://'
    );

alter table public.dashboard_tutorials
    drop column if exists thumbnail_storage_path,
    drop column if exists thumbnail_file_size_bytes,
    drop column if exists thumbnail_content_type;

create or replace function public.reorder_dashboard_tutorials(
    p_ids uuid[],
    p_actor_user_id uuid default null
)
returns table (
    id uuid,
    title text,
    youtube_url text,
    thumbnail_url text,
    thumbnail_media_type text,
    thumbnail_alt text,
    display_order integer,
    is_active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_id uuid;
    v_seen uuid[] := array[]::uuid[];
    v_order integer := 0;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can reorder dashboard tutorials';
    end if;

    if p_ids is null or array_length(p_ids, 1) is null then
        raise exception 'Tutorial ids are required';
    end if;

    perform pg_advisory_xact_lock(hashtext('dashboard_tutorials_reorder'));

    foreach v_id in array p_ids loop
        if v_id is null then
            raise exception 'Tutorial id cannot be null';
        end if;
        if v_id = any(v_seen) then
            raise exception 'Tutorial ids must be unique';
        end if;

        v_seen := array_append(v_seen, v_id);
        v_order := v_order + 1;

        update public.dashboard_tutorials
           set display_order = v_order,
               updated_by = p_actor_user_id,
               updated_at = timezone('utc', now())
         where dashboard_tutorials.id = v_id;

        if not found then
            raise exception 'Dashboard tutorial not found: %', v_id;
        end if;
    end loop;

    return query
    select
        dashboard_tutorials.id,
        dashboard_tutorials.title,
        dashboard_tutorials.youtube_url,
        dashboard_tutorials.thumbnail_url,
        dashboard_tutorials.thumbnail_media_type,
        dashboard_tutorials.thumbnail_alt,
        dashboard_tutorials.display_order,
        dashboard_tutorials.is_active,
        dashboard_tutorials.created_at,
        dashboard_tutorials.updated_at
      from public.dashboard_tutorials
     order by dashboard_tutorials.display_order asc,
              dashboard_tutorials.updated_at desc
     limit 100;
end;
$$;

revoke all on function public.reorder_dashboard_tutorials(uuid[], uuid) from public;
revoke all on function public.reorder_dashboard_tutorials(uuid[], uuid) from anon;
revoke all on function public.reorder_dashboard_tutorials(uuid[], uuid) from authenticated;
grant execute on function public.reorder_dashboard_tutorials(uuid[], uuid) to service_role;

delete from storage.buckets
 where id = 'dashboard_tutorial_thumbnails';
