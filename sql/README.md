# SQL Operator Index

Purpose: make the repo SQL surface easier to navigate for migration, audit, and hosted-Supabase operator work.

## Layout

- `sql/migrations/`
  - ordered schema and data migrations
  - source of truth for forward database evolution
- `sql/check_*.sql`
  - diagnostic or invariant checks
  - preferred first stop after migration work
- `sql/configure_*.sql`
  - hosted scheduler/secret/configuration helpers
- `sql/create_*.sql`
  - standalone bootstrap or foundation scripts
- `sql/migrate_*.sql`
  - targeted one-off data migration scripts outside the numbered migration stream

## Preferred Reading Order

When touching hosted Supabase state:

1. `docs/database-migrations.md`
2. `docs/sops/sop_sql_migration_operations.md`
3. `docs/sops/sop_nuclo_supabase_migration_apply_and_validation.md`
4. the relevant files under `sql/migrations/`
5. the closest relevant `sql/check_*.sql` files

## Safety Notes

- Do not treat ad hoc SQL files as automatically safe to rerun.
- Prefer numbered migrations for durable schema evolution.
- Prefer `sql/check_*.sql` for post-change validation instead of inventing fresh one-off queries every time.
- Do not use this directory as justification for destructive user-data cleanup. Nuclo’s standing no-delete boundary still applies.

## Common Patterns

### Verify a Sensitive Migration

1. inspect the migration file
2. inspect nearby `sql/check_*.sql`
3. apply to staging first
4. run the check SQL
5. promote to production only after evidence-backed validation

### Audit Drift

Use:

- `sql/check_character_sheet_alias_drift.sql`
- other nearby `sql/check_*.sql`
- plus `scripts/ops/supabase_public_schema_parity.sh` when staging/production comparison matters
- plus `scripts/ops/supabase_public_acl_sync.sh` after schema-only bootstrap when grants, function execute posture, or service-role worker access must match another hosted environment

### Hosted Scheduler Work

Use the `sql/configure_*.sql` files together with the relevant SOP and operator env values. Treat these as hosted-configuration helpers, not local development setup.
