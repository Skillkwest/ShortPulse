-- Add autosave preference control to user preferences.
-- Locks default behavior to ON while enabling explicit user opt-out.

do $$
begin
    if to_regclass('public.user_preferences') is null then
        raise exception 'public.user_preferences table is required before applying migration 043';
    end if;
end;
$$;

alter table public.user_preferences
    add column if not exists media_autosave_enabled boolean default true;

update public.user_preferences
   set media_autosave_enabled = true
 where media_autosave_enabled is null;

alter table public.user_preferences
    alter column media_autosave_enabled set default true;

alter table public.user_preferences
    alter column media_autosave_enabled set not null;
