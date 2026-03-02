-- User preference table for AI Studio settings.
create table if not exists user_preferences (
    user_id uuid primary key references auth.users(id) on delete cascade,
    beginner_mode boolean not null default true,
    media_autosave_enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table if exists user_preferences
    add column if not exists media_autosave_enabled boolean default true;

update user_preferences
   set media_autosave_enabled = true
 where media_autosave_enabled is null;

alter table if exists user_preferences
    alter column media_autosave_enabled set default true;

alter table if exists user_preferences
    alter column media_autosave_enabled set not null;

alter table user_preferences enable row level security;
drop policy if exists select_user_preferences_isolation on user_preferences;
create policy select_user_preferences_isolation on user_preferences
    for select using (user_id = auth.uid());
drop policy if exists modify_user_preferences_isolation on user_preferences;
create policy modify_user_preferences_isolation on user_preferences
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function user_preferences_set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists user_preferences_set_updated_at on user_preferences;
create trigger user_preferences_set_updated_at
    before update on user_preferences
    for each row execute procedure user_preferences_set_updated_at();
