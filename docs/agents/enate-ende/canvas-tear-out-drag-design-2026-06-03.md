# Canvas Tear-Out Drag Design

Date: `2026-06-03`

Owner: `Enate Ende`

Status: design-ready, not yet implemented

## Purpose

Define the safest high-confidence way to let users drag Canvas items out of the right-rail `Canvas` and drop them into AI Studio workflow targets without degrading normal Canvas repositioning.

This is intentionally a design note, not a launch-hardening commitment. It is feature work and should not displace the July 7, 2026 Canvas launch-stability lane unless the user explicitly reprioritizes it.

## Problem

Today the right-rail Canvas has one dominant drag meaning:

- pointer drag on an item means `move this item inside the Canvas scene`

That behavior is owned by `frontend/features/ai-studio/components/canvas/useCanvasViewportInstanceState.ts`.

The user request is to support a second meaning:

- drag an image, video, audio card, or text note out of Canvas and drop it into workflow surfaces such as the Create prompt/workflow ingress

The danger is overloading one gesture so heavily that normal Canvas dragging becomes error-prone, laggy, or ambiguous.

## Repo Reality

The existing codebase already contains the pieces needed for a safe design:

- Canvas internal drag/reposition is pointer-driven in `frontend/features/ai-studio/components/canvas/useCanvasViewportInstanceState.ts`.
- Canvas render shell already supports optional native HTML drag hooks through `isItemDraggable`, `onItemDragStart`, and `onItemDragEnd` in `frontend/features/ai-studio/components/canvas/CanvasPropertiesPanel.tsx`.
- The Canvas tests already preserve a small export lane: `frontend/features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx` contains a `Shift`-drag export contract that avoids scene movement.
- AI Studio already has a mature internal drag payload and drag-ghost system in `frontend/features/ai-studio/utils/dragDrop.ts`.
- Existing drop targets already know how to ingest internal reference payloads and prompt text through shared drop contracts such as:
  - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridDropController.ts`
  - `frontend/features/ai-studio/components/edit/useExpertEditPrimaryIngress.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioAgentComposer.ts`
- A prior Media Library folder-canvas implementation proved that a Canvas-like surface could export text and media through native dragstart, and the surviving shared-canvas `Shift`-drag export contract is still covered in `frontend/features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx`.

This means the right approach is not a brand-new drag protocol. The right approach is to let Canvas become another trusted source surface for the app's existing internal drag system.

## Goals

- Preserve normal in-Canvas drag as fast, predictable repositioning.
- Let users intentionally tear items out of Canvas into workflow targets.
- Reuse shared internal drag payloads and drag ghosts.
- Keep Canvas items saved in the project unless a future explicit move contract is adopted.
- Avoid large interaction rewrites before proof exists.

## Non-Goals

- No new Canvas object types.
- No general-purpose multi-item export in the first pass.
- No cross-window/system drag ambitions.
- No launch-blocking dependency on this feature.

## Approaches Considered

### Approach A: Convert normal item drag into export the moment the pointer leaves Canvas

Summary:

- Start with the existing pointer drag.
- If pointer crosses the Canvas boundary, reinterpret the gesture as an outside drag.

Why this is weak:

- It makes normal Canvas repositioning fragile near the edge.
- It mixes pointer-session scene updates with native drag/drop late in the gesture.
- It raises regression risk in the most sensitive Canvas owner seam.
- It is harder to reason about cancellation and rollback.

Verdict:

- Reject.

### Approach B: Native export only through an explicit modifier gesture

Summary:

- Keep normal drag untouched.
- Require an explicit export trigger such as `Shift` + drag, or a dedicated handle.
- Use native `dragstart` immediately and skip pointer-scene movement.

Why this is strong:

- Very low regression risk.
- It already has a tiny proving seam in the current Canvas test contract.
- It reuses the shared payload and ghost model cleanly.

Why this is weak:

- It is safe, but less discoverable.
- It does not satisfy the more natural "tear it out" feeling by itself.

Verdict:

- Good transitional fallback.

### Approach C: Ghost-first drag with thresholded handoff into export mode

Summary:

- Start drag with a ghost preview rather than moving the real item node immediately.
- While the pointer is still clearly inside Canvas, treat the gesture as in-Canvas reposition preview.
- If the pointer exits the Canvas and crosses an additional escape threshold or enters a known workflow drop zone, convert into export mode.
- On release inside Canvas, commit the reposition.
- On release into a workflow drop target, send a shared drag payload and keep the Canvas source item intact.

Why this is strong:

- Best end-user feel.
- Solves lag and makes tear-out drag feel intentional.
- Matches the mental model used by mature canvas tools more closely.
- Reduces per-move work if the preview is kept separate from scene commits.

Why this is risky:

- Requires a real interaction-state-machine upgrade.
- Must carefully avoid breaking text edit, pan, marquee, and selection behavior.

Verdict:

- Best long-term design.
- Should be built in staged slices, not as one large rewrite.

## Recommended Direction

Adopt a staged version of Approach C, with Approach B preserved as the safe fallback lane.

The recommended product contract is:

1. Normal item drag still means `move inside Canvas`.
2. Export is opt-in and intentional, never accidental.
3. Canvas drag uses a ghost preview rather than dragging the real media node directly.
4. Leaving the Canvas boundary is not enough by itself to change the meaning of the gesture.
5. Export conversion only happens after a second signal:
   - boundary hysteresis distance, or
   - valid workflow target entry, or
   - explicit modifier/handle
6. First-pass export semantics should be `copy`, not `move`.

Copy-first semantics are safer because Canvas is currently a workspace/archive surface. Pulling an item into a workflow should not silently remove the source from the saved Canvas project state.

## Recommended State Model

Use one drag interaction model with explicit states:

- `idle`
- `canvas-preview`
- `canvas-reposition`
- `export-candidate`
- `export-active`
- `commit-reposition`
- `commit-export`
- `cancel`

Important rule:

- `canvas-reposition` and `export-active` must be mutually exclusive. Once the gesture becomes export, Canvas scene coordinates should stop updating.

## Recommended Technical Shape

### 1. Keep the real owner seams

- Canvas pointer ownership stays in `frontend/features/ai-studio/components/canvas/useCanvasViewportInstanceState.ts`
- Canvas render shell stays in `frontend/features/ai-studio/components/canvas/CanvasPropertiesPanel.tsx`
- Shared drag payload creation should route through `frontend/features/ai-studio/utils/dragDrop.ts`

### 2. Introduce a Canvas-export payload adapter

Create a small Canvas-owned adapter that turns a `CanvasSceneItem` into the same internal drag semantics used by reference cards and folder canvas.

Likely shape:

- media-backed Canvas items export as internal reference/composer-image style payloads when durable authority exists
- text Canvas items export as prompt/library-prompt style payloads
- fallback-only Canvas items fail closed rather than exporting weak authority

### 3. Use a ghost layer

Do not drag the actual image/text node around during the export-candidate phase.

Instead:

- render a ghost preview
- keep the source item visually stable until commit
- commit the scene move only on release inside Canvas

This reduces layout churn and simplifies cancellation.

### 4. Prefer copy semantics at drop targets

Workflow targets should interpret Canvas export as new intake, not ownership transfer.

That means:

- prompt workflows receive prompt text
- image/video/audio workflows receive reference/media intake payloads
- Canvas project state remains unchanged unless a future explicit move contract is designed

## Suggested Rollout

### Stage 1: Safe export lane using existing native drag seam

- Promote the existing `Shift`-drag export concept from test-only support into a real page-wired Canvas export lane.
- Use shared drag payload utilities from `dragDrop.ts`.
- Support text and media separately.
- Keep normal pointer drag unchanged.

Value:

- Very low regression risk
- Fast way to prove payload compatibility with workflow targets

### Stage 2: Ghost-first in-Canvas drag preview

- Replace direct per-move real-item motion with a preview offset layer where practical.
- Commit world-coordinate changes on release.

Value:

- Reduces drag lag
- Creates the foundation for export handoff

### Stage 3: Thresholded tear-out conversion

- Add Canvas-boundary escape detection with hysteresis.
- Convert preview drag into export only when the gesture is clearly intentional.

Value:

- Natural creative feel without edge-trigger fragility

### Stage 4: Discoverability polish

- Add light UX signposting only if needed after behavior works.
- Examples: cursor change, export affordance on select, hint text in docs/tests

## Proof Requirements Before Runtime Rollout

- Canvas reposition still works for image, video, audio, and text.
- Selection, marquee, text edit, and pan behavior remain unchanged.
- Exporting text into prompt/workflow ingress succeeds.
- Exporting media into supported workflow ingress succeeds.
- Invalid or weak-authority Canvas items fail closed gracefully.
- Save/restore still preserves Canvas items before and after attempted exports.
- No duplicate scene movement occurs during export gestures.
- No accidental export occurs when dragging near Canvas edges.

## Launch Scope Guidance

This is not part of the current no-new-features pre-launch Canvas hardening plan by default.

If the user chooses to prioritize this before launch, the safest order is:

1. Stage 1 only
2. validate in production
3. decide whether Stages 2 and 3 are still worth the risk before July 7, 2026

Do not jump directly to thresholded tear-out conversion before proving the existing native drag payload lane first.

## Recommendation

If ShortPulse wants this soon without making a mess:

- implement `Stage 1` first
- keep export as `copy`
- reuse the existing shared drag payload/ghost system
- do not overload the current pointer drag into immediate boundary-based export

That gives the product a real creative-workspace upgrade while keeping the Canvas stable and the implementation legible.
