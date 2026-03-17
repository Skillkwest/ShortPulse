# CI And Policy-As-Code Checks

Date: 2026-02-27
Authority: Working
Owner: Engineering

## Current CI jobs

- `deadcode`
- `frontend`
- `phase11_fal_regression`
- `type_check`
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
- `secret_scan`
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
- `scripts/check_secret_exposure.js` (new)
- `scripts/ci_npm_ci_with_retry.sh` (new)
- `scripts/phase11_checkpoint_window_guard.mjs` (new)

## Reference-grid foundation guardrail lane

The reference-grid modularization program uses staged guardrail variables:
- `REFERENCE_GRID_BOUNDARY_MODE` for reference-domain boundary checks inside `architecture_boundary`.
- `REFERENCE_GRID_SIZE_BUDGET_MODE` for target size budgets inside `size_budget`.

Architecture boundary lane also enforces AI Studio foundation boundaries:
- `ARCHITECTURE_BOUNDARY_MODE` governs server/runtime checks preventing
  `frontend/lib/server/**` and `frontend/pages/api/**` imports from
  `frontend/features/ai-studio/**` (warn -> enforce promotion model).

Mode policy:
1. `warn` during decomposition phases while legacy hotspots are above final targets.
2. `enforce` only after phase-6 evidence and two green cycles.

## Lane D runtime-safety policy mapping

- Canonical command: `npm -C frontend run validate:lane-d-runtime`
- Command expands to:
  1. `npm -C frontend run lint`
  2. `npm -C frontend run type-check`
  3. `npm -C frontend run check:architecture-boundary`
  4. `npm -C frontend run check:size-budget`
  5. `npm -C frontend run build`
  6. `npm -C frontend run docs:check`
  7. `npm -C frontend run check:lane-d-strict-runtime`
- Strict runtime rule intent:
  - block new `react-hooks/set-state-in-effect` debt in touched production seams
  - block new `react-hooks/exhaustive-deps` regressions in the same touched runtime surfaces
- Additional required gate when adaptive/reference-grid protected surfaces are touched:
  - `npm -C frontend run test:adaptive-v2-gate`
- Reviewer policy:
  1. use `validate:lane-d-runtime` for all Lane D PRs,
  2. attach targeted seam tests in the evidence packet,
  3. add `test:adaptive-v2-gate` when the slice touches reference-grid, adaptive-media, or canvas runtime seams.

## Lane E governance policy mapping

- Canonical command: `npm -C frontend run validate:lane-e-governance`
- Command expands to:
  1. `npm -C frontend run validate`
  2. `npm -C frontend run build`
  3. `npm -C frontend run docs:check`
- Policy intent:
  - keep active docs/index/ADR/changelog governance green under the same local command,
  - ensure validation-governance surface edits do not bypass the normal frontend validation contract,
  - require explicit green-cycle evidence before Lane E closeout.
- Reviewer policy:
  1. use `validate:lane-e-governance` for all Lane E convergence and closeout PRs,
  2. attach the exact green-cycle packet reference in the evidence chain,
  3. do not mark Lane E complete until two consecutive green cycles are recorded.

## Frontend fast-lane suites

- `auth-helper`
- `proxy-internal-utils`
- `auth-guarded-ai-routes`
- `fal-status.auth-context`
- `fal-status.ownership`
- `auth-latency-benchmark`

## Phase 11 Fal no-regression lane

- Gate job ID: `phase11_fal_regression`
- Command: `npm run test:phase11:fal-regression`
- Trigger policy:
  - Always on non-PR runs (`push`, `workflow_dispatch`)
  - PR runs only when Phase 11 Fal/provider-impacting files change
- Mode variable: `PHASE11_FAL_REGRESSION_MODE=warn|enforce` (defaults to `enforce`)
- Policy intent: preserve `/api/fal/*` contract parity and provider-boundary no-regression during Phase 11 work while Kie rollout remains off-path.

## SQL lint gate

- Command: `supabase db lint --db-url "$SUPABASE_DB_URL" --schema public --fail-on warning`
- Alternative command (linked local profile): `supabase db lint --linked --schema public --fail-on warning`
- Initial mode: warn/evaluate
- Current mode: `enforce` (re-promoted 2026-02-21 after CI bootstrap fix; validated by runs `22258656706` and `22258746736`)
- CI policy update (2026-03-16): `sql_lint` runs against hosted-target pinning (`SUPABASE_DB_URL`) and does not use Docker-local Supabase startup/cleanup.

## CI install hardening

- Shared CI install wrapper: `scripts/ci_npm_ci_with_retry.sh`.
- Purpose: retry `npm ci` only for transient network/download failures (for example proxy `502` or connection reset), while failing fast for deterministic dependency issues.
- Applied to CI jobs that run `npm ci` in `.github/workflows/ci.yml`.

## Security gate

- Blocking command: `npm audit --omit=dev --audit-level=moderate`
- Advisory command: `npm audit --audit-level=moderate`
- Policy intent: block production dependency vulnerabilities while preserving visibility into dev/tooling advisories without stalling release-cycle stabilization.

## Secret exposure gate

- Gate job ID: `secret_scan`
- Command: `node scripts/check_secret_exposure.js`
- Mode variable: `SECRET_SCAN_MODE=warn|enforce` (defaults to `warn`)
- Policy intent: block committed high-confidence secret literals while allowing staged rollout in warn mode.

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
- `type_check`
- `secret_scan`
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
