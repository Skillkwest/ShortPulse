-- Add durable display derivatives for admin-managed dashboard tutorial thumbnails.
-- Uploaded originals remain source material; dashboard cards should render signed derivative objects.

alter table public.dashboard_tutorials
    add column if not exists thumbnail_display_storage_path text,
    add column if not exists thumbnail_display_file_size_bytes integer,
    add column if not exists thumbnail_display_content_type text,
    add column if not exists thumbnail_display_media_type text,
    add column if not exists thumbnail_poster_storage_path text,
    add column if not exists thumbnail_poster_file_size_bytes integer,
    add column if not exists thumbnail_poster_content_type text;

alter table public.dashboard_tutorials
    drop constraint if exists dashboard_tutorials_thumbnail_display_storage_path_format_check,
    drop constraint if exists dashboard_tutorials_thumbnail_display_file_size_check,
    drop constraint if exists dashboard_tutorials_thumbnail_display_content_type_check,
    drop constraint if exists dashboard_tutorials_thumbnail_display_media_type_check,
    drop constraint if exists dashboard_tutorials_thumbnail_poster_storage_path_format_check,
    drop constraint if exists dashboard_tutorials_thumbnail_poster_file_size_check,
    drop constraint if exists dashboard_tutorials_thumbnail_poster_content_type_check,
    drop constraint if exists dashboard_tutorials_thumbnail_display_source_check;

alter table public.dashboard_tutorials
    add constraint dashboard_tutorials_thumbnail_display_storage_path_format_check check (
        thumbnail_display_storage_path is null
        or (
            thumbnail_display_storage_path = btrim(thumbnail_display_storage_path)
            and char_length(thumbnail_display_storage_path) between 1 and 500
            and thumbnail_display_storage_path ~ '^tutorial-thumbnail-variants/'
            and thumbnail_display_storage_path !~ '(^/|//|\\.\\.|\\\\)'
        )
    ),
    add constraint dashboard_tutorials_thumbnail_display_file_size_check check (
        thumbnail_display_file_size_bytes is null
        or (
            thumbnail_display_file_size_bytes > 0
            and thumbnail_display_file_size_bytes <= 52428800
        )
    ),
    add constraint dashboard_tutorials_thumbnail_display_content_type_check check (
        thumbnail_display_content_type is null
        or thumbnail_display_content_type in (
            'image/jpeg',
            'image/webp',
            'video/mp4'
        )
    ),
    add constraint dashboard_tutorials_thumbnail_display_media_type_check check (
        thumbnail_display_media_type is null
        or thumbnail_display_media_type in ('image', 'video')
    ),
    add constraint dashboard_tutorials_thumbnail_poster_storage_path_format_check check (
        thumbnail_poster_storage_path is null
        or (
            thumbnail_poster_storage_path = btrim(thumbnail_poster_storage_path)
            and char_length(thumbnail_poster_storage_path) between 1 and 500
            and thumbnail_poster_storage_path ~ '^tutorial-thumbnail-variants/'
            and thumbnail_poster_storage_path !~ '(^/|//|\\.\\.|\\\\)'
        )
    ),
    add constraint dashboard_tutorials_thumbnail_poster_file_size_check check (
        thumbnail_poster_file_size_bytes is null
        or (
            thumbnail_poster_file_size_bytes > 0
            and thumbnail_poster_file_size_bytes <= 52428800
        )
    ),
    add constraint dashboard_tutorials_thumbnail_poster_content_type_check check (
        thumbnail_poster_content_type is null
        or thumbnail_poster_content_type = 'image/jpeg'
    ),
    add constraint dashboard_tutorials_thumbnail_display_source_check check (
        thumbnail_storage_path is null
        or (
            thumbnail_display_storage_path is null
            or (
                thumbnail_display_file_size_bytes is not null
                and thumbnail_display_content_type is not null
                and thumbnail_display_media_type is not null
            )
        )
    );

drop function if exists public.reorder_dashboard_tutorials(uuid[], uuid);

create or replace function public.reorder_dashboard_tutorials(
    p_ids uuid[],
    p_actor_user_id uuid default null
)
returns table (
    id uuid,
    title text,
    youtube_url text,
    thumbnail_url text,
    thumbnail_storage_path text,
    thumbnail_file_size_bytes integer,
    thumbnail_content_type text,
    thumbnail_media_type text,
    thumbnail_display_storage_path text,
    thumbnail_display_file_size_bytes integer,
    thumbnail_display_content_type text,
    thumbnail_display_media_type text,
    thumbnail_poster_storage_path text,
    thumbnail_poster_file_size_bytes integer,
    thumbnail_poster_content_type text,
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
        dashboard_tutorials.thumbnail_storage_path,
        dashboard_tutorials.thumbnail_file_size_bytes,
        dashboard_tutorials.thumbnail_content_type,
        dashboard_tutorials.thumbnail_media_type,
        dashboard_tutorials.thumbnail_display_storage_path,
        dashboard_tutorials.thumbnail_display_file_size_bytes,
        dashboard_tutorials.thumbnail_display_content_type,
        dashboard_tutorials.thumbnail_display_media_type,
        dashboard_tutorials.thumbnail_poster_storage_path,
        dashboard_tutorials.thumbnail_poster_file_size_bytes,
        dashboard_tutorials.thumbnail_poster_content_type,
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
