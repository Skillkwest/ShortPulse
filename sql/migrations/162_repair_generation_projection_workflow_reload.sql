-- Repair generation_projection workflow reload metadata that was lost during
-- partial projection convergence updates.

with repaired as (
  update public.generation_projection as projection
  set
    workflow_reload = generation.metadata -> 'workflow_reload',
    updated_at = now()
  from public.ai_generations as generation
  where
    projection.generation_id = generation.id
    and (
      projection.workflow_reload is null
      or projection.workflow_reload = '{}'::jsonb
    )
    and jsonb_typeof(generation.metadata -> 'workflow_reload') = 'object'
    and generation.metadata -> 'workflow_reload' <> '{}'::jsonb
  returning projection.generation_id
)
select 'generation_projection_workflow_reload_repaired' as repair_metric, count(*)::bigint as value
from repaired;
