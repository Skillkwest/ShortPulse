drop index if exists public.ix_generation_projection_user_source_ref;

alter table public.generation_projection
    drop column if exists source_ref;
