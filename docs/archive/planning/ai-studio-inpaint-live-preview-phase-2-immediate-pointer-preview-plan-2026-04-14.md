> Archived 2026-05-23 during planning cleanup. Reason: dormant draft plan packet no longer part of the active planning reading path.

# AI Studio Inpaint Live Preview Phase 2: Immediate Pointer Preview Plan (2026-04-14)

Status: draft  
Owner: Engineering

## Goal
Drive brush and lasso preview directly from live pointer input so the user sees feedback immediately while drawing.

## Why This Phase Exists
The current pointer path already mutates authoritative mask state immediately, but visible feedback still waits on the committed overlay path. This phase establishes a proper transient preview path driven by pointer input rather than derived mask analysis.

## Scope
1. reuse coalesced pointer-sample handling for inpaint preview updates,
2. render transient brush feedback from move-time pointer state,
3. render transient lasso feedback from move-time lasso point accumulation.

## Primary Files
1. `frontend/features/ai-studio/components/edit/useInpaintMaskController.ts`
2. `frontend/features/ai-studio/components/edit/inpaintMaskOverlay.ts`
3. `frontend/features/ai-studio/components/edit/markupStrokeController.ts`
4. `frontend/features/ai-studio/components/edit/useExpertEditMarkupDrawController.ts`

## Entry Criteria
1. Shared preview-layer canvases exist in the stage scene.
2. The current pointer-session behavior is characterized well enough to preserve existing commit semantics.

## Exit Criteria
1. Brush preview updates visibly during pointer move, without waiting for mask analysis.
2. Lasso preview shows anchor, active path, endpoint, and closing guidance during drag.
3. Pointer capture and release behavior remain correct.
4. Preview state clears correctly on commit, cancel, or teardown.

## Work Items
1. Add transient preview refs/state to the inpaint controller.
2. Render brush preview from immediate pointer-session samples.
3. Render lasso preview from immediate point accumulation.
4. Keep coalesced-event handling on the preview hot path.
5. Clear transient preview state on pointer-up, cancel, leave, and unmount.

## Risks
1. Brush preview could drift from authoritative mask geometry if preview math differs from commit math.
2. Lasso preview could flicker if the preview loop and committed overlay loop fight over shared state.
3. Pointer-session cleanup bugs could leave stale preview artifacts on the stage.

## Non-Goals
1. No committed-mask contour redesign.
2. No submission/export behavior changes.
3. No worker migration.

## Validation
1. Verify first brush contact paints visible feedback immediately.
2. Verify lasso first-point anchor appears immediately.
3. Verify preview clears correctly on pointer-up, cancel, and leave.

## Rollback Note
If this phase causes visible preview instability, remove the transient preview-state wiring while preserving the mounted preview-layer seam from Phase 1.

## Stop Rule
Stop this phase once immediate brush and lasso feedback are visually present and stable on the live stage.
