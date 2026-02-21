# STG-06 Warn/Evaluate Cycle Status (2026-02-21)

Date: 2026-02-21  
Stage: STG-06  
Operator: @sleepyseamonster

## Scope
- Verify two-green-cycle stabilization evidence for CI guardrail promotion.
- Track enforce-mode transitions and remaining closeout conditions.

## Evidence Snapshot

### CI workflow (`ci.yml`) stabilization runs
- `22250627010` (success)
- `22250698460` (success)
- `22250715981` (success)
- `22250809128` (success)

Commands used:
- `gh run list --workflow ci.yml --branch fal-modular-makeover --limit 10`
- `gh run view 22250809128 --json status,conclusion,jobs,headSha,createdAt,updatedAt`

### Incremental remediation history (same day)
- `22250505283` (failure): workflow startup issue (no jobs).
- `22250581279` (failure): path-filter jobs failed (`Resource not accessible by integration`).
- `22250627010` (success): permissions fix validated (`pull-requests: read`), full CI green.

### Enforce-mode promotions (2026-02-21)
Initial promotion:
- `DOCS_SEMANTIC_DRIFT_MODE=enforce`
- `MIGRATION_PARITY_MODE=enforce`

Expanded promotion:
- `ARCHIVE_MANIFEST_MODE=enforce`
- `SQL_LINT_MODE=enforce`
- `ARCHITECTURE_BOUNDARY_MODE=enforce`
- `SIZE_BUDGET_MODE=enforce`
- `AGENT_CONTRACT_TESTS_MODE=enforce`
- `AGENT_DISABLE_CONTINUITY_MODE=enforce`

Command used:
- `gh variable list | rg 'DOCS_SEMANTIC_DRIFT_MODE|MIGRATION_PARITY_MODE|ARCHIVE_MANIFEST_MODE|SQL_LINT_MODE|ARCHITECTURE_BOUNDARY_MODE|SIZE_BUDGET_MODE|AGENT_CONTRACT_TESTS_MODE|AGENT_DISABLE_CONTINUITY_MODE'`

Enforce-trial result:
- `ci.yml` run `22251008051` failed only on `sql_lint` after promotion.
- Failure detail: `supabase db lint --local` could not connect to local postgres (`127.0.0.1:54322`).
- Rollback-first stabilization applied: `SQL_LINT_MODE=warn` (all other promoted checks remain `enforce`).
- Post-rollback validation run `22251094709` completed `success`.
- CI bootstrap fix applied: `sql_lint` job now starts local Supabase (postgres-only footprint) before lint.
- SQL lint enforce mode re-promoted: `SQL_LINT_MODE=enforce` (2026-02-21).
- Post-repromotion validation run `22258656706` completed `success` (first green cycle after SQL lint re-promotion).
- Post-repromotion validation run `22258746736` completed `success` (second consecutive green cycle after SQL lint re-promotion).
- Additional full-check verification run `22258824796` completed `success` (includes successful `frontend` and `sql_lint` completion after governance packet update).
- Additional validation run `22258999203` completed `success` after failed-job rerun; initial `agent_disable_continuity` failure was transient Supabase CLI checksum fetch `502` during `npm ci`, and CI install retry hardening was added (`scripts/ci_npm_ci_with_retry.sh`).
- Additional validation run `22259338790` completed `success` after retry-hardening evidence sync; all enforce-mode guardrail jobs remained green.
- Additional validation run `22259592274` completed `success` after Vercel preview throttle-control rollout; all enforce-mode guardrail jobs remained green.
- Additional validation run `22262296039` completed `success`; all required CI jobs passed and Vercel checks were no longer rate-limited.

## Result
- Pre-promotion two-green-cycle criterion is satisfied.
- Expanded enforce-mode trial surfaced CI bootstrap gap for SQL lint.
- SQL lint bootstrap gap is resolved and two consecutive post-repromotion green cycles are now recorded.
- Governance evidence packet is now published (`docs/planning/evidence/agent/phase-4/2026-02-21-phase-4-governance-closeout.md`).
- Branch-protection reviewer/date metadata is now captured in `docs/planning/evidence/docs/2026-02-20-branch-protection-required-check-mapping.md`.
- STG-06 remains `In Progress` only for ongoing plan-tier enforcement constraint tracking (`DEP-01`).

## Next Action Required
- Keep plan-tier enforcement constraint (`403` API / non-enforceable private ruleset) tracked as open dependency for production-readiness closeout.
