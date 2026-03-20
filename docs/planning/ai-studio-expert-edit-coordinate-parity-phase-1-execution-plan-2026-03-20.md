# AI Studio Expert Edit Coordinate Parity Phase 1 Execution Plan (2026-03-20)

## Purpose
Define the implementation-ready execution plan for Phase 1 (`Coordinate Core Unification`) of the Expert Edit coordinate parity program.

This document is execution-specific for tracker rows:
1. `CP-101`
2. `CP-102`
3. `CP-103`

## Phase 1 Outcome Contract
Phase 1 is complete only when:
1. Markup and inpaint pointer unprojection consume one shared forward/inverse transform core.
2. Inline and modal pointer mapping follow identical transform ownership semantics.
3. Authoritative rect usage is stage-only (`primaryDropzoneRef`, `markupModalStageRef`) with no wrapper-authority fallback in draw/export mapping paths.

## Execution Gating
### Entry Criteria
1. `CP-004` baseline evidence packet is complete and approved.
2. ADR 0045 decisions are accepted and unchanged.
3. Existing characterization tests are passing on current branch.

### Hard Blockers
1. Do not execute behavior-changing edits before `CP-004` exits.
2. Do not execute Phase 2 implementation work until Phase 1 exit criteria are accepted.

## Implementation Slices
### Slice P1-S1: Shared Transform Core Introduction (`CP-101` part A)
Objective:
1. Introduce a shared transform service for `stage <-> scene` and `scene <-> mask` mapping with explicit forward/inverse APIs.

Target modules:
1. `frontend/features/ai-studio/components/edit/stageSceneGeometry.ts` (extend or split)
2. `frontend/features/ai-studio/components/edit/inpaintMaskGeometry.ts`
3. `frontend/features/ai-studio/components/edit/markupStrokeController.ts`

Deliverables:
1. One canonical transform input model (stage rect, camera scale/offset, fit rect).
2. One inverse mapping path for pointer samples.
3. Utility tests for round-trip stability and numeric tolerance.

### Slice P1-S2: Markup Controller Migration (`CP-101` part B)
Objective:
1. Remove local ad hoc inverse math from markup pointer conversion and migrate to shared transform core.

Target modules:
1. `frontend/features/ai-studio/components/edit/markupStrokeController.ts`
2. `frontend/features/ai-studio/components/edit/useExpertEditMarkupDrawController.ts`
3. `frontend/features/ai-studio/components/edit/__tests__/markupStrokeController.test.ts`

Deliverables:
1. Markup pointer unprojection uses shared core only.
2. No duplicate center/scale inverse formulas remain in markup path.
3. Tests assert parity under zoom/pan matrices.

### Slice P1-S3: Inpaint Controller Migration (`CP-101` part C)
Objective:
1. Remove local ad hoc inverse math from inpaint pointer conversion and migrate to shared transform core.

Target modules:
1. `frontend/features/ai-studio/components/edit/inpaintMaskGeometry.ts`
2. `frontend/features/ai-studio/components/edit/useInpaintMaskController.ts`
3. `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`

Deliverables:
1. Inpaint pointer unprojection uses shared core only.
2. Brush/lasso sample mapping uses same transform contract as markup.
3. Tests assert mapping consistency at non-default zoom/pan.

### Slice P1-S4: Surface Transform Ownership and Rect Authority (`CP-102`, `CP-103`)
Objective:
1. Enforce untransformed interaction target semantics and stage-only authoritative rect mapping.

Target modules:
1. `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
2. `frontend/features/ai-studio/components/edit/ExpertEditMarkupModalShell.tsx`
3. `frontend/features/ai-studio/components/edit/expertEditViewportUtils.ts`
4. `frontend/styles/ai-studio-edit-expert.css`

Deliverables:
1. Inline stage interaction target does not carry camera transform.
2. Modal follows same ownership rule as inline.
3. Wrapper rect fallback removed from draw/export authoritative paths.
4. No draw-time mapping dependency on wrapper padding/border geometry.

### Slice P1-S5: Characterization Lock and Evidence
Objective:
1. Lock Phase 1 completion with deterministic verification artifacts.

Deliverables:
1. Unit matrix for transform round-trip.
2. Integration matrix for inline/modal pointer parity.
3. Evidence packet under `docs/planning/evidence/ai-studio-expert-edit/`.

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
1. `CP-101`, `CP-102`, `CP-103` all marked `DONE`.
2. No remaining duplicate pointer inverse paths in markup/inpaint code.
3. Authoritative stage rect contract enforced and verified by tests.
4. Phase 1 evidence packet is published and linked from tracker.

## Rollback Posture
1. Keep Phase 1 changes isolated by slice for revertability.
2. Revert order: `P1-S4` -> `P1-S3` -> `P1-S2` -> `P1-S1`.
3. Preserve baseline evidence packet for parity comparison before/after rollback.

## Risks
1. Hidden duplicate inverse logic survives migration.
Mitigation: static search checks and reviewer checklist.

2. Inline-only style/layout assumptions reintroduce rect drift.
Mitigation: parity tests run against inline + modal at all zoom set points.

3. Export path still reading non-authoritative rect source.
Mitigation: explicitly audit flatten/mask camera inputs in Phase 1 closeout.

## References
1. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-tracker-2026-03-20.md`
3. `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md`
4. `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-evidence-template.md`
