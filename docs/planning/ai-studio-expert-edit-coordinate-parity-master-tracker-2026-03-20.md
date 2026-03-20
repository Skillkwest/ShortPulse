# AI Studio Expert Edit Coordinate Parity Master Tracker (2026-03-20)

## Objective
Track execution status for the coordinate-parity hardening roadmap before phase-level docs are produced.

## Status Legend
1. `DONE`: completed and validated.
2. `IN_PROGRESS`: actively executing.
3. `PENDING`: ready but not started.
4. `BLOCKED`: waiting on dependency or decision.

## Phase Overview
| Phase | Name | Status | Gate |
| --- | --- | --- | --- |
| `P0` | Contract lock and baseline spec | `IN_PROGRESS` | ADR + master docs indexed; baseline evidence packet |
| `P1` | Coordinate core unification | `PENDING` | Shared transform core live in both tools and both surfaces |
| `P2` | Tool geometry parity | `PENDING` | Markup/inpaint placement parity under zoom/pan matrix |
| `P3` | Mask and export camera parity | `PENDING` | Submit export alignment parity under matrix |
| `P4` | Regression harness and CI gates | `PENDING` | Required tests and thresholds enforced in CI |
| `P5` | Controlled rollout and closeout | `PENDING` | Canary evidence accepted, rollback posture verified |

## Workstream Tracker
| ID | Phase | Workstream | Task | Owner | Status | Dependencies | Risk | Entry Criteria | Exit Criteria | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CP-001` | `P0` | Contracts | Publish canonical contract ADR | AI Studio FE | `DONE` | None | Low | Regression scope accepted | ADR merged + indexed | `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md` | Decision lock document |
| `CP-002` | `P0` | Planning | Publish master roadmap | AI Studio FE | `DONE` | `CP-001` | Low | Contract agreed | Roadmap merged + indexed | `docs/planning/ai-studio-expert-edit-coordinate-parity-master-roadmap-2026-03-20.md` | Master source before phase docs |
| `CP-003` | `P0` | Planning | Publish master tracker | AI Studio FE | `DONE` | `CP-002` | Low | Roadmap approved | Tracker merged + indexed | `docs/planning/ai-studio-expert-edit-coordinate-parity-master-tracker-2026-03-20.md` | This document |
| `CP-004` | `P0` | Baseline | Capture parity baseline matrix (zoom/pan/aspect/DPR) | QA + AI Studio FE | `PENDING` | `CP-003` | Medium | Matrix and thresholds locked | Baseline evidence packet posted | `docs/planning/evidence/ai-studio-expert-edit/` | Required before implementation slices |
| `CP-101` | `P1` | Coordinate core | Implement shared forward/inverse transform core | AI Studio FE | `PENDING` | `CP-004` | High | Baseline captured | Shared core consumed by markup + inpaint | `TBD` | No ad hoc inverse paths remain |
| `CP-102` | `P1` | Surface contract | Inline interaction surface parity with modal ownership rule | AI Studio FE | `PENDING` | `CP-101` | High | Shared core merged | Inline and modal pointer mapping paths unified | `TBD` | Event target elements remain untransformed |
| `CP-103` | `P1` | Rect authority | Remove wrapper rect authority from draw/export math | AI Studio FE | `PENDING` | `CP-102` | Medium | Authoritative refs locked | Only stage refs used for authoritative rects | `TBD` | Guard against wrapper padding offsets |
| `CP-201` | `P2` | Markup | Align markup pointer sampling and stroke placement with shared core | AI Studio FE | `PENDING` | `CP-103` | High | P1 complete | Pointer-to-stroke thresholds pass for markup | `TBD` | Includes coalesced sample parity |
| `CP-202` | `P2` | Inpaint brush | Align brush reticle/paint radius parity using mask-space contract | AI Studio FE | `PENDING` | `CP-103` | High | P1 complete | Reticle vs painted diameter thresholds pass | `TBD` | Includes zoom set `{0.5,1,2,4}` |
| `CP-203` | `P2` | Inpaint lasso | Apply explicit `evenodd` lasso fill and self-intersection characterization | AI Studio FE | `PENDING` | `CP-103` | Medium | P1 complete | Figure-eight and nested-loop deterministic parity tests pass | `TBD` | Remove implicit default rule ambiguity |
| `CP-301` | `P3` | Mask mapping | Align mask canonical resolution and scene-to-mask conversion | AI Studio FE | `PENDING` | `CP-202` | High | P2 brush parity complete | Mask mapping invariants pass across aspects | `TBD` | Image-space canonical mask basis |
| `CP-302` | `P3` | Export parity | Align submit mask export camera/crop with base flatten contract | AI Studio FE | `PENDING` | `CP-301` | High | P3 mapping complete | Export alignment threshold passes under matrix | `TBD` | Includes non-zero pan cases |
| `CP-303` | `P3` | Zoom cap parity | Resolve viewport/flatten zoom cap mismatch | AI Studio FE | `PENDING` | `CP-302` | Medium | Export contract aligned | Same max clamp across viewport and flatten camera | `TBD` | Prevent high-zoom WYSIWYG drift |
| `CP-401` | `P4` | Unit tests | Add transform-chain round-trip and threshold tests | AI Studio FE | `PENDING` | `CP-303` | Medium | P3 complete | Unit matrix tests green | `TBD` | Numeric assertions only |
| `CP-402` | `P4` | Integration tests | Add inline/modal interaction parity tests | AI Studio FE + QA | `PENDING` | `CP-401` | High | Unit tests green | Tool matrix integration tests green | `TBD` | Pointer lifecycle/cancel coverage |
| `CP-403` | `P4` | Visual parity | Add screenshot or pixel-diff drift guard suite | QA | `PENDING` | `CP-402` | Medium | Integration tests green | Drift signatures locked in CI | `TBD` | Zoom/pan/aspect/DPR slices |
| `CP-404` | `P4` | CI gate | Wire parity thresholds into required checks | AI Studio FE + DevEx | `PENDING` | `CP-403` | Medium | Test suites stable | CI blocks threshold regressions | `TBD` | Required before rollout |
| `CP-501` | `P5` | Rollout | Enable guarded canary rollout | AI Studio FE + Ops | `PENDING` | `CP-404` | Medium | CI gates green | Canary metrics within thresholds | `TBD` | Maintain rollback flag posture |
| `CP-502` | `P5` | Verification | Collect production parity evidence bundle | QA + Ops | `PENDING` | `CP-501` | Medium | Canary pass | Production evidence accepted | `TBD` | Required for closeout signoff |
| `CP-503` | `P5` | Closeout | Final closeout packet and de-risk cleanup | AI Studio FE | `PENDING` | `CP-502` | Low | Production evidence accepted | Program marked complete | `TBD` | Remove temporary guardrails |

## Current Blockers
1. `CP-004` baseline evidence is not yet captured.

## Immediate Next Actions
1. Complete `CP-004` baseline evidence packet.
2. Open phase execution doc for `P1` only after `CP-004` exits.
3. Keep all behavior-changing implementation blocked until `P0` exits.

## Reference Docs
1. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-roadmap-2026-03-20.md`
2. `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md`
3. `docs/adr/0034-ai-studio-expert-edit-shared-stage-interaction-parity.md`
