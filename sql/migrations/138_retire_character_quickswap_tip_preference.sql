-- Retire the unused Character QuickSwap tip preference from the current schema contract.
alter table if exists public.user_preferences
    drop column if exists ai_studio_character_quickswap_tip_hidden;
