# Gottspan Admin Access Handoff

Date: 2026-05-13  
Owner receiving handoff: Gottspan  
Prepared by: Nuclo

## Purpose

Grant the user admin access for:

- the dedicated working-development Supabase/auth environment
- the production Supabase/auth environment

Do this without deleting users or user-owned data.

## Credential Source

Do **not** ask for or paste raw secrets into tracked files.

Use the existing gitignored root operator file:

- `.env.agent.local`

Relevant key groups already exist there:

- development:
  - `SHORTPULSE_DEVELOPMENT_PROJECT_REF`
  - `SHORTPULSE_DEVELOPMENT_SUPABASE_URL`
  - `SHORTPULSE_DEVELOPMENT_SUPABASE_SERVICE_ROLE_KEY`
  - `SHORTPULSE_DEVELOPMENT_DB_URL`
- production:
  - `SHORTPULSE_PRODUCTION_PROJECT_REF`
  - `SHORTPULSE_PRODUCTION_SUPABASE_URL`
  - `SHORTPULSE_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY`
  - `SHORTPULSE_PRODUCTION_DB_URL`

Project refs:

- working-development: `bgdhqbenqltxildlgkyu`
- production: `ftgrqgjrchpimronuhop`

## Actual Admin Contract

Admin access in this app is granted by either:

1. `app_metadata` role membership on the authenticated Supabase user
2. `SHORTPULSE_ADMIN_EMAILS` allowlist

Repo evidence:

- `frontend/lib/server/api/auth.ts`
- `frontend/pages/api/admin/access.ts`

`resolveAdminAccessVia()` treats either of these as admin:

- `app_metadata.role` or `app_metadata.roles` containing `admin` or `operator`
- authenticated user email included in `SHORTPULSE_ADMIN_EMAILS`

## Recommended Path

Use both layers so access is durable and easy to validate:

1. Resolve the target auth user in working-development by email.
2. Resolve the target auth user in production by email.
3. Add durable auth metadata so each user is an admin in both projects:
   - set `app_metadata.role = "admin"` or ensure `app_metadata.roles` contains `admin`
4. Ensure the same email is present in:
   - Vercel `Development` `SHORTPULSE_ADMIN_EMAILS`
   - Vercel `Production` `SHORTPULSE_ADMIN_EMAILS`
5. For local development, re-pull:
   - `vercel env pull frontend/.env.local --environment development --yes`
6. Validate using the real authenticated route:
   - `GET /api/admin/access`
   - expected: `200` with `isAdmin: true`

## Important Clarification

This is **application admin access**, not a Postgres superuser/database-owner grant.

Do **not** try to make the user a database owner or grant broad Postgres roles.
The app checks authenticated Supabase user metadata plus the email allowlist.

## Safe Execution Rules

- Do not delete users.
- Do not delete or rewrite user-owned rows/files.
- Do not rotate secrets during this task.
- Do not store any raw secret in tracked docs, handoffs, or memory.
- If the target email/login is ambiguous, stop and ask the user which email should be promoted.

## Validation Checklist

Working-development:

1. user exists in auth
2. `app_metadata` includes admin
3. Vercel `Development` `SHORTPULSE_ADMIN_EMAILS` includes the email
4. local `frontend/.env.local` refreshed from Vercel development
5. authenticated `GET /api/admin/access` returns admin

Production:

1. user exists in auth
2. `app_metadata` includes admin
3. Vercel `Production` `SHORTPULSE_ADMIN_EMAILS` includes the email
4. authenticated `GET /api/admin/access` returns admin

## If Tooling Choice Is Flexible

Preferred order:

1. use Supabase admin tooling/API with the service-role key from `.env.agent.local`
2. use Vercel CLI/dashboard for `SHORTPULSE_ADMIN_EMAILS`
3. avoid direct `auth.users` SQL mutation unless the admin API/tooling path is blocked

## Follow-On

After access is granted and verified:

- leave credentials as-is for now
- secret rotation still happens later, after the broader environment work is considered stable
