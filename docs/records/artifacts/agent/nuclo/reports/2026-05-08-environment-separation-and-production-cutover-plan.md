# Nuclo Environment Separation And Production Cutover Plan

Purpose: capture the audited May 8, 2026 environment-state findings and the current Nuclo execution plan for separating dev, staging, and production safely.

Historical context note:

- This report preserves the May 8, 2026 ladder-era environment plan.
- Any references here to `working-development` as the active coding branch are historical and do not override Nuclo's current pre-launch `production`-only operating rule.
- Use `docs/agents/nuclo/README.md` and `docs/agents/nuclo/memory.md` for Nuclo's current standing branch instruction.

## Scope

- Branch ladder: `working-development` -> `staging-preview` -> `production`
- Vercel environment mapping
- GitHub Environment secret alignment
- Supabase project separation and production readiness

## Verified State On 2026-05-08

### Branching And Deployment Routing

- The intended branch ladder is already established:
  - `working-development`
  - `staging-preview`
  - `production`
- Vercel branch routing is largely correct:
  - `staging-preview` deploys the staging runtime
  - `production` deploys the live runtime

### Current Miswiring

- Vercel `Development`, `Preview`, and `Production` all still resolve to the staging Supabase project for the core Supabase runtime variables.
- Production base URL variables still resolve to the Vercel default domain instead of the canonical live domain.
- Local development is not isolated from staging.

### Supabase State

- The existing staging project ref is `jwmcytzyhcvacjwqtynn`.
- The existing production project ref is `ftgrqgjrchpimronuhop`.
- The production Supabase project is not yet app-ready:
  - core application tables were not present during direct runtime checks
  - auth users were absent
  - storage buckets were absent

### GitHub And Governance State

- `production` is protected by an active ruleset.
- `staging-preview` is not currently protected.
- GitHub Environments exist for `staging` and `production`.

### Billing And Runtime Risk

- Production Stripe secrets were resolved as empty in Vercel during the live audit.

## Problem Statement

This is not primarily a branch-structure problem. It is a runtime, database, and secret-alignment problem.

Today, the environment model is effectively:

- local dev -> staging database
- hosted staging -> staging database
- hosted production -> staging database

That posture must be eliminated before a safe production cutover can happen.

## Target State

### Dev

- Branch: `working-development`
- Vercel scope: `Development`
- Runtime: local-only for now
- Supabase: dedicated dev project

### Staging

- Branch: `staging-preview`
- Vercel scope: `Preview`
- Runtime: staging Vercel URL
- Supabase: `jwmcytzyhcvacjwqtynn`

### Production

- Branch: `production`
- Vercel scope: `Production`
- Runtime: `https://www.shortpulse.ai`
- Supabase: `ftgrqgjrchpimronuhop`

## Key Decisions

- Keep `working-development` as the only active coding branch.
- Use `https://www.shortpulse.ai` as the canonical production origin.
- Treat `https://shortpulse.ai` as a redirect to the `www` origin.
- Keep development local-only for now unless a hosted dev runtime becomes a concrete requirement.

## Non-Negotiable Rules

- Dev must never default to staging or production data.
- Staging must never use production keys or database URLs.
- Production must never use staging keys or database URLs.
- Schema changes must come from repo-managed migrations.
- No production cutover happens until production Supabase passes readiness checks.
- No values are copied from chat history or memory during execution; authoritative platforms must be read directly.
- During cutover, no ad hoc configuration changes happen outside the reviewed runbook.

## Critical Path

1. Lock the architecture and operating rules.
2. Build the authoritative environment ledger.
3. Isolate dev.
4. Bootstrap production Supabase.
5. Validate production Supabase readiness.
6. Normalize Vercel.
7. Align GitHub Environment secrets.
8. Cut over production.
9. Monitor and harden.
10. Rotate exposed secrets and clean governance drift.

## Phase Plan

### Phase A: Lock Architecture

Freeze:

- the branch ladder
- the canonical production origin
- the local-only dev posture

Exit gate:

- no unresolved architecture question remains

### Phase B: Build The Environment Ledger

Create a reviewed matrix with, for each environment:

