# Next-Agent Handoff: Hosted SQL Delivery Safety

Lane id: `architecture-audit-00-hosted-sql-delivery-safety`

Status: overlap-gated. Current work already modifies hosted SQL workflows, migration docs, schema/security docs, and new migrations. Do not edit until that batch is reconciled.

## Copy/Paste Assignment

Harden ShortPulse's hosted SQL execution authority so forward migrations are transaction-safe by default, applied in order, auditable, and distinct from rollback operations. Work only on migration delivery and proof infrastructure. Do not implement domain billing, generation, storage, privacy, or entitlement migrations in this lane.

## Why This Is First

Most high-priority architecture lanes require SQL. The current general workflow can execute an arbitrary selected file using `psql -v ON_ERROR_STOP=1 -f`; that stops after an error but does not automatically undo earlier statements. A safe delivery authority reduces the regression risk of every later lane.

## Mandatory Freshness And Overlap Checks

- Follow the universal gate in [`README.md`](README.md).
- Inspect active diffs in:
  - `.github/workflows/apply-hosted-sql-migration.yml`
  - `.github/workflows/apply-control-plane-ops-sql.yml`
  - `.github/workflows/apply-conversation-state-migration-028.yml`
  - `docs/sops/sop_sql_migration_operations.md`
  - `docs/database-migrations.md`
  - `docs/security-checklist.md`
  - `sql/check_runtime_sql_security_audit.sql`
- If current changes already establish the required contract, verify them and return a reduced findings packet instead of duplicating them.

## Required Context

Read first:

- `AGENTS.md`
- `docs/launch-week-production-operations.md`
- `docs/sops/sop_sql_migration_operations.md`
- `docs/database-migrations.md`
- `docs/security-checklist.md`
- `docs/deployment.md`
- `docs/disaster-recovery.md`
- `.github/workflows/apply-hosted-sql-migration.yml`

## Confirmed Problem

- Forward and rollback file selection share a general execution mechanism.
- `ON_ERROR_STOP` is not transaction atomicity.
- There is no canonical hosted applied-migration ledger/order gate in the audited path.
- Post-apply linting detects problems but cannot roll back a partially committed file.
- Backup/PITR and restore posture are separate live unknowns; do not claim them from repo code.

## Owned Write Surface

- `.github/workflows/apply-hosted-sql-migration.yml`
- narrowly related reusable workflow/scripts for migration classification and validation
- migration-operation tests under `frontend/tests/github/` or `frontend/tests/scripts/`
- `docs/sops/sop_sql_migration_operations.md`
- `docs/database-migrations.md`
- `docs/deployment.md` and `docs/disaster-recovery.md` only where the execution contract changes

## Avoid Surface

- domain SQL migrations unrelated to the runner
- billing, generation, storage, privacy, or pricing application code
- direct hosted database mutation during implementation unless separately authorized
- production rollback execution
- Docker/local Supabase workflows

## Implementation Contract

1. Define a machine-readable migration classification: transactional by default; explicit exception for statements such as `CREATE INDEX CONCURRENTLY`.
2. Ensure ordinary forward files run inside one transaction.
3. Require strict ordered migration identity and prevent silent gaps/out-of-order replay.
4. Record applied identity, checksum, actor/run, timestamp, target, and result without storing secrets.
5. Separate rollback authorization and inputs from forward apply.
6. Preserve dry-run/validation capability and post-apply security audit.
7. Fail before database execution when file classification, order, checksum, or target is ambiguous.

## Acceptance Criteria

- A multi-statement failure regression proves earlier statements do not remain committed for transactional migrations.
- A nontransactional exception is explicit and rejected unless its validation contract is present.
- Out-of-order, already-applied-with-different-checksum, missing-file, and rollback-as-forward cases fail before execution.
- Existing production-branch enforcement remains intact.
- No workflow exposes secrets in logs or artifacts.
- Docs name the exact apply authority, proof boundary, and rollback boundary.

## Validation And Proof

- Run focused workflow/script tests.
- Run `npm -C frontend run docs:check`.
- Run `node scripts/check_docs_links.js`.
- Validate workflow YAML parsing using existing repo tooling.
- Do not claim hosted atomicity until an approved non-production apply/failure drill proves it.

## Stop Rules

- Stop if active workflow changes overlap.
- Stop before applying SQL to production.
- Stop if the solution requires choosing a backup/PITR plan without current hosted evidence.
- Do not absorb disaster-recovery implementation; produce a separate read-only evidence request if needed.
