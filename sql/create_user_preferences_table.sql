-- User preference table for AI Studio settings.
create table if not exists user_preferences (
    user_id uuid primary key references auth.users(id) on delete cascade,
    beginner_mode boolean not null default false,
    media_autosave_enabled boolean not null default true,
    expert_edit_preset_panel_labels text[] not null default array['Selfie', 'Side Profile', 'Enhance Realism']::text[],
    expert_edit_preset_panel_ids text[] not null default array['selfie', 'side_profile', 'enhance_realism']::text[],
    expert_edit_custom_presets jsonb not null default '{}'::jsonb,
    ai_studio_deleted_style_ids text[] not null default array[]::text[],
    ai_studio_style_details_overrides jsonb not null default '{}'::jsonb,
    ai_studio_character_quickswap_tip_hidden boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table if exists user_preferences
    add column if not exists media_autosave_enabled boolean default true;

alter table if exists user_preferences
    add column if not exists expert_edit_preset_panel_labels text[] default array['Selfie', 'Side Profile', 'Enhance Realism']::text[];

alter table if exists user_preferences
    add column if not exists expert_edit_preset_panel_ids text[] default array['selfie', 'side_profile', 'enhance_realism']::text[];

alter table if exists user_preferences
    add column if not exists expert_edit_custom_presets jsonb default '{}'::jsonb;

alter table if exists user_preferences
    add column if not exists ai_studio_deleted_style_ids text[] default array[]::text[];

alter table if exists user_preferences
    add column if not exists ai_studio_style_details_overrides jsonb default '{}'::jsonb;

alter table if exists user_preferences
    add column if not exists ai_studio_character_quickswap_tip_hidden boolean default false;

update user_preferences
   set media_autosave_enabled = true
 where media_autosave_enabled is null;

update user_preferences
   set expert_edit_preset_panel_labels = array['Selfie', 'Side Profile', 'Enhance Realism']::text[]
 where expert_edit_preset_panel_labels is null;

with normalized_labels as (
    select
        user_id,
        array(
            select lower(trim(label))
            from unnest(coalesce(expert_edit_preset_panel_labels, array[]::text[])) as label
        ) as labels
    from user_preferences
), mapped_ids as (
    select
        user_id,
        (
            array_remove(array[
                case when 'selfie' = any(labels) then 'selfie' end,
                case when 'side profile' = any(labels) then 'side_profile' end,
                case when 'over shoulder' = any(labels) then 'over_shoulder' end,
                case when 'from behind' = any(labels) then 'from_behind' end,
                case when 'low angle' = any(labels) then 'low_angle' end,
                case when 'drone view' = any(labels) then 'drone_view' end,
                case when 'zoom in' = any(labels) then 'zoom_in' end,
                case when 'zoom out' = any(labels) then 'zoom_out' end,
                case when 'enhance realism' = any(labels) then 'enhance_realism' end
            ], null)
            || coalesce(
                array(
                    select format('custom_%s', custom_index)
                    from generate_series(1, 18) as custom_index
                    where format('custom %s', custom_index) = any(labels)
                    order by custom_index
                ),
                array[]::text[]
            )
        ) as preset_ids
    from normalized_labels
)
update user_preferences pref
   set expert_edit_preset_panel_ids =
       case
           when coalesce(array_length(mapped_ids.preset_ids, 1), 0) > 0
               then mapped_ids.preset_ids
           else array['selfie', 'side_profile', 'enhance_realism']::text[]
       end
  from mapped_ids
 where pref.user_id = mapped_ids.user_id
   and pref.expert_edit_preset_panel_ids is null;

update user_preferences
   set expert_edit_preset_panel_ids = array['selfie', 'side_profile', 'enhance_realism']::text[]
 where expert_edit_preset_panel_ids is null;

update user_preferences
   set expert_edit_custom_presets = '{}'::jsonb
 where expert_edit_custom_presets is null;

update user_preferences
   set ai_studio_deleted_style_ids = array[]::text[]
 where ai_studio_deleted_style_ids is null;

update user_preferences
   set ai_studio_style_details_overrides = '{}'::jsonb
 where ai_studio_style_details_overrides is null;

update user_preferences
   set ai_studio_character_quickswap_tip_hidden = false
 where ai_studio_character_quickswap_tip_hidden is null;

alter table if exists user_preferences
    alter column media_autosave_enabled set default true;

alter table if exists user_preferences
    alter column expert_edit_preset_panel_labels set default array['Selfie', 'Side Profile', 'Enhance Realism']::text[];

alter table if exists user_preferences
    alter column expert_edit_preset_panel_ids set default array['selfie', 'side_profile', 'enhance_realism']::text[];

alter table if exists user_preferences
    alter column expert_edit_custom_presets set default '{}'::jsonb;

alter table if exists user_preferences
    alter column ai_studio_deleted_style_ids set default array[]::text[];

alter table if exists user_preferences
    alter column ai_studio_style_details_overrides set default '{}'::jsonb;

alter table if exists user_preferences
    alter column ai_studio_character_quickswap_tip_hidden set default false;

alter table if exists user_preferences
    alter column media_autosave_enabled set not null;

alter table if exists user_preferences
    alter column expert_edit_preset_panel_labels set not null;

alter table if exists user_preferences
    alter column expert_edit_preset_panel_ids set not null;

alter table if exists user_preferences
    alter column expert_edit_custom_presets set not null;

alter table if exists user_preferences
    alter column ai_studio_deleted_style_ids set not null;

alter table if exists user_preferences
    alter column ai_studio_style_details_overrides set not null;

alter table if exists user_preferences
    alter column ai_studio_character_quickswap_tip_hidden set not null;

alter table user_preferences enable row level security;
drop policy if exists select_user_preferences_isolation on user_preferences;
create policy select_user_preferences_isolation on user_preferences
    for select using (user_id = auth.uid());
drop policy if exists modify_user_preferences_isolation on user_preferences;
create policy modify_user_preferences_isolation on user_preferences
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function user_preferences_set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists user_preferences_set_updated_at on user_preferences;
create trigger user_preferences_set_updated_at
    before update on user_preferences
    for each row execute procedure user_preferences_set_updated_at();
