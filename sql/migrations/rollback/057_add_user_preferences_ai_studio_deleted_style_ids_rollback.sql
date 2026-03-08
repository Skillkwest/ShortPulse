-- Rollback: remove AI Studio deleted style IDs preference column.

alter table if exists public.user_preferences
    drop column if exists ai_studio_deleted_style_ids;
