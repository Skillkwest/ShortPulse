-- Rollback migration 059: remove persisted AI Studio Character QuickSwap tip visibility preference.

alter table if exists public.user_preferences
    drop column if exists ai_studio_character_quickswap_tip_hidden;
