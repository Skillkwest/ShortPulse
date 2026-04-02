drop table if exists public.generation_projection;
drop table if exists public.generation_publications;
drop table if exists public.generation_observation_inbox;

drop index if exists public.ix_ai_generation_outputs_attempt_index;

alter table public.ai_generation_outputs
    drop column if exists generation_attempt_id;

