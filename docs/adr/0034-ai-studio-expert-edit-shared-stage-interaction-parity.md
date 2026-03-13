# ADR 0034: AI Studio Expert Edit Shared Stage Interaction Parity

- Status: Accepted
- Date: 2026-03-12
- Owners: AI Studio / Expert Edit

## Context
Expert Edit had behavior drift between the inline stage and expanded Markup modal stage. The modal path was using separate event handling and incomplete tool support, causing parity gaps in move and inpaint interactions. The previous structure also concentrated modal composition and stage interaction logic inside `ExpertEditPanelView`, which made safe changes harder.

Key constraints:
1. Keep existing public component contracts stable (no external prop API changes).
2. Preserve existing generation contracts (flatten/remove-background/inpaint submit behavior).
3. Eliminate duplicated interaction logic while keeping surfaces (`inline`, `modal`) behaviorally equivalent.
4. Remove modal-only viewport geometry paths (square stage + frame overlay) that diverged from inline behavior.

## Decision
1. Introduce a shared stage interaction router for both surfaces:
   - `useExpertEditStageInteractionRouter` routes pointer/wheel lifecycle by active tool mode (`move`, `inpaint`, `markup`) and scope (`inline`, `modal`).
   - Inline and modal stages now execute one decision path for tool interactions.
2. Upgrade inpaint controller to dual-surface rendering with shared state:
   - `useInpaintMaskController` owns one mask state and renders overlay output for both inline and modal canvases.
   - Pointer mapping is normalized from active interaction surface bounds so inpaint gestures work consistently in both stages.
3. Extract expanded modal composition into a presentational shell:
   - `ExpertEditMarkupModalShell` contains modal layout slots (General/Move/In-paint/Markup panels, stage, layers).
   - `ExpertEditPanelView` remains orchestration-focused.
4. Enforce parity and compactness with strict tests:
   - Add modal-stage tests for move transforms and inpaint pointer/overlay behavior.
   - Keep shared-state guarantees (aspect sync, utility actions, layers, markup strokes) under existing test coverage.
5. Normalize shared viewport camera state across surfaces:
   - Store camera offsets as `offsetXRatio` / `offsetYRatio` (normalized to active viewport size) with shared `scale`.
   - Resolve per-surface transforms from normalized state so inline and modal render equivalent framing at different pixel sizes.
   - Replace modal square sizing with aspect-fit stage geometry against modal center-column bounds (letterbox/pillarbox).
   - Remove modal-only aspect-frame overlay and rely on shared stage geometry for aspect framing.

## Consequences
Positive:
1. Main stage and modal stage now share core interaction architecture, reducing divergence risk.
2. Inpaint behavior is consistent across surfaces with one mask source of truth.
3. Modal UI composition is modularized, reducing `ExpertEditPanelView` responsibility.
4. Viewport camera semantics are now surface-agnostic and stable under different stage sizes.
5. Compaction changes can be applied through modal-scoped tokens without changing behavior contracts.

Tradeoffs:
1. Additional internal hook/component files increase internal module count.
2. Router/controller boundaries require dependency discipline to avoid over-coupling.
3. Test maintenance now includes explicit parity coverage for both surfaces.

## Links
- `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
- `frontend/features/ai-studio/components/edit/useExpertEditStageInteractionRouter.ts`
- `frontend/features/ai-studio/components/edit/useInpaintMaskController.ts`
- `frontend/features/ai-studio/components/edit/ExpertEditMarkupModalShell.tsx`
- `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
- `docs/sops/sop_image_generation.md`
- `docs/planning/evidence/ai-studio-expert-edit/2026-03-12-markup-modal-parity-matrix.md`
