-- Add admin-managed tutorial cards for the signed-in dashboard.
-- Tutorials are globally ordered, read by authenticated users, and written only through admin APIs.

create table if not exists public.dashboard_tutorials (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    youtube_url text not null,
    thumbnail_url text not null,
    thumbnail_media_type text not null default 'image',
    thumbnail_alt text not null default '',
    display_order integer not null default 0,
    is_active boolean not null default true,
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint dashboard_tutorials_title_format_check check (
        title = btrim(title)
        and char_length(title) between 1 and 120
    ),
    constraint dashboard_tutorials_youtube_url_format_check check (
        youtube_url = btrim(youtube_url)
        and char_length(youtube_url) between 1 and 500
        and youtube_url ~ '^https://'
    ),
    constraint dashboard_tutorials_thumbnail_url_format_check check (
        thumbnail_url = btrim(thumbnail_url)
        and char_length(thumbnail_url) between 1 and 1000
        and thumbnail_url ~ '^https://'
    ),
    constraint dashboard_tutorials_thumbnail_media_type_check check (
        thumbnail_media_type in ('image', 'video')
    ),
    constraint dashboard_tutorials_thumbnail_alt_format_check check (
        thumbnail_alt = btrim(thumbnail_alt)
        and char_length(thumbnail_alt) <= 160
    ),
    constraint dashboard_tutorials_display_order_check check (
        display_order >= 0
    )
);

create index if not exists ix_dashboard_tutorials_active_order
    on public.dashboard_tutorials (is_active, display_order asc, updated_at desc)
    where is_active = true;

create index if not exists ix_dashboard_tutorials_admin_order
    on public.dashboard_tutorials (display_order asc, updated_at desc);

create or replace function public.set_dashboard_tutorials_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists trg_dashboard_tutorials_updated_at on public.dashboard_tutorials;
create trigger trg_dashboard_tutorials_updated_at
before update on public.dashboard_tutorials
for each row execute function public.set_dashboard_tutorials_updated_at();

alter table public.dashboard_tutorials enable row level security;

drop policy if exists select_active_dashboard_tutorials on public.dashboard_tutorials;
create policy select_active_dashboard_tutorials
    on public.dashboard_tutorials
    for select
    using (auth.uid() is not null and is_active = true);

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

revoke all on public.dashboard_tutorials from public;
revoke all on public.dashboard_tutorials from anon;
revoke all on public.dashboard_tutorials from authenticated;
grant select, insert, update, delete on public.dashboard_tutorials to service_role;

revoke all on function public.reorder_dashboard_tutorials(uuid[], uuid) from public;
revoke all on function public.reorder_dashboard_tutorials(uuid[], uuid) from anon;
revoke all on function public.reorder_dashboard_tutorials(uuid[], uuid) from authenticated;
grant execute on function public.reorder_dashboard_tutorials(uuid[], uuid) to service_role;
