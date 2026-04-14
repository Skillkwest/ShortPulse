# AI Studio Master Stage Rebuild Spec (2026-04-12)

Last updated: 2026-04-12  
Status: Active  
Owner: Engineering

## Summary
This spec defines the canonical rebuild target for the AI Studio stage area.

The two primary goals are:
1. make the stage materially better as an editor,
2. trim duplicate systems, rollout scaffolding, and dead-weight seams so future stage work stays clean.

The rebuild target is a Photoshop-like editor model:
1. one master workspace viewport,
2. one bounded aspect-ratio artboard inside it,
3. one layer/document model in artboard coordinates,
4. one selection and transform overlay,
5. one export adapter,
6. one persistence contract.

## Why This Exists
Current repo truth shows three overlapping problems:
1. the canonical editor surface is unclear because generic Canvas and Expert Edit both act like stage systems,
2. the current Expert Edit stage is functionally closer to the desired product but structurally bulky,
3. export, submit, persistence, and parity logic are too entangled with stage orchestration.

This document is the authority source for the rebuild plan and the matching phase plans.

## Authority Order
Use these sources in this order:
1. live code in `frontend/`
2. current ADR/SOP contracts that still match live runtime behavior
3. the planning docs published in this artifact set
4. older planning docs only as historical references

## Current Repo-Backed Baseline
The rebuild plan is based on these verified hotspots and overlap seams:

