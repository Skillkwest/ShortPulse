-- Add the initial user-owned Projects table used by the dashboard "New Project" flow.

create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null default 'Untitled project',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint projects_title_normalized_check
      check (
        title = btrim(title)
        and char_length(title) between 1 and 120
      )
);

create unique index if not exists ix_projects_id_user
    on public.projects (id, user_id);

create index if not exists ix_projects_user_updated
    on public.projects (user_id, updated_at desc);

alter table public.projects enable row level security;

drop policy if exists select_projects_isolation on public.projects;
create policy select_projects_isolation
    on public.projects
    for select
    using (user_id = auth.uid());

drop policy if exists insert_projects_isolation on public.projects;
create policy insert_projects_isolation
    on public.projects
    for insert
    with check (user_id = auth.uid());

drop policy if exists update_projects_isolation on public.projects;
create policy update_projects_isolation
    on public.projects
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists delete_projects_isolation on public.projects;
create policy delete_projects_isolation
    on public.projects
    for delete
    using (user_id = auth.uid());
