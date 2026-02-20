# CI And Policy-As-Code Checks

Date: 2026-02-20
Authority: Working
Owner: Engineering

## Current CI jobs

- `deadcode`
- `frontend`
- `adaptive_media_gate`
- `ai_studio_perf_gate`
- `ai_studio_perf_gate_notice`
- `security`

## New CI jobs

- `docs_semantic_drift`
- `migration_parity`
- `sql_lint`
- `archive_manifest_check`
- `architecture_boundary` (planned)
- `size_budget` (planned)

## Policy-as-code artifacts

- `scripts/check_docs_links.js` (existing)
- `scripts/check_docs_semantic_drift.js` (new)
- `scripts/check_migration_doc_parity.js` (new)
- `scripts/check_archive_manifest.js` (new)
- `scripts/check_architecture_boundaries.js` (planned)
- `scripts/check_size_budgets.js` (planned)

## SQL lint gate

- Command: `supabase db lint --local --schema public --fail-on warning`
- Initial mode: warn/evaluate
- Enforce mode: after two green release cycles

## Branch protection mapping

Required checks must map to exact CI job IDs. Job ID renames are blocked after branch protection binding.
