# AI Studio Reference Grid Reliability Phase P3 Execution Plan (2026-03-21)

Date: 2026-03-21  
Authority: Working  
Owner: AI Studio Engineering  
Status: Planned (implementation gated on P2 closeout)

## Summary
Phase `P3` aligns recovery semantics and state projection so queue status, status-proxy recovery kicks, and overdue-running reconciliation resolve to one deterministic contract.

Primary objective:
1. Align status-proxy recovery timing semantics with operator expectations.
2. Lock queue-status state precedence and client-facing projection rules.
3. Reconcile overdue-running generations with explicit fail/exhaust transitions and evidence.

Master references:
1. `docs/planning/ai-studio-reference-grid-reliability-master-plan-2026-03-21.md`
2. `docs/planning/ai-studio-reference-grid-reliability-master-roadmap-2026-03-21.md`
3. `docs/planning/ai-studio-reference-grid-reliability-master-tracker-2026-03-21.md`
4. `docs/planning/ai-studio-reference-grid-reliability-tracker-spec-2026-03-21.md`
5. `docs/adr/0047-ai-studio-generation-recovery-timing-and-failure-threshold-contract.md`

## Scope Lock
In scope:
1. Queue-status read and response precedence semantics in:
   - `frontend/pages/api/fal/queue-status.ts`
   - `frontend/lib/server/api/generationQueue/service.ts`
2. Status-proxy recovery claim eligibility/timing rules in `frontend/lib/server/api/generationQueue/statusRecoveryKick.ts`.
3. Overdue-running escalation/reconciliation behavior in:
   - `frontend/lib/server/falIntegration/recoveryExecution.ts`
   - `frontend/lib/server/falIntegration/recoveryExecutionRuntime.ts`
   - `frontend/lib/server/falIntegration/recoveryLifecycleTransitions.ts`
4. Client resume projection parity for queue status transitions in:
   - `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts`
   - `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`
5. P3 tracker/evidence closeout updates for rows `RGR-M09` and `RGR-M10`.

Out of scope:
1. P0 recovery scheduling/not-found policy baseline fixes.
2. P1 output-authority/selector-store parity changes.
3. P2 hydration/decode fallback convergence changes.
4. P4 rollout/canary/final-closeout governance work.

## Entry Criteria
1. `P2` exit criteria are complete or explicitly waived with risk signoff.
2. `RGR-M09` and `RGR-M10` are approved for execution.
3. ADR `0047` remains the active recovery timing/threshold contract.
4. P3 evidence packet paths are reserved in the reliability evidence namespace.

## Hard Blockers
1. Do not keep implicit or path-dependent queue-status precedence behavior.
2. Do not close P3 while `RGR-M09` or `RGR-M10` lacks evidence and rollback notes.
3. Do not tune overdue-running transitions without synchronized client/server projection tests.

## Slice Backlog
| Slice ID | Goal | Primary Surfaces | Deliverable | Status |
| --- | --- | --- | --- | --- |
| `P3-S1` | Lock queue-status precedence contract | `queue-status.ts`; `generationQueue/service.ts`; `useAiStudioTaskOrchestration.ts` | Deterministic precedence matrix for `queued/dispatched/failed/not_found` projections | Planned |
| `P3-S2` | Align status-proxy recovery claim timing semantics | `statusRecoveryKick.ts`; `queue-status.ts` | Explicit due/not-due/too-recent claim policy with bounded telemetry-ready outcomes | Planned |
| `P3-S3` | Reconcile overdue-running transitions across recovery engine and client projection | `recoveryExecution.ts`; `recoveryExecutionRuntime.ts`; `recoveryLifecycleTransitions.ts`; orchestration/task hooks | Deterministic running-timeout/exhaustion contract and no-ambiguity client state projection | Planned |
| `P3-S4` | Publish P3 closeout packet and tracker row completion | Planning/evidence namespace docs | `RGR-M09` + `RGR-M10` completion (or waivers) with linked evidence | Planned |

