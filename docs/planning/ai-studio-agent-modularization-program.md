# AI Studio Agent Hardening + Modularization Program (v3)

Date: 2026-02-21
Authority: Working
Owner: AI Platform + Frontend
Status: Active

## Summary
This program hardens and modularizes the AI Studio agent into a robust, semi-independent subsystem with strict contracts, staged rollout controls, and regression-prevention guardrails.

Delivery model:
1. Incremental strangler migration.
2. Backward-compatible contract governance.
3. Progressive exposure rollout with rollback-first incident posture.

## Program Charter

### Goals
1. Decouple agent runtime behavior from AI Studio page-level orchestration.
2. Enforce one canonical contract across client, route, runtime, and docs.
3. Eliminate known drift and fragility points from the audit delta.
4. Reduce hotspot file risk through behavior-preserving modularization.
5. Ship with zero unplanned regressions via hard gates and deterministic rollback.

### Non-goals
1. No migration away from Next.js Pages Router in this program.
2. No new external orchestration platform.
3. No product-scope expansion beyond current agent capability.

### Success Criteria
1. Agent behavior parity is preserved for all in-scope flows.
2. Required checks are green for two consecutive release cycles.
3. Legacy AI routes are decommissioned with no first-party traffic.
4. Runtime/doc/schema parity is verifiably zero drift at closeout.
5. P0/P1 post-release regressions attributable to this program equal zero.

## Architecture Invariants (Must Not Break)
1. Server remains the sole authority for secrets, policy checks, and action validation.
2. Client-originated `system` and `observation` roles are never trusted or executed.
3. Canonical continuity is keyed by stable session namespace, not transient UI state.
4. Agent modules do not directly import AI Studio orchestration internals.
5. Route contracts are versioned and backward compatible during deprecation windows.
6. Docs, schemas/types, and runtime behavior are updated in the same change train.
7. Refusal responses never synthesize `applyPrompt` actions.
8. Rollback path exists before each phase can advance.

## Target Module Topology
| Module | Responsibility | Allowed Imports | Forbidden Imports | Owner |
| --- | --- | --- | --- | --- |
| `frontend/features/agent-core` | Pure contracts, flow classifier, sanitizers, action normalization | TS stdlib, shared utils | `features/ai-studio/**`, Next route handlers | AI Platform |
| `frontend/features/agent-runtime` | Provider orchestration, persistence adapter, throttling, telemetry | `agent-core`, server libs | `pages/ai-studio.tsx`, UI hooks | AI Platform |
| `frontend/features/agent-client` | Transport, session controller, message store | `agent-core`, fetch helpers | `features/ai-studio/hooks/**` | Frontend |
| `frontend/features/studio-agent-adapter` | AI Studio mapping to/from agent contracts | `agent-core`, `agent-client` | `agent-runtime` internals | Frontend |
| `frontend/pages/api/ai/*` | Thin HTTP adapters + compatibility wrappers | `agent-runtime`, validators | UI hooks/components | AI Platform |

## Public API / Contract Changes

### Canonical Endpoint
1. Canonical route stays `POST /api/ai/studio-agent`.
2. Responses include `Agent-Contract-Version: 1`.
3. Validation failures use one envelope: `{ code, message, details, traceId }`.

### Request Contract
1. `messages[].role` allowed values are `user | assistant` only.
2. Unsupported roles return `400 INVALID_MESSAGE_ROLE`.
3. `context.media` server-bound payload requires `https` URL only.
4. Public `dataUrl` is removed from API request contract.
5. `clientSessionKey` is required and stable across reload.
6. `traceId` is optional in request and always echoed in response payload.

### Response Contract
1. `actions.questions` remains removed.
2. Refusals return assistant text with empty actions.
3. Responses include `traceId` for correlation.

### Legacy Compatibility
Legacy routes remain wrappers during deprecation window:
1. `POST /api/ai/generate-prompt`
2. `POST /api/ai/describe-image`

Both emit:
1. `Deprecation: true`
2. `Sunset: Sun, 26 Apr 2026 00:00:00 GMT`
3. `Link: <https://docs.shortpulse.app/agent-route-migration>; rel="deprecation"`

## Compatibility Matrix
| Surface | 2026-02-23 to 2026-03-22 | 2026-03-23 to 2026-04-26 | 2026-04-27 onward |
| --- | --- | --- | --- |
| `/api/ai/studio-agent` | Canonical v1 | Canonical v1 | Canonical v1 |
| `/api/ai/generate-prompt` | Compatibility wrapper | Deprecated wrapper + headers | Removed |
| `/api/ai/describe-image` | Compatibility wrapper | Deprecated wrapper + headers | Removed |
| Client `dataUrl` media | Soft warning/tests only | Hard reject in contract tests | Unsupported |
| Non-`user/assistant` roles | Warn/log | Hard reject | Hard reject |

