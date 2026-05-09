begin;

alter table if exists public.user_preferences
    drop column if exists beginner_mode;

commit;
