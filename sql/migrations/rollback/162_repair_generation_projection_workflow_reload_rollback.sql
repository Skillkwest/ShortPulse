-- No-op rollback.
--
-- Migration 162 repairs generation_projection.workflow_reload from the original
-- ai_generations.metadata.workflow_reload authority. Reverting it would erase
-- restored workflow replay metadata and reintroduce the production bug.
select 'generation_projection_workflow_reload_repair_rollback_noop' as rollback_metric, 0::bigint as value;
