# Foundation Lanes Master Roadmap (2026-03-16)

Last updated: 2026-03-17  
Status: active

## Purpose
Provide one canonical roadmap for all foundational hardening lanes so execution stays aligned to:
- no regressions,
- no bloat,
- modular and maintainable architecture,
- enforceable validation and documentation governance.

## Program Outcomes
1. Restore and keep CI/local quality gates green.
2. Reduce structural risk in oversized/high-churn surfaces.
3. Increase regression detection on fragile workflows before behavior changes.
4. Keep docs/SOP/ADR coverage synchronized with code changes.
5. Maintain short-lived, low-risk delivery slices through merge discipline.

## Lane Catalog
| Lane | Name | Scope | Primary Output | Plan Artifact |
| --- | --- | --- | --- | --- |
| A | Gate Recovery + Governance Hardening | Red gate recovery, docs/governance drift, dead-code pass, policy/script alignment | Green baseline and enforceable governance contracts | `docs/archive/planning/lane-a-master-plan-2026-03-16.md` |
| B | Modularization | Responsibility-based splits of oversized hotspots with parity behavior | Smaller modules and reduced coupling | `docs/archive/planning/lane-b-master-plan-2026-03-16.md` |
| C | Regression Armor | Characterization and contract tests for fragile paths | Deterministic regression detection | `docs/planning/lane-c-master-plan-2026-03-16.md` |
| D | Runtime Safety + Stability | Core flow warning removal, risky effect patterns, hard-disable cleanup | Safer runtime behavior and lower regression risk | `docs/archive/planning/lane-d-master-plan-2026-03-16.md` |
| E | Docs + ADR Discipline | SOP/API/architecture/ADR synchronization for core changes | Discoverable and current source-of-truth docs | `docs/archive/planning/lane-e-master-plan-2026-03-16.md` |
| F | Release + CI Discipline | Merge protections, queue policy, required checks, sweep cadence | Repeatable release confidence | `docs/archive/planning/lane-f-master-plan-2026-03-16.md` |

## Parallel Track Catalog
| Track | Name | Scope | Primary Output | Plan Artifact |
| --- | --- | --- | --- | --- |
| P1 | Generation Pipeline Hardening | Submit/dispatch payload contract gate, strict unknown-field policy, queue identity invariants, claim-collision hardening | Fail-closed and test-backed generation pipeline boundaries | `docs/archive/planning/generation-pipeline-hardening-master-plan-2026-03-16.md` |

## Lane Plan Registry
Each lane must maintain one canonical plan artifact linked in the Lane Catalog table. The roadmap and tracker are summary control docs; lane-level execution detail lives in the linked artifact.
Lane-level companion execution plans are allowed for concrete slice sequencing. Current companion:
- Lane A: `docs/archive/planning/lane-a-execution-plan-2026-03-16.md`
- Lane B: `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`
- Lane C: `docs/planning/lane-c-execution-plan-2026-03-16.md`
- Lane D: `docs/archive/planning/lane-d-execution-plan-2026-03-16.md`
- Lane E: `docs/archive/planning/lane-e-execution-plan-2026-03-16.md`
- Lane F: `docs/archive/planning/lane-f-execution-plan-2026-03-16.md`

Parallel tracks follow the same rule and must publish a master plan plus tracker spec before implementation begins.
Current parallel-track companion execution plan:
- P1: `docs/archive/planning/generation-pipeline-hardening-execution-plan-2026-03-16.md`

## Rebuild Method Contract
Any lane/track that proposes from-scratch replacement work must follow:
- `docs/planning/foundation-rebuild-playbook-2026-03-16.md`

Mandatory implications:
1. Rebuild entry criteria must be satisfied before implementation slices open.
2. Explicit do-not-rebuild criteria must be checked and recorded in tracker evidence.
3. Big-bang replacement is disallowed; strangler cutover with rollback is required.

## Sequencing Model
1. `M0 Baseline Lock`: capture baseline runs, freeze Lane A scope, and define non-goals.
2. `M1 Baseline Green`: complete Lane A exit criteria before broad behavior work.
3. `M2 Structural Hardening`: run Lane B with refactor-only slices and parity tests.
4. `M2.5 Pipeline Contract Hardening`: run Track P1 after baseline green; may run parallel to Lane B with seam isolation.
5. `M3 Regression Net Expansion`: run Lane C before touching known-fragile flows.
6. `M4 Runtime + Governance Convergence`: execute Lane D and Lane E updates per slice.
7. `M5 Operationalization`: enforce Lane F rules as ongoing defaults.

## Dependency Rules
1. Lane A is merge-blocking for downstream lanes where baseline checks are required.
2. Lane B refactor slices must not include behavior changes.
3. Lane C characterization tests precede any fragile-path behavior edits.
4. Lane E updates ship in the same PR as contract/surface changes.
5. Lane F policies are permanent, not one-time cleanup tasks.
6. Track P1 must stay isolated from Lane B modularization slices (no mixed PRs).
7. Any from-scratch replacement scope is blocked unless the rebuild playbook contract is satisfied and evidence-linked.

Dependency exception (explicit):
1. Downstream lanes may run prep-only work in parallel with Lane A (audit, seam mapping, fixture authoring, docs).
2. Prep-only parallel work must not merge behavior-changing or baseline-dependent slices until Lane A baseline-green signoff.

## Delivery Guardrails
1. One open PR per lane or parallel track at a time.
2. Small PR slices with explicit acceptance criteria and rollback notes.
3. No new compatibility aliases unless tracked with owner and sunset criterion.
4. No broad suppressions/allowlist expansions without ADR-linked rationale.
5. No docs additions without index updates (`docs/README.md` + section README).

## Task Contract (Required)
Applies to every lane and parallel track slice:
1. Definition of done requires: behavior/API parity (or explicit intent), required gates pass, docs/tracker/evidence parity complete.
2. Micro-audit runs at task close and is same-domain by default (cross-domain only for blockers).
3. Milestone audit runs at lane/phase closeout.
4. Audit budget rule: if more than 2 non-blocking findings appear, stop scope growth and create a follow-up slice.
5. Commit structure rule: keep implementation and audit-fix changes separable (two commits when both exist).
6. Every slice must record audit findings as `blocking`, `non-blocking`, and `deferred` in evidence.

## Required Validation Set
Run this set for foundational lane merges unless a lane-specific waiver is documented:
1. `cd frontend && npm run lint`
2. `cd frontend && npm run type-check`
3. `cd frontend && npm run build`
4. `cd frontend && npm run docs:check`
5. `cd frontend && npm run deadcode:check` (when dead-code scope is touched)
6. `cd frontend && npm run check:size-budget` (or documented temporary exception)
7. `cd frontend && npm run validate` (required when Lane A gate-recovery slices merge)

## Evidence Policy
Each lane slice must record:
1. commands run,
2. pass/fail outcome,
3. scope touched,
4. rollback note,
5. follow-up debt (if any) with owner.

Use the companion tracker:
- `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`
