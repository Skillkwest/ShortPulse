---
name: skill-media-storage-deploy-gate
description: Run the media storage pre-deploy integrity gate when the user says they are ready to deploy. Verifies drift diagnostics and constraint validation for media path scope/shape, then returns a clear pass/fail decision and remediation steps.
---

# Media Storage Deploy Gate

Purpose: make media path isolation checks a strict release gate with a repeatable workflow and clear evidence.

## When to use
- User says: "I'm ready to deploy."
- Any deploy that touches media upload/sign/move/storage logic.
- Any deploy after running media-related SQL migrations.

## Sources of truth
- `sql/check_media_storage_scope_drift.sql`
- `sql/migrations/003_add_private_media_source.sql`
- `sql/migrations/004_add_private_media_integrity_checks.sql`
- `sql/migrations/009_repair_legacy_media_storage_paths.sql`
- `sql/migrations/016_harden_media_storage_path_scope.sql`
- `sql/migrations/017_harden_media_storage_path_shape.sql`
- `docs/sops/sop_sql_migration_operations.md`

## Workflow
1. Confirm target environment and gate scope.
- Ask whether this is staging or production.
- Confirm deploy includes media/storage changes. If unsure, run the gate anyway.

2. Run drift diagnostics.
- Preferred (if DB CLI access exists):
  - `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f sql/check_media_storage_scope_drift.sql`
- Otherwise:
  - Have the user run `sql/check_media_storage_scope_drift.sql` in Supabase SQL Editor and paste results.

3. Enforce pass criteria.
- All returned `mismatch_count` values must equal `0`.
- Treat any non-zero value as a release blocker.

4. Verify constraint validation state.
- Run:
  ```sql
  select conname, convalidated
  from pg_constraint
  where conname in (
    'media_files_storage_scope_check',
    'media_files_storage_path_shape_check',
    'media_files_variant_hint_shape_check',
    'media_asset_variants_storage_path_shape_check'
  )
  order by conname;
  ```
- Expected: every applicable row is `convalidated = true`.

5. If gate fails, run the remediation loop.
- `sql/migrations/009_repair_legacy_media_storage_paths.sql`
- Re-run:
  - `sql/migrations/016_harden_media_storage_path_scope.sql`
  - `sql/migrations/017_harden_media_storage_path_shape.sql`
  - `sql/check_media_storage_scope_drift.sql`
- Repeat until drift is fully zero and constraints validate.

6. Return a strict gate verdict.
- `PASS`: all drift counts are zero and applicable constraints are validated.
- `FAIL`: any drift mismatch exists or any applicable constraint is not validated.

## Output format (required)
```text
Media storage deploy gate: PASS|FAIL
Environment: <staging|production>

Drift checks:
- <check_name>: <mismatch_count>

Constraint validation:
- <constraint_name>: <true|false|missing>

Decision:
- <deploy approved|deploy blocked>

If blocked:
- Next SQL actions in order:
  1. <migration/query>
  2. <migration/query>
```
