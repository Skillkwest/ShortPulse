-- Roll back per-user deletion persistence for admin-owned AI Studio built-in presets.

alter table if exists public.user_preferences
    drop column if exists expert_edit_deleted_system_preset_ids,
    drop column if exists ai_studio_deleted_builtin_pulse_ids;
