# Lane F Execution Plan (2026-03-16)

Last updated: 2026-03-17  
Status: Active  
Owner: Engineering  
Master plan: `docs/planning/lane-f-master-plan-2026-03-16.md`  
Tracker spec: `docs/planning/lane-f-tracker-spec-2026-03-16.md`  
Contact map: `docs/planning/lane-f-contact-map-2026-03-16.md`  
Evidence root: `docs/planning/evidence/lane-f/`

## Purpose
Translate Lane F CI/release governance into low-blast-radius execution slices with explicit drift metrics, gate bundles, and closeout evidence.

## Scope Lock
In scope:
1. CI workflow and policy-doc parity contracts.
2. Required-check catalog and job-ID mapping stability.
3. Plan-limited branch/ruleset compensating controls.
4. Workflow reliability/concurrency/trigger governance.
5. Action pinning policy and tracked exceptions.
6. Environment protection and owner-identity policy surfaces.

Out of scope:
1. Runtime feature/API behavior changes.
2. Lane B, C, D, or E implementation work.
3. Broad historical evidence rewrites.
4. `mini-ecosystem/**` governance surfaces unless explicitly promoted.

## Slice Backlog
| Slice ID | Phase | Governance Surface | Primary Goal | Primary Evidence Artifact | Status |
| --- | --- | --- | --- | --- | --- |
| `F0-01` | F0 | Lane F artifact bootstrap | Publish missing execution plan, lock baseline metrics, and wire tracker/index state | `docs/planning/evidence/lane-f/2026-03-17-f0-01-baseline-lock.md` | Completed |
| `F1-01` | F1 | CI inventory and required-check policy | Align workflow job inventory and CI policy docs, including rollback verification coverage | `docs/planning/evidence/lane-f/2026-03-17-f1-01-ci-inventory-required-check-contract.md` | Completed |
| `F2-01` | F2 | Plan-limited enforcement model | Refresh branch/ruleset compensating controls and current waiver posture | `docs/planning/evidence/lane-f/2026-03-17-f2-01-plan-limited-enforcement-model.md` | Completed |
| `F3-01` | F3 | Workflow reliability policy | Document and implement workflow concurrency/trigger posture for active release gates | `docs/planning/evidence/lane-f/2026-03-17-f3-01-workflow-reliability-policy.md` | Not Started |
| `F4-01` | F4 | GitHub Actions supply-chain policy | Establish phased action pinning contract and tracked exception policy | `docs/planning/evidence/lane-f/2026-03-17-f4-01-action-pinning-policy.md` | Not Started |
| `F5-01` | F5 | Environment protection policy | Normalize environment naming/protection policy and release-gate posture docs | `docs/planning/evidence/lane-f/2026-03-17-f5-01-environment-protection-policy.md` | Not Started |
| `F6-01` | F6 | Lane F convergence | Record two green cycles and close out Lane F governance | `docs/planning/evidence/lane-f/2026-03-17-f6-01-lane-f-convergence.md` | Not Started |

Policy:
1. One CI/release governance seam per PR.
2. No mixed runtime/product changes in Lane F slices.
3. Prefer extending existing governance docs/scripts over adding duplicate frameworks.
4. Any waiver or exception must include owner, reason, and sunset criterion.

## Execution Detail
### F0-01 Baseline Lock
Commands:
1. `npm -C frontend run docs:check`

Acceptance:
1. Missing Lane F execution plan is published.
2. Lane F artifacts are indexed in active planning/root docs.
3. Tracker state moves from `Not Started` to `In Progress`.
4. Baseline packet records CI job inventory, action pinning baseline, mode variable state, and current drift targets.

### F1-01 CI Inventory And Required-Check Contract
Acceptance:
1. Active CI job inventory and `docs/planning/ci-policy-checks.md` remain in exact parity for touched surfaces.
2. Required-check/job-ID contract drift is non-increasing.
3. `agent_rollback_verification` and `AGENT_ROLLBACK_VERIFICATION_MODE` are explicitly documented.

### F2-01 Plan-Limited Enforcement Model
Acceptance:
1. Plan-tier/ruleset limitation posture is current and date-stamped.
2. Manual compensating-control evidence path is explicit for required checks and release signoff.
3. Stale waiver text is removed or explicitly superseded.

### F3-01 Workflow Reliability Policy
Acceptance:
1. Workflow concurrency/trigger posture is explicit for touched workflows.
2. Merge-queue (`merge_group`) readiness posture is documented for future adoption.
3. Reliability-policy drift for touched release surfaces is non-increasing.

### F4-01 Action Pinning Policy
Acceptance:
1. Current action inventory and phase target are explicit.
2. Pinning exceptions, if any, are tracked with owner and sunset criterion.
3. Dependabot/update guidance remains actionable after the policy change.

### F5-01 Environment Protection Policy
Acceptance:
1. Canonical `staging` and `production` naming policy is explicit.
2. Current protection state and planned protection state are distinguished.
3. Release/deployment docs remain synchronized with the environment policy.

### F6-01 Lane F Convergence
Outputs:
1. Canonical Lane F convergence command documented.
2. Two consecutive green-cycle records captured.
3. Closeout packet records residuals and rollback posture.

Acceptance:
1. Lane F checker bundle is documented and linked.
2. Tracker rows include complete evidence links.
3. Lane remains open until required CI/release governance contracts are green or explicitly deferred with owner/date.

## Merge Gates (Per Slice)
1. `npm -C frontend run docs:check`
2. `npm -C frontend run lint` (when scripts/workflows/templates are touched)
3. `npm -C frontend run type-check` (when scripts/workflows/templates are touched)
4. `npm -C frontend run build` (when frontend/tooling surfaces are touched)
5. targeted policy or inventory drift checks for touched Lane F surfaces

Lane-level closeout:
1. `npm -C frontend run docs:check`
2. `gh variable list` snapshot attached in evidence (or manual UI fallback evidence)
3. `gh run list --workflow ci.yml --limit 20` snapshot attached in evidence (or manual run-capture fallback)
