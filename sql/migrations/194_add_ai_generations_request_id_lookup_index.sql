-- Add a narrow request_id lookup index for provider callbacks and recovery.
-- Some canonical server paths receive only the provider request id before the
-- owning user is known, so the existing (user_id, request_id) index cannot
-- serve those lookups.

create index if not exists ix_ai_generations_request_id_lookup
    on public.ai_generations (request_id, created_at desc)
    include (id, user_id, model_id)
    where request_id is not null;
