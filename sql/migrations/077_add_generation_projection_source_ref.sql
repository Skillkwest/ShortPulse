-- Add source_ref to generation_projection so the read model can own queue/source identity
-- without depending on ai_generations.metadata for all consumers.

alter table public.generation_projection
    add column if not exists source_ref text;

create index if not exists ix_generation_projection_user_source_ref
    on public.generation_projection (user_id, source_ref)
    where source_ref is not null;
