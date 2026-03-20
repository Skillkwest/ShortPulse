# AI Studio Expert Edit Coordinate Parity Phase 5 Execution Plan (2026-03-20)

## Purpose
Define the implementation-ready execution plan for Phase 5 (`Controlled Rollout and Closeout`) of the Expert Edit coordinate parity program.

This document is execution-specific for tracker rows:
1. `CP-501`
2. `CP-502`
3. `CP-503`

## Phase 5 Outcome Contract
Phase 5 is complete only when:
1. Coordinate-parity changes are promoted through guarded canary rollout with no threshold regressions.
2. Production evidence confirms pointer/reticle/export parity remains within locked acceptance thresholds.
3. Rollback posture is validated and closeout artifacts are published.

## Execution Gating
### Entry Criteria
1. Phase 4 (`CP-401`, `CP-402`, `CP-403`, `CP-404`) is marked `DONE`.
2. Required CI parity gates are green and enforced.
3. Phase 4 evidence packet and release-readiness summary are accepted.

### Hard Blockers
1. Do not promote canary rollout while any Phase 4 gate remains open.
2. Do not remove temporary parity guardrails until production evidence acceptance is complete.

## Implementation Slices
### Slice P5-S1: Guarded Canary Rollout (`CP-501`)
Objective:
1. Promote coordinate-parity changes behind explicit rollout controls and verify canary health before broader exposure.

Target modules:
1. `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
2. `frontend/features/ai-studio/components/edit/useInpaintMaskController.ts`
3. `frontend/features/ai-studio/components/edit/markupStrokeController.ts`
4. `frontend/features/ai-studio/logic/expertEditStageFlatten.ts`
5. `docs/sops/sop_image_generation.md`

Deliverables:
1. Canary enablement plan defines scope, window length, stop/go thresholds, and rollback triggers.
2. Rollout controls are documented with explicit owner and decision checkpoints.
3. Canary matrix run logs are captured under Expert Edit evidence namespace.

### Slice P5-S2: Production Parity Verification (`CP-502`)
Objective:
1. Validate production behavior against the same matrix and thresholds used during pre-release phases.

Target modules:
1. `docs/planning/evidence/ai-studio-expert-edit/README.md`
2. `docs/planning/evidence/ai-studio-expert-edit/` (new dated evidence artifacts)
3. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-tracker-2026-03-20.md`

Deliverables:
1. Production evidence packet includes zoom/pan/aspect/DPR matrix outcomes for inline and modal surfaces.
2. Threshold summary documents pointer, brush/reticle, and export alignment deltas.
3. Any deviation includes explicit incident record and rollback decision outcome.

### Slice P5-S3: Program Closeout and Guardrail Cleanup (`CP-503`)
Objective:
1. Finalize program closure, lock durable documentation, and remove temporary controls that are no longer required.

Target modules:
1. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-tracker-2026-03-20.md`
3. `docs/planning/README.md`
4. `docs/README.md`
5. `docs/change_log.md` (if required by closeout governance)

Deliverables:
1. Final closeout packet links canary logs, production evidence, and rollback validation.
2. Tracker rows `CP-501`, `CP-502`, and `CP-503` are marked `DONE` with evidence references.
3. Temporary rollout guardrails are removed only after documented signoff.

### Slice P5-S4: Post-Release Monitoring Window
Objective:
1. Run a bounded post-release observation window to confirm parity remains stable under live usage.

Target modules:
1. `docs/operator-map.md`
2. `docs/troubleshooting.md`
3. `docs/planning/evidence/ai-studio-expert-edit/` (monitoring summary artifact)

Deliverables:
1. Monitoring checklist defines alert signals, ownership, and escalation paths.
2. Observation-window summary confirms no emerging drift signatures.
3. Residual risks and follow-up actions are documented explicitly.

## Validation and Commands
Minimum required commands:
1. `npm -C frontend run test:expert-edit:coordinate-parity:gate`
2. `npm -C frontend run docs:check`
3. `npm -C frontend run type-check`
4. `npm -C frontend run lint`
5. `npm -C frontend run build`

## Exit Criteria
1. `CP-501`, `CP-502`, and `CP-503` are all marked `DONE`.
2. Canary and production evidence satisfy all locked acceptance thresholds.
3. Rollback drill and recovery notes are verified and linked in closeout packet.
4. Phase 5 closeout evidence is published and indexed.

## Rollback Posture
1. Keep rollback controls live until Phase 5 completion is formally accepted.
2. If canary or production thresholds fail, rollback is immediate and evidence is captured before reattempt.
3. Preserve all canary and production artifacts for postmortem comparability.

## Risks
1. Live-traffic variability masks low-frequency parity regressions.
Mitigation: enforce matrix replay checks during canary and post-release monitoring window.

2. Rollout controls are removed before enough evidence is captured.
Mitigation: explicit signoff gate tied to `CP-503` exit criteria.

3. Production-only environment differences introduce export drift.
Mitigation: include production-equivalent DPR/aspect fixtures and verify export-path thresholds in canary.

## References
1. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-tracker-2026-03-20.md`
3. `docs/planning/ai-studio-expert-edit-coordinate-parity-phase-4-execution-plan-2026-03-20.md`
4. `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md`
5. `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-evidence-template.md`
6. `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-rollout-decision-log-2026-03-20.md`
