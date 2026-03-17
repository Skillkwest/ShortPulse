# Lane E Master Plan (2026-03-16)

Last updated: 2026-03-17  
Status: Active  
Owner: Engineering  
Roadmap anchor: `docs/planning/foundation-lanes-master-roadmap-2026-03-16.md`  
Tracker anchor: `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`  
Tracker spec: `docs/planning/lane-e-tracker-spec-2026-03-16.md`  
Execution plan: `docs/planning/lane-e-execution-plan-2026-03-16.md`  
Evidence index: `docs/planning/evidence/lane-e/README.md`

## Summary
Lane E makes docs and architecture-governance discipline enforceable so foundational lanes stay no-regression and no-bloat.

Locked objectives:
1. Keep active docs indexes and section indexes in parity with active files.
2. Keep ADR inventory structurally correct (unique numbering and discoverable references).
3. Keep policy surfaces consistent with repo rules (especially Supabase operations policy).
4. Normalize changelog structure so chronology and future-date guards are enforceable.
5. Convert governance intent into CI/local checks with explicit allowlist control.

Default contract:
1. No runtime behavior/API changes.
2. No new runtime dependencies.
3. One governance seam per PR.
4. Lane E is governance-enforcement first; one-time remediation cleanup remains owned by Lane A.

## Baseline Findings (Audit Snapshot)
As of 2026-03-17:
1. Lane E artifact set now includes master plan, tracker spec, execution plan, and evidence index.
2. Root/planning index parity for active planning and design surfaces is now locked after `E1-01`:
   - `docs/planning/README.md`: `0` missing for active top-level planning docs
   - `docs/README.md`: `0` missing for active planning + design surfaces
   - `docs/product/README.md`: `0` missing
   - `docs/design/README.md`: `0` missing
3. ADR inventory integrity is now locked after `E2-01`:
   - `docs/adr/README.md`: `0` active ADR entries missing
   - duplicate ADR number drift: `0`
4. Active policy-surface drift remains for `E3-01`: Docker-local Supabase lint/start instructions appear in active templates/scripts/CI/planning policy docs while core repo policy prohibits Docker-local Supabase workflows.
5. Changelog normalization drift remains for `E4-01`: `docs/change_log.md` has no `## Unreleased`; chronology/future-date enforcement in `scripts/check_docs_semantic_drift.js` is therefore not active.
6. `npm -C frontend run docs:check` is green, confirming current checks are healthy while Lane E continues converting the remaining governance intent into enforced contracts.

## Scope
In scope:
1. Docs index parity contracts for active surfaces.
2. ADR inventory integrity and link parity contracts.
3. Policy-surface consistency checks for active docs/templates/scripts/CI workflows.
4. Changelog governance contract and enforceable chronology/future-date checks.
5. Lane E-specific tracker/evidence discipline and same-PR docs contract for touched surfaces.
6. Checker expansion so the above contracts are machine-enforced and non-regressing.

Out of scope:
1. Runtime feature behavior changes.
2. Lane B modularization execution.
3. Lane C regression characterization bundles.
4. Lane D runtime warning/suppression work.
5. Parallel Track P1 generation pipeline hardening logic.
6. Standalone `mini-ecosystem/` system docs.
7. Lane A remediation slices already defined in Lane A (`A2/A3`) such as initial duplicate route-row cleanup and first-pass policy text cleanup.

## Lane Boundary Lock (A vs E)
1. Lane A owns one-time remediation cleanup to remove current governance debt and unblock baseline gates.
2. Lane E owns durable enforcement: checkers, parity contracts, and sustained non-regression controls after cleanup.
3. If a remediation edit is required to make an enforcement checker deterministic, that remediation must either:
   - ship in Lane A first, or
   - be explicitly split as a pre-Lane-E debt slice with rollback note and tracker evidence.
4. No mixed remediation + enforcement mega-PRs.

## Governance Surfaces (Locked)
Lane E active-surface parity targets:
1. Root index: `docs/README.md`
2. Planning index: `docs/planning/README.md`
3. Product index: `docs/product/README.md`
4. Design index: `docs/design/README.md`
5. ADR index: `docs/adr/README.md`
6. Planning evidence index: `docs/planning/evidence/README.md`

