# Nuclo Current Handoff - 2026-05-14

Purpose: own the hosted Supabase remediation needed to clear `sql_lint` during the current pre-launch `production` lane.

## Current Environment Finding

Hosted CI `sql_lint` is still failing against the target remote database because the remote function body for:

- `public.list_admin_model_usage_stats(integer)`

is stale.

## Evidence

Recent hosted CI `sql_lint` logs show:

- function: `public.list_admin_model_usage_stats`
- error: `column reference "model_id" is ambiguous`
- SQLSTATE: `42702`

This failure is happening on the hosted remote database lint target, not in the local repo validation lane.

## Important Correction

The repo already had:

- `sql/migrations/101_fix_admin_stats_and_pricing_rpc_lint.sql`

but that migration was still incomplete. It has now been corrected so the PL/pgSQL `RETURN QUERY` explicitly qualifies the relevant `app_error_events` and `ai_generations` fields, which removes the `model_id` shadowing problem properly.

## Hosted Remediation Path

A new environment-gated hosted workflow now exists:

- `.github/workflows/apply-hosted-sql-migration.yml`

It:

- applies a selected canonical SQL file using the GitHub Environment `SUPABASE_DB_URL`
- immediately reruns hosted `supabase db lint --db-url "$SUPABASE_DB_URL" --schema public --fail-on warning`
- uploads apply and lint logs as artifacts

Required workflow inputs:

- `target_environment`
- `sql_file`
- `confirm_token=apply-hosted-sql`

## Nuclo Action Sequence

Do this only after the current branch changes are pushed and the workflow file exists on GitHub.

1. Dispatch the hosted workflow against staging:
   - `target_environment=staging`
   - `sql_file=sql/migrations/101_fix_admin_stats_and_pricing_rpc_lint.sql`
   - `confirm_token=apply-hosted-sql`

2. Review the workflow artifacts:
   - hosted SQL apply log
   - hosted SQL lint log

3. Rerun CI on the pushed branch and confirm:
   - `sql_lint` is green

4. If staging is clean, repeat the same hosted apply path for production before any production promotion:
   - `target_environment=production`
   - `sql_file=sql/migrations/101_fix_admin_stats_and_pricing_rpc_lint.sql`
   - `confirm_token=apply-hosted-sql`

## Scope Boundary

This handoff is for Nuclo because it is:

- environment-targeting work
- GitHub Environment `SUPABASE_DB_URL` work
- hosted Supabase schema remediation
- promotion-path risk reduction

It is not a Gear Ball commit/push responsibility.

## Relevant Files

- `sql/migrations/101_fix_admin_stats_and_pricing_rpc_lint.sql`
- `.github/workflows/apply-hosted-sql-migration.yml`
- `docs/database-migrations.md`
- `docs/deployment.md`

## Residual Risk

- `sql_lint` will remain red on the hosted target until the corrected migration is applied remotely.
- The local branch can still be healthy while hosted staging or production remains stale, so Nuclo must treat this as environment drift, not repo uncertainty.
