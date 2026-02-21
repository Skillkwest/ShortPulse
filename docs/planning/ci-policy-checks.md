# CI And Policy-As-Code Checks

Date: 2026-02-20
Authority: Working
Owner: Engineering

## Current CI jobs

- `deadcode`
- `frontend`
- `docs_semantic_drift`
- `migration_parity`
- `sql_lint`
- `archive_manifest_check`
- `architecture_boundary`
- `size_budget`
- `agent_contract_tests`
- `agent_disable_continuity`
- `adaptive_media_gate`
- `ai_studio_perf_gate`
- `security`
- `conversation_state_hardening_gate` (manual workflow-dispatch; environment-gated)
- `apply_conversation_state_migration` (manual workflow-dispatch; environment-gated)

## Policy-as-code artifacts

- `scripts/check_docs_links.js` (existing)
- `scripts/check_docs_semantic_drift.js` (new)
- `scripts/check_migration_doc_parity.js` (new)
- `scripts/check_archive_manifest.js` (new)
- `scripts/check_architecture_boundaries.js` (new)
- `scripts/check_size_budgets.js` (new)
- `scripts/check_agent_contract_tests.js` (new)
- `scripts/check_agent_disable_continuity.js` (new)

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
- Current mode: `warn` (rolled back 2026-02-21 after enforce trial run `22251008051` failed: local DB bootstrap unavailable in CI for `supabase db lint --local`)

## Security gate

- Blocking command: `npm audit --omit=dev --audit-level=moderate`
- Advisory command: `npm audit --audit-level=moderate`
- Policy intent: block production dependency vulnerabilities while preserving visibility into dev/tooling advisories without stalling release-cycle stabilization.

## Prototype mode policy (MVP)

- During MVP prototype iteration, governance checks may begin in advisory/warn mode.
- This policy does not block local build/test/commit or feature delivery.
- Enforcement promotion is deferred to production-readiness hardening.
- Current hardening state (2026-02-21): target governance checks have been promoted to `enforce` in CI.

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

Current required check names (to be mirrored exactly in GitHub settings):
- `frontend`
- `security`
- `deadcode`

Target required check names (running in `enforce` mode in CI; branch-level enforcement still constrained by repository plan tier):
- `docs_semantic_drift`
- `migration_parity`
- `sql_lint`
- `archive_manifest_check`
- `architecture_boundary`
- `size_budget`
- `agent_contract_tests`
- `agent_disable_continuity`

## Manual evidence runbook (required)
Repository API access for branch rules/protection is restricted in this repo context (`403`), so evidence is captured manually:
- Capture repository settings screenshot/export showing required checks.
- Copy exact required check names into this document.
- Add operator/date evidence note at `docs/planning/evidence/docs/2026-02-20-branch-protection-required-check-mapping.md`.
- Keep STG-06 closeout pending until two green cycles are logged after the most recent enforce-mode promotion.
