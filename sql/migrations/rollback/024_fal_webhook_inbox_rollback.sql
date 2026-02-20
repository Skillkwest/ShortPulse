-- Rollback: remove Fal webhook inbox table.

drop table if exists public.fal_webhook_events;
