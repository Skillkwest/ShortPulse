# AI Studio Reference Grid Reliability Master Plan (2026-03-21)

Last updated: 2026-03-21  
Status: Active (P0-P4 plans published; implementation pending)  
Owner: AI Studio Engineering  
Roadmap anchor: `docs/planning/ai-studio-reference-grid-reliability-master-roadmap-2026-03-21.md`  
Tracker anchor: `docs/planning/ai-studio-reference-grid-reliability-master-tracker-2026-03-21.md`  
Tracker spec: `docs/planning/ai-studio-reference-grid-reliability-tracker-spec-2026-03-21.md`

## Summary
This program defines the execution contract to eliminate the reliability gap where generated media appears in assistant/chat preview flows but is missing, delayed, or stuck in the AI Studio Reference Grid.

Primary intent:
1. Make Reference Grid visibility deterministic for generated outputs.
2. Remove false-missing states caused by hydration/decode stalls.
3. Align recovery and failure policies so cards are recoverable before terminal removal.
4. Provide evidence-gated, phased rollout with explicit rollback criteria.

## Program Objectives
1. Fix recovery-path correctness defects that prevent background recovery from running.
2. Unify output authority across preview surfaces and Reference Grid rendering.
3. Harden queue/recovery state handling to prevent premature fail/remove outcomes.
4. Stabilize image hydration/decode behavior so cards converge to renderable media.
5. Lock observability and parity tests before broad rollout.

## Scope Lock
In scope:
1. AI Studio generation lifecycle hooks (`useAiStudioTaskSubmission`, `useAiStudioTasks`, `useAiStudioTaskOrchestration`, output lifecycle cleanup).
2. Output selector-store bridge and decoupled page wiring for Reference Grid.
3. Reference Grid projection, loading-state, hydration queue, and image decode controllers.
4. Queue-status and status-recovery policy semantics in server queue APIs.
5. Test, telemetry, SOP, and ADR updates required to operate the new reliability contract.

Out of scope:
1. New provider integrations unrelated to grid reliability.
2. Broad visual redesign unrelated to loading/hydration state clarity.
3. Full queue-architecture replacement.
4. Mini Ecosystem work.

## Decision Locks
1. Reference Grid card visibility is the reliability source of truth for generation completion UX.
2. Root-cause fixes ship before cosmetic/loading polish.
3. No behavior-changing phase is complete without explicit test and evidence links.
4. Rollout remains flag/guardrail-driven with bounded rollback paths.
5. Publish and execute phase plans sequentially, starting with `P0`, with evidence-gated progression.

## Program Phases
### P0: Recovery And Dispatch Correctness
1. Fix immediate recovery timer cancellation defects.
2. Align queued `not_found` fail policy with age-gated recovery expectations.
3. Prevent premature card removal for still-recoverable runs.

### P1: Data Authority And Surface Parity
1. Remove bubble-vs-grid authority drift in decoupled mode.
2. Lock selector-store parity behavior for card presence timing.
3. Preserve pending/running visibility under microtask coalescing.

### P2: Hydration And Media Convergence
1. Add bounded timeout/fallback for stalled image hydration.
2. Prevent no-`src` indefinite spinner states.
3. Distinguish generation-loading vs hydration-loading visually and in telemetry.

### P3: Recovery Semantics And State Projection
1. Align status-proxy and recovery timing semantics with operator expectations.
2. Tighten queue-status state precedence and stale-running resolution rules.
3. Validate end-to-end lifecycle consistency with overdue running rows.

### P4: Hardening, Rollout, And Closeout
1. Land integration/race tests and evidence packets.
2. Execute bounded canary rollout with promote/hold/rollback gates.
3. Publish residual risk and final closeout state.

## Phase Execution Plan Registry
1. `docs/planning/ai-studio-reference-grid-reliability-phase-p0-execution-plan-2026-03-21.md` (published)
2. `docs/planning/ai-studio-reference-grid-reliability-phase-p1-execution-plan-2026-03-21.md` (published)
3. `docs/planning/ai-studio-reference-grid-reliability-phase-p2-execution-plan-2026-03-21.md` (published)
4. `docs/planning/ai-studio-reference-grid-reliability-phase-p3-execution-plan-2026-03-21.md` (published)
5. `docs/planning/ai-studio-reference-grid-reliability-phase-p4-execution-plan-2026-03-21.md` (published)

## Supporting Artifacts
1. `docs/planning/ai-studio-reference-grid-reliability-decision-log-2026-03-21.md`
2. `docs/planning/ai-studio-reference-grid-reliability-risk-register-2026-03-21.md`
3. `docs/planning/ai-studio-reference-grid-reliability-implementation-entry-checklist-2026-03-21.md`
4. `docs/planning/ai-studio-reference-grid-reliability-readiness-state-2026-03-21.md`
5. `docs/planning/ai-studio-reference-grid-reliability-evidence-packet-template-2026-03-21.md`
6. `docs/planning/evidence/ai-studio-reference-grid-reliability/README.md`

## Merge And Validation Discipline
Per planning slice:
1. `npm -C frontend run docs:check`
2. Include explicit acceptance criteria, risk class, rollback note, and evidence link.

Per implementation slice (phase plans later):
1. `npm -C frontend run lint`
2. `npm -C frontend run build`
3. Targeted tests for touched seams.
4. `npm -C frontend run docs:check`
