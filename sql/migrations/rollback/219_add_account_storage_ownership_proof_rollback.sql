-- Roll back proof-only inactive-account storage ownership diagnostics.

drop function if exists public.get_account_storage_ownership_proof_summary(integer);
drop function if exists public.get_account_storage_ownership_proof_details(integer, uuid, integer);
