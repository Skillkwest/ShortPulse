drop function if exists public.claim_generation_observation_inbox_batch(integer, integer);

drop index if exists public.ix_generation_observation_inbox_processing_state_updated;

update public.generation_observation_inbox
set
    processing_state = 'pending',
    processing_error = null,
    processed_at = null,
    updated_at = now()
where processing_state = 'processing';

alter table public.generation_observation_inbox
    drop constraint if exists generation_observation_inbox_processing_state_check;

alter table public.generation_observation_inbox
    add constraint generation_observation_inbox_processing_state_check
      check (processing_state in ('pending', 'processed', 'ignored', 'failed'));
