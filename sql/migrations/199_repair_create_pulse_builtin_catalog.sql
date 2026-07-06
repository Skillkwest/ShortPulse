-- Repair legacy Create Pulse built-in control-plane rows.
-- Normalizes the three seeded built-ins when legacy labels are present, but preserves
-- operator-authored admin catalog entries such as prompt_modifier.

do $$
begin
    if to_regclass('public.create_pulse_builtin_runtime') is null then
        raise exception 'public.create_pulse_builtin_runtime table is required before applying migration 199';
    end if;
end;
$$;

with repaired as (
    select
        current_runtime.singleton,
        jsonb_agg(repaired_definition.definition order by repaired_definition.ordinal) as pulse_definitions,
        count(*) filter (where repaired_definition.ordinal in (1, 2, 3)) as repaired_seeded_count
      from public.create_pulse_builtin_runtime current_runtime
     cross join lateral (
          select case definition.value->>'presetId'
              when 'image' then
                  definition.value || jsonb_build_object(
                      'label', 'Video Prompt Magic',
                      'description', 'Guided single-shot video workflow from one reference image.',
                      'runtimeMode', 'workflow_gpt',
                      'activationMode', 'activate_and_start',
                      'outputMode', 'chat_reply',
                      'memoryPolicy', 'session',
                      'artifactTarget', 'video_prompt',
                      'starterAssistantMessage', 'Upload your image to get the process started :)',
                      'workflowStageHints', jsonb_build_array(
                          'Image Gate',
                          'Camera Motion',
                          'Action Selection',
                          'Dialogue',
                          'Final Prompt'
                      ),
                      'schemaVersion', 2
                  )
              when 'multi_shot' then
                  definition.value || jsonb_build_object(
                      'label', 'Multi Sequence Video Prompt',
                      'description', 'Guided multi-shot storyboard workflow from one reference image.',
                      'runtimeMode', 'workflow_gpt',
                      'activationMode', 'activate_and_start',
                      'outputMode', 'chat_reply',
                      'memoryPolicy', 'session',
                      'artifactTarget', 'video_prompt',
                      'starterAssistantMessage', 'Step 1 — Upload: Please upload the image you want to base the scene on.',
                      'workflowStageHints', jsonb_build_array(
                          'Image Intake',
                          'Action Arc',
                          'Dialog',
                          'Storyboard Build',
                          'Final Prompt'
                      ),
                      'schemaVersion', 2
                  )
              when 'story_builder' then
                  definition.value || jsonb_build_object(
                      'label', 'DFY Story Builder',
                      'description', 'Guided story-circle workflow for scene plans and final image prompts.',
                      'runtimeMode', 'workflow_gpt',
                      'activationMode', 'activate_and_start',
                      'outputMode', 'chat_reply',
                      'memoryPolicy', 'session',
                      'artifactTarget', 'image_prompt',
                      'starterAssistantMessage', '**Step 1 — Upload your characters.** Please upload 1–3+ character images. Optional: add quick notes (roles, relationships, must-have traits, do-not-include).',
                      'workflowStageHints', jsonb_build_array(
                          'Upload Characters',
                          'Plot Seed',
                          'Runtime',
                          'Scene Review',
                          'Image Prompts',
                          'Dialogue Story'
                      ),
                      'schemaVersion', 2
                  )
              else definition.value
          end as definition,
          case definition.value->>'presetId'
              when 'image' then 1
              when 'multi_shot' then 2
              when 'story_builder' then 3
              else definition.ordinality + 1000
          end as ordinal
       from jsonb_array_elements(current_runtime.pulse_definitions) with ordinality as definition(value, ordinality)
       where nullif(trim(definition.value->>'systemInstructions'), '') is not null
         and definition.value->>'presetId' not in ('single_shot', 'legacy_prompt_modifier')
    ) as repaired_definition
     where current_runtime.singleton = true
     group by current_runtime.singleton
)
update public.create_pulse_builtin_runtime runtime
   set pulse_definitions = repaired.pulse_definitions,
       updated_at = now(),
       updated_by_email = coalesce(runtime.updated_by_email, 'system_seed')
  from repaired
 where runtime.singleton = repaired.singleton
   and repaired.pulse_definitions is not null
   and repaired.repaired_seeded_count = 3
   and exists (
       select 1
         from jsonb_array_elements(runtime.pulse_definitions) as definition(value)
        where definition.value->>'presetId' in ('single_shot', 'legacy_prompt_modifier')
           or definition.value->>'label' in ('Single Shot Video', 'Multi Shot Video', 'Legacy Prompt Modifier')
   );
