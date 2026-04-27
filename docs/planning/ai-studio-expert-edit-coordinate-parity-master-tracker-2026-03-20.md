# AI Studio Expert Edit Coordinate Parity Master Tracker (2026-03-20)

Status: active

## Objective
Track execution status for the coordinate-parity hardening roadmap, including phase-level docs and supporting governance artifacts.

## Status Legend
1. `DONE`: completed and validated.
2. `IN_PROGRESS`: actively executing.
3. `PENDING`: ready but not started.
4. `BLOCKED`: waiting on dependency or decision.

## Phase Overview
| Phase | Name | Status | Gate |
| --- | --- | --- | --- |
| `P0` | Contract lock and baseline spec | `DONE` | ADR + master docs indexed; baseline evidence packet |
| `P1` | Coordinate core unification | `PENDING` | Shared transform core live in both tools and both surfaces |
| `P2` | Tool geometry parity | `PENDING` | Markup/inpaint placement parity under zoom/pan matrix |
| `P3` | Mask and export camera parity | `DONE` | Submit export alignment parity contract locked with `CP-302` waiver acceptance |
| `P4` | Regression harness and CI gates | `DONE` | Required tests and thresholds enforced in CI |
| `P5` | Controlled rollout and closeout | `IN_PROGRESS` | Canary evidence accepted, rollback posture verified |

