-- Roll back migration 179 by restoring the pre-optimization media storage
-- lifecycle diagnostic RPC body from migration 173.
--
-- This rollback intentionally does not drop lifecycle tables or data. It only
-- replaces public.get_media_storage_lifecycle_summary(integer) with the prior
-- service-role-only aggregate implementation.

\ir ../173_add_media_storage_lifecycle_diagnostics.sql
