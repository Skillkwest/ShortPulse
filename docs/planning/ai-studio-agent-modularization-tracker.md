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
| Phase 4: Guardrails + Governance | In Progress | Platform + DevEx | 2026-02-21 | 2026-04-10 | enforce mode stable for 2 cycles + governance evidence packet | `docs/planning/evidence/agent/phase-4/` |
| Phase 5: Progressive Rollout | In Progress | AI Platform + Ops | 2026-02-21 | 2026-04-24 | all canary rings pass | `docs/planning/evidence/agent/phase-5/` |
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
- [x] Promote remaining guardrail checks to enforce mode (`ARCHIVE_MANIFEST_MODE`, `SQL_LINT_MODE`, `ARCHITECTURE_BOUNDARY_MODE`, `SIZE_BUDGET_MODE`, `AGENT_CONTRACT_TESTS_MODE`, `AGENT_DISABLE_CONTINUITY_MODE`) on 2026-02-21 (`docs/planning/evidence/agent/phase-4/2026-02-21-phase-4-required-check-enforce-promotion.md`).
- [x] Apply rollback-first stabilization for SQL lint (`SQL_LINT_MODE=warn`) after run `22251008051` failed due missing local Supabase/Postgres bootstrap in CI.
- [x] Add SQL lint CI bootstrap in `.github/workflows/ci.yml` to start local Supabase (postgres-only footprint) before `supabase db lint --local` (`docs/planning/evidence/agent/phase-4/2026-02-21-phase-4-sql-lint-bootstrap.md`).
- [x] Re-promote SQL lint to enforce mode (`SQL_LINT_MODE=enforce`) after bootstrap fix on 2026-02-21; validation cycles completed.
- [x] Harden CI dependency install path with transient-retry wrapper for `npm ci` across install jobs (`scripts/ci_npm_ci_with_retry.sh`, `docs/planning/evidence/agent/phase-4/2026-02-21-phase-4-npm-ci-transient-retry-hardening.md`, validated by runs `22259261557`, `22259338790`, `22259592274`, and `22262296039`).
- [x] Refresh branch-protection evidence mapping (`docs/planning/evidence/docs/2026-02-20-branch-protection-required-check-mapping.md` refreshed 2026-02-21).
- [x] Publish governance closeout packet for STG-06 with explicit dependency tracking and compensating controls (`docs/planning/evidence/agent/phase-4/2026-02-21-phase-4-governance-closeout.md`).

Exit validation:
- [x] Required checks reflect target state.
- [x] Two green cycles logged with full enforce-mode check set (`22258656706`, `22258746736`).
- [x] Governance evidence complete.
- [x] Branch-protection reviewer/date metadata captured in manual-control artifact; plan-tier enforceability constraint remains tracked as `DEP-01`.

### Phase 5: Progressive Rollout
- [x] Publish on-call rollout runbook before ring execution (`docs/sops/sop_ai_studio_agent_rollout_operations.md`).
- [x] Seed phase-5 evidence templates for rollout reports and rollback drills (`docs/planning/evidence/agent/phase-5/phase-5-rollout-report-template.md`, `docs/planning/evidence/agent/phase-5/phase-5-rollback-drill-template.md`).
- [x] Record ops-readiness bootstrap evidence and CI validation (`docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-ops-readiness-bootstrap.md`, run `22258904215`).
- [x] Record DEP-03 dashboard/alert readiness evidence with source mapping and CI validation (`docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-dep-03-dashboard-alert-readiness.md`, run `22258999203`).
- [x] Publish DEP-03 ops intake template for external dashboard/alert artifact collection (`docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-dep-03-ops-intake-template.md`).
- [x] Kick off staging soak ring and archive rollout report (`docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-rollout-report.md`).
- [x] Publish staging soak checkpoint monitoring plan with gate thresholds and evidence links (`docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-staging-soak-monitoring-plan.md`).
- [x] Publish staging soak checkpoint log sheet for C1-C4 evidence capture (`docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-checkpoint-log.md`).
- [x] Publish pre-promotion gate checklist artifact for soak-exit decision control (`docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-pre-promotion-gate-checklist.md`).
- [x] Publish 5% promotion decision packet template for deterministic go/no-go documentation (`docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-5pct-promotion-decision-packet.md`).
- [x] Add Vercel preview throttle control for docs-only/non-frontend commits (`frontend/vercel.json`, `frontend/scripts/vercel-ignore-build.sh`, evidence: `docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-vercel-preview-throttle-control.md`).
- [x] Execute soak-exit decision procedure; complete checkpoint log, pre-promotion checklist, and 5% decision packet with formal promotion decision at `2026-02-23 01:43:14Z`.
- [x] Record DEP-03 Vercel observability waiver with compensating controls (`docs/planning/evidence/agent/phase-5/2026-02-23-phase-5-dep-03-vercel-observability-waiver.md`).
- [x] Capture DEP-03 readiness/ops intake updates for waiver path.
- [x] Staging soak 24h (window elapsed; promotion approved under DEP-03 waiver path).
- [x] Publish prompt-only single-stage runtime readiness packet with verification matrix and ring flag controls (`docs/planning/evidence/agent/phase-5/2026-02-24-phase-5-prompt-only-single-stage-readiness.md`).
- [x] Classify runtime telemetry outcomes for rollout monitoring (`success_prompt`, `refusal_model`, `refusal_safety`, `upstream_error`, `route_error`) to disambiguate refusal/success/error classes during rings.
- [x] Trim legacy formatter prompt contract to `apply_prompt`-only action output and add regression guard test (`frontend/lib/__tests__/agentPromptsConfig.test.ts`).
- [x] Canonicalize legacy `context_type` naming to `agent-output | prompt | image` across orchestration + prompt contract to remove chat terminology drift.
- [x] Add runtime parity regression guard ensuring single-stage and legacy fallback return the same prompt-only envelope shape (`frontend/tests/api/studio-agent.runtime.test.ts`).
- [x] Harden upstream safety-refusal classifier to avoid mapping non-safety auth/config failures as refusals (`frontend/features/agent-runtime/studioAgentRouteOutcomes.ts` + runtime/route-outcomes tests).
- [x] Add rollback-lever verification coverage for telemetry route-paths and safety short-circuit behavior (`legacy_v2_fallback`, `v2_orchestration`, and no-fallback-on-safety tests in `frontend/tests/api/studio-agent.runtime.test.ts`).
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
| `sql_lint` | Active | Enforced | Platform | re-promoted to enforce on 2026-02-21 after CI bootstrap fix; validated by runs `22258656706`, `22258746736`, and `22258824796` |
| `archive_manifest_check` | Active | Enforced | Docs | workflow mode promoted to enforce 2026-02-21 |
| `architecture_boundary` | Active | Enforced | Platform | workflow mode promoted to enforce 2026-02-21 |
| `size_budget` | Active | Enforced | Frontend | workflow mode promoted to enforce 2026-02-21 |
| `agent_contract_tests` | Active | Enforced | AI Platform | workflow mode promoted to enforce 2026-02-21 |
| `agent_disable_continuity` | Active | Enforced | AI Platform | workflow mode promoted to enforce 2026-02-21 |

