-- Add shared AI Studio Styles ordering persistence.
-- Stores per-user style tile ordering so the library panel and right rail stay aligned.

do $$
begin
    if to_regclass('public.user_preferences') is null then
        raise exception 'public.user_preferences table is required before applying migration 090';
    end if;
end;
$$;

alter table public.user_preferences
    add column if not exists ai_studio_style_panel_ids text[] default array[]::text[];

update public.user_preferences
   set ai_studio_style_panel_ids = array[]::text[]
 where ai_studio_style_panel_ids is null;

alter table public.user_preferences
    alter column ai_studio_style_panel_ids set default array[]::text[];

alter table public.user_preferences
    alter column ai_studio_style_panel_ids set not null;
