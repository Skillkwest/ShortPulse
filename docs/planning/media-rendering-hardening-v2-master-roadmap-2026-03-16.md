# Media Rendering Hardening v2 Master Roadmap (2026-03-16)

Last updated: 2026-03-18
Status: Active  
Companion plan: `docs/planning/media-rendering-hardening-v2-master-plan-2026-03-16.md`

## Purpose
Provide one execution sequence for media rendering hardening so all phases stay aligned to no-regression and no-bloat constraints.

## Lane Map
| lane | focus | blocked by | primary outputs |
| --- | --- | --- | --- |
| Foundation | inventory, policy, telemetry truth, regression armor, shared contracts | none | inventory lock, policy matrix, telemetry truth spec, test realignment matrix |
| Pipeline | ingest/upload authority, metadata authority, derivative readiness, list/sign/resolve/query contracts | Foundation policy + telemetry stop/go | metadata authority, derivative-first server truth, list/query changes, upload consolidation, server-contract handoff to Surface |
| Surface | route/modal/panel/file-modal/panel-preview/reference-grid/character/quick-swap/detail/long-tail adoption | Foundation policy + Pipeline authority contracts | surface parity slices, render-cost improvements, rollout closeout |

## Workstream Catalog
| workstream | scope | primary deliverable |
| --- | --- | --- |
| WS0 | Inventory + telemetry truth + baseline lock | Inventory lock + telemetry truth spec + baseline packet |
| WS1 | Surface policy decision lock | Surface policy matrix + decision-log entries |
| WS2 | Ingest + metadata authority | Metadata authority spec + derivative-first invariant locks |
| WS3 | Read/render contract unification | Cross-surface preview/fallback contract |
| WS4 | Test realignment | Regression-armor matrix + rewritten policy tests |
| WS5 | List/query hardening | Profiled payload + scalable folder query |
| WS6 | Upload consolidation | Canonical upload path + adapter sunset controls |
| WS7 | Render cost + anti-bloat | Virtualization/hydration improvements + enforced guardrails |
| WS8 | Long-tail consistency | Inventory-driven sweep packet |
| WS9 | Rollout + decommission | Ring rollout, decommission packet, closeout evidence |

## Phase Sequencing
1. `R0` -> P0 Inventory + Telemetry Truth + Baseline Lock
2. `R1` -> P1 Surface Policy Decision Lock
3. `R2` -> P2 Ingest + Dimension + Metadata Authority
4. `R3` -> P3 Read/Render Contract Unification
5. `R4` -> P4 Test Realignment + Regression Armor
6. `R5` -> P5 API Payload + Query Hardening
7. `R6` -> P6 Upload Pipeline Consolidation
8. `R7` -> P7 Render Cost Reduction + Anti-Bloat Enforcement
9. `R8` -> P8 Long-Tail Surface Sweep
10. `R9` -> P9 Rollout + Decommission

## Dependency Rules
1. P0 must complete before any behavior-changing slice lands.
2. P1 policy decisions must be accepted before P3/P4/P7 surface behavior edits.
3. P2 dimension authority must precede any contract that relies on image width/height truth.
4. P4 test realignment must start before policy-changing surface slices merge so outdated tests do not block valid work.
5. P5 query-shape hardening must precede high-volume rollout rings.
6. P6 adapter track must remain active until P9 decommission gates pass.
7. P7 guardrails should be in enforce mode before P8 long-tail sweeps broaden the change set.
8. P9 closeout is blocked until two clean release windows complete.

## Critical Path Milestones
1. `M1`: Inventory lock, telemetry truth spec, and stop/go checklist accepted.
2. `M2`: Surface policy decision matrix locked and decision-log aligned.
3. `M3`: Metadata and derivative-readiness authority accepted and invariant tests passing.
4. `M4`: Cross-surface preview/fallback contract green for route/modal/panel/file-modal/panel-preview/reference-grid/character/quick-swap/detail.
5. `M5`: Test realignment complete for all policy-sensitive surfaces.
6. `M6`: Folder query scalability design accepted and implemented.
7. `M7`: Canonical upload path defaulted with adapters in compatibility mode.
8. `M8`: Render-cost and anti-bloat checks in enforce mode for media hotspots.
9. `M9`: Legacy adapters decommissioned with zero P0/P1 regressions.

## Rollout Rings
1. Ring 0: local validation and targeted smoke.
2. Ring 1: staging full gate bundle and perf observation.
3. Ring 2: limited cohort rollout with elevated telemetry watch.
4. Ring 3: full rollout with observation window and decommission readiness check.

## Required Evidence at Each Milestone
1. Command bundle and pass/fail outcomes.
2. Targeted seam tests and assertions.
3. Baseline-vs-current delta summary using telemetry-approved fields.
4. Risk and rollback update.
5. Tracker row updates with evidence links.
6. Decision-log and contract-matrix sync confirmation for policy-changing milestones.
