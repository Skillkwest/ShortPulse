# Generation Reliability Hardening Master Roadmap (2026-03-20)

Last updated: 2026-03-20  
Status: active  
Companion plan: `docs/planning/generation-reliability-hardening-master-plan-2026-03-20.md`  
Companion tracker: `docs/planning/generation-reliability-hardening-master-tracker-2026-03-20.md`

## Purpose
Provide one canonical sequencing document for reliability hardening work focused on scheduler/control-plane health, bounded recovery behavior, and operations governance.

## Program Outcomes
1. No silent scheduler outages for critical generation-control jobs.
2. Faster detection and response for stuck/aged generation states.
3. Deterministic operator actions for callback drift, provider throttling, and stale reservations.
4. Quantified reliability posture through stable SLO/SLI reporting.

## Workstream Catalog
| Workstream | Scope | Primary Output | Status |
| --- | --- | --- | --- |
| WR-1 Reliability SLO/SLI Contract | Metrics, thresholds, severity policy, burn-rate posture | Locked reliability scorecard contract | Completed |
| WR-2 Supabase Control-Plane Diagnostics | `pg_cron` + `pg_net` checks, alert semantics, evidence retention | Canonical control-plane runbook bundle | Completed |
| WR-3 Scheduler Policy Hardening | Cadence, ownership, route parity discipline, secret-rotation safety | Stable scheduler operations contract | Completed |
| WR-4 State/Idempotency Governance | Transition matrix, duplicate-handling rules, CAS invariants | Deterministic state-ownership contract | Completed |
| WR-5 Retry/Timeout/Quarantine Policy | Failure taxonomy, lease/deadline calibration, poison isolation | Bounded retry and quarantine policy | Completed |
| WR-6 Fairness And Load Management | Per-tenant/provider controls, jitter policy, backlog response | Capacity and starvation-prevention policy | Completed |
| WR-7 Game-Day And Incident Readiness | Drill matrix, pass/fail rules, closeout scorecard | Operational reliability certification | Completed |

## Sequencing Model
1. `S0 Planning Lock`
   - Finalize WR-1 baseline metrics and reliability acceptance criteria.
2. `S1 Control-Plane Lock`
   - Execute WR-2 and WR-3 before deeper state-policy changes.
3. `S2 State Safety Lock`
   - Execute WR-4 and WR-5 with deterministic transition and quarantine controls.
4. `S3 Capacity/Resilience Lock`
   - Execute WR-6 with fairness and load-shedding contracts.
5. `S4 Operational Certification`
   - Execute WR-7 and publish closeout with residual-risk register.

## Dependency Rules
1. WR-1 is required before all downstream workstreams.
2. WR-2/WR-3 must complete before scheduler cadence changes are promoted.
3. WR-4 must be locked before WR-5 retry/quarantine execution slices.
4. WR-6 depends on WR-1 + WR-5 to avoid policy conflicts.
5. WR-7 requires at least one completed slice from WR-2 through WR-6.

## Delivery Guardrails
1. One active reliability implementation slice per workstream unless explicitly parallel-safe.
2. No cadence changes without pre-change diagnostic baseline and rollback path.
3. No alert threshold changes without historical false-positive/false-negative review.
4. No quarantine automation enablement before deterministic operator replay policy is published.

## Phase Plan Registry
1. `docs/planning/generation-reliability-hardening-phase-r0-execution-plan-2026-03-20.md`
2. `docs/planning/generation-reliability-hardening-phase-r1-execution-plan-2026-03-20.md`
3. `docs/planning/generation-reliability-hardening-phase-r2-execution-plan-2026-03-20.md`
4. `docs/planning/generation-reliability-hardening-phase-r3-execution-plan-2026-03-20.md`
5. `docs/planning/generation-reliability-hardening-phase-r4-execution-plan-2026-03-20.md`
6. `docs/planning/generation-reliability-hardening-phase-r5-execution-plan-2026-03-20.md`
7. `docs/planning/generation-reliability-hardening-phase-r6-execution-plan-2026-03-20.md`

## Supporting Artifacts
1. `docs/planning/generation-reliability-hardening-provider-contract-matrix-2026-03-20.md`
2. `docs/planning/generation-reliability-hardening-decision-log-2026-03-20.md`
3. `docs/planning/generation-reliability-hardening-risk-register-2026-03-20.md`
4. `docs/planning/generation-reliability-hardening-evidence-packet-template.md`
5. `docs/planning/generation-reliability-hardening-implementation-entry-checklist-2026-03-20.md`
6. `docs/planning/generation-reliability-hardening-fleet-cadence-contract-2026-03-20.md`
7. `docs/planning/generation-reliability-hardening-readiness-state-2026-03-20.md`

## Planning And Implementation Gates
1. Planning progression can run across multiple authored phases for coverage.
2. Runtime implementation is allowed only when completed/waived phase gates and linked evidence are present.
3. Current state: explicit closeout go decision is recorded; implementation may start under the entry checklist contract.
4. Cadence changes and runtime behavior changes remain bound by phase-specific exit criteria and rollback controls.

## Required Validation Set (Roadmap And Tracker Changes)
1. `npm -C frontend run docs:check`
