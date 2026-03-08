-- Add per-user AI Studio Styles Library style-detail overrides.
-- Stores editable style metadata (style/title/reference image name/style prompt) by style id.

do $$
begin
    if to_regclass('public.user_preferences') is null then
        raise exception 'public.user_preferences table is required before applying migration 058';
    end if;
end;
$$;

alter table public.user_preferences
    add column if not exists ai_studio_style_details_overrides jsonb default '{}'::jsonb;

update public.user_preferences
   set ai_studio_style_details_overrides = '{}'::jsonb
 where ai_studio_style_details_overrides is null;

alter table public.user_preferences
    alter column ai_studio_style_details_overrides set default '{}'::jsonb;

alter table public.user_preferences
    alter column ai_studio_style_details_overrides set not null;
