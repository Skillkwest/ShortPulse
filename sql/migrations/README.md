# SQL Migrations

Use this folder for ordered, forward-only schema migrations.

## Naming

- `NNN_description.sql` (e.g., `001_initial_schema.sql`)

## Rollbacks

- Put optional rollback scripts in `sql/migrations/rollback/` with matching numbering.

## Existing legacy scripts

- Historical bootstrap scripts remain in `sql/` and should not be deleted.
- New schema changes should use this migration folder.
