# AI Studio Agent Modularization Tracker

Date: 2026-02-21
Authority: Working
Owner: Engineering
Program Doc: `docs/planning/ai-studio-agent-modularization-program.md`

## Status Overview
Execution note:
Phase dates in the program doc are target windows. Guardrail setup and initial strangler extraction were pulled forward on 2026-02-21 to reduce regression risk before deeper modularization.

| Phase | Status | Owner | Start | Target End | Gate | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Phase 0: Contract Freeze | Completed | AI Platform | 2026-02-23 | 2026-02-25 | schema source-of-truth locked | `docs/planning/evidence/agent/phase-0/` |
| Phase 1: Correctness Hardening | Completed | AI Platform + Frontend | 2026-02-26 | 2026-03-06 | audit-delta defects closed | `docs/planning/evidence/agent/phase-1/` |
| Phase 2: Strangler Consolidation | Completed | AI Platform | 2026-02-21 | 2026-03-20 | no logic duplication across 3 routes | `docs/planning/evidence/agent/phase-2/` |
| Phase 3: Modularization Pass | Completed | Frontend | 2026-03-23 | 2026-04-03 | size budget pass or ADR exceptions | `docs/planning/evidence/architecture/` |
| Phase 4: Guardrails + Governance | In Progress | Platform + DevEx | 2026-02-21 | 2026-04-10 | enforce mode stable for 2 cycles | `docs/planning/evidence/agent/phase-4/` |
| Phase 5: Progressive Rollout | Planned | AI Platform + Ops | 2026-04-13 | 2026-04-24 | all canary rings pass | `docs/planning/evidence/agent/phase-5/` |
| Phase 6: Legacy Decommission | Planned | AI Platform | 2026-04-27 | 2026-05-01 | 14-day zero first-party traffic | `docs/planning/evidence/agent/phase-6/` |

## Execution Checklist

### Phase 0: Contract Freeze
- [x] Lock canonical route schema in one TS source.
- [x] Lock request validation and error envelope shape.
- [x] Capture baseline characterization snapshots.
- [x] Publish stop-the-line criteria + incident packet template.

Exit validation:
- [x] Contract doc approved.
- [x] Baseline tests green.
- [x] Traceability links added.

### Phase 1: Correctness Hardening
- [x] Enforce `user|assistant` roles at API boundary.
- [x] Enforce `https` media-only server payload policy.
- [x] Require stable `clientSessionKey` from client.
- [x] Enforce request body-size limits and return `413` on breach.
- [x] Add per-user studio-agent throttling.
- [x] Align client/server feature-enable semantics.
- [x] Add regression tests for disable-path and continuity.
- [x] Update SOP/docs in same PR train.

Exit validation:
- [x] All audit-delta defects closed.
- [x] CI checks green.
- [x] Doc/runtime/schema parity pass.

### Phase 2: Strangler Consolidation
- [x] Introduce `AgentRuntimeService` internal entrypoints.
- [x] Route `/generate-prompt` through runtime adapter.
- [x] Route `/describe-image` through runtime adapter.
- [x] Keep external contracts stable in compatibility mode.
- [x] Emit deprecation + sunset headers on legacy routes.

Exit validation:
- [x] No duplicated business logic among AI routes.
- [x] Compatibility tests pass.
- [x] Migration report published.

### Phase 3: Modularization Pass
- [x] Slice 1: extract studio-agent route envelope + turn-response modules.
- [x] Slice 2: extract studio-agent OpenAI gateway + canonical persistence modules.
- [x] Slice 3: extract studio-agent vision summary module.
- [x] Slice 4: extract studio-agent thinker/formatter V2 turn module.
- [x] Slice 5: extract studio-agent fast-path turn module.
- [x] Slice 6: extract studio-agent telemetry and route-outcome helpers.
- [x] Slice 7: extract studio-agent coordinator shell for fast-path/v2 orchestration.
- [x] Slice 8: extract `useAiAgent` transport/session/store/action-normalizer modules.
- [x] Slice 9: extract `useAiStudioAgentOrchestration` attachment-prep and context-pipeline modules.
- [x] Slice 10: extract `ai-studio.tsx` agent bridge wiring into dedicated hook.
- [x] Slice 11: extract `useAiStudioState` agent context/reference adapters.
- [x] Slice 12: split `PromptStep` into header/chat/enhanced surface components.
- [x] Split `frontend/pages/api/ai/studio-agent.ts` by concern.
- [x] Split `frontend/features/ai-agent/useAiAgent.ts` into transport/session/store.
- [x] Split `frontend/features/ai-studio/hooks/useAiStudioAgentOrchestration.ts` by pipeline concern.
- [x] Split `frontend/pages/ai-studio.tsx` agent bridge wiring out.
- [x] Split `frontend/features/ai-studio/hooks/useAiStudioState.ts` agent adapters out.
- [x] Split `frontend/features/ai-studio/components/PromptStep.tsx` history/composer/actions.
- [x] Enforce size budgets with explicit ADR exceptions where required (no exceptions required after slice completion).

Exit validation:
- [x] Behavior parity test suite unchanged and green.
- [x] Boundaries + size checks green.

