# AI Studio Expert Edit Coordinate Parity Master Roadmap (2026-03-20)

Status: active

## Purpose
Define the canonical, decision-locked execution roadmap to restore and harden pixel-accurate draw behavior for Expert Edit markup and inpaint across inline and modal stages.

This master roadmap is the source of truth for phase-level execution docs and supporting governance artifacts.

## Problem Statement
Expert Edit currently has a high-severity zoom/pan regression where pointer sampling, reticle placement, and painted output diverge under non-default camera states.

Regression risk is cross-cutting because draw behavior depends on shared contracts across:
1. DOM geometry and stage rect authority.
2. Camera/viewport transform ownership.
3. Tool pointer unprojection and brush/lasso math.
4. Inpaint mask-space mapping.
5. Submit-time flatten/export camera/crop parity.

## Locked Decisions
1. Canonical coordinate chain is `screen -> stage -> scene -> mask -> export`.
2. Pointer unprojection uses one shared inverse transform exactly once.
3. Authoritative stage rects are `primaryDropzoneRef` (inline) and `markupModalStageRef` (modal).
4. Wrapper rects are non-authoritative for draw/unproject/export math.
5. Interaction surfaces are layout-only; camera transforms are not applied to event target elements.
6. Inpaint brush source-of-truth is mask-space diameter.
7. Inpaint mask canonical resolution equals selected layer image resolution for submit-targeted operations.
8. Lasso fill rule is explicit `evenodd`.
9. Inpaint submit/export uses image-space crop parity and the same camera contract as base flatten.
10. Pointer lifecycle contract requires capture + `pointercancel` handling + coalesced sampling parity for markup and inpaint.

## Scope
1. Expert Edit inline + modal stage parity.
2. Markup draw/erase placement and brush parity.
3. Inpaint brush/lasso placement, mask mapping, and submit export parity.
4. Regression test matrix and CI gate hardening for coordinate parity.
5. Rollout safety controls and rollback evidence.

## Non-Scope
1. New creative tools beyond existing move/inpaint/markup.
2. New renderer technology migration.
3. Multi-user/collaborative drawing semantics.
4. Unrelated AI Studio route/panel redesign work.

## Phase Roadmap
### Phase 0: Contract Lock and Baseline Spec
1. Finalize contracts in ADR and master roadmap/tracker.
2. Define one viewport authority and one transform ownership policy.
3. Publish numeric acceptance thresholds.
4. Freeze current behavior baseline evidence against matrix.

Exit criteria:
1. ADR accepted and indexed.
2. Master tracker published and indexed.
3. Baseline evidence packet generated.

### Phase 1: Coordinate Core Unification
1. Introduce shared transform core for forward/inverse mapping.
2. Remove duplicate ad hoc inverse math paths from tool controllers.
3. Move inline interaction surface to untransformed target parity with modal contract.

Exit criteria:
1. Shared transform core used by markup and inpaint pointer mapping.
2. Inline/modal pointer mapping contract is identical by design.
3. No remaining wrapper-authority draw math paths.

### Phase 2: Tool Geometry Parity
1. Align markup stroke sampling and reticle placement with shared transform core.
2. Align inpaint brush radius mapping so reticle and painted footprint remain contract-accurate.
3. Apply explicit `evenodd` lasso fill semantics and deterministic self-intersection behavior.

Exit criteria:
1. Tool parity assertions pass at zoom set `{0.5, 1, 2, 4}` and non-zero pans.
2. Lasso deterministic parity tests pass for figure-eight and nested loops.

### Phase 3: Mask and Export Camera Parity
1. Align mask canonical resolution/mapping with image-space contract.
2. Ensure submit-time mask export and base flatten use same camera/crop basis.
3. Resolve zoom-cap mismatch between viewport and flatten camera.

Exit criteria:
1. Export alignment error within threshold across zoom/pan/aspect/DPR matrix.
2. No camera-basis divergence between display and submit paths.

### Phase 4: Regression Harness and CI Gates
1. Add deterministic unit tests for transform chain and round-trip stability.
2. Add integration/visual parity tests for pointer-to-stroke and export alignment.
3. Add CI gate assertions for threshold compliance.

