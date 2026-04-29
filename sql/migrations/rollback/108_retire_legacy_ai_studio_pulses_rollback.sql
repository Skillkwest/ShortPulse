-- Roll back the AI Studio Pulse rail default changed by migration 108.
-- Removed saved legacy Pulse overrides are intentionally not restored.

alter table if exists public.user_preferences
    alter column ai_studio_create_pulse_panel_ids set default array['image', 'single_shot', 'multi_shot', 'story_builder']::text[];
