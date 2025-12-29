-- Prototype table for tracking saved creators per user
create table if not exists saved_creators (
    id uuid primary key default gen_random_uuid(),
    handle text not null,
    platform text not null, -- 'instagram' | 'tiktok' | 'youtube'
    followers integer default 0,
    avg_views integer default 0,
    user_id uuid not null default auth.uid(), -- link to auth.users for RLS
    created_at timestamptz not null default now()
);

create index if not exists ix_saved_creators_handle on saved_creators (handle);
create index if not exists ix_saved_creators_user_platform on saved_creators (user_id, platform);

alter table saved_creators enable row level security;
drop policy if exists select_saved_creators_isolation on saved_creators;
create policy select_saved_creators_isolation on saved_creators
    for select using (user_id = auth.uid());
drop policy if exists modify_saved_creators_isolation on saved_creators;
create policy modify_saved_creators_isolation on saved_creators
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
