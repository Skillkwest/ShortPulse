-- Add shared AI Studio Pulse persistence.
-- Stores saved custom Pulse definitions plus the curated Create Pulse rail allocation per user.

do $$
begin
    if to_regclass('public.user_preferences') is null then
        raise exception 'public.user_preferences table is required before applying migration 083';
    end if;
end;
$$;

alter table public.user_preferences
    add column if not exists ai_studio_create_pulse_panel_ids text[] default array['image', 'single_shot', 'multi_shot', 'story_builder']::text[];

alter table public.user_preferences
    add column if not exists ai_studio_saved_pulses jsonb default '[]'::jsonb;

update public.user_preferences
   set ai_studio_create_pulse_panel_ids = array['image', 'single_shot', 'multi_shot', 'story_builder']::text[]
 where ai_studio_create_pulse_panel_ids is null;

update public.user_preferences
   set ai_studio_saved_pulses = '[]'::jsonb
 where ai_studio_saved_pulses is null;

alter table public.user_preferences
    alter column ai_studio_create_pulse_panel_ids set default array['image', 'single_shot', 'multi_shot', 'story_builder']::text[];

alter table public.user_preferences
    alter column ai_studio_saved_pulses set default '[]'::jsonb;

alter table public.user_preferences
    alter column ai_studio_create_pulse_panel_ids set not null;

alter table public.user_preferences
    alter column ai_studio_saved_pulses set not null;
