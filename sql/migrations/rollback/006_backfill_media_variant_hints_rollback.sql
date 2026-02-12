-- Rollback for migration 006.
-- The forward migration performs data backfill on existing rows and is intentionally non-destructive.
-- Exact reversal is not feasible without a prior snapshot, so this rollback is a no-op by design.

select 1;
