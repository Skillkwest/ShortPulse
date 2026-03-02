-- Enforce expert-first beginner-mode defaults.
-- Sets user_preferences.beginner_mode default to false and backfills existing rows.

do $$
begin
    if to_regclass('public.user_preferences') is null then
        raise exception 'public.user_preferences table is required before applying migration 049';
    end if;
end;
$$;

alter table public.user_preferences
    alter column beginner_mode set default false;

update public.user_preferences
   set beginner_mode = false
 where beginner_mode is distinct from false;

alter table public.user_preferences
    alter column beginner_mode set not null;