### Phase 4: Guardrails + Governance
- [x] Add architecture-boundary check script + CI gate (active warn/evaluate).
- [x] Add size-budget check script + CI gate (active warn/evaluate).
- [x] Add contract-test suite as required check (active warn/evaluate).
- [x] Add disable-path continuity suite as required check (active warn/evaluate).
- [x] Promote docs/parity checks to enforce mode after 2 green cycles (`DOCS_SEMANTIC_DRIFT_MODE=enforce`, `MIGRATION_PARITY_MODE=enforce`).
- [x] Refresh branch-protection evidence mapping (`docs/planning/evidence/docs/2026-02-20-branch-protection-required-check-mapping.md` refreshed 2026-02-21).

Exit validation:
- [ ] Required checks reflect target state.
- [x] Two green cycles logged (`22250627010`, `22250698460`).
- [ ] Governance evidence complete.

### Phase 5: Progressive Rollout
- [ ] Staging soak 24h.
- [ ] Production 5% 24h.
- [ ] Production 25% 24h.
- [ ] Production 50% 24h.
- [ ] Production 100% after gates.
- [ ] Single active canary only.

Exit validation:
- [ ] No unresolved Sev-1/Sev-2 regressions.
- [ ] SLO/SLI budgets met at each ring.
- [ ] Rollout report archived.

### Phase 6: Legacy Decommission
- [ ] Confirm two green release cycles.
- [ ] Confirm 14-day zero first-party legacy route traffic.
- [ ] Remove legacy routes + deprecated docs.
- [ ] Archive migration references.

Exit validation:
- [ ] Single authoritative production route.
- [ ] Decommission closeout signed.

## Required Checks Matrix
| Check | Status | Mode | Owner | Notes |
| --- | --- | --- | --- | --- |
| `frontend` | Active | Enforced | Frontend | core app/build/test gate |
| `security` | Active | Enforced | Platform | security checks |
| `deadcode` | Active | Enforced | Platform | knip production file gate |
| `docs_semantic_drift` | Active | Enforced | Docs | workflow mode promoted to enforce 2026-02-21 |
| `migration_parity` | Active | Enforced | Platform | workflow mode promoted to enforce 2026-02-21 |
| `sql_lint` | Active | Warn/Evaluate | Platform | currently advisory |
| `archive_manifest_check` | Active | Warn/Evaluate | Docs | currently advisory |
| `architecture_boundary` | Active | Warn/Evaluate | Platform | promote to enforce after two green cycles |
| `size_budget` | Active | Warn/Evaluate | Frontend | promote to enforce after two green cycles |
| `agent_contract_tests` | Active | Warn/Evaluate | AI Platform | promote to enforce after two green cycles |
| `agent_disable_continuity` | Active | Warn/Evaluate | AI Platform | promote to enforce after two green cycles |

## Rollout Gate Tracker
| Ring | Start | End | Pass/Fail | p95 | p99 | 5xx | timeout | refusal delta | Decision | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Staging soak 24h | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Production 5% | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Production 25% | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Production 50% | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Production 100% | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

## Risk Register Tracker
| Rank | Risk | State | Leading Indicator | Mitigation Owner | Last Review |
| --- | --- | --- | --- | --- | --- |
| 1 | Contract drift | Open | contract test drift/snapshot mismatch | AI Platform | TBD |
| 2 | Hidden behavior regressions in modularization | Open | characterization diffs | Frontend | TBD |
| 3 | Reload continuity regressions | Open | continuity SLI drops | AI Platform | TBD |
| 4 | Legacy traffic persists near sunset | Open | non-zero legacy traffic after deprecation | Product Eng | TBD |
| 5 | Branch-policy enforceability constrained by plan tier | Open | required checks not enforceable at branch level | Engineering Mgmt | TBD |
| 6 | Mixed-flow cost/latency spike | Open | p95/p99 and token trend increase | AI Platform | TBD |

## Blockers And Dependencies
| ID | Blocker/Dependency | Impact | Owner | Status | Resolution Target |
| --- | --- | --- | --- | --- | --- |
| DEP-01 | GitHub plan-tier constraint for enforceable required checks | Blocks full policy enforcement | Engineering Mgmt | Open | TBD |
| DEP-02 | Legacy caller migration off `/generate-prompt` + `/describe-image` | Blocks decommission | Product Eng | Open | TBD |
| DEP-03 | Dashboards + alert wiring for ring gates | Blocks rollout promotion | Ops | Open | TBD |

## Evidence Links (to fill during execution)
- Phase 0: `docs/planning/evidence/agent/phase-0/`
- Phase 1: `docs/planning/evidence/agent/phase-1/`
- Phase 2: `docs/planning/evidence/agent/phase-2/`
- Phase 3: `docs/planning/evidence/architecture/`
- Phase 4: `docs/planning/evidence/agent/phase-4/`
- Phase 5: `docs/planning/evidence/agent/phase-5/`
- Phase 6: `docs/planning/evidence/agent/phase-6/`

## Decision Log
| Date | Decision | Rationale | Owner |
| --- | --- | --- | --- |
| 2026-02-21 | Strangler migration before hard cutover | minimize regression risk and maximize rollback clarity | AI Platform |
| 2026-02-21 | Legacy routes retained with explicit deprecation headers | controlled compatibility window | AI Platform |
| 2026-02-21 | Stable `clientSessionKey` continuity policy | reload continuity + traceability | Frontend |
| 2026-02-21 | Rollback-first incident posture | minimize MTTR during canary | Ops |
