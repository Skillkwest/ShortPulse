# Database Migrations

Purpose: define a consistent migration workflow for Supabase schema changes.

## Migration layout

- Canonical folder: `sql/migrations/`
- Naming pattern: `NNN_short_description.sql` (e.g., `001_initial_schema.sql`)
- Keep legacy bootstrap scripts in `sql/` unchanged for historical reference.

## Create a migration

1. Pick the next migration number.
2. Add forward SQL under `sql/migrations/NNN_description.sql`.
3. Add matching rollback SQL under `sql/migrations/rollback/NNN_description_rollback.sql` when feasible.
4. Include RLS/storage/index updates in the same migration when they are part of the same feature.

## Local/staging test flow

1. Apply migration in local/staging Supabase project.
2. Run:
   ```bash
   cd frontend
   npm run validate
   npm run build
   ```
3. Validate impacted flows (auth, AI Studio billing/debits, media library, admin routes).

## CLI workflow

When Supabase CLI is installed:

```bash
cd frontend
npm run db:migrate
```

For reset/testing:

```bash
cd frontend
npm run db:reset
```

## Production deploy workflow

1. Apply migrations to staging and verify.
2. Schedule production migration window.
3. Apply production migrations.
4. Deploy app code dependent on the migration.
5. Run post-deploy smoke checks.

## Rollback strategy

- Preferred: run paired rollback migration.
- Fallback: execute targeted corrective SQL and redeploy the previous known-good app revision.
- Always document migration failures and corrections in project docs.

## Current required migration set (billing + generation)

For environments bootstrapped from `docs/supabase_full_schema.sql`, apply these migrations to match current API behavior:

1. `sql/migrations/001_add_studio_10000_credit_package.sql`
2. `sql/migrations/002_add_generation_credit_reservations.sql`

If upgrading from a legacy ledger schema, also apply:

3. `sql/migrate_ai_credit_ledger_legacy_to_v2.sql`

If enabling the Media Library Private tab, also apply:

4. `sql/migrations/003_add_private_media_source.sql`
5. `sql/migrations/004_add_private_media_integrity_checks.sql`

If enabling the derivative-first media optimization architecture (virtualized grid + variant hints), also apply:

6. `sql/migrations/005_add_media_processing_and_variants.sql`
7. `sql/migrations/006_backfill_media_variant_hints.sql`
8. `sql/migrations/007_harden_media_source_and_usage_rpc.sql`

If enabling Character Manager (reference packs + generation history), also apply:

9. `sql/migrations/008_add_character_manager_foundation.sql`

If Media Library cards still show blank placeholders in legacy environments, also apply:

10. `sql/migrations/009_repair_legacy_media_storage_paths.sql`
