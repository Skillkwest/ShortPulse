-- Rollback: remove AI Studio Pulse preference columns.

alter table if exists public.user_preferences
    drop column if exists ai_studio_saved_pulses,
    drop column if exists ai_studio_create_pulse_panel_ids;
