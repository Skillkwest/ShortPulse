# AI Studio Expert Edit Coordinate Parity Phase 2 Execution Plan (2026-03-20)

## Purpose
Define the implementation-ready execution plan for Phase 2 (`Tool Geometry Parity`) of the Expert Edit coordinate parity program.

This document is execution-specific for tracker rows:
1. `CP-201`
2. `CP-202`
3. `CP-203`

## Phase 2 Outcome Contract
Phase 2 is complete only when:
1. Markup pen/eraser stroke placement remains pointer-accurate under zoom/pan with shared transform core.
2. Inpaint reticle and painted footprint remain contract-accurate across zoom/pan and aspect combinations.
3. Lasso commit behavior is explicit and deterministic with `evenodd` semantics in all characterized self-intersection fixtures.

## Execution Gating
### Entry Criteria
1. Phase 1 (`CP-101`, `CP-102`, `CP-103`) is marked `DONE`.
2. Shared transform core is adopted by both markup and inpaint pointer paths.
3. Stage rect authority contract is enforced in active code paths.

### Hard Blockers
1. Do not execute Phase 2 behavior changes while any Phase 1 gate remains open.
2. Do not execute Phase 3 implementation work until Phase 2 exit criteria are accepted.

## Implementation Slices
### Slice P2-S1: Markup Geometry Parity (`CP-201`)
Objective:
1. Lock markup pointer-to-stroke and eraser-hit placement parity under camera transforms.

Target modules:
1. `frontend/features/ai-studio/components/edit/markupStrokeController.ts`
2. `frontend/features/ai-studio/components/edit/useExpertEditMarkupDrawController.ts`
3. `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
4. `frontend/features/ai-studio/components/edit/__tests__/markupStrokeController.test.ts`

Deliverables:
1. Markup sampling and hit-testing consume the same shared stage/scene mapping contract.
2. Pen and eraser remain parity-accurate in inline and modal surfaces.
3. Coalesced sample behavior remains parity-safe at high pointer velocity.

### Slice P2-S2: Inpaint Brush Parity (`CP-202`)
Objective:
1. Enforce inpaint brush contract where mask-space footprint is stable while reticle display scales consistently with camera.

Target modules:
1. `frontend/features/ai-studio/components/edit/inpaintMaskGeometry.ts`
2. `frontend/features/ai-studio/components/edit/useInpaintMaskController.ts`
3. `frontend/features/ai-studio/components/edit/inpaintMaskOverlay.ts`
4. `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`

Deliverables:
1. Brush radius derivation is contract-aligned with mask-space source-of-truth.
2. Reticle diameter and painted diameter parity assertions pass across zoom and DPR matrix.
3. No duplicate compensations (`sceneScale` and surface/mask scaling) remain beyond the canonical formula.

### Slice P2-S3: Inpaint Lasso Determinism (`CP-203`)
Objective:
1. Make lasso fill semantics explicit (`evenodd`) and deterministic for self-intersection cases.

Target modules:
1. `frontend/features/ai-studio/components/edit/useInpaintMaskController.ts`
2. `frontend/features/ai-studio/components/edit/inpaintMaskGeometry.ts`
3. `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`

Deliverables:
1. Lasso commit path uses explicit `evenodd` fill rule.
2. Figure-eight and nested-loop fixtures produce stable area results.
3. Select/unselect modes preserve deterministic parity behavior.

### Slice P2-S4: Cross-Surface Tool Parity Verification
Objective:
1. Verify that identical tool actions produce parity outcomes between inline and modal surfaces.

Target modules:
1. `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
2. `frontend/features/ai-studio/components/edit/__tests__/markupStrokeController.test.ts`
3. `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`

Deliverables:
1. Inline/modal parity tests for markup and inpaint pass under zoom/pan matrix.
2. Pointer lifecycle paths (`pointerup`, `pointercancel`, leave-with-capture) remain deterministic.

### Slice P2-S5: Evidence Lock and Readiness Hand-off
Objective:
1. Produce Phase 2 evidence and hand off cleanly to Phase 3 planning/execution.

Deliverables:
1. Phase 2 evidence packet with parity matrix outputs.
2. Tracker updates for `CP-201`, `CP-202`, `CP-203`.
3. Phase 3 readiness note documenting known residual risks.

## Validation and Commands
Minimum required commands:
1. `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/markupStrokeController.test.ts`
2. `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`
3. `npm -C frontend run test -- features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
4. `npm -C frontend run type-check`
5. `npm -C frontend run lint`
6. `npm -C frontend run build`
7. `npm -C frontend run docs:check`

## Exit Criteria
1. `CP-201`, `CP-202`, `CP-203` are all marked `DONE`.
2. Tool geometry parity assertions pass under master matrix thresholds.
3. Lasso deterministic behavior is explicitly covered by tests and evidence.
4. Phase 2 evidence packet is published and linked from tracker.

## Rollback Posture
1. Keep Phase 2 changes isolated by slice for targeted rollback.
2. Revert order: `P2-S4` -> `P2-S3` -> `P2-S2` -> `P2-S1`.
3. Preserve Phase 1 known-good parity baseline and compare on rollback.

## Risks
1. Markup and inpaint formulas diverge after shared-core adoption.
Mitigation: cross-surface parity tests and shared formula review checklist.

2. Reticle parity appears correct visually but fails at export-time mapping boundaries.
Mitigation: include contract-level assertions that bridge to Phase 3 export gates.

3. Lasso parity is unstable on high-velocity sample streams.
Mitigation: explicit coalesced-sample characterization and deterministic fixture playback.

## References
1. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-tracker-2026-03-20.md`
3. `docs/planning/ai-studio-expert-edit-coordinate-parity-phase-1-execution-plan-2026-03-20.md`
4. `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md`
5. `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-evidence-template.md`
