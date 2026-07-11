-- Project canonical Voice Changer remux retry state into generated-output hydration.

alter table public.generation_projection
  add column if not exists remux_recovery jsonb;

alter table public.generation_projection
  drop constraint if exists generation_projection_remux_recovery_object_check;

alter table public.generation_projection
  add constraint generation_projection_remux_recovery_object_check
  check (remux_recovery is null or jsonb_typeof(remux_recovery) = 'object');

comment on column public.generation_projection.remux_recovery is
  'Read projection of ai_generations.metadata Voice Changer remux retry state; not storage or billing authority.';
