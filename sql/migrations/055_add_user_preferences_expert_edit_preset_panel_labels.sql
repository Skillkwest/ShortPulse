-- Add persistent Expert Edit preset panel allocation to user preferences.
-- Stores the selected left-panel preset chip labels per user account.

do $$
begin
    if to_regclass('public.user_preferences') is null then
        raise exception 'public.user_preferences table is required before applying migration 055';
    end if;
end;
$$;

alter table public.user_preferences
    add column if not exists expert_edit_preset_panel_labels text[] default array['Selfie', 'Side Profile', 'Enhance Realism']::text[];

update public.user_preferences
   set expert_edit_preset_panel_labels = array['Selfie', 'Side Profile', 'Enhance Realism']::text[]
 where expert_edit_preset_panel_labels is null;

alter table public.user_preferences
    alter column expert_edit_preset_panel_labels set default array['Selfie', 'Side Profile', 'Enhance Realism']::text[];

alter table public.user_preferences
    alter column expert_edit_preset_panel_labels set not null;
