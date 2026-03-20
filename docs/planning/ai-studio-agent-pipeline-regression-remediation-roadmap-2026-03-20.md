# AI Studio Agent Pipeline Regression Remediation Roadmap

Date: 2026-03-20  
Authority: Working  
Owner: AI Platform + Frontend  
Status: Active (planning complete, implementation pending)

## Summary
This roadmap defines a short, phased recovery plan for the AI Studio agent regression cluster discovered in March 2026. The target is to restore predictable behavior, remove safety/runtime drift, and lock in testable parity across OpenAI agent lanes.

Program links:
1. Tracker: `docs/planning/ai-studio-agent-pipeline-regression-remediation-tracker-2026-03-20.md`
2. Phase 1 execution plan: `docs/planning/ai-studio-agent-pipeline-regression-phase-1-openai-execution-plan-2026-03-20.md`
3. Phase 2 execution plan: `docs/planning/ai-studio-agent-pipeline-regression-phase-2-openai-execution-plan-2026-03-20.md`

Primary regression themes:
1. Infra fallback is being surfaced in user lanes and is easy to misread as safety refusal.
2. Safety precheck and rewrite policies are inconsistent by route.
3. OpenAI route outcomes are not machine-distinguishable enough for reliable fallback vs refusal diagnosis.
4. Input precheck mutates context/canonical/reference memory fields in ways that can degrade prompt continuity.
5. Local/preview/prod flag precedence is not explicit enough for repeatable diagnostics.

## Goals
1. Restore deterministic, explainable safety/runtime behavior across OpenAI agent lanes.
2. Preserve prompt quality and continuity while keeping safety controls enforceable.
3. Make policy precedence and runtime outcomes observable and testable in CI.
4. Ship with rollback-first operational controls.

## Non-Goals
1. No broad AI Studio UI redesign.
2. No provider migration.
3. No schema redesign unless required by a specific implementation gate.

## Delivery Model
Use phase gates with strict entry and exit criteria. Each phase has its own context pack; do not front-load all research.

## Phase Roadmap

### Phase 1: Stability + Policy Parity
Duration target: 1-2 implementation windows.

Entry criteria:
1. Baseline failures captured with at least 3 representative trace IDs.
2. Flag freeze window declared for safety/runtime env knobs.
3. Golden prompt suite recorded (15-20 prompts with expected route outcomes).

Implementation scope:
1. Apply OpenAI-only scope lock (`studio-agent`, `generate-prompt`, `describe-image`).
2. Separate fallback and refusal machine outcomes clearly in route payloads/telemetry.
3. Align server and client handling using additive machine-readable fields.
4. Defer all `fal-submit` work outside this program.

Validation gates:
1. API route tests for all touched safety lanes.
2. Cross-route parity test on shared prompt corpus.
3. Telemetry verification for refusal vs fallback distinction.
4. OpenAI Phase 1 plan checklist complete (`docs/planning/ai-studio-agent-pipeline-regression-phase-1-openai-execution-plan-2026-03-20.md`).

Exit criteria:
1. No route-level policy drift in parity matrix.
2. Baseline failing traces reproduce expected corrected path.
3. Rollback switch path verified.

### Phase 2: Prompt Quality + Continuity Hardening
Duration target: 1 implementation window.

Entry criteria:
1. Phase 1 parity matrix green.
2. Safety and infra error outcome codes stable.

Implementation scope:
1. Reduce input-precheck blast radius (default user-turn focus; guarded context-field checks).
2. Validate canonical/active/last/reference memory preservation under normal prompt-edit loops.
3. Align client/server safety assumptions to avoid split-brain local behavior.

Validation gates:
1. Quality regression suite over golden prompts (prompt fidelity + continuity).
2. Session-switch and latest-agent-prompt continuity tests.
3. No new false refusals in baseline corpus.
4. OpenAI Phase 2 plan checklist complete (`docs/planning/ai-studio-agent-pipeline-regression-phase-2-openai-execution-plan-2026-03-20.md`).

Exit criteria:
1. Prompt continuity metrics meet baseline or better.
2. No net increase in safety false positives on golden set.

### Phase 3: Operational Hardening + Rollout Guardrails
Duration target: 1 implementation window plus canary observation.

Entry criteria:
1. Phases 1 and 2 fully green.
2. Observability fields confirmed in staging.

Implementation scope:
1. Lock precedence contract (`env`, control plane, defaults) in docs + tests.
2. Add canary/rollback thresholds for safety/refusal/fallback deltas.
3. Add CI enforcement for cross-route policy parity and precedence tests.

Validation gates:
1. Staging canary observation window complete.
2. Rollback drill packet complete.
3. Docs index and SOP references updated.

Exit criteria:
1. Production canary passes thresholds.
2. Rollback drill passes.
3. Tracker closed with evidence links.

## Context Pack Strategy (Phase-by-Phase)
Gather context per phase, not all at once.

### Phase 1 context pack
1. OpenAI route behavior matrix (`studio-agent`, `generate-prompt`, `describe-image`).
2. Current env flag map (`local`, `preview`, `prod`).
3. Failing trace samples with status, code, and telemetry.
4. Current tests that lock route behavior.

### Phase 2 context pack
1. Golden prompt quality baseline.
2. Memory continuity behavior snapshots (session/tool/mode transitions).
3. Client/server safety divergence examples.

### Phase 3 context pack
1. Staging telemetry trend snapshots.
2. CI pass/fail policy checks.
3. Rollback drill evidence packet.

## Risks and Mitigations
1. Risk: correcting policy drift can change currently expected test outcomes.
   - Mitigation: stage-by-stage parity snapshots and explicit contract updates.
2. Risk: prompt quality drops while tightening safety.
   - Mitigation: golden prompt suite with quality acceptance checks.
3. Risk: environment precedence confusion during rollout.
   - Mitigation: explicit precedence table plus automated precedence tests.

## Definition of Done
1. All three phases complete with evidence links in tracker.
2. Cross-route safety parity tests are green in CI.
3. Fallback/refusal outcomes are distinct and reliably diagnosable.
4. Policy precedence is documented, tested, and operationally stable.
