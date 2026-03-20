# AI Studio Agent Prompt-Compiler Hardening Master Tracker

Date: 2026-03-20  
Authority: Working  
Owner: Engineering  
Program Doc: `docs/planning/ai-studio-agent-pipeline-regression-remediation-roadmap-2026-03-20.md`
Threshold Contract: `docs/planning/ai-studio-agent-pipeline-regression-threshold-contract-2026-03-20.md`
Authority Addendum: `docs/planning/ai-studio-agent-pipeline-regression-authority-precedence-addendum-2026-03-20.md`
Gate Clarification: `docs/planning/ai-studio-agent-pipeline-regression-tracker-gate-clarification-2026-03-20.md`
Environment Labels: `docs/planning/ai-studio-agent-pipeline-regression-environment-label-normalization-2026-03-20.md`
Supporting Docs Plan: `docs/planning/ai-studio-agent-pipeline-regression-supporting-docs-plan-2026-03-20.md`
Evidence Root: `docs/planning/evidence/agent-pipeline-remediation/master/`
Phase 1 Plan: `docs/planning/ai-studio-agent-pipeline-regression-phase-1-openai-execution-plan-2026-03-20.md`
Phase 2 Plan: `docs/planning/ai-studio-agent-pipeline-regression-phase-2-openai-execution-plan-2026-03-20.md`
Phase 3 Plan: `docs/planning/ai-studio-agent-pipeline-regression-phase-3-openai-execution-plan-2026-03-20.md`
Phase 4 Plan: `docs/planning/ai-studio-agent-pipeline-regression-phase-4-openai-execution-plan-2026-03-20.md`
Status: Active (master planning complete; Phase 2 closeout complete with staging scope; Phase 3 implementation in progress)

## Master Status Overview
| Workstream | Status | Owner | Entry Gate | Exit Gate | Evidence |
| --- | --- | --- | --- | --- | --- |
| WS-1 IR Contract And Schema Governance | Planned | AI Platform | Master roadmap approved | Schema/version/repair contract approved | `docs/planning/evidence/agent-pipeline-remediation/master/ws-1/` |
| WS-2 Orchestration And Canonical Continuity | Planned | Frontend + AI Platform | WS-1 contract draft available | Canonical continuity invariants approved | `docs/planning/evidence/agent-pipeline-remediation/master/ws-2/` |
| WS-3 Safety And Policy Envelope | In Progress | AI Platform + Platform | WS-1/WS-2 draft assumptions captured | OpenAI envelope and reason taxonomy approved (current scope) | `docs/planning/evidence/agent-pipeline-remediation/master/ws-3/` |
| WS-4 Reliability, Latency, And Cost Lanes | Completed | Platform | WS-1 through WS-3 contracts stable | Experiment matrix and lane policy approved | `docs/planning/evidence/agent-pipeline-remediation/master/ws-4/` |
| WS-5 Evaluation And Adversarial Defense | Completed | Frontend + AI Platform | WS-1 through WS-4 assumptions documented | Eval gates and corpus workflow approved | `docs/planning/evidence/agent-pipeline-remediation/master/ws-5/` |
| WS-6 Rollout Governance And Observability | Completed | Platform Ops + Platform | WS-1 through WS-5 gate drafts available | Canary/rollback/precedence controls approved | `docs/planning/evidence/agent-pipeline-remediation/master/ws-6/` |