1. `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
   - dominant orchestration hotspot
   - currently owns stage composition, interaction, session, and generation-adjacent behavior
2. `frontend/features/ai-studio/components/canvas/useAiStudioCanvasWorkspaceState.ts`
   - separate freeboard editor model with its own scene/camera/persistence contracts
3. `frontend/features/ai-studio/components/AiStudioReferenceRail.tsx`
   - threads right-rail canvas duplication into the shell
4. `frontend/features/ai-studio/components/EditPropertiesPanel.tsx`
   - legacy edit fallback path still mounted through page-content routing
5. `frontend/features/ai-studio/components/edit/useExpertEditInlineGenerate.ts`
   - stage flattening, mask export, prompt/reference preparation, and submit dispatch are coupled
6. `frontend/features/ai-studio/logic/sessionPersistencePolicy.ts`
   - rollout-heavy persistence control plane remains broader than the intended durable document contract

## External Product/Architecture References
The rebuild target follows the same separation of concerns used by high-value editor products and platform guidance:
1. Adobe Photoshop workspace and transform-handle model:
   - [Workspace overview](https://helpx.adobe.com/photoshop/web/get-set-up/learn-the-basics/workspace-overview.html)
   - [Display layer edges and handles](https://helpx.adobe.com/photoshop/desktop/create-manage-layers/transform-manipulate-layers/display-layer-edges-and-handles.html)
2. Figma frame/artboard model:
   - [Frames in Figma Design](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design)
3. tldraw camera/bounds guidance:
   - [Camera system](https://tldraw.dev/sdk-features/camera)
4. Pointer and React/Next implementation guidance:
   - [Pointer Events](https://developer.mozilla.org/docs/Web/API/Pointer_events)
   - [setPointerCapture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)
   - [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
   - [React useRef](https://react.dev/reference/react/useRef)

## Locked Planning Defaults
Unless a later explicit product decision changes them, the rebuild assumes:
1. Expert Edit becomes the canonical editor foundation.
2. Generic Canvas is retired as the primary editing system.
3. The expanded Expert Edit modal may survive temporarily only as a presentation shell around the same stage core; it does not survive as a second interaction path.
4. V1 interaction scope is single-select move, resize, and rotate.
5. Multi-select, grouping, snapping, and alignment tooling are deferred.
6. Persistence prioritizes document/artboard/layer state over transient camera state.
7. Extra prompt-reference image fanout is not retained unless the provider contract truly consumes it.

## Phase 1 Substrate Decision
Phase 1 implementation and bakeoff work locked the substrate on 2026-04-12:
1. DOM/CSS is the chosen rendering substrate for the rebuild.
2. The decision is based on keeping the repo's own geometry/export contract authoritative, minimizing dependency and hydration cost, and avoiding a second scene/object model.
3. Konva remains the fallback option only if later execution proves built-in transformer ergonomics are materially worth the abstraction tradeoff.
4. Fabric.js is not part of the rebuild path.

## Goals
1. Deliver one coherent master stage architecture for AI Studio editing.
2. Make the stage act like a bounded workspace/editor rather than a mixed freeboard/editor hybrid.
3. Reduce stage implementation bulk by deleting duplicate surfaces before adding more functionality.
4. Separate stage-core geometry and interaction from provider-specific submit logic.
5. Make future functionality additions cheaper and clearer.

## Explicit Non-Goals
1. No attempt to preserve the generic Canvas as a second full editor by default.
2. No multi-user collaboration work.
3. No opportunistic redesign of unrelated AI Studio panels.
4. No provider/model migration beyond what is required to decouple submit/export boundaries.
5. No expansion into V2 features such as groups, snapping, or alignment tooling.

## Canonical Target Model
### 1) Workspace
One master workspace viewport that owns:
1. camera zoom,
2. camera pan,
3. fit-to-screen and reset behavior,
4. stage-level pointer routing.

### 2) Artboard
One bounded inner artboard that owns:
1. active aspect ratio,
2. width/height contract,
3. visible frame/bounds inside the workspace,
4. authoritative export area.

### 3) Document
One document/layer model in artboard coordinates that owns:
1. layer ordering,
2. image sources,
3. translation, scale, rotation,
4. selection state,
5. layer metadata needed for export and persistence.

### 4) Transform Overlay
One transform/session model that owns:
1. handle positions,
2. drag and rotate sessions,
3. pointer capture lifecycle,
4. overlay drawing rules.

### 5) Tool Plugins
Stage tools are adapters on top of the same camera/artboard/document contract:
1. move/select,
2. inpaint,
3. markup.

### 6) Export Boundary
Stage export owns:
1. artboard flattening,
2. mask export,
3. geometry conversion from document/artboard space to export/output space.

Submit dispatch does not live in stage core.

### 7) Persistence Boundary
Stage persistence owns:
1. durable document/artboard state,
2. durable tool content only when required,
3. versioned snapshot format.

Transient UI sessions and rollout-specific control-plane scaffolding are not stage-core concerns.

## Canonical Coordinate Chain
The target mapping chain is:
1. `screen`
2. `workspace`
3. `artboard`
4. `layer local`
5. `mask/export`

This extends the Expert Edit coordinate-authority direction already recorded in `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md`.

## Delete And Trim List
The rebuild must reduce surface area as part of the work.

Highest-value deletions or demotions:
1. legacy edit fallback
   - `frontend/features/ai-studio/components/EditPropertiesPanel.tsx`
   - `frontend/features/ai-studio/hooks/useAiStudioEditPanelProps.ts`
2. generic Canvas as a first-class editor
   - `frontend/features/ai-studio/components/canvas/*`
3. right-rail canvas duplication
   - `railCanvasProps` threading through page/shell/rail/reference-grid
4. inline versus modal duplicate interaction path
   - modal may remain only as presentation shell if still needed
5. export plus submit coupling
6. rollout-heavy persistence control plane
7. prompt/reference overreach that the active provider path does not consume
8. stale feature flags and dead branches that only protect transitional stage behavior

## Program Structure
This rebuild runs through seven implementation phases:
1. target contract and implementation bakeoff
2. delete duplicate stage surfaces and legacy entry points
3. stage core extraction
4. artboard, selection, and transform implementation
5. export and submit decoupling
6. persistence and session simplification
7. cutover, deletion, and closeout

Phase-specific execution details live in:
1. `docs/planning/ai-studio-master-stage-phase-1-target-contract-and-bakeoff-plan-2026-04-12.md`
2. `docs/planning/ai-studio-master-stage-phase-2-delete-duplicate-stage-surfaces-plan-2026-04-12.md`
3. `docs/planning/ai-studio-master-stage-phase-3-stage-core-extraction-plan-2026-04-12.md`
4. `docs/planning/ai-studio-master-stage-phase-4-artboard-selection-transform-plan-2026-04-12.md`
5. `docs/planning/ai-studio-master-stage-phase-5-export-and-submit-decoupling-plan-2026-04-12.md`
6. `docs/planning/ai-studio-master-stage-phase-6-persistence-and-session-simplification-plan-2026-04-12.md`
7. `docs/planning/ai-studio-master-stage-phase-7-cutover-and-deletion-plan-2026-04-12.md`

## Done State
### Planning-Task Done State
This planning task is done when:
1. the master spec exists,
2. the rebuild tracker exists,
3. each implementation phase has its own plan,
4. the architectural decision is recorded as an ADR,
5. the new docs are added to the relevant indexes,
6. no implementation work has been started by momentum alone.

Once those conditions are met, planning work stops unless a new request extends scope.

### Rebuild Program Done State
The rebuild program is done when all of the following are true:
1. one canonical stage/editor path remains in AI Studio,
2. the stage uses one master workspace and one bounded artboard,
3. artboard aspect ratio is authoritative for editing and export,
4. document layers live in artboard coordinates, independent of camera state,
5. single-select move, resize, and rotate are implemented cleanly on the new stage,
6. inpaint and other stage tools operate through the same canonical coordinate chain,
7. export and mask export depend on the stage export adapter, not submit handlers,
8. session durability is reduced to a clear document-centered contract,
9. legacy edit fallback, generic Canvas-as-editor, right-rail canvas duplication, and duplicate inline/modal interaction paths are removed or formally demoted out of the canonical editor flow,
10. stale stage-only flags, dead branches, and obsolete tests/docs for removed paths are deleted or updated,
11. acceptance validation for the final phase passes.

Once the rebuild program done state is achieved, stop stage-rebuild work unless a new product requirement creates a new concrete lane.

## Stop Rules
Stop and re-scope if:
1. a phase requires preserving duplicate editor systems longer than its explicit exit criteria,
2. a phase starts rebuilding new functionality on top of a surface already marked for deletion,
3. behavior drift requires broad UI rewrites outside the stage scope,
4. the chosen rendering substrate cannot satisfy pan/zoom, artboard, transform, and export requirements without unacceptable complexity,
5. new work no longer reduces stage complexity more than it adds.

## Execution Guardrails
Use these guardrails while the rebuild is active:
1. Do not continue Phase 2 cleanup unless the next cleanup item directly blocks Phase 3 extraction.
2. Prefer extraction work over further compatibility pruning once the canonical editor path is singular and the duplicate right-rail stage contract is gone.
3. Every new implementation slice after Phase 2 must map directly to one of:
   - `stage shell`
   - `camera/workspace`
   - `artboard geometry`
   - `document/layer model`
   - `selection/transform session`
4. If a task does not simplify or strengthen one of those seams, stop and justify it before implementation continues.

## Validation Baseline
The implementation tracker is the operational source of truth, but every phase should maintain:
1. focused seam tests for the touched stage modules,
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`
5. `npm -C frontend run docs:check`

## Related Docs
1. `docs/planning/ai-studio-expert-edit-properties-panel-fresh-start-lean-up-plan-2026-04-10.md`
2. `docs/adr/0030-ai-studio-dual-canvas-right-rail-shared-scene.md`
3. `docs/adr/0034-ai-studio-expert-edit-shared-stage-interaction-parity.md`
4. `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md`
5. `docs/planning/ai-studio-master-stage-rebuild-tracker-2026-04-12.md`
