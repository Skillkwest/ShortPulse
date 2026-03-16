# Media Rendering Hardening v2 Master Roadmap (2026-03-16)

Last updated: 2026-03-16  
Status: Active  
Companion plan: `docs/planning/media-rendering-hardening-v2-master-plan-2026-03-16.md`

## Purpose
Provide one execution sequence for media rendering hardening so all phases stay aligned to no-regression and no-bloat constraints.

## Workstream Catalog
| Workstream | Scope | Primary Deliverable |
| --- | --- | --- |
| WS0 | Baseline and characterization lock | Inventory + contract + metrics lock |
| WS1 | Read/render contract unification | Signed URL policy and fallback contract |
| WS2 | List/query hardening | Profiled payload and scalable folder queries |
| WS3 | Upload consolidation | Canonical upload path + adapter sunset lane |
| WS4 | Metadata authority | Deterministic dimensions and metadata propagation |
| WS5 | Render performance | Virtualization and scheduling cost reductions |
| WS6 | Anti-bloat governance | Size/boundary guardrails for media hotspots |
| WS7 | Long-tail consistency | Inventory-driven non-hot-path parity sweep |
| WS8 | Rollout and decommission | Ring rollout and adapter retirement closeout |

## Phase Sequencing
1. `R0` -> P0A Characterization + Baseline Lock
2. `R1` -> P0B Inventory Lock
3. `R2` -> P1 Contract Hardening
4. `R3` -> P2 API Payload + Query Hardening
5. `R4` -> P3 Upload Pipeline Consolidation
6. `R5` -> P4 Dimension + Metadata Authority
7. `R6` -> P5 Virtualization + Render Cost Reduction
8. `R7` -> P6 Anti-Bloat Enforcement
9. `R8` -> P7 Long-Tail Surface Sweep
10. `R9` -> P8 Rollout + Decommission

## Dependency Rules
1. P0A and P0B are required before any behavior-changing slices.
2. P1 contract locks must land before P2/P3 changes that rely on them.
3. P2 query-shape hardening must precede high-volume rollout rings.
4. P3 adapter track must remain active until P8 decommission gates pass.
5. P6 guardrails should be enabled before P7 long-tail sweep to prevent bloat backslide.
6. P8 closeout is blocked until two clean release windows complete.

## Critical Path Milestones
1. `M1`: Baseline + characterization lock accepted.
2. `M2`: Signed URL policy decision locked and test-backed.
3. `M3`: Folder query scalability design accepted and implemented.
4. `M4`: Canonical upload path defaulted with adapters in compatibility mode.
5. `M5`: Metadata authority policy accepted and invariants passing.
6. `M6`: Anti-bloat checks in enforce mode for media hotspots.
7. `M7`: Legacy adapters decommissioned with zero P0/P1 regressions.

## Rollout Rings
1. Ring 0: local validation and targeted smoke.
2. Ring 1: staging full gate bundle and perf observation.
3. Ring 2: limited cohort rollout with elevated telemetry watch.
4. Ring 3: full rollout with observation window and decommission readiness check.

## Required Evidence at Each Milestone
1. Command bundle and pass/fail outcomes.
2. Targeted seam tests and assertions.
3. Baseline-vs-current delta summary.
4. Risk and rollback update.
5. Tracker row updates with evidence links.