Lane E active policy-surface consistency targets:
1. `.github/pull_request_template.md`
2. `.github/workflows/ci.yml`
3. `scripts/run_repo_sweep.sh`
4. `docs/planning/ci-policy-checks.md`
5. `docs/planning/master-rollout-proposal.md`
6. `docs/planning/stages/stage-02-sql-rpc-hardening-028.md`
7. Core policy docs (`README.md`, `docs/dev-ground-rules.md`, `docs/agent-playbook.md`, `docs/local-development.md`, `docs/database-migrations.md`, `docs/deployment.md`, `docs/sops/sop_sql_migration_operations.md`)

Lane E excluded historical surfaces by default:
1. `docs/archive/**`
2. `docs/planning/evidence/**`
3. `mini-ecosystem/**`

## No-Bloat Controls (Mandatory)
1. Prefer extending existing governance scripts over creating many new check scripts.
2. No broad archive/evidence rewrites in this lane.
3. No mass style/frontmatter reformatting unrelated to governance contracts.
4. Any exclusion/allowlist entry must include owner, reason, and sunset criterion.

## Implementation Phases
### E0: Governance Bootstrap
1. Publish Lane E master plan + tracker spec + evidence index.
2. Wire Lane E artifacts into roadmap/tracker/docs indexes.
3. Freeze Lane E non-goals, lane-boundary lock, and rollback posture.
4. Capture baseline drift metrics for each locked governance surface.
5. Capture classification decisions for temporary planning notes (active index vs archive/defer) before parity enforcement.

### E1: Index Parity Contract
1. Enforce active top-level `docs/planning/*.md` parity in `docs/planning/README.md`.
2. Enforce required active inventory parity for `docs/README.md` and scoped section READMEs.
3. Allow exclusions only through explicit checker allowlist entries with owner + sunset criterion.
4. Resolve temporary top-level planning notes explicitly as either indexed active docs or moved out of active planning inventory (no silent drift).

### E2: ADR Integrity Contract
1. Resolve duplicate ADR number drift with stable, unique IDs (renumber the non-canonical duplicate to next available ADR number).
2. Enforce duplicate-number detection under `docs/adr/`.
3. Enforce root/section ADR index parity for active ADR docs.
4. Update cross-doc ADR references in the same slice.

### E3: Policy Surface Consistency
1. Align active policy docs/templates/scripts/CI workflow to one Supabase operations contract.
2. Apply strict checks to active surfaces and explicitly exclude archive/evidence historical records.
3. Keep exceptions explicit, scoped, and tracked with owner + sunset.
4. Ensure PR template, CI workflow, and helper scripts no longer prescribe contradictory Docker-local Supabase workflows when active policy forbids them.

### E4: Changelog Governance Hardening
1. Normalize changelog structure to include `## Unreleased`.
2. Keep dated sections in strict descending order with non-future date enforcement.
3. Preserve non-timeline legacy imports in clearly separated sections when needed.

### E5: Convergence And Enforcement
1. Promote Lane E drift checks to enforce mode after two consecutive green cycles.
2. Require Lane E evidence packet references for PRs that alter contract/surface docs.
3. Keep lane closed only when all required parity and policy contracts are green and tracked.

## Exit Criteria
1. `docs/planning/README.md` top-level active planning drift count is `0` (or explicit tracked exclusions only).
2. `docs/product/README.md`, `docs/design/README.md`, and `docs/adr/README.md` active drift counts are each `0` (or explicit tracked exclusions only).
3. `docs/README.md` drift count for active ADR/design/planning references is `0`.
4. ADR duplicate-number drift count is `0`.
5. Active policy-surface contradiction count is `0`.
6. Changelog chronology/future-date checks run in enforce mode and pass.
7. `npm -C frontend run docs:check` passes for two consecutive green cycles after Lane E enforcement updates.

## Merge Gates
Per slice:
1. `npm -C frontend run docs:check`
2. `npm -C frontend run lint` (when scripts/templates are touched)
3. `npm -C frontend run type-check` (when scripts/templates are touched)
4. `npm -C frontend run build` (when frontend/tooling surfaces are touched)

Lane-level final gate:
1. `npm -C frontend run docs:check`
2. `npm -C frontend run validate` (when Lane E updates affect validation governance surfaces)

## Assumptions And Defaults
1. Lane E enforces governance contracts; it does not add product/runtime capability.
2. Active operational surfaces are enforceable; archive/evidence surfaces remain historical and non-blocking unless explicitly promoted.
3. Any allowlist exception must include owner, reason, and sunset criterion in tracker evidence.
4. Lane E updates should ship with the same PR as affected contract/surface changes.
