# Nuclo Operator Runbook And Environment Ledger

Purpose: lock the exact ShortPulse environment model and the execution order for production Supabase bootstrap and later runtime cutover work.

## Current Environment Decision

As of 2026-05-08, the approved environment posture is:

- local development and `working-development` use the staging Supabase project
- `staging-preview` uses the staging Supabase project
- `production` must use the dedicated production Supabase project

This means the current rollout goal is production isolation, not full three-database isolation.

## Canonical Ledger

| Surface | Development | Staging | Production |
| --- | --- | --- | --- |
| Git branch | `working-development` | `staging-preview` | `production` |
| Vercel scope | `Development` | `Preview` | `Production` |
| Runtime URL | local app runtime | staging Vercel deployment | `https://www.shortpulse.ai` |
| Supabase project role | shared non-production | shared non-production | live production |
| Supabase project ref | `jwmcytzyhcvacjwqtynn` | `jwmcytzyhcvacjwqtynn` | `ftgrqgjrchpimronuhop` |
| GitHub Environment | none | `staging` | `production` |
| DB workflow secret owner | local only | GitHub `staging` | GitHub `production` |
| Billing cutover policy | not applicable | not applicable | deferred until post-environment cutover |

## Canonical Variable Mapping

### Development

- `NEXT_PUBLIC_SUPABASE_URL` -> staging Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -> staging client key
- `SUPABASE_SERVICE_ROLE_KEY` -> staging server key
- `APP_BASE_URL` -> local runtime value
- `SHORTPULSE_PUBLIC_API_BASE_URL` -> local runtime value

### Staging

- `NEXT_PUBLIC_SUPABASE_URL` -> staging Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -> staging client key
- `SUPABASE_SERVICE_ROLE_KEY` -> staging server key
- `APP_BASE_URL` -> staging deployment URL
- `SHORTPULSE_PUBLIC_API_BASE_URL` -> staging deployment URL

### Production

- `NEXT_PUBLIC_SUPABASE_URL` -> production Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -> production client key
- `SUPABASE_SERVICE_ROLE_KEY` -> production server key
- `APP_BASE_URL` -> `https://www.shortpulse.ai`
- `SHORTPULSE_PUBLIC_API_BASE_URL` -> `https://www.shortpulse.ai`

### GitHub Environment Secrets

- `staging` `SUPABASE_DB_URL` -> staging database
- `production` `SUPABASE_DB_URL` -> production database

## Execution Order

1. Bootstrap production Supabase to application readiness.
2. Validate required tables, storage bucket, and core auth/runtime readiness.
3. Identify and apply the minimal post-bootstrap migration gap set.
4. Update Vercel `Production` environment variables to production Supabase and live domain values.
5. Update GitHub `production` `SUPABASE_DB_URL`.
6. Trigger a fresh production deploy.
7. Run live production smoke tests.
8. Monitor and only then move to secret rotation and cleanup.

## Production Bootstrap Policy

- Use repo-backed schema authority first.
- Prefer `docs/supabase_full_schema.sql` as the baseline bootstrap snapshot for a fresh production project.
- Treat post-snapshot migration work as a targeted gap-closure pass, not an uncontrolled replay of every historical migration unless evidence shows that is required.
- Do not migrate staging test data into production.
- Default production data policy is schema/config only.

## Production Billing Policy

- Billing is deferred until after environment cutover unless explicitly re-scoped.
- Empty or missing production Stripe secrets are a release gate only if billing is declared in-scope for the cutover window.

## Go / No-Go Gates Before Vercel Rewire

- production Supabase schema is present
- required application tables are queryable
- `media_library` bucket exists
- core auth configuration can be completed and verified
- production values are verified from authoritative platform sources
- rollback-ready production Vercel values are recorded

## Rollback Reference

If production validation fails after later Vercel rewiring:

1. restore previous production Vercel env values
2. redeploy previous known-good production deployment
3. revert GitHub `production` `SUPABASE_DB_URL` only if workflow behavior requires it
4. revalidate the live domain

## Deferred Follow-Ups

- protect `staging-preview` with a GitHub ruleset comparable to production
- rotate all secrets exposed in chat after environment work completes
- remove stale duplicate Supabase env names from Vercel
- document final cutover state in deployment docs after production is proven healthy
