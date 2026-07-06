-- Repair legacy Create Pulse built-in control-plane rows.
-- Keeps the active three canonical built-ins and removes retired built-in entries such as
-- single_shot and prompt_modifier while preserving the existing hidden system instructions.

do $$
begin
    if to_regclass('public.create_pulse_builtin_runtime') is null then
        raise exception 'public.create_pulse_builtin_runtime table is required before applying migration 199';
    end if;
end;
$$;

update public.create_pulse_builtin_runtime runtime
   set pulse_definitions = repaired.pulse_definitions,
       updated_at = now(),
       updated_by_email = coalesce(runtime.updated_by_email, 'system_seed')
  from (
      select jsonb_agg(definition order by ordinal) as pulse_definitions
        from (
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
                end as definition,
                case definition.value->>'presetId'
                    when 'image' then 1
                    when 'multi_shot' then 2
                    when 'story_builder' then 3
                end as ordinal
              from public.create_pulse_builtin_runtime current_runtime
             cross join lateral jsonb_array_elements(current_runtime.pulse_definitions) as definition(value)
             where current_runtime.singleton = true
               and definition.value->>'presetId' in ('image', 'multi_shot', 'story_builder')
               and nullif(trim(definition.value->>'systemInstructions'), '') is not null
        ) canonical_definitions
  ) repaired
 where runtime.singleton = true
   and repaired.pulse_definitions is not null
   and jsonb_array_length(repaired.pulse_definitions) = 3
   and exists (
       select 1
         from jsonb_array_elements(runtime.pulse_definitions) as definition(value)
        where definition.value->>'presetId' in ('single_shot', 'prompt_modifier', 'legacy_prompt_modifier')
           or definition.value->>'label' in ('Single Shot Video', 'Multi Shot Video', 'Prompt Modifier', 'Legacy Prompt Modifier')
           or jsonb_array_length(runtime.pulse_definitions) <> 3
   );
