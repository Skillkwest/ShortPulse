-- Rollback: remove Expert Edit preset panel preference column.

alter table if exists public.user_preferences
    drop column if exists expert_edit_preset_panel_labels;
