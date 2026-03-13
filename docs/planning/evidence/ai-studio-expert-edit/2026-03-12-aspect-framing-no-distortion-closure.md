# Expert Edit Aspect Framing No-Distortion Closure

- Date: 2026-03-12
- Scope: Expert Edit inline stage + Markup modal stage
- Objective: Verify aspect changes are framing-only (crop-by-frame) with no markup/inpaint geometry distortion.

## Implemented contract

1. Markup points are persisted in centered, height-normalized scene coordinates.
2. Inpaint mask mapping uses shared isotropic scene transforms (`surface <-> scene <-> mask`) with one uniform scale plus center offset.
3. Existing mask canvases are no longer anisotropically resized on dropzone/aspect changes.
4. Overlay rendering for markup and inpaint uses scene-preserving transforms; no fixed-square stretch path remains.
5. Aspect switches are crop-by-frame only, never auto-rescale-to-fit.

## Validation evidence

1. Unit coverage:
- `stageSceneGeometry.test.ts` verifies scene-space round-trip and cross-aspect mapping.
- `markupStrokeController.test.ts` verifies scene-space pointer append/hit behavior.
- `useInpaintMaskController.test.ts` verifies isotropic lasso mapping behavior across aspect changes.

2. Component coverage:
- `ExpertEditPanelView.test.tsx` validates markup scene geometry remains stable across `16:9 -> 9:16` in inline stage.
- `ExpertEditPanelView.test.tsx` validates the same no-distortion geometry behavior in expanded modal stage.

3. Regression gate set:
- `npm -C frontend run test -- ExpertEditPanelView.test.tsx`
- `npm -C frontend run test -- markupStrokeController.test.ts`
- `npm -C frontend run test -- useInpaintMaskController.test.ts`
- `npm -C frontend run lint`
- `npm -C frontend run build`

## Result

- Aspect-ratio switching now preserves markup/inpaint shape geometry across supported ratios.
- Frame changes may clip content at bounds by design, but no stretch/squish distortion occurs.
