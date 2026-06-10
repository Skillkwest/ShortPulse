import { describe, expect, it } from "vitest";

import {
  resolveLayerVisualGeometry,
  resolveTransformHandleCounterScale,
} from "../expertEditLayerTransformUtils";

describe("expertEditLayerTransformUtils", () => {
  it("counter-scales transform handles against selected layer scale", () => {
    expect(resolveTransformHandleCounterScale(2)).toBe(0.5);
    expect(resolveTransformHandleCounterScale(0.25)).toBe(4);
    expect(resolveTransformHandleCounterScale(Number.NaN)).toBe(1);
  });

  it("keeps layer transform scale while exposing inverse handle scale", () => {
    const geometry = resolveLayerVisualGeometry({
      imageAspectRatio: 1,
      viewportWidth: 400,
      viewportHeight: 400,
      transform: {
        translateXRatio: 0,
        translateYRatio: 0,
        scale: 0.5,
        rotationDeg: 0,
      },
    });

    expect(geometry.transformCss).toContain("scale(0.5)");
    expect(geometry.transformHandleCounterScale).toBe(2);
  });
});
