-- Roll back 022_generation_persist_idempotency.sql unique index.

drop index if exists public.media_files_generation_output_idx_unique;
