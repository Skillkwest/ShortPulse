-- Rollback: remove admin kanban mutation RPCs and restore cascade FK semantics.

drop function if exists public.archive_admin_kanban_item(uuid, uuid, text);
drop function if exists public.move_admin_kanban_item(uuid, text, uuid, text);
drop function if exists public.update_admin_kanban_item(uuid, text, text, uuid, text);
drop function if exists public.create_admin_kanban_item(text, text, uuid, text);

alter table public.admin_kanban_activity
    drop constraint if exists admin_kanban_activity_item_id_fkey;

alter table public.admin_kanban_activity
    add constraint admin_kanban_activity_item_id_fkey
    foreign key (item_id)
    references public.admin_kanban_items(id)
    on delete cascade;