## Performance, Reliability, Cost Budgets
| Metric | Text Flow | Mixed/Image Flow | Hard Fail Threshold |
| --- | --- | --- | --- |
| p95 latency | <= 1800 ms | <= 4500 ms | Over budget for 2 consecutive canary windows |
| p99 latency | <= 3500 ms | <= 8000 ms | Over budget for 1 canary window |
| timeout rate | <= 0.3% | <= 0.8% | > 1.0% any 30-minute window |
| 5xx error rate | <= 0.5% | <= 0.8% | > 1.0% any 30-minute window |
| refusal-rate delta | <= +1.5pp | <= +1.5pp | > +2.0pp any canary window |
| max request body | 512 KB | 1.5 MB | reject `413` |
| max input token budget | 8k | 12k | reject/truncate per policy |
| max output token budget | 900 | 1200 | truncate with explicit finish reason |

## Rollout Gates And Freeze Conditions

### Fixed Rollout Rings
1. Staging soak 24h.
2. Production 5% for 24h.
3. Production 25% for 24h.
4. Production 50% for 24h.
5. Production 100% only after all gates pass.

### Promotion Rules
1. Single active canary for this subsystem at a time.
2. All budgets above pass for current ring.
3. No open Sev-1/Sev-2 defects linked to this subsystem.
4. Contract + disable-path + continuity suites are green.

### Freeze Rules
1. Freeze on any hard-threshold breach.
2. Freeze on doc/runtime/schema parity failure.
3. Freeze on missing rollback verification evidence.

## Rollback Playbooks
| Scenario | Trigger | Immediate Action | Recovery Target |
| --- | --- | --- | --- |
| Latency regression | p95/p99 hard fail | Disable latest rollout flag tier and revert to previous ring | <= 15 minutes |
| Contract break | Contract monitor/test fail | Route to last-known-good compatibility adapter | <= 15 minutes |
| Refusal spike | Refusal delta hard fail | Revert prompt/runtime policy flags | <= 30 minutes |
| Continuity failure | Reload continuity SLI < 99.5% | Disable stable-session write path, use last-good fallback | <= 30 minutes |
| Legacy wrapper failure | Wrapper 5xx spike | Bypass wrapper to canonical endpoint for first-party callers | <= 30 minutes |

## Phase Plan And Definition Of Done
| Phase | Dates | Scope | Definition of Done | Evidence |
| --- | --- | --- | --- | --- |
| Phase 0: Contract Freeze | 2026-02-23 to 2026-02-25 | Canonical schema, characterization tests, incident criteria | Contract doc + TS schema are single source of truth; snapshots green | contract doc + schema tests + baseline report |
| Phase 1: Correctness Hardening | 2026-02-26 to 2026-03-06 | Role/media validation, continuity key, size limits, throttling, disable-path fix | Audit-delta defects closed with regression tests; docs parity merged | PR evidence + CI links + parity report |
| Phase 2: Strangler Consolidation | 2026-03-09 to 2026-03-20 | `AgentRuntimeService`; legacy routes call shared runtime | No duplicated business logic across three AI routes; deprecation headers live | route diff audit + contract tests |
| Phase 3: Modularization Pass | 2026-03-23 to 2026-04-03 | Split hotspot files with behavior parity | Size budgets pass or ADR exceptions approved; parity tests unchanged | architecture evidence bundle |
| Phase 4: Guardrails + Governance | 2026-04-06 to 2026-04-10 | Boundary CI, size budget CI, required checks, reviewer policy | Guardrails enforce-mode for two green cycles | CI history + branch/ruleset evidence |
| Phase 5: Progressive Rollout | 2026-04-13 to 2026-04-24 | Canary progression with hard gates | All rings pass; no unresolved Sev-1/Sev-2 regressions | rollout reports + dashboard captures |
| Phase 6: Legacy Decommission | 2026-04-27 to 2026-05-01 | Remove deprecated routes/docs and archive references | 14-day zero first-party usage; routes removed; closeout signed | traffic report + removal PR + final validation |

## Test Matrix
| Layer | Required Scenarios | Gate |
| --- | --- | --- |
| Unit | flow classification, role filtering, action normalization, media sanitizer | `frontend` |
| Contract | schema validation, deprecation headers, error envelope invariants | `agent_contract_tests` |
| Integration | continuity, refusal handling, fallback paths, throttling | `frontend` + `security` |
| UI | disable-path behavior, attachment-failure rollback, non-agent parity | `frontend` |
| Performance | p50/p95/p99 by flow, timeout/retry | `agent_perf_smoke` |
| Operational | canary gate automation, alert routing, rollback drill | `ops_readiness` |
| Parity | docs/runtime/schema drift | `docs_semantic_drift` + `migration_parity` |

## Regression Prevention And Governance

### Required Checks (Target)
1. `frontend`
2. `security`
3. `deadcode`
4. `docs_semantic_drift`
5. `migration_parity`
6. `sql_lint`
7. `archive_manifest_check`
8. `architecture_boundary`
9. `size_budget`
10. `agent_contract_tests`
11. `agent_disable_continuity`

