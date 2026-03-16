# Foundation Lanes Execution Tracker (2026-03-16)

Last updated: 2026-03-16  
Status: Active  
Roadmap source: `docs/planning/foundation-lanes-master-roadmap-2026-03-16.md`

## Status Legend
- `Not Started`
- `In Progress`
- `Blocked`
- `Completed`

## Program Snapshot
| Lane | Status | Owner | Current Focus | Blockers | Next Checkpoint | Plan Artifact |
| --- | --- | --- | --- | --- | --- | --- |
| A | In Progress | Engineering | Gate recovery + docs/dead-code governance cleanup | `validate`/size/deadcode baseline drift | Lane A phase signoff | `docs/planning/lane-a-master-plan-2026-03-16.md` |
| B | In Progress | Engineering | Ongoing modularization pass (separate execution stream) | Must avoid mixed behavior changes | Next modularization slice closeout | `docs/planning/lane-b-master-plan-2026-03-16.md` |
| C | Not Started | Engineering | Regression armor baseline lock and fragile-path characterization matrix | Awaiting C0 baseline evidence packet | Lane C fragile-path matrix lock | `docs/planning/lane-c-master-plan-2026-03-16.md` |
| D | Not Started | Engineering | Runtime safety and warning/suppression hardening for core hot paths | Awaiting D0 baseline evidence packet | Lane D warning debt baseline lock | `docs/planning/lane-d-master-plan-2026-03-16.md` |
| E | Not Started | Engineering | Docs/SOP/ADR parity and governance contract lock | Awaiting E0 baseline evidence packet | Lane E governance baseline lock | `docs/planning/lane-e-master-plan-2026-03-16.md` |
| F | Not Started | Engineering | Release and CI discipline baseline lock and policy-inventory parity | Awaiting F0 baseline evidence packet | Lane F CI inventory and required-check contract lock | `docs/planning/lane-f-master-plan-2026-03-16.md` |
| P1 | Not Started | Engineering | Separate generation pipeline hardening (submit/dispatch contract + queue reliability) | Must stay isolated from Lane B seam PRs | Contract coverage lock | `docs/planning/generation-pipeline-hardening-master-plan-2026-03-16.md` |

## Lane A Master Checklist
Canonical plan: `docs/planning/lane-a-master-plan-2026-03-16.md`

### A0: Baseline Lock
- [ ] Capture baseline outputs for: `deadcode:check:full`, `lint`, `type-check`, `build`, `test`, `docs:check`.
- [ ] Freeze explicit in-scope files and explicit out-of-scope files.
- [ ] Record rollback posture for each Lane A phase.

### A1: Policy + Validation Gate Recovery
- [ ] Resolve naming guard failures without introducing permanent alias drift.
- [ ] Align scripts with Supabase CLI policy (remove Docker-local Supabase workflow references).
- [ ] Reconfirm `validate` path expectations and blockers.

### A2: Docs/Governance Cleanup
- [ ] Normalize changelog structure and chronology policy enforcement.
- [ ] Repair active index parity (`docs/README.md`, `docs/planning/README.md`, scoped section READMEs).
- [ ] Remove duplicate/stale API/SOP doc rows and stale references.

### A3: Dead-Code Cleanup (Safe Core)
- [ ] Apply isolated dead-file/dependency removals with strict validation gates.
- [ ] Update active docs/skills impacted by removals in same phase.
- [ ] Confirm no behavior-contract regressions in targeted tests.

### A4: Selective Dead-Code Pruning
- [ ] Prune only high-confidence leaf exports/constants.
- [ ] Defer ambiguous/core-orchestration candidates to follow-up audit.
- [ ] Re-run full suite and compare to baseline.

### A5: Lane A Final Signoff
- [ ] Required checks pass.
- [ ] No net increase in warnings for touched surfaces.
- [ ] Follow-up debt list captured with owners and sunset criteria.

## Lane Slice Template (Copy Per PR)
### Slice ID
- `lane`:  
- `phase`:  
- `owner`:  
- `date`:  

### Scope
- Files/modules:
- Explicit non-goals:

### Validation
- Commands run:
- Results:

### Rollback
- Revert strategy:
- Trigger conditions:

### Follow-Ups
- Debt items:
- Owner:
- Target date:

