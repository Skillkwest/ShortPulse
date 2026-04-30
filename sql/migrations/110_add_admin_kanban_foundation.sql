-- Add shared admin kanban board persistence.
-- Stores operator tasks and immutable activity entries behind admin-only server APIs.

create table if not exists public.admin_kanban_items (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    details text not null default '',
    status text not null default 'backlog',
    sort_order integer not null default 0,
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null,
    archived_by uuid references auth.users(id) on delete set null,
    archived_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint admin_kanban_items_title_format_check check (
        title = btrim(title)
        and char_length(title) between 1 and 140
    ),
    constraint admin_kanban_items_details_format_check check (
        details = btrim(details)
        and char_length(details) <= 1000
    ),
    constraint admin_kanban_items_status_check check (
        status in ('backlog', 'in_progress', 'complete', 'published')
    ),
    constraint admin_kanban_items_sort_order_check check (sort_order >= 0)
);

create index if not exists ix_admin_kanban_items_active_status_sort
    on public.admin_kanban_items (status, sort_order, updated_at desc)
    where archived_at is null;

create index if not exists ix_admin_kanban_items_archived_at
    on public.admin_kanban_items (archived_at desc)
    where archived_at is not null;

create table if not exists public.admin_kanban_activity (
    id uuid primary key default gen_random_uuid(),
    item_id uuid not null references public.admin_kanban_items(id) on delete cascade,
    action text not null,
    from_status text,
    to_status text,
    note text,
    actor_user_id uuid references auth.users(id) on delete set null,
    actor_email text,
    created_at timestamptz not null default timezone('utc', now()),
    constraint admin_kanban_activity_action_check check (
        action in ('created', 'updated', 'moved', 'archived')
    ),
    constraint admin_kanban_activity_from_status_check check (
        from_status is null
        or from_status in ('backlog', 'in_progress', 'complete', 'published')
    ),
    constraint admin_kanban_activity_to_status_check check (
        to_status is null
        or to_status in ('backlog', 'in_progress', 'complete', 'published')
    ),
    constraint admin_kanban_activity_note_length_check check (
        note is null
        or char_length(note) <= 1000
    ),
    constraint admin_kanban_activity_actor_email_length_check check (
        actor_email is null
        or char_length(actor_email) <= 320
    )
);

create index if not exists ix_admin_kanban_activity_item_created
    on public.admin_kanban_activity (item_id, created_at desc);

create or replace function public.set_admin_kanban_items_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists trg_admin_kanban_items_updated_at on public.admin_kanban_items;
create trigger trg_admin_kanban_items_updated_at
before update on public.admin_kanban_items
for each row execute function public.set_admin_kanban_items_updated_at();

alter table public.admin_kanban_items enable row level security;
alter table public.admin_kanban_activity enable row level security;

revoke all on table public.admin_kanban_items from public;
revoke all on table public.admin_kanban_items from anon;
revoke all on table public.admin_kanban_items from authenticated;
grant all on table public.admin_kanban_items to service_role;

revoke all on table public.admin_kanban_activity from public;
revoke all on table public.admin_kanban_activity from anon;
revoke all on table public.admin_kanban_activity from authenticated;
grant all on table public.admin_kanban_activity to service_role;

comment on table public.admin_kanban_items is
    'Shared admin-only kanban tasks tracked from backlog through published.';
comment on table public.admin_kanban_activity is
    'Immutable admin-only activity log for shared kanban task mutations.';
