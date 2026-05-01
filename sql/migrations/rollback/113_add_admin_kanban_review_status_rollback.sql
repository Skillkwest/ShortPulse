-- Roll back Review as an admin kanban status.
-- Review rows are folded into Complete before restoring the previous constraints.

update public.admin_kanban_items
set status = 'complete'
where status = 'review';

update public.admin_kanban_activity
set from_status = 'complete'
where from_status = 'review';

update public.admin_kanban_activity
set to_status = 'complete'
where to_status = 'review';

alter table public.admin_kanban_items
    drop constraint if exists admin_kanban_items_status_check;

alter table public.admin_kanban_items
    add constraint admin_kanban_items_status_check check (
        status in ('backlog', 'in_progress', 'complete', 'published')
    );

alter table public.admin_kanban_activity
    drop constraint if exists admin_kanban_activity_from_status_check;

alter table public.admin_kanban_activity
    add constraint admin_kanban_activity_from_status_check check (
        from_status is null
        or from_status in ('backlog', 'in_progress', 'complete', 'published')
    );

alter table public.admin_kanban_activity
    drop constraint if exists admin_kanban_activity_to_status_check;

alter table public.admin_kanban_activity
    add constraint admin_kanban_activity_to_status_check check (
        to_status is null
        or to_status in ('backlog', 'in_progress', 'complete', 'published')
    );

create or replace function public.move_admin_kanban_item(
    p_item_id uuid,
    p_status text,
    p_actor_user_id uuid default null,
    p_actor_email text default null
)
returns public.admin_kanban_items
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    v_next_status text := lower(btrim(coalesce(p_status, '')));
    v_current public.admin_kanban_items%rowtype;
    v_item public.admin_kanban_items%rowtype;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized' using errcode = '42501';
    end if;

    if p_item_id is null then
        raise exception 'Item id is required.' using errcode = '22023';
    end if;

    if v_next_status not in ('backlog', 'in_progress', 'complete', 'published') then
        raise exception 'status must be one of backlog, in_progress, complete, published.' using errcode = '22023';
    end if;

    select *
    into v_current
    from public.admin_kanban_items
    where id = p_item_id
      and archived_at is null
    for update;

    if v_current.id is null then
        return null;
    end if;

    if v_current.status = v_next_status then
        return v_current;
    end if;

    update public.admin_kanban_items
    set
        status = v_next_status,
        updated_by = p_actor_user_id
    where id = v_current.id
    returning * into v_item;

    insert into public.admin_kanban_activity (
        item_id,
        action,
        from_status,
        to_status,
        actor_user_id,
        actor_email
    )
    values (
        v_item.id,
        'moved',
        v_current.status,
        v_item.status,
        p_actor_user_id,
        p_actor_email
    );

    return v_item;
end;
$$;

revoke all on function public.move_admin_kanban_item(uuid, text, uuid, text) from public;
revoke all on function public.move_admin_kanban_item(uuid, text, uuid, text) from anon;
revoke all on function public.move_admin_kanban_item(uuid, text, uuid, text) from authenticated;
grant execute on function public.move_admin_kanban_item(uuid, text, uuid, text) to service_role;