## Required Gate Bundle (Default)
1. `cd frontend && npm run lint`
2. `cd frontend && npm run type-check`
3. `cd frontend && npm run build`
4. `cd frontend && npm run docs:check`
5. `cd frontend && npm run validate` (for Lane A gate recovery slices)

## Lane B Artifacts
1. Master plan: `docs/planning/lane-b-master-plan-2026-03-16.md`
2. Tracker spec: `docs/planning/lane-b-tracker-spec-2026-03-16.md`

## Lane C Artifacts
1. Master plan: `docs/planning/lane-c-master-plan-2026-03-16.md`
2. Tracker spec: `docs/planning/lane-c-tracker-spec-2026-03-16.md`
3. Execution plan: `docs/planning/lane-c-execution-plan-2026-03-16.md`

## Lane D Artifacts
1. Master plan: `docs/planning/lane-d-master-plan-2026-03-16.md`
2. Tracker spec: `docs/planning/lane-d-tracker-spec-2026-03-16.md`
3. Execution plan: `docs/planning/lane-d-execution-plan-2026-03-16.md`
4. Evidence index: `docs/planning/evidence/lane-d/README.md`

## Lane E Artifacts
1. Master plan: `docs/planning/lane-e-master-plan-2026-03-16.md`
2. Tracker spec: `docs/planning/lane-e-tracker-spec-2026-03-16.md`
3. Evidence index: `docs/planning/evidence/lane-e/README.md`

## Lane F Artifacts
1. Master plan: `docs/planning/lane-f-master-plan-2026-03-16.md`
2. Tracker spec: `docs/planning/lane-f-tracker-spec-2026-03-16.md`
3. Contact map: `docs/planning/lane-f-contact-map-2026-03-16.md`
4. Evidence index: `docs/planning/evidence/lane-f/README.md`

## Lane C Master Checklist
Canonical plan: `docs/planning/lane-c-master-plan-2026-03-16.md`  
Concrete sequencing: `docs/planning/lane-c-execution-plan-2026-03-16.md`

### C0: Baseline Lock
- [ ] Capture baseline outputs for `lint`, `type-check`, `build`, `docs:check`, `test`.
- [ ] Freeze Lane C non-goals and fragile-path inventory scope.

### C1: Characterization Capture
- [ ] Capture one failing and one passing Styles-drop payload packet.
- [ ] Convert capture packets into fixture-backed regression tests before behavior edits.

### C2-C5: Contract Armor
- [ ] Lock generation/recovery/billing fragile-path command bundles.
- [ ] Lock shared-browser isolation and adaptive cross-surface parity bundles.
- [ ] Lock internal operational route/auth contract bundles.

### C6: Convergence
- [ ] Publish required Lane C command bundle for fragile-path PRs.
- [ ] Attach all required evidence packets under `docs/planning/evidence/lane-c/`.

## Lane D Master Checklist
Canonical plan: `docs/planning/lane-d-master-plan-2026-03-16.md`  
Tracker contract: `docs/planning/lane-d-tracker-spec-2026-03-16.md`  
Concrete sequencing: `docs/planning/lane-d-execution-plan-2026-03-16.md`

### D0: Baseline Lock
- [ ] Capture baseline outputs for `lint`, `type-check`, `build`, `docs:check`, and `test`.
- [ ] Capture warning and suppression inventory for Lane D runtime seams.
- [ ] Freeze Lane D non-goals and rollback posture.

### D1-D2: Effect/Suppression Hardening
- [ ] Resolve active `react-hooks/set-state-in-effect` warnings in scoped production seams.
- [ ] Remove scoped suppression debt where equivalent safe behavior can be preserved.
- [ ] Add/extend targeted tests for touched seams.

### D3-D4: Hard-Disable + Logging Hygiene
- [ ] Replace unconditional emergency hard-disable branches with governed controls or retire dead fallback code.
- [ ] Gate runtime debug/audit console logging to explicit audit lanes.
- [ ] Record kill-switch delta and rollback notes for each slice.

### D5: Convergence
- [ ] Publish Lane D runtime safety command bundle and evidence references.
- [ ] Attach all required evidence packets under `docs/planning/evidence/lane-d/`.
- [ ] Confirm warning/suppression targets are closed or deferred with owner/date.

## Lane E Master Checklist
Canonical plan: `docs/planning/lane-e-master-plan-2026-03-16.md`  
Tracker contract: `docs/planning/lane-e-tracker-spec-2026-03-16.md`

