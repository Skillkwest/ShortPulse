import { describe, expect, it } from "vitest";

import {
  EXPERT_EDIT_LAYER_SCALE_MAX,
  EXPERT_EDIT_LAYER_SCALE_MIN,
  clampLayerScale,
  resolveLayerVisualGeometry,
  resolveClippedLayerTransform,
  resolveTransformHandleCounterScale,
} from "../expertEditLayerTransformUtils";

describe("expertEditLayerTransformUtils", () => {
  it("counter-scales transform handles against selected layer scale", () => {
    expect(resolveTransformHandleCounterScale(2)).toBe(0.5);
    expect(resolveTransformHandleCounterScale(0.25)).toBe(4);
    expect(resolveTransformHandleCounterScale(0.02)).toBe(50);
    expect(resolveTransformHandleCounterScale(8)).toBe(0.125);
    expect(resolveTransformHandleCounterScale(0.25, 2)).toBe(2);
    expect(resolveTransformHandleCounterScale(2, 0.5)).toBe(1);
    expect(resolveTransformHandleCounterScale(Number.NaN)).toBe(1);
  });

  it("keeps layer transform scale while exposing inverse layer and viewport handle scale", () => {
    const geometry = resolveLayerVisualGeometry({
      imageAspectRatio: 1,
      viewportWidth: 400,
      viewportHeight: 400,
      viewportScale: 2,
      transform: {
        translateXRatio: 0,
        translateYRatio: 0,
        scale: 0.5,
        rotationDeg: 0,
      },
    });

    expect(geometry.transformCss).toContain("scale(0.5)");
    expect(geometry.transformHandleCounterScale).toBe(1);
  });

  it("uses the shared wide stage scale range for clipped layer transforms", () => {
    expect(clampLayerScale(0.001)).toBe(EXPERT_EDIT_LAYER_SCALE_MIN);
    expect(clampLayerScale(0.1)).toBe(0.1);
    expect(clampLayerScale(3)).toBe(3);
    expect(clampLayerScale(99)).toBe(EXPERT_EDIT_LAYER_SCALE_MAX);

    expect(
      resolveClippedLayerTransform({
        transform: {
          translateXRatio: 0,
          translateYRatio: 0,
          scale: 0.1,
          rotationDeg: 0,
        },
      }).scale
    ).toBe(0.1);
  });
});
