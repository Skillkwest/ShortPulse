-- Add canonical Expert Edit preset ID allocation + custom override persistence.
-- Keeps legacy label column for read-only fallback and migration compatibility.

do $$
begin
    if to_regclass('public.user_preferences') is null then
        raise exception 'public.user_preferences table is required before applying migration 056';
    end if;
end;
$$;

alter table public.user_preferences
    add column if not exists expert_edit_preset_panel_ids text[] default array['selfie', 'side_profile', 'enhance_realism']::text[];

alter table public.user_preferences
    add column if not exists expert_edit_custom_presets jsonb default '{}'::jsonb;

with normalized_labels as (
    select
        user_id,
        array(
            select lower(trim(label))
            from unnest(coalesce(expert_edit_preset_panel_labels, array[]::text[])) as label
        ) as labels
    from public.user_preferences
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
update public.user_preferences pref
   set expert_edit_preset_panel_ids =
       case
           when coalesce(array_length(mapped_ids.preset_ids, 1), 0) > 0
               then mapped_ids.preset_ids
           else array['selfie', 'side_profile', 'enhance_realism']::text[]
       end
  from mapped_ids
 where pref.user_id = mapped_ids.user_id
   and pref.expert_edit_preset_panel_ids is null;

update public.user_preferences
   set expert_edit_preset_panel_ids = array['selfie', 'side_profile', 'enhance_realism']::text[]
 where expert_edit_preset_panel_ids is null;

update public.user_preferences
   set expert_edit_custom_presets = '{}'::jsonb
 where expert_edit_custom_presets is null;

alter table public.user_preferences
    alter column expert_edit_preset_panel_ids set default array['selfie', 'side_profile', 'enhance_realism']::text[];

alter table public.user_preferences
    alter column expert_edit_custom_presets set default '{}'::jsonb;

alter table public.user_preferences
    alter column expert_edit_preset_panel_ids set not null;

alter table public.user_preferences
    alter column expert_edit_custom_presets set not null;