- branch
- Vercel scope
- runtime URL
- Supabase project ref
- Supabase API URL
- public key source
- secret/service key source
- GitHub Environment
- `SUPABASE_DB_URL` target
- auth site URL
- redirect URLs
- storage bucket status
- Stripe/webhook status
- validation status
- rollback-ready status

Exit gate:

- every production-bound value has been verified from its authoritative source

### Phase C: Isolate Dev

- create a dedicated Supabase dev project
- provision dev keys, database URL, auth config, and required buckets
- point Vercel `Development` to the dev project
- keep local CLI default targeting non-production only

Exit gate:

- local development no longer targets staging by default

### Phase D: Bootstrap Production Supabase

- apply the full schema and migrations
- verify required application tables exist
- create required storage buckets
- configure auth site URL and redirect URLs
- configure any required email, OAuth, or provider settings
- recreate required cron or project-level settings
- load only approved production seed or config data

Rule:

- do not migrate staging test data into production unless explicitly approved

Exit gate:

- production Supabase is app-ready

### Phase E: Normalize Vercel

- `Development` -> dev Supabase
- `Preview` and `staging-preview` -> staging Supabase
- `Production` -> production Supabase
- production base URLs -> `https://www.shortpulse.ai`
- keep only canonical environment variable names that the app contract expects
- populate production Stripe secrets before live billing use

Exit gate:

- resolved Vercel environment pulls match the environment ledger

### Phase F: Align GitHub Environments

- keep `staging` database workflow secrets on staging
- move `production` database workflow secrets to production
- verify any environment-specific workflow secrets tied to deploy gates or background operations

Exit gate:

- GitHub Environment secrets align with the same targets as Vercel and Supabase

### Phase G: Harden Governance

- keep `production` protected
- add protection or equivalent ruleset coverage to `staging-preview`
- freeze schema changes during the cutover window

Exit gate:

- both release branches are enforceable and the cutover window is controlled

## Validation Plan

### Dev Validation

- local app boots
- auth works
- one read path works
- one write path works
- storage path works

### Staging Validation

- staging deployment resolves correctly
- deployment route parity passes
- auth works
- storage works
- internal operations routes exist
- one representative generation path works

### Production Supabase Pre-Cutover Validation

- required schema exists
- required tables exist
- required storage buckets exist
- auth configuration is correct
- required jobs and project-level settings exist

### Production Runtime Post-Cutover Validation

- `https://www.shortpulse.ai` resolves correctly
- deployment route parity passes
- auth login and session flows work
- storage works
- internal operations routes work
- billing and webhook paths work if they are live

## Go / No-Go Gate

Production cutover is allowed only if all are true:

- production Supabase is app-ready
- production Vercel values have been reviewed and locked
- GitHub `production` database secret is correct
- production base URLs are correct
- route parity passes
- billing secrets are present if billing is live
- rollback values are prepared in advance

If any item fails, stop.

## Cutover Sequence

1. Freeze schema and configuration changes.
2. Review and lock the environment ledger.
3. Update production Vercel env vars.
4. Update GitHub `production` `SUPABASE_DB_URL`.
5. Trigger a fresh production deploy.
6. Run immediate smoke tests on `https://www.shortpulse.ai`.
7. Monitor closely for one hour.
8. Continue a 24-hour validation window.

## Rollback Plan

Rollback triggers:

- auth failure
- storage failure
- route parity failure
- broken core runtime
- customer-impacting billing or webhook failure

Rollback steps:

1. restore the previous known-good production Vercel env values
2. redeploy the previous known-good production deployment
3. revert GitHub `production` database secret only if workflow behavior requires it
4. revalidate the live domain
5. log the incident and cause in Nuclo records

## Post-Cutover Hardening

- rotate all exposed Supabase keys
- rotate exposed database passwords
- rotate related webhook or provider secrets as needed
- remove stale duplicate Vercel env keys
- update docs that still reference `main` or older trunk assumptions
- document the final branch -> Vercel -> Supabase mapping
- record the final state and validation outcome in Nuclo memory and retained artifacts

## Success Criteria

The plan is complete only when all are true:

- dev no longer touches staging
- staging uses only staging Supabase
- production uses only production Supabase
- production uses `https://www.shortpulse.ai` correctly
- GitHub workflow secrets align with runtime truth
- production Supabase is app-ready
- both release branches are protected
- exposed credentials have been rotated
- docs and Nuclo records match reality
