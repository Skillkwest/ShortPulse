# Generation Reliability Hardening Master Plan (2026-03-20)

Last updated: 2026-03-20  
Status: Active (planning complete; implementation ready)  
Owner: Engineering  
Roadmap anchor: `docs/planning/generation-reliability-hardening-master-roadmap-2026-03-20.md`  
Tracker anchor: `docs/planning/generation-reliability-hardening-master-tracker-2026-03-20.md`  
Tracker spec: `docs/planning/generation-reliability-hardening-tracker-spec-2026-03-20.md`

## Summary
This program defines the reliability and operations hardening contract for the generation pipeline without requiring an immediate queue-system rebuild.

Primary intent:
1. Eliminate silent scheduler/control-plane drift.
2. Keep stuck-work states bounded, observable, and recoverable.
3. Raise operator confidence through deterministic runbooks and evidence gates.

## Program Objectives
1. Establish measurable reliability SLO/SLI contracts for recovery, scheduling, and stale-work age.
2. Harden Supabase `pg_cron` + `pg_net` control-plane diagnostics and alert thresholds.
3. Move from ad-hoc sweeps to policy-driven reconciliation, bounded retries, and deterministic quarantine criteria.
4. Lock callback/webhook idempotency and state-transition contracts before deeper pipeline refactors.
5. Introduce repeatable game-day validation and release-governed reliability closeout.

## Scope Lock
In scope:
1. Reliability planning and governance for:
   - `/api/internal/generation-recovery/run`
   - `/api/internal/admin-user-health-fleet/run`
   - Supabase scheduler controls (`cron.job`, `cron.job_run_details`, Vault secret contracts)
   - `pg_net` response diagnostics and retention/archival policy
2. Runtime policy contracts:
   - SLO/SLI definitions and thresholds
   - retry/timeout class policy
   - quarantine taxonomy and operations rules
3. Ops documentation and validation policy updates required for phase execution.

Out of scope:
1. Immediate replacement of queue architecture or migration to a workflow engine.
2. Product-surface UI redesign.
3. Provider API expansion work unrelated to reliability controls.
4. Broad schema redesign not required by locked reliability slices.

## Decision Locks
1. Reliability work is incremental hardening first; no big-bang orchestration rewrite in this program.
2. Recovery cadence remains high-frequency; fleet cadence can change independently.
3. Control-plane liveness signals are first-class release gates (scheduler alive, job health, dispatch health).
4. Callback handling must remain idempotent and signature-verified; reconciliation remains mandatory backup.
5. Evidence-driven rollout only: every phase requires explicit pass/fail artifacts and rollback notes.

## Program Phases
### R0: Baseline And Governance Lock
1. Freeze reliability scope and non-goals.
2. Publish SLO/SLI candidate set and alert severity model.
3. Confirm canonical ownership and escalation map.

### R1: Control-Plane Observability
1. Lock canonical checks for `pg_cron` missing/inactive/failing/stalled states.
2. Lock canonical `pg_net` failure signatures and evidence retention policy.
3. Define automation surfaces for repeatable diagnostics packets.

### R2: Scheduler Hardening
1. Re-validate scheduler ownership (Supabase Cron + Vault only).
2. Update fleet cadence policy (target hourly) with explicit runbook updates.
3. Keep recovery scheduler high-frequency and validate non-regression.

### R3: State And Idempotency Contracts
1. Publish deterministic transition matrix and compare-and-set requirements.
2. Define unique-key/idempotency constraints for callbacks/artifacts/credit mutations.
3. Lock duplicate/out-of-order callback handling contract.

### R4: Retry/Lease/Quarantine Policy
1. Define retryable vs terminal vs quarantine taxonomy for provider outcomes.
2. Define lease/timeout/deadline calibration method from observed latency percentiles.
3. Define quarantine triage and replay rules.

### R5: Fairness And Load-Shedding Controls
1. Define per-tenant and per-provider fairness controls.
2. Define jitter/stagger policy for cron/reconciliation scans.
3. Define overload response policy (rate-limit and backlog growth handling).

### R6: Validation, Game Days, And Closeout
1. Run provider blackhole/callback outage/throttle surge drills.
2. Validate SLO/SLI operational readiness and alert quality.
3. Publish closeout decision with residual-risk register.

## Phase Execution Plans
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

## Merge And Validation Discipline
Per reliability planning slice:
1. `npm -C frontend run docs:check`
2. Include explicit:
   - acceptance criteria,
   - rollback note,
   - evidence link(s),
   - risk classification.

Program-level closeout gate:
1. All master tracker rows marked `Completed` or explicitly waived with owner + risk signoff.
2. Phase execution plans published for approved next phase(s).
3. Monitoring/runbook docs synchronized with locked contracts.
