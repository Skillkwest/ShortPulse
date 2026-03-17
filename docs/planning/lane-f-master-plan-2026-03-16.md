# Lane F Master Plan (2026-03-16)

Last updated: 2026-03-17  
Status: Active  
Owner: Engineering  
Roadmap anchor: `docs/planning/foundation-lanes-master-roadmap-2026-03-16.md`  
Tracker anchor: `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`  
Tracker spec: `docs/planning/lane-f-tracker-spec-2026-03-16.md`  
Contact map: `docs/planning/lane-f-contact-map-2026-03-16.md`  
Execution plan: `docs/planning/lane-f-execution-plan-2026-03-16.md`  
Evidence index: `docs/planning/evidence/lane-f/README.md`

## Summary
Lane F operationalizes release and CI discipline so foundational hardening lanes can ship with repeatable merge confidence and no governance drift.

Locked objectives:
1. Keep CI/release policy docs in strict parity with workflow reality.
2. Keep required-check and job-ID contracts stable and explicitly controlled.
3. Define durable compensating controls for private-repo plan limits on branch/ruleset enforcement.
4. Improve CI reliability controls (concurrency, stale-run cancellation posture, and trigger clarity).
5. Harden workflow supply-chain posture with a phased GitHub Action pinning policy.
6. Lock environment protection and deployment-gate posture for staging/production.
7. Keep ownership and escalation identity consistent across operator/docs/repo control files.

Default contract:
1. No runtime feature behavior/API changes.
2. No new runtime dependencies.
3. One CI/release governance seam per PR.
4. Lane F governs release/CI control planes; lane-local checks must remain no-bloat and no-regression.

## Baseline Findings (Audit Snapshot)
As of 2026-03-17:
1. Lane F artifacts are now published: master plan, tracker spec, contact map, execution plan, and lane evidence index.
2. CI workflow currently defines `17` jobs in `.github/workflows/ci.yml`.
3. CI inventory and required-check coverage are now locked after `F1-01`:
   - `agent_rollback_verification` is documented in `docs/planning/ci-policy-checks.md`,
   - `AGENT_ROLLBACK_VERIFICATION_MODE` is tracked in policy docs,
   - release checklist engineering gates explicitly include `npm -C frontend run docs:check`.
4. Guardrail mode variables are currently set to `enforce` for core CI policy checks.
5. Plan-limited branch/ruleset compensating controls are now refreshed after `F2-01`:
   - current required-check mapping evidence is date-current,
   - current prototype-mode waiver posture is date-current,
   - production-readiness blocker language is explicit while repository-plan enforcement remains unavailable.
6. Workflow reliability controls are incomplete:
   - no workflow-level `concurrency` blocks,
   - no `merge_group` trigger posture documented for future merge-queue adoption.
7. Workflow supply-chain hardening drift exists:
   - GitHub Action `uses:` references: `42`,
   - full-SHA pinned references: `0`.
8. Environment protection posture is currently open:
   - `Production` and `staging` environments have no protection rules and no deployment branch policy.
9. Environment namespace drift exists: duplicate naming variants (`Production`, `Production – short-pulse`, `Production – shortpulse`, and preview variants) increase operator error risk.
10. Ownership identity drift exists between operator/contact artifacts (`worldbuilder`) and `.github/CODEOWNERS` (`@sleepyseamonster`).
11. CI reliability is currently volatile in recent history (mixed success/failure cadence), requiring lane-level reliability policy rather than one-off fixes.

## Scope
In scope:
1. CI workflow and policy-doc parity contracts.
2. Required-check catalog and branch/ruleset compensation policy.
3. Workflow reliability policy (triggers, concurrency posture, skip behavior controls).
4. GitHub Actions supply-chain hardening policy and rollout phases.
5. Environment protection and release-gate policy for production/staging.
6. Ownership identity normalization across operator map/contact map/CODEOWNERS.
7. Local CI/release sweep policy surfaces (`scripts/run_repo_sweep.sh`, retry/install helper scripts).
8. Lane F tracker/evidence packet discipline.

