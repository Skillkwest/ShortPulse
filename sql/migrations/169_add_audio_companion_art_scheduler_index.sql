-- Give the audio companion-art scheduler an index that matches its claim predicate.
-- The older pending-only index does not cover the NULL/failed retry states that
-- the processor intentionally accepts for compatibility and retry handling.

create index if not exists ix_generation_projection_audio_companion_art_claim
    on public.generation_projection (updated_at asc)
    include (
        generation_id,
        user_id,
        companion_art_attempt_count,
        publication_state,
        hidden_in_reference_grid,
        reference_grid_visible
    )
    where provider = 'elevenlabs'
      and task_state = 'success'
      and publication_state <> 'suppressed'
      and preview_storage_path like '%/generations/audio/%'
      and companion_art_attempt_count < 3
      and (
          companion_art_status is null
          or companion_art_status in ('pending', 'failed')
      );
