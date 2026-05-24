# Nuclo Previous Handoff - 2026-05-14

Purpose: preserve the prior Nuclo current handoff that was replaced by the 2026-05-23 P0 branch-instruction handoff.

## Original Purpose

Own the hosted Supabase remediation needed to clear `sql_lint` during the pre-launch `production` lane.

## Current Environment Finding

Hosted CI `sql_lint` was failing against the target remote database because the remote function body for:

- `public.list_admin_model_usage_stats(integer)`

was stale.

## Evidence

Hosted CI `sql_lint` logs showed:

- function: `public.list_admin_model_usage_stats`
- error: `column reference "model_id" is ambiguous`
- SQLSTATE: `42702`

This failure was happening on the hosted remote database lint target, not in the local repo validation lane.

## Important Correction

The repo already had:

- `sql/migrations/101_fix_admin_stats_and_pricing_rpc_lint.sql`

but that migration was still incomplete. It was corrected so the PL/pgSQL `RETURN QUERY` explicitly qualified the relevant `app_error_events` and `ai_generations` fields, which removed the `model_id` shadowing problem properly.

## Hosted Remediation Path

An environment-gated hosted workflow existed:

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

This sequence was intended only after the branch changes were pushed and the workflow file existed on GitHub.

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

This handoff was for Nuclo because it was:

- environment-targeting work
- GitHub Environment `SUPABASE_DB_URL` work
- hosted Supabase schema remediation
- promotion-path risk reduction

It was not a Gear Ball commit/push responsibility.

## Relevant Files

- `sql/migrations/101_fix_admin_stats_and_pricing_rpc_lint.sql`
- `.github/workflows/apply-hosted-sql-migration.yml`
- `docs/database-migrations.md`
- `docs/deployment.md`

## Residual Risk

- `sql_lint` could remain red on the hosted target until the corrected migration was applied remotely.
- The local branch could still be healthy while hosted staging or production remained stale, so Nuclo had to treat this as environment drift, not repo uncertainty.
