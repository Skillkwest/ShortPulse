# D-Bug Handoff - Nuclo Hosted SQL Lint Remediation

Date: 2026-05-14
From: D-Bug
To: Nuclo
Issue label: hosted-sql-lint-remediation

## Why This Is A Nuclo Handoff

This is a Nuclo-owned next step because the remaining blocker is hosted environment drift, not local repo uncertainty:

- hosted Supabase target
- GitHub Environment `SUPABASE_DB_URL`
- remote SQL apply
- remote `sql_lint` verification

This is not a Gear Ball lane. Commit and push execution belong to Gear Ball. Hosted environment and SQL remediation belong to Nuclo.

## Current State

The `working-development` repo-side stabilization lane is green, but hosted `sql_lint` can still remain red until the corrected SQL is applied remotely.

The key failing object is:

- `public.list_admin_model_usage_stats(integer)`

Observed hosted error:

- `column reference "model_id" is ambiguous`
- SQLSTATE `42702`

## Debug Conclusion

The repo migration:

- `sql/migrations/101_fix_admin_stats_and_pricing_rpc_lint.sql`

was corrected so the relevant `RETURN QUERY` field references are explicitly qualified. That removes the `model_id` shadowing problem in the canonical source.

The likely remaining problem is hosted schema drift on the target remote database.

## Required Nuclo Action

After the branch changes are pushed and available on GitHub, Nuclo should:

1. Dispatch the hosted SQL workflow against `staging`:
   - workflow: `.github/workflows/apply-hosted-sql-migration.yml`
   - `target_environment=staging`
   - `sql_file=sql/migrations/101_fix_admin_stats_and_pricing_rpc_lint.sql`
   - `confirm_token=apply-hosted-sql`

2. Review the workflow artifacts:
   - apply log
   - hosted lint log

3. Re-run CI and confirm:
   - `sql_lint` is green

4. If staging is clean, repeat for `production` before production promotion:
   - `target_environment=production`
   - `sql_file=sql/migrations/101_fix_admin_stats_and_pricing_rpc_lint.sql`
   - `confirm_token=apply-hosted-sql`

## Relevant Files

- `sql/migrations/101_fix_admin_stats_and_pricing_rpc_lint.sql`
- `.github/workflows/apply-hosted-sql-migration.yml`
- `docs/database-migrations.md`
- `docs/deployment.md`
- `docs/agents/nuclo/CURRENT-HANDOFF.md`

## Residual Risk

- local repo validation can still be green while hosted `sql_lint` remains red
- this lane is not complete until the remote target is updated and re-linted

## Downstream Owner

- `Nuclo`
