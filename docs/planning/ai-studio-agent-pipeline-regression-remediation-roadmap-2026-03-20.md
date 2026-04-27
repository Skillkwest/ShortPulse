# AI Studio Agent Prompt-Compiler Hardening Master Roadmap

Date: 2026-03-20  
Authority: Working  
Owner: AI Platform + Frontend + Platform Ops  
Status: active

## Summary
This document is the master roadmap for hardening the AI Studio multimodal agent into a deterministic prompt-compiler system.  
It locks architecture decisions, operating constraints, and workstream sequencing before phase-level implementation planning.

Program links:
1. Master tracker: `docs/planning/ai-studio-agent-pipeline-regression-remediation-tracker-2026-03-20.md`
2. Evidence index: `docs/planning/evidence/agent-pipeline-remediation/README.md`
3. Master evidence folder: `docs/planning/evidence/agent-pipeline-remediation/master/`
4. Threshold contract: `docs/planning/ai-studio-agent-pipeline-regression-threshold-contract-2026-03-20.md`
5. Authority precedence addendum: `docs/planning/ai-studio-agent-pipeline-regression-authority-precedence-addendum-2026-03-20.md`
6. Tracker gate clarification: `docs/planning/ai-studio-agent-pipeline-regression-tracker-gate-clarification-2026-03-20.md`
7. Environment label normalization: `docs/planning/ai-studio-agent-pipeline-regression-environment-label-normalization-2026-03-20.md`
8. Supporting docs plan: `docs/planning/ai-studio-agent-pipeline-regression-supporting-docs-plan-2026-03-20.md`

Phase execution plans:
1. Phase 1: `docs/planning/ai-studio-agent-pipeline-regression-phase-1-openai-execution-plan-2026-03-20.md`
2. Phase 2: `docs/archive/planning/ai-studio-agent-pipeline-regression-phase-2-openai-execution-plan-2026-03-20.md`
3. Phase 3: `docs/archive/planning/ai-studio-agent-pipeline-regression-phase-3-openai-execution-plan-2026-03-20.md`
4. Phase 4: `docs/planning/ai-studio-agent-pipeline-regression-phase-4-openai-execution-plan-2026-03-20.md`
5. Phase execution remains gated by master workstream criteria and phase-specific entry gates.

Current execution state (2026-03-20):
1. Phase 2: complete (staging scope).
2. Phase 3: complete (staging scope).
3. Phase 4: not started; production rollout remains deferred under active staging-only directive.

## Objective
Build a reliable multimodal prompt-compiler pipeline where:
1. Outputs are strict, versioned IR objects (not free-form chat artifacts).
2. Safety, refusal, fallback, and error outcomes are machine-distinguishable.
3. Canonical prompt state is continuity-safe across sessions, modes, and failures.
4. Runtime policy/config precedence is explicit, testable, and rollback-safe.

## Non-Goals
1. No broad AI Studio UI redesign.
2. No provider policy bypass strategy.
3. No schema/database migration unless required by a locked workstream gate.

## Decision Locks
1. Compiler IR is the source of truth.
   - Every successful turn must produce schema-valid IR with `schema_version`.
   - Canonical state is committed only from validated IR.
2. Structured output contracts are strict-by-default.
   - Schema objects use explicit required/optional rules and `additionalProperties: false`.
   - Invalid IR is repaired via bounded retry, then fails closed with deterministic reason codes.
3. Orchestration is code-first with specialist lanes.
   - Interpreter lane (intent, constraints, image facts).
   - Renderer/compiler lane (canonical prompt assembly).
   - Validator/repair lane (schema/policy/contract enforcement).
4. Multimodal untrusted-content isolation is mandatory.
   - OCR/caption/image-derived text is treated as hostile data.
   - Untrusted content cannot become instructions or control-plane input.
5. Outcome taxonomy is standardized.
   - `decision`, `reason_code`, and `retryable` are required machine fields for refusal/fallback/error behavior.
6. Runtime precedence is explicit and test-backed.
   - Precedence order is locked and validated by deterministic tests.
   - Cache keys include prompt/schema/control-plane version signals to prevent silent drift.
