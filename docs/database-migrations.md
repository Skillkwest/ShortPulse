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
