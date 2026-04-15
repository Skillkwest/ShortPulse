# AI Studio Inpaint Live Preview Phase 1: Stage Preview Layer Plan (2026-04-14)

Status: Planned  
Owner: Engineering

## Goal
Create one shared mount point for a transient inpaint preview layer that works the same way on inline and modal stages.

## Why This Phase Exists
The repo audit shows the correct mount point already exists: `ExpertEditStageScene.tsx` owns the shared scene stack for both inline and modal surfaces. The first draft identified that insertion point but did not make the mounting contract or stacking constraints explicit enough for implementation.

## Scope
1. add preview-layer ownership to the shared stage-scene composition,
2. mount preview canvases inside the same transformed stage scene as the committed inpaint overlay,
3. keep the layer non-interactive and visually isolated from transform overlays and busy overlays.

## Primary Files
1. `frontend/features/ai-studio/components/edit/ExpertEditStageScene.tsx`
2. `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
3. `frontend/styles/ai-studio-edit-expert.css`

## Entry Criteria
1. The shared stage-scene insertion point is confirmed.
2. The preview layer is known to belong inside `ExpertEditStageScene.tsx`, not in the outer shells.

## Exit Criteria
1. Inline and modal stages each mount a transient preview canvas.
2. The preview layer inherits the same stage sizing and transform context as the committed overlay.
3. The preview layer does not intercept pointer events.
4. The preview layer is visually stacked below transform overlays and busy overlays.

## Work Items
1. Extend stage-scene props to accept transient preview refs for both inline and modal surfaces.
2. Mount the preview layer next to the committed inpaint overlay canvas in the shared scene stack.
3. Add dedicated CSS class ownership for the preview layer and its z-index.
4. Confirm the layer stays inside the shared viewport transform context.

## Risks
1. Incorrect z-index placement could hide preview under committed overlays or above transform overlays.
2. Incorrect `pointer-events` could steal the stage pointer stream.
3. Mounting the layer outside the stage scene would reintroduce inline/modal divergence.

## Non-Goals
1. No pointer-session logic changes yet.
2. No mask-analysis changes yet.
3. No history/export changes.

## Validation
1. Verify both inline and modal stage trees mount the preview layer.
2. Verify preview-layer CSS preserves `pointer-events: none`.
3. Verify the new layer does not disturb existing stage overlays.

## Rollback Note
If this phase destabilizes stage rendering, remove only the new preview-layer refs, canvas mount, and CSS while keeping the committed overlay unchanged.

## Stop Rule
Stop this phase once the shared preview-layer mount exists cleanly for both surfaces.
