-- Add hidden audio companion-art tracking to generation_projection.
-- This keeps companion art owned by the audio generation without creating a second
-- visible generation/media surface.

alter table public.generation_projection
    add column if not exists companion_art_status text,
    add column if not exists companion_art_storage_path text,
    add column if not exists companion_art_attempt_count integer not null default 0;

alter table public.generation_projection
    drop constraint if exists generation_projection_companion_art_status_check;

alter table public.generation_projection
    add constraint generation_projection_companion_art_status_check
      check (
        companion_art_status is null or
        companion_art_status in ('pending', 'processing', 'ready', 'failed')
      );

alter table public.generation_projection
    drop constraint if exists generation_projection_companion_art_attempt_count_check;

alter table public.generation_projection
    add constraint generation_projection_companion_art_attempt_count_check
      check (companion_art_attempt_count >= 0);

create index if not exists ix_generation_projection_companion_art_pending
    on public.generation_projection (updated_at asc)
    where companion_art_status = 'pending';
