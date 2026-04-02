drop function if exists public.release_worker_leadership(text, uuid);
drop function if exists public.acquire_worker_leadership(text, uuid, text, integer, jsonb);
drop table if exists public.worker_leases;