## P3 Execution Tracker Rows
| Slice ID | Phase | Workstream | Surface | Goal | Entry Gate | Exit Gate | Before And After | Targeted Validation | Full Gates | Risk Class | Rollback Note | Runbooks/Docs Updated | Evidence Link | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `P3-S1` | `P3` | `WG-4` | `queue-status.ts`; `generationQueue/service.ts`; `useAiStudioTaskOrchestration.ts` | Lock canonical queue-status precedence and client projection rules | P2 closeout approved; `RGR-M09` planned for kickoff | Queue-status responses and client resume behavior follow one precedence contract without path drift | Before: precedence can vary by route timing and fallback surface. After: deterministic precedence matrix governs server response and client projection. | `tests/api/fal-queue-status.test.ts`; `features/ai-studio/hooks/__tests__/useAiStudioTaskOrchestration.test.ts` | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | High | Revert precedence/projection mapping changes and restore prior status-proxy behavior while retaining evidence | Master tracker + phase plan + diagnostics SOP references | `docs/planning/evidence/ai-studio-reference-grid-reliability/2026-03-21-p3-s1-status-precedence-contract.md` (planned) | Planned |
| `P3-S2` | `P3` | `WG-4` | `statusRecoveryKick.ts`; `queue-status.ts` | Align status-proxy recovery claim timing semantics with ADR contract | `P3-S1` precedence contract drafted; `RGR-M09` in progress | Claim outcomes (`claimed/not_due/too_recent/max_attempts`) are deterministic and bounded by explicit thresholds | Before: timing semantics can appear inconsistent between operator expectation and status-proxy behavior. After: claim policy is explicit, test-backed, and parity-checked. | `lib/server/api/__tests__/statusRecoveryKick.test.ts`; `tests/api/fal-queue-status.test.ts` | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | High | Revert timing-threshold alignment and restore prior claim gates pending further diagnostics | Tracker + risk register + phase plan | `docs/planning/evidence/ai-studio-reference-grid-reliability/2026-03-21-p3-s2-status-proxy-recovery-timing.md` (planned) | Planned |
| `P3-S3` | `P3` | `WG-4` | `recoveryExecution.ts`; `recoveryExecutionRuntime.ts`; `recoveryLifecycleTransitions.ts`; `useAiStudioTasks.ts`; `useAiStudioTaskOrchestration.ts` | Lock overdue-running escalation/reconciliation policy and client-visible lifecycle projection | `P3-S2` policy merged with targeted tests; `RGR-M10` in progress | Overdue-running rows transition through explicit hard-timeout/exhaustion outcomes with matching client projection behavior | Before: long-running rows can remain ambiguous across server transitions and client resume watchers. After: running-timeout/exhaustion semantics are deterministic and projection-safe. | `lib/server/falIntegration/__tests__/recoveryExecution.test.ts`; `lib/server/falIntegration/__tests__/recoveryExecutionRuntime.test.ts`; `lib/server/falIntegration/__tests__/recoveryLifecycleTransitions.test.ts`; `features/ai-studio/hooks/__tests__/useAiStudioTasks.test.ts`; `features/ai-studio/hooks/__tests__/useAiStudioTaskOrchestration.test.ts` | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | High | Revert overdue-running transition policy and client projection coupling changes in reverse merge order | Tracker + readiness notes + phase plan | `docs/planning/evidence/ai-studio-reference-grid-reliability/2026-03-21-p3-s3-overdue-running-reconciliation.md` (planned) | Planned |
| `P3-S4` | `P3` | `WG-4` | Planning/evidence governance surfaces | Publish P3 closeout packet and mark `RGR-M09`/`RGR-M10` complete (or waived) with risk signoff | `P3-S1`..`P3-S3` evidence drafted | Tracker rows complete/waived and dependencies for P4 handoff are explicit | Before: P3 readiness inferred. After: P3 closeout is explicit and auditable. | Evidence completeness review against tracker-spec row schema and checklist | `npm -C frontend run docs:check` | Medium | Revert premature completion status and return rows to `In Progress` pending evidence | Tracker + decision log + readiness state + risk register | `docs/planning/evidence/ai-studio-reference-grid-reliability/2026-03-21-p3-s4-phase-closeout-packet.md` (planned) | Planned |

## Operating Cadence
1. Daily P3 checkpoint: queue-status precedence parity, claim timing behavior, and overdue-running evidence progress.
2. Mid-phase gate: `P3-S1` and `P3-S2` must lock before `P3-S3` closeout begins.
3. Phase closeout gate: `RGR-M09` and `RGR-M10` complete (or waived) before any P4 behavior-change start.

## Required Validation
1. `npm -C frontend run test -- tests/api/fal-queue-status.test.ts`
2. `npm -C frontend run test -- lib/server/api/__tests__/statusRecoveryKick.test.ts`
3. `npm -C frontend run test -- lib/server/falIntegration/__tests__/recoveryExecution.test.ts lib/server/falIntegration/__tests__/recoveryExecutionRuntime.test.ts lib/server/falIntegration/__tests__/recoveryLifecycleTransitions.test.ts`
4. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioTaskOrchestration.test.ts features/ai-studio/hooks/__tests__/useAiStudioTasks.test.ts`
5. `npm -C frontend run lint`
6. `npm -C frontend run build`
7. `npm -C frontend run docs:check`

## Exit Criteria
1. Queue-status precedence semantics are explicit and deterministic across server/client surfaces.
2. Status-proxy recovery claim timing semantics match ADR and operator expectations.
3. Overdue-running rows resolve through bounded, test-backed transition policy with consistent client projection.
4. `RGR-M09` and `RGR-M10` are complete or waived with owner/risk signoff and linked evidence.

## Rollback Posture
1. Revert order:
   - `P3-S3` overdue-running transition/projection changes,
   - `P3-S2` status-proxy timing semantics,
   - `P3-S1` queue-status precedence mapping.
2. If rollback is partial, block P3 closeout until residual risk is documented.

## Risks
1. Precedence-lock changes can reveal latent queue/client projection assumptions.
Mitigation: keep precedence matrix explicit and covered by queue-status + orchestration tests.

2. Running-timeout thresholds can over-fail slow providers.
Mitigation: preserve bounded age/attempt thresholds and use telemetry-backed threshold review.

3. Stronger semantics can increase operator triage complexity during transition.
Mitigation: update diagnostics/runbook references and keep evidence packets mandatory before closeout.
