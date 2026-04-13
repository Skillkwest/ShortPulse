# AI Studio Master Stage Phase 4: Artboard Selection And Transform Plan (2026-04-12)

Status: In Progress  
Owner: Engineering

## Goal
Implement the core editing behavior of the rebuilt stage: one explicit artboard, one canonical selection model, and one transform system.

## Scope
This phase covers:
1. artboard sizing and framing,
2. workspace pan and zoom,
3. single-layer selection,
4. move handles and drag sessions,
5. resize handles and scale sessions,
6. rotation support,
7. overlay rendering for selection and transforms.

## Required Behavior
1. the workspace can pan and zoom independently from document geometry,
2. the artboard remains the authoritative aspect-ratio boundary,
3. selected image layers are manipulated in artboard coordinates,
4. transform handles visually track the selected layer through camera changes,
5. fit, reset, and `100%` semantics are deterministic.

## Explicit Non-Goals
1. No multi-select or grouping.
2. No snapping or alignment tools.
3. No export or persistence migration yet.

## Entry Criteria
1. stage core seams exist and are stable enough to host transforms,
2. the artboard/document/camera ownership is already explicit.

## Exit Criteria
1. one canonical stage path supports single-select move/resize/rotate,
2. transform sessions use the new stage core instead of legacy duplicate paths,
3. camera and document state remain independent,
4. acceptance tests cover transform behavior and artboard-first geometry.

## Validation
1. focused transform and geometry tests,
2. manual smoke for pan/zoom, fit, reset, and selection overlay behavior,
3. confirm no dependency on deleted rail/legacy stage systems.

## Current Focus
Phase 4 starts from the extracted stage-core seams and should now target the first artboard-first interaction lane:
1. make the extracted stage core the authoritative path for single-select move/resize/rotate behavior,
2. reduce reliance on panel-local interaction assembly where transform and router behavior still depend on legacy orchestration,
3. keep camera state independent from document geometry and selection state through the extracted seams,
4. avoid new compatibility layers while converting remaining transform behavior to the new canonical stage path.

## First Execution Lane
1. tighten the selection/transform path so the extracted stage core, not panel-local shell glue, is the canonical owner of single-select interaction,
2. keep the current artboard and viewport contracts stable while doing that,
3. do not widen into export, persistence, or provider submission cleanup during this lane.

## Current Progress
Completed on 2026-04-12:
1. Enabled the canonical single-select transform path in `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx` so move-mode interactions now use the extracted transform-session/controller path instead of the previous frozen placeholder behavior.
2. Updated focused app-level transform coverage in `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx` to assert the real Phase 4 behavior for:
   - overlay and handle visibility in move mode,
   - resize behavior,
   - move history and recenter behavior,
   - rotation behavior with undo/redo,
   - expanded-modal transform behavior.
3. Kept the transform math and controller path rooted in the extracted stage-core seams without widening into export, persistence, or provider submission work.
4. Extracted stage interaction handler assembly and router wiring into `frontend/features/ai-studio/components/edit/useExpertEditStageInteractions.ts`, moving move/inpaint/markup handler composition out of `ExpertEditPanelView.tsx` while keeping the active transform path and stage-routing behavior unchanged.
5. Tightened the extracted interaction path by moving inline/modal stage router assembly and move/inpaint/markup handler composition into `frontend/features/ai-studio/components/edit/useExpertEditStageInteractions.ts`, reducing panel-local interaction glue without introducing another compatibility layer.
6. Extracted transform-runtime glue into `frontend/features/ai-studio/components/edit/useExpertEditStageTransformRuntime.ts`, moving transform-history transition ownership, selected-layer overlay gating, move recenter behavior, and stage cursor/style resolution out of `ExpertEditPanelView.tsx` while preserving the canonical move/resize/rotate path.
7. Extracted the inline/modal stage workspace shell into `frontend/features/ai-studio/components/edit/ExpertEditStageWorkspace.tsx`, moving canonical stage-surface, modal-surface, and context-menu assembly out of `ExpertEditPanelView.tsx` while keeping the live artboard interaction path unchanged.
8. Extracted preset-panel runtime into `frontend/features/ai-studio/components/edit/useExpertEditPresetRuntime.ts`, moving More Presets drag/drop session ownership, panel/surface drop state, preset apply behavior, and custom preset save handling out of `ExpertEditPanelView.tsx` while keeping preset-panel behavior stable.

## Rollback Note
If the new transform system is not stable enough for general use, keep a narrowly-scoped adapter to the prior transform path while preserving the new artboard-first data model. Do not reopen generic Canvas as a fallback editor.
