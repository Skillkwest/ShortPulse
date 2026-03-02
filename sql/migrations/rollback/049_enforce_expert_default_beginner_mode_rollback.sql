-- Rollback: restore beginner_mode default for new user preference rows.
-- Intentionally does not restore previously backfilled per-user values.

do $$
begin
    if to_regclass('public.user_preferences') is null then
        raise exception 'public.user_preferences table is required before applying rollback 049';
    end if;
end;
$$;

alter table public.user_preferences
    alter column beginner_mode set default true;

alter table public.user_preferences
    alter column beginner_mode set not null;
