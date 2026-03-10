-- Add global dashboard announcements managed by admin operators.
-- Supports one active bulletin at a time with service-role publish semantics.

create table if not exists public.dashboard_announcements (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    message text not null,
    is_active boolean not null default false,
    published_at timestamptz,
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint dashboard_announcements_title_format_check check (
        title = btrim(title)
        and char_length(title) between 1 and 120
    ),
    constraint dashboard_announcements_message_format_check check (
        message = btrim(message)
        and char_length(message) between 1 and 500
    )
);

create unique index if not exists ux_dashboard_announcements_single_active
    on public.dashboard_announcements ((is_active))
    where is_active = true;

create index if not exists ix_dashboard_announcements_active_published
    on public.dashboard_announcements (is_active, published_at desc);

create or replace function public.set_dashboard_announcements_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists trg_dashboard_announcements_updated_at on public.dashboard_announcements;
create trigger trg_dashboard_announcements_updated_at
before update on public.dashboard_announcements
for each row execute function public.set_dashboard_announcements_updated_at();

alter table public.dashboard_announcements enable row level security;

drop policy if exists select_active_dashboard_announcements on public.dashboard_announcements;
create policy select_active_dashboard_announcements
    on public.dashboard_announcements
    for select
    using (auth.uid() is not null and is_active = true);

create or replace function public.publish_dashboard_announcement(
    p_title text,
    p_message text,
    p_actor_user_id uuid default null
)
returns table (
    id uuid,
    title text,
    message text,
    published_at timestamptz,
    updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_title text;
    v_message text;
    v_now timestamptz;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can publish dashboard announcements';
    end if;

    v_title := left(btrim(coalesce(p_title, '')), 120);
    v_message := left(btrim(coalesce(p_message, '')), 500);

    if v_title = '' then
        raise exception 'Announcement title is required';
    end if;
    if v_message = '' then
        raise exception 'Announcement message is required';
    end if;

    v_now := timezone('utc', now());

    -- Serialize publish operations to preserve one-active semantics under contention.
    perform pg_advisory_xact_lock(hashtext('dashboard_announcements_publish'));

    update public.dashboard_announcements
       set is_active = false,
           updated_by = p_actor_user_id,
           updated_at = v_now
     where is_active = true;

    return query
    insert into public.dashboard_announcements (
        title,
        message,
        is_active,
        published_at,
        created_by,
        updated_by,
        created_at,
        updated_at
    )
    values (
        v_title,
        v_message,
        true,
        v_now,
        p_actor_user_id,
        p_actor_user_id,
        v_now,
        v_now
    )
    returning
        dashboard_announcements.id,
        dashboard_announcements.title,
        dashboard_announcements.message,
        dashboard_announcements.published_at,
        dashboard_announcements.updated_at;
end;
$$;

revoke all on function public.publish_dashboard_announcement(text, text, uuid) from public;
revoke all on function public.publish_dashboard_announcement(text, text, uuid) from anon;
revoke all on function public.publish_dashboard_announcement(text, text, uuid) from authenticated;
grant execute on function public.publish_dashboard_announcement(text, text, uuid) to service_role;