Out of scope:
1. Runtime feature behavior changes.
2. Lane B modularization implementation.
3. Lane C regression test creation.
4. Lane D warning/suppression cleanup execution.
5. Lane E docs-index and ADR remediation execution.
6. Standalone `mini-ecosystem/` system docs.

## Lane Boundary Lock (E vs F)
1. Lane E owns broad documentation governance enforcement across docs indexes/changelog/ADR integrity.
2. Lane F owns CI/release policy governance and workflow/release control surfaces.
3. If a CI/release governance update needs generic docs-governance checker expansion, coordinate the checker seam in Lane E and keep policy content seam in Lane F.
4. No mixed Lane E + Lane F mega-PRs.

## Governance Surfaces (Locked)
Lane F CI/release governance targets:
1. `.github/workflows/ci.yml`
2. `.github/workflows/media-storage-deploy-gate.yml`
3. `.github/workflows/conversation-state-hardening-gate.yml`
4. `.github/workflows/apply-conversation-state-migration-028.yml`
5. `.github/pull_request_template.md`
6. `.github/CODEOWNERS`
7. `docs/planning/ci-policy-checks.md`
8. `docs/release-checklist.md`
9. `docs/deployment.md`
10. `scripts/run_repo_sweep.sh`
11. `scripts/ci_npm_ci_with_retry.sh`
12. `.github/dependabot.yml`
13. `docs/planning/evidence/docs/2026-02-20-branch-protection-required-check-mapping.md`
14. `docs/planning/evidence/docs/2026-02-21-stg-06-prototype-waiver.md`
15. `docs/operator-map.md`
16. `docs/planning/lane-f-contact-map-2026-03-16.md`

Lane F excluded historical surfaces by default:
1. `docs/archive/**`
2. `docs/planning/evidence/**` except explicitly listed governance evidence artifacts.
3. `mini-ecosystem/**`

## No-Bloat Controls (Mandatory)
1. Prefer extending existing CI/policy docs and scripts over adding parallel governance frameworks.
2. No broad workflow rewrites when a targeted policy seam can be isolated.
3. No required-check/job-ID renames without same-PR policy-doc updates and explicit migration note.
4. Any temporary waiver/exception must include owner, reason, expiration trigger, and evidence reference.
5. No mixed runtime-feature scope in Lane F governance PRs.

## Implementation Phases
### F0: Baseline Lock
1. Publish Lane F master plan, tracker spec, and evidence namespace.
2. Wire Lane F artifacts into roadmap/tracker/docs indexes.
3. Freeze non-goals, rollback posture, and lane-boundary constraints.
4. Capture baseline snapshots:
   - CI job inventory,
   - required-check catalog,
   - mode variable state,
   - ruleset/branch-protection API access state,
   - environment protection state,
   - environment namespace inventory.

### F1: CI Inventory And Required-Check Contract
1. Enforce exact parity between workflow job inventory and `docs/planning/ci-policy-checks.md`.
2. Ensure required-check names remain unique, stable, and mapped to exact job IDs.
3. Add deterministic change-control rules for job-ID renames and required-check migration windows.
4. Ensure PR template checklists and release checklist commands reflect canonical CI policy.
5. Add explicit policy coverage for `agent_rollback_verification` and its mode variable contract.

### F2: Plan-Limited Enforcement Model
1. Formalize compensating controls while branch/ruleset enforcement remains plan-limited:
   - manual evidence cadence,
   - explicit blocker state for production-readiness signoff,
   - two-green-cycle proof requirements after policy changes.
2. Keep plan-tier assumptions explicit and date-stamped; prevent silent drift from stale waiver docs.
3. Define promotion path to fully enforceable branch/ruleset controls if repository plan changes.
4. Keep evidence fallback explicit when GitHub API calls are unavailable (UI/manual capture path).

