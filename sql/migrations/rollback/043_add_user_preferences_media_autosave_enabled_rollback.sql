-- Rollback: remove AI Studio media autosave preference column.

alter table if exists public.user_preferences
    drop column if exists media_autosave_enabled;
