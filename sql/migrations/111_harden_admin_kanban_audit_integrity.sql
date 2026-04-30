-- Harden admin kanban audit integrity.
-- Moves task mutations plus activity logging into service-role-only RPCs so
-- item state and audit history cannot partially commit.

alter table public.admin_kanban_activity
    drop constraint if exists admin_kanban_activity_item_id_fkey;

alter table public.admin_kanban_activity
    add constraint admin_kanban_activity_item_id_fkey
    foreign key (item_id)
    references public.admin_kanban_items(id)
    on delete restrict;

create or replace function public.create_admin_kanban_item(
    p_title text,
    p_details text default '',
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
    v_title text := btrim(coalesce(p_title, ''));
    v_details text := btrim(coalesce(p_details, ''));
    v_sort_order integer;
    v_item public.admin_kanban_items%rowtype;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized' using errcode = '42501';
    end if;

    if char_length(v_title) < 1 or char_length(v_title) > 140 then
        raise exception 'Task title must be between 1 and 140 characters.' using errcode = '22023';
    end if;

    if char_length(v_details) > 1000 then
        raise exception 'Task notes must be 1000 characters or fewer.' using errcode = '22023';
    end if;

    select coalesce(max(sort_order), 0) + 1
    into v_sort_order
    from public.admin_kanban_items
    where archived_at is null;

    insert into public.admin_kanban_items (
        title,
        details,
        status,
        sort_order,
        created_by,
        updated_by
    )
    values (
        v_title,
        v_details,
        'backlog',
        v_sort_order,
        p_actor_user_id,
        p_actor_user_id
    )
    returning * into v_item;

    insert into public.admin_kanban_activity (
        item_id,
        action,
        to_status,
        note,
        actor_user_id,
        actor_email
    )
    values (
        v_item.id,
        'created',
        v_item.status,
        v_item.title,
        p_actor_user_id,
        p_actor_email
    );

    return v_item;
end;
$$;

create or replace function public.update_admin_kanban_item(
    p_item_id uuid,
    p_title text,
    p_details text default '',
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
    v_title text := btrim(coalesce(p_title, ''));
    v_details text := btrim(coalesce(p_details, ''));
    v_item public.admin_kanban_items%rowtype;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized' using errcode = '42501';
    end if;

    if p_item_id is null then
        raise exception 'Item id is required.' using errcode = '22023';
    end if;

    if char_length(v_title) < 1 or char_length(v_title) > 140 then
        raise exception 'Task title must be between 1 and 140 characters.' using errcode = '22023';
    end if;

    if char_length(v_details) > 1000 then
        raise exception 'Task notes must be 1000 characters or fewer.' using errcode = '22023';
    end if;

    update public.admin_kanban_items
    set
        title = v_title,
        details = v_details,
        updated_by = p_actor_user_id
    where id = p_item_id
      and archived_at is null
    returning * into v_item;

    if v_item.id is null then
        return null;
    end if;

    insert into public.admin_kanban_activity (
        item_id,
        action,
        to_status,
        note,
        actor_user_id,
        actor_email
    )
    values (
        v_item.id,
        'updated',
        v_item.status,
        v_item.title,
        p_actor_user_id,
        p_actor_email
    );

    return v_item;
end;
$$;

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

create or replace function public.archive_admin_kanban_item(
    p_item_id uuid,
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
    v_current public.admin_kanban_items%rowtype;
    v_item public.admin_kanban_items%rowtype;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized' using errcode = '42501';
    end if;

    if p_item_id is null then
        raise exception 'Item id is required.' using errcode = '22023';
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

    update public.admin_kanban_items
    set
        archived_at = timezone('utc', now()),
        archived_by = p_actor_user_id,
        updated_by = p_actor_user_id
    where id = v_current.id
    returning * into v_item;

    insert into public.admin_kanban_activity (
        item_id,
        action,
        from_status,
        note,
        actor_user_id,
        actor_email
    )
    values (
        v_item.id,
        'archived',
        v_current.status,
        v_current.title,
        p_actor_user_id,
        p_actor_email
    );

    return v_item;
end;
$$;

revoke all on function public.create_admin_kanban_item(text, text, uuid, text) from public;
revoke all on function public.create_admin_kanban_item(text, text, uuid, text) from anon;
revoke all on function public.create_admin_kanban_item(text, text, uuid, text) from authenticated;
grant execute on function public.create_admin_kanban_item(text, text, uuid, text) to service_role;

revoke all on function public.update_admin_kanban_item(uuid, text, text, uuid, text) from public;
revoke all on function public.update_admin_kanban_item(uuid, text, text, uuid, text) from anon;
revoke all on function public.update_admin_kanban_item(uuid, text, text, uuid, text) from authenticated;
grant execute on function public.update_admin_kanban_item(uuid, text, text, uuid, text) to service_role;

revoke all on function public.move_admin_kanban_item(uuid, text, uuid, text) from public;
revoke all on function public.move_admin_kanban_item(uuid, text, uuid, text) from anon;
revoke all on function public.move_admin_kanban_item(uuid, text, uuid, text) from authenticated;
grant execute on function public.move_admin_kanban_item(uuid, text, uuid, text) to service_role;

revoke all on function public.archive_admin_kanban_item(uuid, uuid, text) from public;
revoke all on function public.archive_admin_kanban_item(uuid, uuid, text) from anon;
revoke all on function public.archive_admin_kanban_item(uuid, uuid, text) from authenticated;
grant execute on function public.archive_admin_kanban_item(uuid, uuid, text) to service_role;