### F3: Workflow Reliability Controls
1. Define and enforce workflow `concurrency` posture for CI churn control and stale-run cancellation strategy.
2. Normalize trigger policy clarity (`pull_request`, `push`, `workflow_dispatch`) and skip semantics to avoid ambiguous required-check state.
3. Add merge-queue readiness policy:
   - if merge queue is adopted later, required-check workflows must include `merge_group`.
4. Keep workflow reliability controls documented in CI policy artifacts and release checklist.

### F4: Workflow Supply-Chain Hardening
1. Define phased action pinning policy:
   - phase A: inventory + ownership + update procedure,
   - phase B: pin high-risk third-party actions to full SHA,
   - phase C: expand pinning posture to all eligible actions with controlled exceptions.
2. Keep update/rotation guidance explicit for pinned actions and rollback-safe.
3. Track pinning exceptions with owner and sunset criteria.
4. Keep Dependabot policy aligned with pinning rollout so update hygiene remains actionable.

### F5: Environment Protection And Release Gates
1. Define required environment protection baseline for `staging` and `production`:
   - required reviewers policy,
   - deployment branch policy,
   - release gate dependencies.
2. Keep deployment route parity and media-storage deploy gate contracts synchronized with release checklist and deployment runbook.
3. Ensure environment and deployment policy docs are explicit about current enabled vs planned protections.
4. Normalize environment namespace conventions (single canonical `staging` and `production` naming policy) to reduce operator targeting errors.

### F6: Ownership And Convergence
1. Normalize owner identity across:
   - `docs/operator-map.md`,
   - `docs/planning/lane-f-contact-map-2026-03-16.md`,
   - `.github/CODEOWNERS`,
   - CI policy ownership fields.
2. Promote Lane F policy checks from advisory drift tracking to enforce posture where repository constraints allow.
3. Close Lane F only when CI/release governance drift metrics are stable and evidence-complete.

## Exit Criteria
1. Lane F artifacts are published and indexed:
   - master plan,
   - tracker spec,
   - contact map,
   - evidence index.
2. CI policy inventory drift count is `0`.
3. Required-check catalog and job-ID mapping drift count is `0`.
4. Local sweep/release helper policy surfaces are synchronized with CI/release governance docs.
5. Plan-limited enforcement compensating controls are current, explicit, and evidence-backed.
6. Workflow reliability policy (including concurrency and merge-queue readiness posture) is documented and implemented for in-scope workflows.
7. Workflow action pinning policy is implemented to the lane-approved phase target with tracked exceptions only.
8. Environment protection and environment-namespace policy state for `staging` and `production` is explicitly documented and synchronized with release/deployment docs.
9. Ownership identity drift across operator/contact/CODEOWNERS surfaces is `0` or explicitly mapped through an approved canonical-identity policy.
10. `npm -C frontend run docs:check` passes for two consecutive green cycles after Lane F enforcement updates.

## Merge Gates
Per slice:
1. `npm -C frontend run docs:check`
2. `npm -C frontend run lint` (when scripts/workflows/templates are touched)
3. `npm -C frontend run type-check` (when scripts/workflows/templates are touched)
4. `npm -C frontend run build` (when frontend/tooling surfaces are touched)

Lane-level final gate:
1. `npm -C frontend run docs:check`
2. `gh variable list` snapshot attached in evidence for policy-mode validation (or manual UI fallback evidence when CLI/API access is unavailable).
3. `gh run list --workflow ci.yml --limit 20` snapshot attached in evidence for post-change green-cycle verification (or manual run-capture fallback when CLI/API access is unavailable).

## Assumptions And Defaults
1. Lane F enforces release/CI discipline and does not add product/runtime capability.
2. Branch/ruleset enforcement is currently plan-limited for this private repository and must be handled with explicit compensating controls.
3. Any waiver is temporary and must include owner, date, unblock criterion, and evidence reference.
4. Lane F updates should ship in the same PR as affected CI/policy surfaces.
