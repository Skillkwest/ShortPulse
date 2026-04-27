# AI Studio Expert Edit Coordinate Parity Phase 0 Baseline Capture Execution Plan (2026-03-20)

> Archived on 2026-04-27 because the master tracker marks Phase 0 baseline capture complete. This runbook is retained as historical execution context while later active phases remain in `docs/planning/`.

## Purpose
Define the execution contract for `CP-004` baseline capture before any behavior-changing coordinate-parity implementation begins.

This document is execution-specific for tracker row:
1. `CP-004`

## Phase 0 Outcome Contract
Phase 0 baseline capture is complete only when:
1. Baseline behavior is captured across the locked matrix (`zoom`, `pan`, `aspect`, `DPR`, `inline/modal`, `markup/inpaint`).
2. Baseline evidence artifacts are published under the Expert Edit evidence namespace using a consistent template.
3. Baseline acceptance is signed off and linked from the master tracker before Phase 1 work starts.

## Execution Gating
### Entry Criteria
1. ADR 0045 coordinate/interaction contract is accepted.
2. Master roadmap + tracker are indexed and discoverable.
3. No behavior-changing coordinate-parity branch edits are active for baseline capture.

### Hard Blockers
1. Do not start `CP-101` while `CP-004` remains open.
2. Do not update acceptance thresholds during baseline capture.
3. Do not mix baseline and post-fix evidence in the same artifact.

## Baseline Capture Slices
### Slice P0-S1: Fixture and Matrix Lock
Objective:
1. Lock reproducible fixtures and matrix parameters used for baseline characterization.

Deliverables:
1. Matrix lock includes zoom `{0.5,1,2,4}`, pan variants, stage/image aspect variants, and DPR `{1,2,3}`.
2. Fixture set is documented with deterministic stage/image dimensions.
3. Inline and modal parity paths are both included.

### Slice P0-S2: Deterministic Test Baseline
Objective:
1. Capture current automated baseline behavior from unit/integration suites relevant to coordinate mapping and export parity.

Deliverables:
1. Test run results are attached to baseline evidence packet.
2. Failing tests are recorded with explicit context; no fixes are applied in this phase.
3. Command versions and environment context are recorded.

### Slice P0-S3: Interactive Baseline Characterization
Objective:
1. Capture baseline interaction drift signatures for markup, inpaint brush, and export alignment.

Deliverables:
1. Cursor/reticle/stroke mismatch observations are documented for each matrix slice.
2. Export output alignment observations are documented for each matrix slice.
3. Known drift signatures are classified and linked to matrix rows.

### Slice P0-S4: Evidence Packet Assembly
Objective:
1. Publish a complete baseline evidence packet with consistent naming and structure.

Deliverables:
1. Evidence packet uses `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-evidence-template.md`.
2. Artifact naming follows dated convention and includes `cp004-baseline`.
3. Baseline packet links all command outputs and any supporting captures.

### Slice P0-S5: Acceptance and Tracker Update
Objective:
1. Finalize baseline acceptance and unlock Phase 1 entry gate.

Deliverables:
1. `CP-004` is marked `DONE` in tracker with evidence link.
2. Acceptance signoff records owners and timestamp.
3. Phase 1 start permission is explicitly documented.

## Evidence Artifact Convention
1. Baseline packet path: `docs/planning/evidence/ai-studio-expert-edit/<date>-cp004-baseline-matrix.md`
2. Optional supporting captures: `docs/planning/evidence/ai-studio-expert-edit/<date>-cp004-<surface>-<mode>-notes.md`
3. Baseline decision entry: `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-rollout-decision-log-2026-03-20.md`

## Validation and Commands
Minimum required commands:
1. `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/stageSceneGeometry.test.ts`
2. `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/markupStrokeController.test.ts`
3. `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`
4. `npm -C frontend run test -- features/ai-studio/logic/__tests__/expertEditStageFlatten.test.ts`
5. `npm -C frontend run test -- features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
6. `npm -C frontend run type-check`
7. `npm -C frontend run lint`
8. `npm -C frontend run build`
9. `npm -C frontend run docs:check`

## Exit Criteria
1. `CP-004` is marked `DONE`.
2. Baseline evidence packet is published and indexed.
3. Baseline signoff is recorded in decision log.
4. Phase 1 is explicitly unblocked in tracker notes.

## Risks
1. Baseline capture drift due to ad hoc fixture changes.
Mitigation: lock fixture dimensions and command sequence before capture.

2. Incomplete matrix coverage.
Mitigation: require matrix checklist completion in evidence template before signoff.

3. Ambiguous acceptance decisions.
Mitigation: require explicit owner and timestamp in rollout decision log.

## References
1. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-tracker-2026-03-20.md`
3. `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-evidence-template.md`
4. `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-rollout-decision-log-2026-03-20.md`
