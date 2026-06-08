alter table public.generation_projection
    drop constraint if exists generation_projection_workflow_reload_object_check;

alter table public.generation_projection
    drop column if exists workflow_reload;
