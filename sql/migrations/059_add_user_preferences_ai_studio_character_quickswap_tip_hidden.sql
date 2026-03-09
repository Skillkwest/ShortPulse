-- Add per-user AI Studio Character QuickSwap tip visibility persistence.
-- Stores whether the embedded QuickSwap guidance bubble should stay hidden.

do $$
begin
    if to_regclass('public.user_preferences') is null then
        raise exception 'public.user_preferences table is required before applying migration 059';
    end if;
end;
$$;

alter table public.user_preferences
    add column if not exists ai_studio_character_quickswap_tip_hidden boolean default false;

update public.user_preferences
   set ai_studio_character_quickswap_tip_hidden = false
 where ai_studio_character_quickswap_tip_hidden is null;

alter table public.user_preferences
    alter column ai_studio_character_quickswap_tip_hidden set default false;

alter table public.user_preferences
    alter column ai_studio_character_quickswap_tip_hidden set not null;
