-- Add durable AI Studio workflow reload metadata to generated-output projection.

alter table public.generation_projection
    add column if not exists workflow_reload jsonb not null default '{}'::jsonb;

alter table public.generation_projection
    drop constraint if exists generation_projection_workflow_reload_object_check;

alter table public.generation_projection
    add constraint generation_projection_workflow_reload_object_check
    check (jsonb_typeof(workflow_reload) = 'object');
