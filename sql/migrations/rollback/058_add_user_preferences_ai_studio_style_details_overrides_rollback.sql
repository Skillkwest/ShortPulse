-- Rollback: remove AI Studio style-details override preference column.

alter table if exists public.user_preferences
    drop column if exists ai_studio_style_details_overrides;
