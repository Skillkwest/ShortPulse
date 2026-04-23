-- Add per-user AI Studio saved-voice persistence.
-- Stores created/provider-backed ElevenLabs voices so they survive refreshes and provider outages.

do $$
begin
    if to_regclass('public.user_preferences') is null then
        raise exception 'public.user_preferences table is required before applying migration 082';
    end if;
end;
$$;

alter table public.user_preferences
    add column if not exists ai_studio_saved_voices jsonb default '[]'::jsonb;

update public.user_preferences
   set ai_studio_saved_voices = '[]'::jsonb
 where ai_studio_saved_voices is null;

alter table public.user_preferences
    alter column ai_studio_saved_voices set default '[]'::jsonb;

alter table public.user_preferences
    alter column ai_studio_saved_voices set not null;
