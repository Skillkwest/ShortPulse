# AI Studio Expert Edit Coordinate Parity Phase 3 Execution Plan (2026-03-20)

> Archived on 2026-04-27 because the master tracker marks Phase 3 complete. This execution plan is retained as historical implementation context while the mixed-state program continues through later active phases.

## Purpose
Define the implementation-ready execution plan for Phase 3 (`Mask and Export Camera Parity`) of the Expert Edit coordinate parity program.

This document is execution-specific for tracker rows:
1. `CP-301`
2. `CP-302`
3. `CP-303`

## Phase 3 Outcome Contract
Phase 3 is complete only when:
1. Mask-space mapping is canonical and deterministic across inline/modal, zoom/pan, and aspect combinations.
2. Submit-time export/flatten consumes the same image-space camera and crop basis as draw-time rendering.
3. Viewport zoom clamps and flatten/export zoom clamps are identical by contract.

## Execution Gating
### Entry Criteria
1. Phase 2 (`CP-201`, `CP-202`, `CP-203`) is marked `DONE`.
2. Tool geometry parity thresholds are passing under the master matrix.
3. Phase 2 evidence packet is published and accepted.

### Hard Blockers
1. Do not execute Phase 3 behavior changes while any Phase 2 gate remains open.
2. Do not execute Phase 4 implementation work until Phase 3 exit criteria are accepted.

## Implementation Slices
### Slice P3-S1: Canonical Mask Mapping (`CP-301`)
Objective:
1. Lock mask canonical resolution and scene-to-mask conversion to one shared, testable contract.

Target modules:
1. `frontend/features/ai-studio/components/edit/useInpaintMaskController.ts`
2. `frontend/features/ai-studio/components/edit/inpaintMaskGeometry.ts`
3. `frontend/features/ai-studio/components/edit/stageSceneGeometry.ts`
4. `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`
5. `frontend/features/ai-studio/components/edit/__tests__/stageSceneGeometry.test.ts`

Deliverables:
1. Mask canonical resolution is explicitly bound to selected-layer image-space rules.
2. Scene-to-mask and mask-to-scene mappings are centralized and free of duplicate ad hoc scale factors.
3. Mapping invariants pass across non-square image/stage aspect fixtures and non-zero pan cases.

### Slice P3-S2: Submit Export Camera/Crop Parity (`CP-302`)
Objective:
1. Align inpaint submit/export camera and crop math with base flatten contract so draw-time and submit-time parity is exact within thresholds.

Target modules:
1. `frontend/features/ai-studio/logic/expertEditStageFlatten.ts`
2. `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
3. `frontend/features/ai-studio/components/edit/useInpaintMaskController.ts`
4. `frontend/features/ai-studio/logic/__tests__/expertEditStageFlatten.test.ts`
5. `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`

Deliverables:
1. Submit export consumes the same canonical image-space crop basis as display flatten.
2. Export camera inputs use stage-authoritative geometry only.
3. Export alignment threshold (`<= 1 mask px`) passes across zoom/pan/aspect/DPR matrix.

### Slice P3-S3: Zoom Clamp Parity (`CP-303`)
Objective:
1. Remove viewport/flatten zoom cap divergence and enforce one shared clamp authority.

Target modules:
1. `frontend/features/ai-studio/components/edit/expertEditViewportUtils.ts`
2. `frontend/features/ai-studio/logic/expertEditStageFlatten.ts`
3. `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
4. `frontend/features/ai-studio/logic/__tests__/expertEditStageFlatten.test.ts`

Deliverables:
1. Viewport and flatten/export paths consume one shared zoom clamp contract.
2. High-zoom parity (`z >= 3`) no longer exhibits WYSIWYG drift.
3. Regression tests lock clamp parity so future changes cannot diverge.

### Slice P3-S4: Cross-Surface Export Characterization
Objective:
1. Characterize and verify export parity behavior across inline/modal surfaces and the full matrix.

Target modules:
1. `frontend/features/ai-studio/logic/__tests__/expertEditStageFlatten.test.ts`
2. `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
3. `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`

Deliverables:
1. Matrix coverage for zoom `{0.5,1,2,4}`, pan variants, aspect variants, and DPR variants.
2. Inline/modal evidence confirms no surface-specific export drift.
3. Threshold failures include deterministic diagnostics for camera/crop basis mismatches.

### Slice P3-S5: Evidence Lock and Phase 4 Readiness
Objective:
1. Produce a complete Phase 3 evidence packet and hand off cleanly to regression harness/CI gating work.

Deliverables:
1. Evidence packet under `docs/planning/evidence/ai-studio-expert-edit/` with matrix outputs and threshold checks.
2. Tracker updates for `CP-301`, `CP-302`, `CP-303`.
3. Phase 4 readiness note documenting remaining test-harness and CI risks only.

## Validation and Commands
Minimum required commands:
1. `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/stageSceneGeometry.test.ts`
2. `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`
3. `npm -C frontend run test -- features/ai-studio/logic/__tests__/expertEditStageFlatten.test.ts`
4. `npm -C frontend run test -- features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
5. `npm -C frontend run type-check`
6. `npm -C frontend run lint`
7. `npm -C frontend run build`
8. `npm -C frontend run docs:check`

## Exit Criteria
1. `CP-301`, `CP-302`, `CP-303` are all marked `DONE`.
2. Export alignment thresholds pass under the full matrix with evidence.
3. Zoom clamp parity is enforced by shared contract and regression tests.
4. Phase 3 evidence packet is published and linked from tracker.

## Rollback Posture
1. Keep Phase 3 changes isolated by slice for targeted rollback.
2. Revert order: `P3-S4` -> `P3-S3` -> `P3-S2` -> `P3-S1`.
3. Preserve Phase 2 known-good evidence to compare mask/export parity before and after rollback.

## Risks
1. Hidden secondary crop basis remains in submit path.
Mitigation: static contract audit plus flatten/export test fixtures with non-zero pan.

2. High-DPR rounding introduces edge drift at crop boundaries.
Mitigation: lock DPR-specific assertions and include tolerance diagnostics in tests.

3. Zoom clamp constants drift in future refactors.
Mitigation: one shared clamp authority and explicit parity assertions in flatten + viewport tests.

## References
1. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-tracker-2026-03-20.md`
3. `docs/planning/ai-studio-expert-edit-coordinate-parity-phase-2-execution-plan-2026-03-20.md`
4. `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md`
5. `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-evidence-template.md`