Exit criteria:
1. Required tests pass in CI.
2. Drift signatures are covered by locked snapshots or numeric assertions.

### Phase 5: Controlled Rollout and Closeout
1. Rollout behind runtime guardrails.
2. Run canary matrix and monitor parity telemetry.
3. Close with evidence packet and remove temporary guardrails.

Exit criteria:
1. Canary and production parity evidence accepted.
2. Rollback posture verified.
3. Closeout evidence posted.

## Acceptance Thresholds
1. Pointer-to-stroke center error: <= 0.75 CSS px.
2. Reticle diameter versus painted diameter delta: <= 1.0 CSS px equivalent.
3. Export alignment delta: <= 1 mask px.
4. Lasso fill deterministic parity: exact area parity for test fixtures.

## Validation Matrix
1. Zoom: `0.5`, `1`, `2`, `4`.
2. Pan: `(0,0)`, `(37,-19)`, `(-120,80)`.
3. Stage aspect: `1:1`, `4:3`, `16:9`.
4. Image aspect: `1:1`, `4:3`, `16:9`, `9:16`.
5. DPR/device scale factor: `1`, `2`, `3`.
6. Modes: markup pen/eraser, inpaint brush/lasso select/unselect.
7. Surfaces: inline + modal.

## Risks and Mitigations
1. Risk: hidden second inverse path remains.
Mitigation: static search guard + shared transform adapter ownership.

2. Risk: wrapper padding/border contaminates stage origin.
Mitigation: hard contract and tests bound to authoritative stage element refs.

3. Risk: export parity drift at extreme zoom.
Mitigation: lock viewport and flatten zoom limits to same clamp values.

4. Risk: touch/browser gesture interruptions corrupt draw state.
Mitigation: pointer capture and `pointercancel` first-class handling tests.

## Rollback Posture
1. Preserve feature-flag path and targeted revert sequence by phase.
2. Keep baseline evidence snapshot for before/after parity comparison.
3. Do not remove fallback code paths until Phase 5 closeout evidence is accepted.

## Dependencies
1. ADR 0034 shared stage interaction parity baseline.
2. SOP image-generation Expert Edit contract.
3. Existing Expert Edit tests for markup/inpaint controllers as starting characterization.

## Deliverables
1. Master roadmap (this document).
2. Master tracker document with task rows and evidence links.
3. Phase docs authored and tracked as planning scaffolds; behavior-changing implementation remains gated by Phase 0 exit criteria.
4. Phase 0 baseline capture execution plan: `docs/archive/planning/ai-studio-expert-edit-coordinate-parity-phase-0-baseline-capture-execution-plan-2026-03-20.md`.
5. Phase 1 execution plan scaffold: `docs/planning/ai-studio-expert-edit-coordinate-parity-phase-1-execution-plan-2026-03-20.md`.
6. Phase 2 execution plan scaffold: `docs/planning/ai-studio-expert-edit-coordinate-parity-phase-2-execution-plan-2026-03-20.md`.
7. Phase 3 execution plan scaffold: `docs/archive/planning/ai-studio-expert-edit-coordinate-parity-phase-3-execution-plan-2026-03-20.md`.
8. Phase 4 execution plan scaffold: `docs/archive/planning/ai-studio-expert-edit-coordinate-parity-phase-4-execution-plan-2026-03-20.md`.
9. Phase 5 execution plan scaffold: `docs/planning/ai-studio-expert-edit-coordinate-parity-phase-5-execution-plan-2026-03-20.md`.
10. Coordinate parity evidence template: `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-evidence-template.md`.
11. Coordinate parity rollout decision log: `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-rollout-decision-log-2026-03-20.md`.

## References
1. `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md`
2. `docs/planning/ai-studio-expert-edit-coordinate-parity-master-tracker-2026-03-20.md`
3. `docs/adr/0034-ai-studio-expert-edit-shared-stage-interaction-parity.md`
4. `docs/sops/sop_image_generation.md`
5. `docs/archive/planning/ai-studio-expert-edit-coordinate-parity-phase-0-baseline-capture-execution-plan-2026-03-20.md`
6. `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-evidence-template.md`
7. `docs/planning/evidence/ai-studio-expert-edit/coordinate-parity-rollout-decision-log-2026-03-20.md`
