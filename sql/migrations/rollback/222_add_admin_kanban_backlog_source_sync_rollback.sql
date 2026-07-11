-- Roll back planning-backlog source metadata and sync RPC for admin Kanban.

drop function if exists public.sync_admin_kanban_planning_backlog_items(jsonb, uuid, text, boolean);

drop function if exists public.create_admin_kanban_item(
    text, text, uuid, text, text, text, text, text, integer, text
);

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

revoke all on function public.create_admin_kanban_item(text, text, uuid, text) from public;
revoke all on function public.create_admin_kanban_item(text, text, uuid, text) from anon;
revoke all on function public.create_admin_kanban_item(text, text, uuid, text) from authenticated;
grant execute on function public.create_admin_kanban_item(text, text, uuid, text) to service_role;

alter table public.admin_kanban_activity
    drop constraint if exists admin_kanban_activity_action_check;

update public.admin_kanban_activity
set action = 'updated'
where action = 'synced';

alter table public.admin_kanban_activity
    add constraint admin_kanban_activity_action_check check (
        action in ('created', 'updated', 'moved', 'archived')
    );

drop index if exists public.ix_admin_kanban_items_active_source_status_sort;
drop index if exists public.ux_admin_kanban_items_source_identity;

alter table public.admin_kanban_items
    drop constraint if exists admin_kanban_items_source_metadata_check,
    drop constraint if exists admin_kanban_items_source_key_format_check,
    drop constraint if exists admin_kanban_items_source_type_check,
    drop column if exists source_missing_at,
    drop column if exists source_synced_at,
    drop column if exists source_fingerprint,
    drop column if exists source_line,
    drop column if exists source_section,
    drop column if exists source_path,
    drop column if exists source_key,
    drop column if exists source_type;