## Rollout Gate Tracker
| Ring | Start | End | Pass/Fail | p95 | p99 | 5xx | timeout | refusal delta | Decision | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Staging soak 24h | 2026-02-21 15:13:00Z | 2026-02-22 15:13:00Z (elapsed); soak-exit review 2026-02-23 01:43:14Z | Pass (waiver) | waiver path | waiver path | waiver path | waiver path | waiver path | Promote to 5% approved under DEP-03 waiver | `docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-rollout-report.md` |
| Production 5% | Approved to start (waiver path) | TBD | Approved | TBD | TBD | TBD | TBD | TBD | Ready | `docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-5pct-promotion-decision-packet.md` |
| Production 25% | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Production 50% | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Production 100% | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

## Risk Register Tracker
| Rank | Risk | State | Leading Indicator | Mitigation Owner | Last Review |
| --- | --- | --- | --- | --- | --- |
| 1 | Contract drift | Open | contract test drift/snapshot mismatch | AI Platform | 2026-02-21 |
| 2 | Hidden behavior regressions in modularization | Open | characterization diffs | Frontend | 2026-02-21 |
| 3 | Reload continuity regressions | Open | continuity SLI drops | AI Platform | 2026-02-21 |
| 4 | Legacy traffic persists near sunset | Open | non-zero legacy traffic after deprecation | Product Eng | 2026-02-21 |
| 5 | Branch-policy enforceability constrained by plan tier | Open | required checks not enforceable at branch level | Engineering Mgmt | 2026-02-21 |
| 6 | Mixed-flow cost/latency spike | Open | p95/p99 and token trend increase | AI Platform | 2026-02-21 |

## Blockers And Dependencies
| ID | Blocker/Dependency | Impact | Owner | Status | Resolution Target |
| --- | --- | --- | --- | --- | --- |
| DEP-01 | GitHub plan-tier constraint for enforceable required checks | Blocks full policy enforcement | Engineering Mgmt | Open | TBD |
| DEP-02 | Legacy caller migration off `/generate-prompt` + `/describe-image` | Blocks decommission | Product Eng | Open | TBD |
| DEP-03 | Dashboards + alert wiring for ring gates | Non-blocking under approved waiver; remains observability hardening follow-up | Ops | Waived (Compensating controls active) | Before waiver retirement |

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
| 2026-02-23 | DEP-03 Vercel observability waiver activated | external dashboard/alert tooling constrained by plan tier; compensating controls documented and approved | AI Platform + Ops |
| 2026-02-23 | Staging soak exit decision = `Promote` (waiver path) | soak target window elapsed with green CI/contract/continuity controls and active DEP-03 waiver | AI Platform + Ops |
| 2026-02-24 | Prompt-only single-stage runtime promoted as canonical behavior (legacy V2 fallback flag retained) | reduce path complexity and edge-case surface while preserving external contract and UI stability | AI Platform |
| 2026-02-24 | Prompt-only single-stage rollout readiness packet published for Phase 5 execution | lock operator flag policy, rollback order, and verification evidence before production ring expansion | AI Platform + Ops |
| 2026-02-24 | Outcome-class telemetry promoted for studio-agent route turn metrics | distinguish model refusals from safety refusals and transport/route errors during canary gating | AI Platform |
| 2026-02-24 | Legacy formatter prompt contract slimmed to apply-prompt-only actions | reduce structured-output surface area while preserving compatibility and UI invariants | AI Platform |
| 2026-02-24 | Legacy context type canonicalized from `chat` to `agent-output` | align orchestration/prompt terminology with active focused-source contract and reduce semantic drift | AI Platform |
| 2026-02-24 | Single-stage vs legacy fallback prompt-envelope parity test added to runtime contract suite | prevent response-shape drift across primary/fallback paths during phased rollback window | AI Platform |
| 2026-02-24 | Safety refusal classifier narrowed (status/pattern hardening) | avoid false-refusal mapping for non-safety upstream failures such as auth/config errors while preserving policy refusal handling | AI Platform |
| 2026-02-24 | Rollback lever verification tests added for route-path telemetry and safety short-circuit | provide deterministic pre-ring proof that fallback levers route as intended and safety refusals do not trigger V2 fallback | AI Platform |
