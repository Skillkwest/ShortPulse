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
- `conversation_state_hardening_gate` (manual workflow-dispatch; environment-gated)
- `apply_conversation_state_migration` (manual workflow-dispatch; environment-gated)

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

## Frontend fast-lane suites

- `auth-helper`
- `proxy-internal-utils`
- `auth-guarded-ai-routes`
- `fal-status.auth-context`
- `fal-status.ownership`
- `auth-latency-benchmark`

## SQL lint gate

- Command: `supabase db lint --local --schema public --fail-on warning`
- Initial mode: warn/evaluate
- Enforce mode: after two green release cycles

## Conversation-state hardening gate

- Workflow: `.github/workflows/conversation-state-hardening-gate.yml`
- Trigger: `workflow_dispatch`
- Job ID: `conversation_state_hardening_gate`
- Secret source: GitHub Environment secret `SUPABASE_DB_URL` (staging/production)
- Command: `./scripts/conversation_state_hardening_gate.sh`
- Modes: `warn` and `enforce` via dispatch input
- Evidence: upload run log artifact and link run URL in `docs/planning/evidence/sql/*.md`

## Conversation-state migration apply workflow

- Workflow: `.github/workflows/apply-conversation-state-migration-028.yml`
- Trigger: `workflow_dispatch`
- Job ID: `apply_conversation_state_migration`
- Secret source: GitHub Environment secret `SUPABASE_DB_URL` (staging/production)
- Inputs: `operation` (`apply|rollback`), `migration_id` (`028|029|030`), `confirm_token`
- Safety controls:
  - explicit operation + migration selection
  - operation-specific confirmation token format (`apply-<id>` / `rollback-<id>`)
  - SQL file existence checks before execution

## Branch protection mapping

Required checks must map to exact CI job IDs. Job ID renames are blocked after branch protection binding.
