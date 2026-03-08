-- Rollback: remove canonical Expert Edit preset id + custom preset override columns.

alter table if exists public.user_preferences
    drop column if exists expert_edit_custom_presets,
    drop column if exists expert_edit_preset_panel_ids;
