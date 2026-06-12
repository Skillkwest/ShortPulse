-- Add per-user deletion persistence for admin-owned AI Studio built-in presets.
-- Stores deleted built-in Prompt Preset and Pulse ids so users can hide and restore them per account.

do $$
begin
    if to_regclass('public.user_preferences') is null then
        raise exception 'public.user_preferences table is required before applying migration 156';
    end if;
end;
$$;

alter table public.user_preferences
    add column if not exists expert_edit_deleted_system_preset_ids text[] default array[]::text[],
    add column if not exists ai_studio_deleted_builtin_pulse_ids text[] default array[]::text[];

update public.user_preferences
   set expert_edit_deleted_system_preset_ids = array[]::text[]
 where expert_edit_deleted_system_preset_ids is null;

update public.user_preferences
   set ai_studio_deleted_builtin_pulse_ids = array[]::text[]
 where ai_studio_deleted_builtin_pulse_ids is null;

alter table public.user_preferences
    alter column expert_edit_deleted_system_preset_ids set default array[]::text[],
    alter column ai_studio_deleted_builtin_pulse_ids set default array[]::text[];

alter table public.user_preferences
    alter column expert_edit_deleted_system_preset_ids set not null,
    alter column ai_studio_deleted_builtin_pulse_ids set not null;
