# AI Studio Agent Pipeline Regression Remediation Tracker

Date: 2026-03-20  
Authority: Working  
Owner: Engineering  
Program Doc: `docs/planning/ai-studio-agent-pipeline-regression-remediation-roadmap-2026-03-20.md`
Phase 1 Plan: `docs/planning/ai-studio-agent-pipeline-regression-phase-1-openai-execution-plan-2026-03-20.md`
Phase 2 Plan: `docs/planning/ai-studio-agent-pipeline-regression-phase-2-openai-execution-plan-2026-03-20.md`

## Status Overview
| Phase | Status | Owner | Entry Gate | Exit Gate | Evidence |
| --- | --- | --- | --- | --- | --- |
| Phase 1: OpenAI Stability + Policy Parity | Planned | AI Platform + Frontend | Baseline traces + flag freeze + golden corpus | OpenAI route parity green + corrected failing traces | `docs/planning/evidence/agent-pipeline-remediation/phase-1/` |
| Phase 2: Prompt Quality + Continuity Hardening | Planned | Frontend + AI Platform | Phase 1 green | Golden quality checks green + no false-positive increase | `docs/planning/evidence/agent-pipeline-remediation/phase-2/` |
| Phase 3: Operational Hardening + Rollout Guardrails | Planned | Platform + Ops | Phase 2 green | Canary + rollback drill + CI parity enforcement green | `docs/planning/evidence/agent-pipeline-remediation/phase-3/` |

## Tracker Rows
| ID | Task | Owner | Status | Risk | Validation | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| P1-01 | Capture baseline failing traces (at least 3) for fallback/refusal confusion | Frontend | Planned | Medium | Trace packet reviewed | Pending |
| P1-02 | Freeze runtime safety flags for implementation window | Platform | Planned | High | Env diff reviewed for local/preview/prod | Pending |
| P1-03 | Build OpenAI route behavior matrix (`studio-agent`/`generate-prompt`/`describe-image`) | AI Platform | Planned | Medium | Matrix reviewed and signed | Pending |
| P1-04 | Add additive outcome contract fields (`outcome_class`, `reason_code`) across OpenAI routes | AI Platform | Planned | High | API tests + contract assertions | Pending |
| P1-05 | Implement shared server-side outcome mapping helper for OpenAI lanes | AI Platform | Planned | High | Unit + route integration tests | Pending |
| P1-06 | Align client agent handling to prefer machine-readable outcome fields | Frontend | Planned | Medium | Client tests + compatibility assertions | Pending |
| P1-07 | Record out-of-scope lock: remove `fal-submit` changes from this remediation program | Engineering | Planned | Low | Roadmap/tracker/docs parity check | Pending |
| P1-08 | Run Phase 1 regression bundle (OpenAI scope) | Engineering | Planned | Medium | `lint`, `type-check`, `build`, route tests, parity tests | Pending |
| P2-01 | Define precheck scope contract (user turn vs context/canonical/reference fields) | AI Platform | Planned | High | Contract doc + test plan approved | Pending |
| P2-02 | Implement scoped precheck behavior with guard flags | AI Platform | Planned | High | Unit/integration tests | Pending |
| P2-03 | Run golden prompt quality suite and compare against baseline | Frontend | Planned | Medium | Golden suite delta report | Pending |
| P2-04 | Verify session/memory continuity across tool and mode switches | Frontend | Planned | Medium | Continuity test suite | Pending |
| P2-05 | Align client/server profile assumptions and local defaults | Platform + Frontend | Planned | Medium | Env and runtime contract checks | Pending |
| P2-06 | Run Phase 2 regression bundle | Engineering | Planned | Medium | `lint`, `type-check`, `build`, quality + continuity suites | Pending |
| P3-01 | Publish precedence table (`env`, control plane, defaults`) in canonical docs | Platform | Planned | Medium | Docs review complete | Pending |
| P3-02 | Add precedence parity tests in CI | AI Platform | Planned | Medium | CI policy checks green | Pending |
| P3-03 | Define and run canary observation packet | Ops | Planned | High | Canary metrics meet thresholds | Pending |
| P3-04 | Execute rollback drill and archive packet | Ops + Platform | Planned | High | Rollback checklist green | Pending |
| P3-05 | Final closeout and tracker signoff | Engineering | Planned | Low | All rows done with evidence links | Pending |

## Validation Command Bundle (per implementation slice)
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. Slice-specific API and unit tests for touched safety/runtime modules.
6. Cross-route parity suite on golden prompt corpus.

## Operational Notes
1. Do not run concurrent safety-flag changes during active phase implementation windows.
2. Capture exact commit SHA and env profile state with every evidence packet.
3. Keep evidence folders phase-scoped and immutable after signoff.
4. Scope lock: Phase 1 excludes `fal-submit` route implementation work.