## Workstream Tracker
| ID | Phase | Workstream | Task | Owner | Status | Dependencies | Risk | Entry Criteria | Exit Criteria | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CP-001` | `P0` | Contracts | Publish canonical contract ADR | AI Studio FE | `DONE` | None | Low | Regression scope accepted | ADR merged + indexed | `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md` | Decision lock document |
| `CP-002` | `P0` | Planning | Publish master roadmap | AI Studio FE | `DONE` | `CP-001` | Low | Contract agreed | Roadmap merged + indexed | `docs/planning/ai-studio-expert-edit-coordinate-parity-master-roadmap-2026-03-20.md` | Master source before phase docs |
| `CP-003` | `P0` | Planning | Publish master tracker | AI Studio FE | `DONE` | `CP-002` | Low | Roadmap approved | Tracker merged + indexed | `docs/planning/ai-studio-expert-edit-coordinate-parity-master-tracker-2026-03-20.md` | This document |
| `CP-005` | `P0` | Planning | Publish Phase 1 execution plan scaffold | AI Studio FE | `DONE` | `CP-003` | Low | Master docs published | Phase 1 doc merged + indexed | `docs/planning/ai-studio-expert-edit-coordinate-parity-phase-1-execution-plan-2026-03-20.md` | Execution remains blocked until `CP-004` exits |
| `CP-006` | `P0` | Planning | Publish Phase 2 execution plan scaffold | AI Studio FE | `DONE` | `CP-005` | Low | Phase 1 plan scaffold published | Phase 2 doc merged + indexed | `docs/planning/ai-studio-expert-edit-coordinate-parity-phase-2-execution-plan-2026-03-20.md` | Execution remains blocked until Phase 1 exits |
| `CP-007` | `P0` | Planning | Publish Phase 3 execution plan scaffold | AI Studio FE | `DONE` | `CP-006` | Low | Phase 2 plan scaffold published | Phase 3 doc merged + indexed | `docs/archive/planning/ai-studio-expert-edit-coordinate-parity-phase-3-execution-plan-2026-03-20.md` | Execution remains blocked until Phase 2 exits |
| `CP-008` | `P0` | Planning | Publish Phase 4 execution plan scaffold | AI Studio FE | `DONE` | `CP-007` | Low | Phase 3 plan scaffold published | Phase 4 doc merged + indexed | `docs/archive/planning/ai-studio-expert-edit-coordinate-parity-phase-4-execution-plan-2026-03-20.md` | Execution remains blocked until Phase 3 exits |
| `CP-009` | `P0` | Planning | Publish Phase 5 execution plan scaffold | AI Studio FE | `DONE` | `CP-008` | Low | Phase 4 plan scaffold published | Phase 5 doc merged + indexed | `docs/planning/ai-studio-expert-edit-coordinate-parity-phase-5-execution-plan-2026-03-20.md` | Execution remains blocked until Phase 4 exits |
| `CP-010` | `P0` | Planning | Publish Phase 0 baseline capture execution plan | AI Studio FE | `DONE` | `CP-009` | Low | Phase scaffold stack published | Baseline runbook merged + indexed | `docs/archive/planning/ai-studio-expert-edit-coordinate-parity-phase-0-baseline-capture-execution-plan-2026-03-20.md` | Supports deterministic `CP-004` execution |
| `CP-011` | `P0` | Planning | Publish coordinate parity evidence template | AI Studio FE | `DONE` | `CP-010` | Low | Baseline runbook published | Evidence template merged + indexed | `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-evidence-template.md` | Shared packet format across phases |
| `CP-012` | `P0` | Planning | Publish coordinate parity rollout decision log scaffold | AI Studio FE | `DONE` | `CP-011` | Low | Evidence template published | Decision log merged + indexed | `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-rollout-decision-log-2026-03-20.md` | Baseline/canary/prod decisions tracked |
| `CP-004` | `P0` | Baseline | Capture parity baseline matrix (zoom/pan/aspect/DPR) | QA + AI Studio FE | `DONE` | `CP-012` | Medium | Matrix and thresholds locked | Baseline evidence packet posted | `docs/planning/evidence/ai-studio-expert-edit/` | Completed with approved waiver for incomplete matrix slices; see decision log |
| `CP-101` | `P1` | Coordinate core | Implement shared forward/inverse transform core | AI Studio FE | `PENDING` | `CP-004` | High | Baseline captured | Shared core consumed by markup + inpaint | `TBD` | No ad hoc inverse paths remain |
| `CP-102` | `P1` | Surface contract | Inline interaction surface parity with modal ownership rule | AI Studio FE | `PENDING` | `CP-101` | High | Shared core merged | Inline and modal pointer mapping paths unified | `TBD` | Event target elements remain untransformed |
| `CP-103` | `P1` | Rect authority | Remove wrapper rect authority from draw/export math | AI Studio FE | `PENDING` | `CP-102` | Medium | Authoritative refs locked | Only stage refs used for authoritative rects | `TBD` | Guard against wrapper padding offsets |
| `CP-201` | `P2` | Markup | Align markup pointer sampling and stroke placement with shared core | AI Studio FE | `PENDING` | `CP-101`,`CP-102`,`CP-103` | High | P1 complete | Pointer-to-stroke thresholds pass for markup | `TBD` | Includes coalesced sample parity |
| `CP-202` | `P2` | Inpaint brush | Align brush reticle/paint radius parity using mask-space contract | AI Studio FE | `PENDING` | `CP-101`,`CP-102`,`CP-103` | High | P1 complete | Reticle vs painted diameter thresholds pass | `TBD` | Includes zoom set `{0.5,1,2,4}` |
| `CP-203` | `P2` | Inpaint lasso | Apply explicit `evenodd` lasso fill and self-intersection characterization | AI Studio FE | `PENDING` | `CP-101`,`CP-102`,`CP-103` | Medium | P1 complete | Figure-eight and nested-loop deterministic parity tests pass | `TBD` | Remove implicit default rule ambiguity |
| `CP-301` | `P3` | Mask mapping | Align mask canonical resolution and scene-to-mask conversion | AI Studio FE | `DONE` | `CP-201`,`CP-202`,`CP-203` | High | P2 complete | Mask mapping invariants pass across aspects | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp301-cp302-mask-export-contract-progress.md` | Canonical selected-layer mask resolution + scene-preserving remap contract validated in local Phase 3 command suite (commits `ba8c5120`, `f357db5d`) |
| `CP-302` | `P3` | Export parity | Align submit mask export camera/crop with base flatten contract | AI Studio FE | `DONE` | `CP-301` | High | P3 mapping complete | Export alignment threshold passes under matrix | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp301-cp302-mask-export-contract-progress.md` | User-approved waiver accepted to skip browser-backed matrix/formal closeout evidence; residual risk acknowledged in decision log |
| `CP-303` | `P3` | Zoom cap parity | Resolve viewport/flatten zoom cap mismatch | AI Studio FE | `DONE` | `CP-302` | Medium | Export contract aligned | Same max clamp across viewport and flatten camera | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp303-zoom-clamp-parity.md` | Shared clamp authority (`EXPERT_EDIT_CAMERA_SCALE_MIN/MAX`) validated and rerun in Phase 3 suite (commits `698984a3`, `f357db5d`) |
| `CP-401` | `P4` | Unit tests | Add transform-chain round-trip and threshold tests | AI Studio FE | `DONE` | `CP-301`,`CP-302`,`CP-303` | Medium | P3 complete | Unit matrix tests green | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp403-cp404-parity-gate-and-ci-enforcement.md` | Canonical zoom/pan transform assertions consolidated into deterministic parity gate command |
| `CP-402` | `P4` | Integration tests | Add inline/modal interaction parity tests | AI Studio FE + QA | `DONE` | `CP-401` | High | Unit tests green | Tool matrix integration tests green | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp403-cp404-parity-gate-and-ci-enforcement.md` | Inline/modal pointer lifecycle parity assertions consolidated into deterministic parity gate command |
| `CP-403` | `P4` | Visual parity | Add screenshot or pixel-diff drift guard suite | QA | `DONE` | `CP-402` | Medium | Integration tests green | Drift signatures locked in CI | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp403-cp404-parity-gate-and-ci-enforcement.md` | Deterministic drift signatures covered by parity gate suite; browser audit path remains optional |
| `CP-404` | `P4` | CI gate | Wire parity thresholds into required checks | AI Studio FE + DevEx | `DONE` | `CP-403` | Medium | Test suites stable | CI blocks threshold regressions | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp403-cp404-parity-gate-and-ci-enforcement.md` | Dedicated `expert_edit_coordinate_parity` CI job added with `warn|enforce` mode (default `enforce`) |
| `CP-501` | `P5` | Rollout | Enable guarded canary rollout | AI Studio FE + Ops | `IN_PROGRESS` | `CP-401`,`CP-402`,`CP-403`,`CP-404` | Medium | CI gates green | Canary metrics within thresholds | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp501-canary-matrix-progress.md` | Deterministic canary command suite is green; browser-backed matrix capture currently blocked by missing audit credentials in this workspace |
| `CP-502` | `P5` | Verification | Collect production parity evidence bundle | QA + Ops | `PENDING` | `CP-501` | Medium | Canary pass | Production evidence accepted | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp502-production-verification-scaffold.md` | Production verification packet scaffold prepared; awaiting canary pass and production run artifacts |
| `CP-503` | `P5` | Closeout | Final closeout packet and de-risk cleanup | AI Studio FE | `PENDING` | `CP-502` | Low | Production evidence accepted | Program marked complete | `TBD` | Remove temporary guardrails |