7. Rollout control uses canary thresholds and rollback triggers.
   - Schema failure delta, fallback delta, false-refusal delta, and repair-rate delta are release gates.

## Master Workstreams

### WS-1 IR Contract And Schema Governance
Targets:
1. Canonical IR schema definition and versioning policy.
2. Strict validation/repair/fail-closed behavior contract.
3. Schema migration playbook (backward compatibility, translators, canary gates).

Exit criteria:
1. IR contract approved with examples.
2. Schema compliance tests and migration tests defined.
3. Rollback path for schema changes documented.

### WS-2 Orchestration And Canonical Continuity
Targets:
1. Manager-plus-specialist orchestration boundaries.
2. Transactional canonical commit rules (no commit on fallback/error/invalid IR).
3. Session/mode continuity invariants across edit loops and image-only turns.

Exit criteria:
1. Continuity invariants approved.
2. State transition matrix and tests defined.
3. Canonical pollution prevention rules locked.

### WS-3 Safety And Policy Envelope
Targets:
1. OpenAI policy envelope matrix (policy layer + empirical runtime layer for current scope).
2. Precheck scope contract for user/canonical/context/reference handling.
3. Shared refusal/fallback reason taxonomy contract.

Exit criteria:
1. Envelope matrix approved for allowed and disallowed classes.
2. Precheck scope and enforcement modes approved.
3. Cross-route reason code contract approved.

### WS-4 Reliability, Latency, And Cost Lanes
Targets:
1. Interactive vs async lane design (priority vs batch/flex style workloads).
2. Stage-splitting experiment plan (fast validator + strong compiler).
3. Prompt/schema caching strategy with version-safe keys.

Exit criteria:
1. Experiment matrix and success thresholds defined.
2. Runtime lane routing policy approved.
3. Cache key and invalidation policy approved.

### WS-5 Evaluation And Adversarial Defense
Targets:
1. Compiler-specific eval suite (schema, fidelity, continuity, refusals).
2. Multimodal prompt-injection adversarial corpus design.
3. Production-trace mining loop for continuous corpus expansion.

Exit criteria:
1. CI eval gates and thresholds approved.
2. Adversarial classes and red-team workflow documented.
3. Daily/weekly evaluation cadence approved.

### WS-6 Rollout Governance And Observability
Targets:
1. Control-plane precedence proof tests.
2. Canary monitoring and rollback SOP thresholds.
3. Telemetry requirements for reason codes, policy decisions, and repair paths.

Exit criteria:
1. Precedence and canary gates approved.
2. Rollback drill requirements approved.
3. Operational dashboards/alerts contract approved.

## Sequencing
1. Master baseline lock:
   - Finalize WS-1 through WS-3 contracts.
2. System hardening design lock:
   - Finalize WS-4 and WS-5 experiment/eval contracts.
3. Rollout governance lock:
   - Finalize WS-6 canary/rollback and observability contracts.
4. Phase planning:
   - Rebaseline phase execution plans against master decision locks.
   - Start each phase when that phase's entry gates and referenced master rows are approved (or explicitly waived).
   - For phases after Phase 1, require prior phase closeout row completion (or explicit waiver) before starting the next phase.
5. Phase execution closeout:
   - Complete phase closeout rows (`PX-01` through `PX-04`) with linked evidence.
   - Do not treat a phase as complete without corresponding master-tracker closeout row completion.

## Definition Of Done (Master Level)
1. All master workstreams have approved contracts and measurable gates.
2. Master tracker rows are fully linked to evidence artifacts.
3. Phase planning can proceed without unresolved architecture/policy ambiguity.
4. Phase execution can proceed when the active phase entry gates and referenced master rows are satisfied (or explicitly waived).
5. Phase completion is recognized only when matching phase closeout rows are complete in the master tracker.

## Done-State Clarification (Current Staging Directive)
1. The master definition above remains the full-program closeout contract.
2. For the current staging-only execution directive, task completion is controlled by:
   - `docs/planning/ai-studio-agent-pipeline-regression-remediation-tracker-2026-03-20.md` section `Task Done State (Staging Scope Directive)`.
3. Under this directive, implementation work stops once the tracker-defined staging done state is satisfied and marked `Done (Staging Scope)`.
