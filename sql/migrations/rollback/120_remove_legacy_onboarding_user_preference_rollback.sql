begin;

alter table if exists public.user_preferences
    add column if not exists beginner_mode boolean not null default false;

commit;