## Current Blockers
1. Residual risk accepted by waiver: CP-004 missing baseline slices (`zoom=4`, canonical pan tuples, `4:3` stage, DPR `1/2/3`) remain unmeasured in this workspace due credential-gated Playwright capture.
2. Residual risk accepted by waiver: CP-302 browser-backed matrix and formal closeout evidence were explicitly skipped by user decision.

## Immediate Next Actions
1. Unblock CP-501 browser matrix capture by providing `PLAYWRIGHT_AUDIT_EMAIL` (or attach explicitly approved substitute evidence) and rerun the parity browser audit.
2. Promote `CP-501` from `HOLD` to `PASS` once browser-backed or approved substitute matrix evidence is attached.
3. Execute CP-502 production verification using the prepared scaffold and keep CP-004/CP-302 waiver context visible until superseded.

## Reference Docs
1. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-roadmap-2026-03-20.md`
2. `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md`
3. `docs/adr/0034-ai-studio-expert-edit-shared-stage-interaction-parity.md`
4. `docs/planning/ai-studio-expert-edit-coordinate-parity-phase-1-execution-plan-2026-03-20.md`
5. `docs/planning/ai-studio-expert-edit-coordinate-parity-phase-2-execution-plan-2026-03-20.md`
6. `docs/archive/planning/ai-studio-expert-edit-coordinate-parity-phase-3-execution-plan-2026-03-20.md`
7. `docs/archive/planning/ai-studio-expert-edit-coordinate-parity-phase-4-execution-plan-2026-03-20.md`
8. `docs/planning/ai-studio-expert-edit-coordinate-parity-phase-5-execution-plan-2026-03-20.md`
9. `docs/archive/planning/ai-studio-expert-edit-coordinate-parity-phase-0-baseline-capture-execution-plan-2026-03-20.md`
10. `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-evidence-template.md`
11. `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-rollout-decision-log-2026-03-20.md`
