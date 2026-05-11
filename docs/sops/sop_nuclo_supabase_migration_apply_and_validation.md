# Nuclo Supabase Migration Apply And Validation

Purpose: give Nuclo a repeatable hosted-Supabase migration workflow for staging and production work without relying on ad hoc `psql` sequences.

## Scope

Use this SOP when the task involves:

- applying one or more SQL migrations to hosted Supabase,
- reconciling staging/production schema drift,
- rerunning a guarded migration on an already-mutated database,
- or validating the database-side effect of a migration before or after environment changes.

Use `docs/sops/sop_sql_migration_operations.md` as the broader repo migration authority. Use this SOP as the Nuclo operator playbook layered on top of that authority.

## Hard Safety Rules

- Do not use Docker-backed Supabase workflows.
- Do not delete auth users or user-owned data as part of normal migration work.
- Prefer forward fixes, guarded reruns, additive backfills, and parity checks over destructive cleanup.
- Do not apply production migrations until staging behavior is understood or the user explicitly asks for direct production repair.

## Prerequisites

1. Load the repo startup contract.
2. Read:
   - `docs/database-migrations.md`
   - `docs/security-checklist.md`
   - `docs/sops/sop_sql_migration_operations.md`
3. Confirm the target database explicitly:
   - staging via `SHORTPULSE_STAGING_DB_URL`
   - production via `SHORTPULSE_PRODUCTION_DB_URL`
4. Inspect the migration file and any nearby `sql/check_*.sql` diagnostic scripts.
5. Decide whether the task is:
   - inspection only,
   - staging apply,
   - production parity repair,
   - or guarded rerun.

## Standard Workflow

### 1. Preflight

1. Confirm the migration number and exact file path.
2. Inspect whether the migration claims rerunnable/idempotent behavior.
3. Search for the affected tables/functions/policies before applying:
   - table/column existence
   - function/trigger existence
   - known drift checks
4. If the migration touches sensitive runtime surfaces, identify the post-check SQL before mutation.

### 2. Stage First

For non-emergency work:

1. Apply to staging first.
2. Use:
   ```bash
   psql "$SHORTPULSE_STAGING_DB_URL" -v ON_ERROR_STOP=1 -f sql/migrations/<file>.sql
   ```
3. If the migration fails, stop and inspect schema state before retrying.
4. If the migration partially overlaps an already-mutated schema, patch the migration to be safely rerunnable before continuing.

### 3. Post-Apply Validation

Run the narrowest effective checks first:

1. targeted `information_schema` checks
2. target-specific `sql/check_*.sql` scripts
3. application-level invariants for the touched domain

Use broader parity scripts when needed:

```bash
bash scripts/ops/supabase_public_schema_parity.sh --source-label staging --target-label production
```

### 4. Production Apply

Only after the staging result is understood:

```bash
psql "$SHORTPULSE_PRODUCTION_DB_URL" -v ON_ERROR_STOP=1 -f sql/migrations/<file>.sql
```

Then rerun the same validation suite plus any staging-vs-production parity checks relevant to the change.

## Recommended Validation Ladder

1. migration-specific invariants
2. `sql/check_*.sql` for the touched domain
3. `bash scripts/ops/supabase_public_schema_parity.sh`
4. `bash scripts/ops/supabase_rowcount_diff.sh` when a data sync or backfill is expected
5. app/runtime route parity if the migration affects hosted behavior indirectly

## Rerun / Drift Repair Rules

If a migration fails because the target schema is already partly at the end state:

1. do not keep rerunning it blindly
2. inspect the exact missing/present objects
3. patch the migration with guarded existence checks if the repo source of truth is wrong
4. update `docs/database-migrations.md` when the rerun contract changes

## Evidence To Record

Record durable lessons when they matter for future operator work:

- rerun hazards
- parity blockers
- production-specific schema drift
- new validation commands that should become standard

Use:

- `docs/agents/nuclo/memory.md`
- `docs/records/artifacts/agent/nuclo/reports/`

## Stop Conditions

Stop and require a dedicated plan if:

- the migration appears to require destructive cleanup of user-owned data
- staging and production are materially divergent in a way the migration does not explain
- a second retry would still be assumption-driven rather than evidence-driven
- the task expands from schema change into a coordinated runtime cutover