### E0: Governance Bootstrap
- [ ] Capture baseline outputs for `docs:check` and scoped validation commands.
- [ ] Wire Lane E artifacts in roadmap/tracker/docs indexes.
- [ ] Freeze Lane E non-goals and rollback posture.

### E1: Index Parity Contract
- [ ] Lock active index parity for scoped root/section indexes.
- [ ] Define explicit allowlist/sunset policy for intentional exclusions only.
- [ ] Record before/after drift counts in tracker evidence.

### E2-E3: ADR + Policy Contract
- [ ] Resolve ADR inventory integrity drift (including duplicate-number handling).
- [ ] Align active policy docs/templates/scripts to one Supabase operations contract.
- [ ] Keep archive/evidence docs excluded from active-surface enforcement unless explicitly promoted.

### E4-E5: Changelog + Convergence
- [ ] Normalize changelog structure so chronology and non-future-date checks are enforceable.
- [ ] Promote Lane E checks to enforce mode after required green cycles.
- [ ] Attach all required evidence packets under `docs/planning/evidence/lane-e/`.
- [ ] Confirm Lane E exit metrics are all `0` drift (or explicit tracked exclusions only).

## Lane F Master Checklist
Canonical plan: `docs/planning/lane-f-master-plan-2026-03-16.md`  
Tracker contract: `docs/planning/lane-f-tracker-spec-2026-03-16.md`

### F0: Baseline Lock
- [ ] Capture baseline snapshots for CI job inventory, required-check mapping, mode variables, ruleset/branch-protection API state, and environment protection state.
- [ ] Wire Lane F artifacts in roadmap/tracker/docs indexes.
- [ ] Freeze Lane F non-goals and rollback posture.

### F1-F2: CI Inventory + Plan-Limited Enforcement Contract
- [ ] Eliminate CI inventory drift between `.github/workflows/*.yml` and `docs/planning/ci-policy-checks.md`.
- [ ] Add missing `agent_rollback_verification` + mode-variable policy coverage in CI policy docs.
- [ ] Lock required-check/job-ID mapping contract and change-control procedure.
- [ ] Publish explicit compensating controls for plan-limited branch/ruleset enforceability.

### F3-F5: Reliability + Supply Chain + Environment Protection
- [ ] Define and apply workflow reliability policy (including concurrency posture and merge-queue readiness policy).
- [ ] Implement phased workflow action pinning policy and exception tracking.
- [ ] Align environment protection and deployment-gate policy state across release/deployment docs.
- [ ] Define canonical environment namespace policy (`staging`/`production`) and resolve naming-variant drift.

### F6: Ownership + Convergence
- [ ] Normalize ownership identity across operator map/contact map/CODEOWNERS surfaces.
- [ ] Attach all required evidence packets under `docs/planning/evidence/lane-f/`.
- [ ] Confirm Lane F exit criteria with two post-change green cycles.

## Parallel Track Artifacts
1. Master plan: `docs/planning/generation-pipeline-hardening-master-plan-2026-03-16.md`
2. Tracker spec: `docs/planning/generation-pipeline-hardening-tracker-spec-2026-03-16.md`
3. Contact map: `docs/planning/generation-pipeline-hardening-contact-map-2026-03-16.md`

## Notes Log
### 2026-03-16
- Tracker initialized to coordinate foundational lanes across governance, modularization, and regression-armor workstreams.
- Added separate Track P1 (generation pipeline hardening) with dedicated plan/tracker/contact artifacts and lane-boundary isolation from Lane B modularization.
- Added Lane C plan/tracker artifacts and updated program snapshot with a concrete Lane C checkpoint path.
- Added Lane C concrete execution plan artifact and lane-specific evidence packet index.
- Added Lane D master plan/tracker artifacts, connected roadmap/tracker references, and seeded a Lane D evidence namespace.
- Added Lane D concrete execution plan artifact and linked it across roadmap/tracker/index surfaces.
- Added Lane E master plan/tracker artifacts, connected roadmap/tracker/index surfaces, and seeded a Lane E evidence namespace.
- Added Lane F contact map artifact to seed owner/escalation routing for release and CI discipline planning.
- Added Lane F master plan/tracker artifacts and seeded a Lane F evidence namespace for CI/release governance execution.
