-- Rollback migration 082: remove persisted AI Studio saved voices preference.

alter table if exists public.user_preferences
    drop column if exists ai_studio_saved_voices;
