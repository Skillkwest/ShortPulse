-- Roll back 023_generation_reconciler_claims.sql claim function.

drop function if exists public.claim_generation_recovery_batch(integer, integer, integer);
