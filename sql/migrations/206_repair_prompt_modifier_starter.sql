-- Repair Prompt Modifier built-in rows that predate the required starter message.
-- Only system-seeded catalog rows may be repaired here. Once an admin save records
-- operator actor metadata on the singleton row, the admin-owned catalog is the authority.

do $$
begin
    if to_regclass('public.create_pulse_builtin_runtime') is null then
        raise exception 'public.create_pulse_builtin_runtime table is required before applying migration 206';
    end if;
end;
$$;

with repaired as (
    select
        runtime.singleton,
        jsonb_agg(
            case
                when definition.value->>'presetId' = 'prompt_modifier'
                 and nullif(trim(definition.value->>'starterAssistantMessage'), '') is null then
                    definition.value ||
                    jsonb_strip_nulls(
                        jsonb_build_object(
                            'starterAssistantMessage', 'Paste the prompt you want to modify.',
                            'workflowStageHints',
                                case
                                    when jsonb_typeof(definition.value->'workflowStageHints') = 'array' then
                                        case
                                            when jsonb_array_length(definition.value->'workflowStageHints') > 0 then null
                                            else jsonb_build_array('Prompt Intake')
                                        end
                                    else jsonb_build_array('Prompt Intake')
                                end,
                            'schemaVersion', 2
                        )
                    )
                else definition.value
            end
            order by definition.ordinality
        ) as pulse_definitions
      from public.create_pulse_builtin_runtime runtime
     cross join lateral jsonb_array_elements(runtime.pulse_definitions) with ordinality as definition(value, ordinality)
     where runtime.singleton = true
       and runtime.updated_by_user_id is null
       and coalesce(nullif(runtime.updated_by_email, ''), 'system_seed') = 'system_seed'
     group by runtime.singleton
)
update public.create_pulse_builtin_runtime runtime
   set pulse_definitions = repaired.pulse_definitions,
       updated_at = now(),
       updated_by_email = coalesce(runtime.updated_by_email, 'system_seed')
  from repaired
 where runtime.singleton = repaired.singleton
   and exists (
       select 1
         from jsonb_array_elements(runtime.pulse_definitions) as definition(value)
        where definition.value->>'presetId' = 'prompt_modifier'
          and nullif(trim(definition.value->>'starterAssistantMessage'), '') is null
   );
