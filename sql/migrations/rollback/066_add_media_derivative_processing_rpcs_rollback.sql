-- Rollback for migration 066 derivative claim/update RPCs.

drop function if exists public.mark_media_derivative_failed(uuid, uuid, text, integer, boolean);
drop function if exists public.mark_media_derivative_ready(uuid, uuid, text, integer, integer);
drop function if exists public.claim_media_derivative_batch(integer, integer, integer);