## Master Tracker Rows
| ID | Task | Owner | Status | Risk | Validation | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| M-01 | Lock canonical prompt-compiler IR schema (`schema_version`, required fields, strict object policy) | AI Platform | Completed (Phase 1 baseline) | High | Phase 1 additive outcome contract lock + shared type contract + validation pass | `docs/planning/evidence/agent-pipeline-remediation/master/2026-03-20-phase-1-entry-gate-signoff.md` |
| M-02 | Define bounded parse-validate-repair-fail-closed contract for invalid IR | AI Platform | Waived (Phase 1 entry) | High | Formal waiver + carry-forward requirements documented | `docs/planning/evidence/agent-pipeline-remediation/master/2026-03-20-phase-1-entry-gate-signoff.md` |
| M-03 | Define schema migration rules (compatibility windows + translators + canary criteria) | Platform | Planned | Medium | Migration simulation tests + rollback checklist | Pending |
| M-04 | Lock orchestration boundaries (interpreter/renderer/validator contracts) | AI Platform + Frontend | Planned | Medium | Contract tests + payload boundary review | Pending |
| M-05 | Lock canonical continuity commit rules (no commit on fallback/error/invalid IR) | Frontend | Planned | High | Continuity matrix tests + failure-path assertions | Pending |
| M-06 | Define multimodal untrusted-content isolation contract for OCR/caption/image text | AI Platform | Planned | High | Injection regression suite + sink-boundary checks | Pending |
| M-07 | Publish OpenAI policy envelope matrix (policy and empirical layers for current remediation scope) | Platform | Completed | High | Matrix review + nightly matrix validation plan | `docs/planning/evidence/agent-pipeline-remediation/master/ws-3/2026-03-20-m07-openai-policy-envelope-matrix-and-nightly-validation-plan.md` |
| M-08 | Lock refusal/fallback/error reason-code taxonomy and retryability contract | AI Platform | Completed | High | Canonical mapping contract + shared type source lock | `docs/planning/evidence/agent-pipeline-remediation/master/2026-03-20-phase-1-entry-gate-signoff.md` |
| M-09 | Define runtime precedence order and proof tests (env/control-plane/profile/request/killswitch) | Platform | Waived (Phase 1 entry) | High | Formal waiver + carry-forward requirements documented | `docs/planning/evidence/agent-pipeline-remediation/master/2026-03-20-phase-1-entry-gate-signoff.md` |
| M-10 | Define cache key and invalidation contract (prompt/schema/control-plane versioning) | Platform | Completed | Medium | Cache-key parity tests + drift simulation | `docs/planning/evidence/agent-pipeline-remediation/master/ws-4/2026-03-20-m10-cache-key-and-invalidation-contract.md` |
| M-11 | Define latency/cost experiment matrix (fast-validator vs strong-compiler lanes) | Platform + Frontend | Completed | Medium | Experiment report with pass/fail thresholds | `docs/planning/evidence/agent-pipeline-remediation/master/ws-4/2026-03-20-m11-latency-cost-experiment-matrix.md` |
| M-12 | Define compiler-specific eval gates (schema/fidelity/continuity/false-refusal) | Frontend + AI Platform | Completed | High | CI gate definitions + baseline dataset report | `docs/planning/evidence/agent-pipeline-remediation/master/ws-5/2026-03-20-m12-compiler-eval-gates-and-baseline.md` |
| M-13 | Define production-trace adversarial mining loop and corpus promotion rules | AI Platform | Completed | Medium | Corpus lifecycle SOP + sample packet review | `docs/planning/evidence/agent-pipeline-remediation/master/ws-5/2026-03-20-m13-adversarial-trace-mining-and-corpus-promotion.md` |
| M-14 | Define canary thresholds and rollback triggers for compiler-native metrics | Platform Ops | Completed | High | Threshold contract + canary policy doc + rollback drill checklist | `docs/planning/evidence/agent-pipeline-remediation/master/ws-6/2026-03-20-m14-canary-thresholds-and-rollback-drill.md` |
| M-15 | Build master signoff packet enabling phase implementation start and gated execution | Engineering | Planned | High | All M-01 through M-14 complete with evidence | Pending |

## Phase Closeout Rows
| ID | Task | Owner | Status | Risk | Validation | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| PX-01 | Phase 1 closeout packet linked and approved | AI Platform + Frontend | Planned | Medium | Phase 1 exit criteria pass + evidence links complete | Pending |
| PX-02 | Phase 2 closeout packet linked and approved | Frontend + AI Platform | Completed (Staging Scope) | Medium | Phase 2 exit criteria pass + evidence links complete | `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-closeout-packet-staging-scope.md` |
| PX-03 | Phase 3 closeout packet linked and approved | Platform Ops + Platform + AI Platform | In Progress | High | Phase 3 exit criteria pass + evidence links complete | `docs/planning/evidence/agent-pipeline-remediation/phase-3/2026-03-20-phase-3-runtime-scope-telemetry-parity-generate-describe.md` |
| PX-04 | Phase 4 closeout packet linked and approved | Platform Ops + AI Platform + Frontend | Planned | High | Phase 4 exit criteria pass + evidence links complete | Pending |

## Phase Execution Gate
Phase implementation is allowed when:
1. The active phase's documented entry dependencies are complete or explicitly waived with risk signoff.
2. Referenced master rows for the active phase are complete or explicitly waived with risk signoff.
3. Required evidence artifacts for completed/waived dependencies are linked.
4. For phases after Phase 1, the prior phase closeout row (`PX-*`) is complete or explicitly waived.
5. Master roadmap decision locks remain unchanged or have a documented amendment record.

## Current Phase Entry Decisions
1. Phase 1: Ready (2026-03-20)
   - dependencies reviewed in `docs/planning/evidence/agent-pipeline-remediation/master/2026-03-20-phase-1-entry-gate-signoff.md`.
   - `M-01` and `M-08` marked complete; `M-02` and `M-09` explicitly waived for Phase 1 entry with carry-forward requirements.
