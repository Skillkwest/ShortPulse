-- Restore the retired Character QuickSwap tip preference for controlled rollback windows.
alter table if exists public.user_preferences
    add column if not exists ai_studio_character_quickswap_tip_hidden boolean default false;

update public.user_preferences
   set ai_studio_character_quickswap_tip_hidden = false
 where ai_studio_character_quickswap_tip_hidden is null;

alter table if exists public.user_preferences
    alter column ai_studio_character_quickswap_tip_hidden set default false;

alter table if exists public.user_preferences
    alter column ai_studio_character_quickswap_tip_hidden set not null;
