# AI Studio Master Stage Phase 3: Stage Core Extraction Plan (2026-04-12)

Status: In Progress  
Owner: Engineering

## Goal
Extract a new stage core from the Expert Edit foundation so the stage stops depending on a single orchestration hotspot.

## Target Modules
Phase 3 should produce clear stage-core seams for:
1. `stage shell`
2. `camera controller`
3. `artboard geometry`
4. `document/layer store`
5. `selection/transform session state`
6. `tool plugin boundary`

## Primary Source Surface
The main extraction source is:
1. `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`

The extraction should preserve the useful contracts from:
1. `frontend/features/ai-studio/components/edit/stageSceneGeometry.ts`
2. `frontend/features/ai-studio/components/edit/useExpertEditStageInteractionRouter.ts`
3. `frontend/features/ai-studio/components/edit/useExpertEditTransformController.ts`
4. `frontend/features/ai-studio/components/edit/useInpaintMaskController.ts`

## Scope
1. establish new module ownership,
2. move stage-core logic out of the orchestration hotspot,
3. make the stage-core mountable without the full legacy orchestration mass,
4. keep current user-facing behavior stable where possible.

## Explicit Non-Goals
1. No full transform UX polish yet.
2. No export/submission separation yet.
3. No persistence cleanup yet.

## Entry Criteria
1. duplicate stage surfaces have been deleted or isolated,
2. the chosen stage substrate and target contracts are already locked.

The expanded Expert Edit modal may remain temporarily only as a presentation shell around the same extracted stage core. It is not allowed to remain a second interaction runtime.

## Exit Criteria
1. stage core compiles through the new module seams,
2. `ExpertEditPanelView.tsx` is no longer the only viable stage-core root,
3. core geometry, camera, and document ownership are explicit,
4. tool-specific behavior can hang off the new core instead of owning it.

## Execution Guardrails
1. No additional Phase 2 cleanup unless it directly blocks extraction.
2. Do not widen scope into export, persistence, or provider submission work in this phase.
3. Prefer narrow extraction slices that reduce ownership inside `ExpertEditPanelView.tsx` without changing user-visible behavior.

## First Extraction Slice
The first implementation lane for Phase 3 should extract and stabilize:
1. `stage shell`
2. `camera/workspace state`
3. `artboard geometry`
4. `document/layer ownership`
5. `selection/transform session boundaries`

The first slice should not attempt:
1. inpaint export redesign,
2. prompt/reference submission cleanup,
3. persistence migration.

## Validation
1. Run focused stage geometry and transform tests for touched seams.
2. Confirm stage mount logic does not require the deleted stage systems.
3. Confirm the new core exposes one canonical camera/artboard/document boundary.

## Current Progress
Completed on 2026-04-12:
1. Extracted stage viewport/artboard ownership out of `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx` into:
   - `frontend/features/ai-studio/components/edit/useExpertEditStageViewport.ts`
   - `frontend/features/ai-studio/components/edit/expertEditStageViewportGeometry.ts`
2. Moved inline/modal stage refs, viewport sizing, modal shell sizing, artboard fit math, and client-to-surface geometry adapters behind the new stage-viewport seam.
3. Extracted the inline and expanded modal stage-shell mounts into `frontend/features/ai-studio/components/edit/ExpertEditStageSurface.tsx`, so `ExpertEditPanelView.tsx` no longer directly renders both stage shells.
4. Extracted transform-session ownership into:
   - `frontend/features/ai-studio/components/edit/useExpertEditTransformSession.tsx`
   - `frontend/features/ai-studio/components/edit/ExpertEditTransformOverlay.tsx`
5. Moved transform pointer-session refs, history-apply wiring, controller integration, and selected-layer overlay rendering behind the new transform-session seam.
6. Kept inpaint behavior, export wiring, and persistence ownership in the legacy orchestrator for now so this slice stays behavior-neutral.
7. Extracted document/layer state ownership into `frontend/features/ai-studio/components/edit/useExpertEditDocumentState.ts`, centralizing layer stack state, selection, rename/delete/reorder flows, primary ingress wiring, and layer-derived selectors.
8. Extracted the inline/modal layers UI and shared layer utility actions into `frontend/features/ai-studio/components/edit/ExpertEditLayersPanel.tsx`, reducing layer-surface rendering ownership inside `ExpertEditPanelView.tsx`.
9. Extracted manual flatten and remove-background execution into `frontend/features/ai-studio/components/edit/useExpertEditLayerActions.ts`, moving pending-state ownership, flatten export orchestration, and remove-background dispatch out of the panel hotspot while keeping session sync wired through one adapter seam.
10. Extracted the session bridge into `frontend/features/ai-studio/components/edit/useExpertEditSessionBridge.ts`, moving session-dispatch refs, host-sync orchestration, and session-owned unmount cleanup out of `ExpertEditPanelView.tsx`.
11. Extracted stage history and general action orchestration into `frontend/features/ai-studio/components/edit/useExpertEditStageHistory.ts`, moving markup and inpaint history state, history baselines, restore/apply effects, general undo/redo dispatch, and reset/clear-generation flows out of the panel hotspot while leaving transform history and tool-specific routing in place.
12. Extracted stage chrome orchestration into `frontend/features/ai-studio/components/edit/useExpertEditStageChrome.ts`, moving modal open/close behavior, stage context-menu state, inline pan-capture handlers, and modal/context-menu lifecycle effects out of the panel hotspot while keeping the modal-open state local to support viewport geometry setup.
13. Extracted stage lifecycle behavior into `frontend/features/ai-studio/components/edit/useExpertEditStageLifecycle.ts`, moving stage wheel listeners, modal undo/redo hotkeys, markup-pan keyboard handling, cursor cleanup, and inpaint-collapse lifecycle behavior out of the panel hotspot while preserving the existing stage interaction contract.
14. Extracted stage controls render composition into `frontend/features/ai-studio/components/edit/ExpertEditStageControls.tsx`, moving markup/move/inpaint panel rendering, modal general controls, prompt preset toolbar rendering, and preset utility action rendering out of the panel hotspot while keeping the stage-interaction contract unchanged.

## Rollback Note
If extraction destabilizes the stage before the new seams are strong enough, keep one temporary adapter from the old orchestrator to the new stage core. Do not copy logic back into the old hotspot.