2. Phase 2: Complete (2026-03-20, staging scope)
   - active evidence packets:
     - `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-precheck-scope-parity-progress.md`
     - `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-continuity-guard-validation.md`
     - `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-quality-refusal-and-runtime-truth-local-baseline.md`
     - `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-runtime-truth-staging-packet.md`
     - `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-golden-quality-false-refusal-comparative-report.md`
     - `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-closeout-packet-staging-scope.md`
   - scope/enforcement parity, local+staging runtime truth, and comparative quality/refusal gates are complete.
   - production runtime-truth capture is deferred by owner directive for this phase and remains a follow-up item.
3. Phase 3: In Progress (started 2026-03-20)
   - dependency check:
     - Phase 1 exit criteria: satisfied.
     - Phase 2 exit criteria: satisfied (staging scope closeout).
     - Staging runtime truth packet: satisfied.
     - Master rows `M-07` through `M-14`: satisfied (`M-07`, `M-08`, `M-10`, `M-11`, `M-12`, `M-13`, `M-14` complete; `M-09` waived).
   - active evidence packets:
     - `docs/planning/evidence/agent-pipeline-remediation/phase-3/2026-03-20-phase-3-runtime-scope-telemetry-parity-generate-describe.md`
     - `docs/planning/evidence/agent-pipeline-remediation/phase-3/2026-03-20-phase-3-precedence-cache-ttl-proof-tests.md`
     - `docs/planning/evidence/agent-pipeline-remediation/phase-3/2026-03-20-phase-3-canary-threshold-decision-utility.md`
     - `docs/planning/evidence/agent-pipeline-remediation/phase-3/2026-03-20-phase-3-rollback-drill-local-dry-run.md`
     - `docs/planning/evidence/agent-pipeline-remediation/phase-3/2026-03-20-phase-3-staging-canary-delta-packet-generator-tooling.md`
   - next gate actions:
     - Capture staging canary delta packet from live telemetry windows (generator tooling landed in Phase 3 evidence).
     - Complete staging rollback drill packet required for `PX-03` closeout.

## PX-02 Timeboxed Closeout Gate (2026-03-20)
1. Timebox:
   - completed in this execution window.
2. Required remaining artifacts:
   - staging runtime-truth packet,
   - approved golden quality + false-refusal comparative report,
   - phase closeout packet with staging scope decision record.
3. Required closeout validation bundle:
   - `npm -C frontend run lint`,
   - `npm -C frontend run type-check`,
   - `npm -C frontend run build`,
   - `npm -C frontend run docs:check`.
4. Completion rule:
   - satisfied; `PX-02` updated to completed with staging scope.

## Program Completion Gate
Program closeout/signoff requires:
1. Master rows `M-01` through `M-15` complete (or explicitly waived with risk signoff).
2. Phase closeout rows `PX-01` through `PX-04` complete with linked evidence.
3. Final signoff packet links all required evidence and validation outcomes.

## Task Done State (Staging Scope Directive)
This section defines the execution stop condition for the current owner directive:
1. Scope lock:
   - staging-only completion target,
   - no production rollout work required for this task.
2. Required completion gates:
   - `PX-03` marked `Completed` with linked evidence,
   - Phase 3 staging canary delta packet captured from live staging telemetry windows,
   - Phase 3 staging rollback drill packet captured and linked,
   - required validation bundle recorded for the closeout update (`lint`, `type-check`, `build`, `docs:check`).
3. Documentation state:
   - tracker status and Phase 3 evidence index updated to show `PX-03` completion and residual follow-ups (if any) explicitly out of scope.
4. Stop-work rule:
   - once all gates above are satisfied, execution status is `Done (Staging Scope)` and no further implementation work is performed unless a new owner directive reopens scope.

## Validation Command Bundle (for Master Planning Artifacts)
1. `npm -C frontend run docs:check`
2. Any row-specific dry-run checks and fixture validations documented in evidence.

## Operational Notes
1. Master tracker rows are architecture and governance gates, not implementation slices.
2. Keep row status changes coupled with evidence links and commit SHA references.
3. Avoid parallel policy/config experiments without explicit row-level signoff.
4. Amendment record (2026-03-20): phase execution uses phase-specific entry gates plus referenced `M-*` rows; full program closeout still requires `M-01` through `M-15` plus `PX-01` through `PX-04`.
5. Simulation usage policy (2026-03-20): run safety simulation matrix as a staging smoke gate at major checkpoints or policy/runtime-plumbing changes only; deterministic tests + golden fixtures remain primary regression gates.