### Reviewer Policy
1. Minimum two reviewers for agent-runtime changes.
2. One reviewer must be boundary code owner.
3. One reviewer must verify docs/runtime parity checklist.

### Current Ruleset Constraint
Branch required-check enforcement is currently constrained by repository plan limits. Manual evidence remains mandatory each cycle in `docs/planning/evidence/docs/` until enforceable plan tier controls are available.

## Observability And Operational Defaults

### Telemetry Contract
1. Every request carries `traceId`, `clientSessionKey`, stage timings.
2. Required dimensions: `flow`, `route`, `model`, `retry`, `refusal`, `timeout`, `canonicalRead`, `canonicalWrite`, `status`.

### Dashboard Panels
1. Latency by stage and flow.
2. Error + timeout rates by ring.
3. Refusal-rate delta versus baseline.
4. Contract rejection rate by reason.
5. Continuity success rate across reload.

### Alerting
1. Sev-2: any hard-threshold breach from budget table.
2. Sev-2: continuity SLI < 99.5%.
3. Sev-3: contract rejection spike > 2x baseline.

### Runbooks And Drills
1. On-call runbook published before Phase 5.
2. One staging rollback drill + one production-canary rollback drill before 50% ring.
3. Incident packet template required for each freeze event.

## Risk Register
| Rank | Risk | Leading Indicator | Mitigation | Contingency Owner |
| --- | --- | --- | --- | --- |
| 1 | Contract drift between route and client | contract test drift/snapshot failures | single TS schema source + contract CI gate | AI Platform |
| 2 | Hidden behavior change during modularization | characterization test deltas | behavior-preserving splits + parity lock | Frontend |
| 3 | Reload continuity regressions | continuity SLI dips | stable session namespace + continuity tests | AI Platform |
| 4 | Deprecation window too short | non-zero legacy traffic near sunset | early headers + weekly migration reporting | Product Eng |
| 5 | Guardrails not enforceable via plan tier | missing branch-enforced checks | manual evidence + plan-tier dependency as blocker | Engineering Mgmt |
| 6 | Cost/latency spike in mixed flows | p95/p99 + token trend increase | token budgets + payload caps + canary halt | AI Platform |

## Decision Log
| Date | Decision | Alternatives | Rationale | Reversal Cost |
| --- | --- | --- | --- | --- |
| 2026-02-21 | Strangler consolidation before hard cutover | big-bang route replacement | lowest regression risk + clear rollback | Medium |
| 2026-02-21 | Keep legacy routes temporarily with deprecation headers | immediate deletion | compatibility while callers migrate | Low |
| 2026-02-21 | Stable `clientSessionKey` namespace policy | ephemeral conversation IDs | continuity + observability requirements | Medium |
| 2026-02-21 | Enforce role/media constraints at API boundary | trust client payload | deterministic behavior + security posture | Low |
| 2026-02-21 | Rollback-first incident posture | forward-fix-first | lower MTTR during canary instability | Low |

## Deliverables
1. `docs/planning/ai-studio-agent-modularization-program.md` (this file).
2. `docs/planning/ai-studio-agent-modularization-tracker.md` (execution + evidence tracker).
3. ADR for final boundary map + deprecation lock.
4. Updated SOPs for agent operations and incident handling.
5. Final closeout in `docs/planning/final-validation-summary.md`.

## Assumptions (Locked)
1. Program target start date: 2026-02-23; execution was pulled forward to 2026-02-21 for risk reduction and is tracked in the tracker execution note.
2. Compatibility window required through 2026-04-26.
3. Legacy route removal target: 2026-04-27 after zero-usage criterion.
4. Zero regression means no unplanned behavior change and no release past failed required gate.
5. No new transcript persistence beyond session continuity metadata.
6. If branch-rule enforcement remains constrained, 100% rollout requires compensating-control approval + evidence.
7. If external observability/alert tooling is constrained by platform tier, rollout may proceed under an explicit DEP-03 compensating-control waiver with documented risk acceptance.

## External Best-Practice References
1. AWS strangler migration pattern: https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-aspnet-web-services/fig-pattern.html
2. Google SRE canarying: https://sre.google/workbook/canarying-releases/
3. Microsoft safe deployments: https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments
4. Stripe versioning discipline: https://docs.stripe.com/sdks/versioning
5. Martin Fowler monolith-first boundaries: https://martinfowler.com/bliki/MonolithFirst.html
6. Pact contract versioning: https://docs.pact.io/getting_started/versioning_in_the_pact_broker
7. RFC 8594 Sunset header: https://datatracker.ietf.org/doc/html/rfc8594
8. RFC 9745 Deprecation header: https://datatracker.ietf.org/doc/html/rfc9745
9. Feature flag debt hygiene: https://launchdarkly.com/docs/guides/flags/technical-debt
10. GitHub protected branches behavior: https://docs.github.com/en/enterprise-server@3.19/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
