# Nuclo Intake Pointer - D-Bug Hosted SQL Lint Remediation

Canonical D-Bug handoff:

- `docs/records/artifacts/agent/d-bug/handoffs/2026-05-14-nuclo-hosted-sql-lint-remediation.md`

Nuclo should also read:

- `docs/agents/nuclo/CURRENT-HANDOFF.md`

Summary:

- remaining blocker is hosted `sql_lint`
- repo-side fix exists in `sql/migrations/101_fix_admin_stats_and_pricing_rpc_lint.sql`
- Nuclo owns the remote staging then production apply/verify sequence through `.github/workflows/apply-hosted-sql-migration.yml`
