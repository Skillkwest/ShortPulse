# Enate Ende Canvas Command Index

Purpose: give Enate Ende one compact first-load map for the right-rail Canvas before escalating into deeper context.

## First-Load Contract Set

Load these first for substantive Canvas product work:

- `frontend/features/ai-studio/components/canvas/CANVAS_BEHAVIOR_MATRIX.md`
- `frontend/features/ai-studio/components/canvas/useAiStudioCanvasWorkspaceState.ts`
- `frontend/features/ai-studio/components/canvas/canvasWorkspaceContracts.ts`
- `frontend/features/ai-studio/components/canvas/CanvasPropertiesPanel.tsx`
- `frontend/features/ai-studio/logic/sessionSnapshotCanvas.ts`

For Enate self-maintenance, docs hygiene, or retained-artifact work, do not load these product files by default. Stay inside Enate's owned docs and artifacts unless the task proves a product seam is in scope.

## Owner Paths By Lane

### Shared workspace and viewport composition

- `frontend/features/ai-studio/components/canvas/useAiStudioCanvasWorkspaceState.ts`
- `frontend/features/ai-studio/components/canvas/useCanvasViewportInstanceState.ts`

### Scene state and item mutation

- `frontend/features/ai-studio/components/canvas/canvasSceneState.ts`
- `frontend/features/ai-studio/components/canvas/canvasTypes.ts`
- `frontend/features/ai-studio/components/canvas/canvasGeometry.ts`

### Pointer behavior, marquee, and text editing

- `frontend/features/ai-studio/components/canvas/canvasInteractionController.ts`
- `frontend/features/ai-studio/components/canvas/canvasMarqueeSelection.ts`
- `frontend/features/ai-studio/components/canvas/useCanvasViewportTextHandlers.ts`

### Drag/drop into Canvas

- `frontend/features/ai-studio/components/canvas/canvasDropController.ts`
- `frontend/features/ai-studio/components/canvas/useCanvasViewportDropHandlers.ts`

### Visible Canvas renderer

- `frontend/features/ai-studio/components/canvas/CanvasPropertiesPanel.tsx`
- `frontend/features/ai-studio/components/canvas/CanvasAudioCard.tsx`

### Session durability and restore

- `frontend/features/ai-studio/logic/sessionSnapshotCanvas.ts`

### Canvas media detail authority

- `frontend/features/ai-studio/logic/canvasMediaDisplayAuthority.ts`

## Validation Anchors

Canvas interaction tests:

- `frontend/features/ai-studio/components/canvas/__tests__/canvas.drop.test.tsx`
- `frontend/features/ai-studio/components/canvas/__tests__/canvas.text.test.tsx`
- `frontend/features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx`
- `frontend/features/ai-studio/components/canvas/__tests__/canvasMarqueeSelection.test.ts`
- `frontend/features/ai-studio/components/canvas/__tests__/canvasInteractionController.test.ts`
- `frontend/features/ai-studio/components/canvas/__tests__/canvasDropController.test.ts`

Canvas durability and media authority tests:

- `frontend/features/ai-studio/logic/__tests__/sessionSnapshotCanvas.test.ts`
- `frontend/features/ai-studio/logic/__tests__/canvasMediaDisplayAuthority.test.ts`

## Contract Escalation Docs

Load these only when the boundary is actively in question:

- `docs/adr/0049-ai-studio-right-rail-surface-ownership-and-media-resolution-contract.md`
- `docs/adr/0083-create-mode-global-right-rail-authority.md`
- `docs/sops/sop_ai_studio_index.md`

## Retained Lane Sources

Load these only when the current lane explicitly needs their history:

- `docs/agents/enate-ende/canvas-launch-hardening-plan-2026-07-07.md`: launch-hardening baseline and proof matrix.
- `docs/agents/enate-ende/canvas-runtime-performance-recovery-plan-2026-06-04.md`: completed Canvas-local responsiveness recovery sequence and evidence trail.
- `docs/agents/enate-ende/canvas-tear-out-drag-design-2026-06-03.md`: deferred Canvas-to-workflow export design.
- `docs/agents/enate-ende/canvas-boundary-tear-out-build-plan-2026-06-05.md`: plan-ready build sequence for no-Shift boundary tear-out from Canvas into the Create composer.

Current Canvas-local responsiveness stop state: after deployed/manual testing, small projects had no Canvas lag, while large projects still lagged. Treat that as evidence that the remaining lag belongs to a separate global AI Studio/project-size responsiveness lane unless fresh current proof re-identifies a Canvas-owned seam.

## Scope Reminder

This index is for the right-rail Canvas only. Do not widen into Quick Slot Inventory or Reference Grid unless the user explicitly expands scope.
