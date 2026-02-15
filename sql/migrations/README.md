# SQL Migrations

Use this folder for ordered, forward-only schema migrations.

For canonical run order, diagnostics loops, and common SQL error handling:
- `docs/sops/sop_sql_migration_operations.md`

## Naming

- `NNN_description.sql` (e.g., `001_initial_schema.sql`)

## Rollbacks

- Put optional rollback scripts in `sql/migrations/rollback/` with matching numbering.

## Existing legacy scripts

- Historical bootstrap scripts remain in `sql/` and should not be deleted.
- New schema changes should use this migration folder.
