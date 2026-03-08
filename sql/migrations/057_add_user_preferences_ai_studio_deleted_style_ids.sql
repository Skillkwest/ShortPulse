-- Add per-user AI Studio Styles Library deletion persistence.
-- Stores deleted style IDs so removed styles stay hidden across sessions/devices.

do $$
begin
    if to_regclass('public.user_preferences') is null then
        raise exception 'public.user_preferences table is required before applying migration 057';
    end if;
end;
$$;

alter table public.user_preferences
    add column if not exists ai_studio_deleted_style_ids text[] default array[]::text[];

update public.user_preferences
   set ai_studio_deleted_style_ids = array[]::text[]
 where ai_studio_deleted_style_ids is null;

alter table public.user_preferences
    alter column ai_studio_deleted_style_ids set default array[]::text[];

alter table public.user_preferences
    alter column ai_studio_deleted_style_ids set not null;
