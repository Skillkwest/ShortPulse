# Expert Edit Master Stage Move/Resize Buildout Plan (2026-06-08)

Status: superseded by `docs/planning/expert-edit-stage-transform-chrome-rebuild-plan-2026-06-08.md`
Owner: Engineering / AI Studio Expert Edit master-stage lane
Source of truth: this plan, bounded by `docs/planning/ai-studio-master-stage-rebuild-spec-2026-04-12.md`, `docs/adr/0054-ai-studio-canonical-master-stage-and-stage-system-sunset.md`, `docs/adr/0034-ai-studio-expert-edit-shared-stage-interaction-parity.md`, and `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md`.

Supersession note: this plan remains useful historical context for the shared image/overlay
geometry and direct manipulation fix. The active implementation source for the later handle-clipping
regression and final transform-chrome rebuild is
`docs/planning/expert-edit-stage-transform-chrome-rebuild-plan-2026-06-08.md`.

## Objective

Make image layers in the Expert Edit stage move and resize in the actual canvas/stage space, not merely move the visible transform handles. The selected image pixels and the transform overlay must derive from one geometry contract so dragging the image body moves the image, dragging resize handles resizes the image, and the handles remain visually locked to the image under the existing stage camera.

## Approved Scope

In scope:

1. Expert Edit stage layer geometry, transform overlay geometry, and pointer routing for single-selected image layers.
2. Inline and expanded Expert Edit stage behavior only where they already share the canonical interaction path.
3. Existing layer transform state, undo/redo/session persistence, and export/flatten adapters, without replacing those authorities.
4. Focused tests that prove image pixels and handles stay aligned during move/resize, including zoomed pointer mapping where practical in the current test harness.

Out of scope:

1. Generic Canvas/right-rail Canvas redesign or revival.
2. Provider, billing, storage, Reference Grid, Quick Slot Inventory, or project persistence changes beyond preserving existing behavior.
3. New stage tools, multi-select, snapping, grouping, alignment guides, or broad visual redesign.
4. Branch, commit, push, deploy, or production-release state changes.
5. Workarounds, duplicate stage implementations, or fallback paths that bypass the canonical Expert Edit stage.

## Current Problem Statement

Repo audit found that the Expert Edit image layer and its transform overlay are rendered through different transform compositions. The image frame applies the layer transform to the actual media element, while the overlay applies translation/rotation to one element and scale to a nested box. CSS also prevents the overlay body from being an explicit move target while resize handles remain interactive. The result is a user-visible failure where handles can appear to move while the image pixels do not reliably move or resize with them.

## Build Plan

1. Create one shared layer-visual geometry contract for the selected image and transform overlay.
   - Derive image frame and overlay placement from the same contained layer rect plus the same layer transform.
   - Keep pointer inverse/camera math in the existing Expert Edit interaction utilities.
2. Replace split overlay/image geometry in the canonical stage rendering path.
   - Make image pixels, selection box, and handles consume the same geometry result.
   - Preserve existing stage camera, layer transform state shape, undo/redo, session persistence, and export adapters.
3. Fix direct manipulation targets.
   - Dragging the selected image/selection body starts move.
   - Dragging corner handles starts resize.
   - Background drag remains stage pan where the current tool contract supports it.
   - Keyboard-modifier resize/rotate behavior may remain as compatibility, but must not be the primary way to resize.
4. Add or restore focused regression coverage.
   - Direct body drag moves the selected layer.
   - Direct handle drag resizes the selected layer.
   - Image and overlay geometry stay aligned after move/resize.
   - Zoomed pointer mapping remains bounded by the existing stage interaction contract where the harness can prove it.
5. Validate and audit.
   - Run focused Expert Edit transform/stage tests.
   - Run the targeted `ExpertEditPanelView` transform slice.
   - Inspect the final diff for accidental scope expansion, duplicate authorities, or unrelated UI/UX changes.

## Proof Requirements

Minimum local proof:

1. Focused transform/stage unit tests pass.
2. Targeted `ExpertEditPanelView` tests for selected-layer overlay, move, resize, and rotate compatibility pass.
3. Added/updated regressions fail against the old split-geometry behavior and pass after the canonical fix.
4. Final diff is limited to the plan source/indexes and Expert Edit stage/transform code plus focused tests.

Production/manual proof is not required in this lane because the user did not approve commit, push, deploy, or production-release work. If production proof is needed, stop and request/receive that scope explicitly.

## Stop Condition

Stop when the in-scope Expert Edit stage can move and resize selected image layers through direct canvas/stage manipulation with image pixels and handles aligned, and the focused local proof above passes or reaches a clear validation blocker.

Stop earlier if:

1. The fix requires replacing the stage substrate, changing generic Canvas, altering provider/export contracts, or changing launch/security/branch/deploy posture.
2. The next step is mostly visual redesign, broad cleanup, or unrelated AI Studio work.
3. Validation shows the plan is incomplete or unsafe for autonomous implementation.
