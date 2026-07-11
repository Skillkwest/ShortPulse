alter table public.generation_projection
  drop constraint if exists generation_projection_remux_recovery_object_check;

alter table public.generation_projection
  drop column if exists remux_recovery;
