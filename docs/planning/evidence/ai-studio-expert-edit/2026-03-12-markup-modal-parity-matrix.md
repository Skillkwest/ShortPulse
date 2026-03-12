# Expert Edit Markup Modal Parity Matrix

- Date: 2026-03-12
- Scope: AI Studio Expert Edit main stage vs Markup modal stage
- Objective: Confirm tool/interaction parity and modular foundation boundaries before compact redesign iteration.

## Baseline (pre-fix audit)

| Capability | Main Stage | Markup Modal Stage | Gap |
| --- | --- | --- | --- |
| Move drag/resize/rotate pointer transform | Yes | No | Critical |
| Move recenter/zoom controls | Yes | Yes | None |
| Inpaint brush/lasso pointer painting | Yes | No | Critical |
| Inpaint overlay visibility | Yes | No | Critical |
| Inpaint clear/invert actions | Yes | Partial | High |
| Markup pen/eraser drawing | Yes | Yes | None |
| Markup pan/wheel zoom | Yes | Yes | None |
| Aspect selector sync | Yes | Yes | None |
| Remove Background / Flatten Layers | Yes | Yes | None |
| Layer selection/reorder/delete | Yes | Yes | None |

## Implemented architecture boundary

1. Shared stage interaction router:
   - `useExpertEditStageInteractionRouter` routes pointer/wheel interactions for `inline` and `modal` surfaces.
2. Dual-surface inpaint controller:
   - `useInpaintMaskController` now renders overlay canvases for both surfaces with one mask state.
3. Modal composition extraction:
   - `ExpertEditMarkupModalShell` handles expanded modal composition; `ExpertEditPanelView` remains orchestration-heavy but less monolithic.

## Validation evidence

1. Targeted parity tests:
   - `npm -C frontend run test -- ExpertEditPanelView.test.tsx`
   - Result: pass (including modal move transform + modal inpaint pointer/overlay coverage).
2. Shared controller regression tests:
   - `npm -C frontend run test -- useInpaintMaskController.test.ts`
3. Gate checks:
   - `npm -C frontend run lint`
   - `npm -C frontend run build`

## Post-fix status

| Capability | Main Stage | Markup Modal Stage | Status |
| --- | --- | --- | --- |
| Move drag/resize/rotate pointer transform | Yes | Yes | Closed |
| Inpaint brush/lasso pointer painting | Yes | Yes | Closed |
| Inpaint overlay visibility | Yes | Yes | Closed |
| Inpaint clear/invert actions | Yes | Yes | Closed |
| Markup pen/eraser drawing | Yes | Yes | Maintained |
| Markup pan/wheel zoom | Yes | Yes | Maintained |
| Shared utility actions / layer ops / aspect sync | Yes | Yes | Maintained |

## Notes

1. This artifact captures parity verification and architecture boundaries only.
2. Compact visual density changes are intentionally treated as a separate styling pass after parity lock.
