-- Retire legacy AI Studio built-in Pulses and pin the default rail to the current three.

do $$
begin
    if to_regclass('public.user_preferences') is null then
        raise exception 'public.user_preferences table is required before applying migration 108';
    end if;
end;
$$;

alter table public.user_preferences
    add column if not exists ai_studio_create_pulse_panel_ids text[] default array['image', 'multi_shot', 'story_builder']::text[];

alter table public.user_preferences
    add column if not exists ai_studio_saved_pulses jsonb default '[]'::jsonb;

update public.user_preferences
   set ai_studio_create_pulse_panel_ids = array['image', 'multi_shot', 'story_builder']::text[]
 where ai_studio_create_pulse_panel_ids is null;

update public.user_preferences
   set ai_studio_saved_pulses = '[]'::jsonb
 where ai_studio_saved_pulses is null;

alter table public.user_preferences
    alter column ai_studio_create_pulse_panel_ids set default array['image', 'multi_shot', 'story_builder']::text[];

alter table public.user_preferences
    alter column ai_studio_saved_pulses set default '[]'::jsonb;

update public.user_preferences
   set ai_studio_create_pulse_panel_ids = coalesce(
       (
           select array_agg(preset_id order by ordinal)
             from unnest(ai_studio_create_pulse_panel_ids) with ordinality as panel(preset_id, ordinal)
            where preset_id not in (
                'custom_1',
                'custom_2',
                'custom_3',
                'single_shot',
                'ad_hook',
                'product_hero',
                'ugc_style',
                'before_after',
                'lifestyle_scene'
            )
       ),
       array['image', 'multi_shot', 'story_builder']::text[]
   )
 where ai_studio_create_pulse_panel_ids && array[
     'custom_1',
     'custom_2',
     'custom_3',
     'single_shot',
     'ad_hook',
     'product_hero',
     'ugc_style',
     'before_after',
     'lifestyle_scene'
 ]::text[];

update public.user_preferences
   set ai_studio_saved_pulses = coalesce(
       (
           select jsonb_agg(preset)
             from jsonb_array_elements(ai_studio_saved_pulses) as preset
            where preset->>'presetId' not in (
                'custom_1',
                'custom_2',
                'custom_3',
                'single_shot',
                'ad_hook',
                'product_hero',
                'ugc_style',
                'before_after',
                'lifestyle_scene'
            )
       ),
       '[]'::jsonb
   )
 where jsonb_typeof(ai_studio_saved_pulses) = 'array'
	   and exists (
	       select 1
	         from jsonb_array_elements(ai_studio_saved_pulses) as preset
        where preset->>'presetId' in (
            'custom_1',
            'custom_2',
            'custom_3',
            'single_shot',
            'ad_hook',
            'product_hero',
            'ugc_style',
            'before_after',
            'lifestyle_scene'
	        )
	   );

alter table public.user_preferences
    alter column ai_studio_create_pulse_panel_ids set not null;

alter table public.user_preferences
    alter column ai_studio_saved_pulses set not null;
