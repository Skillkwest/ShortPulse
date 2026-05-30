import { describe, expect, it } from "vitest";

import { resolveInlineStageRectFromRefs } from "../expertEditStageViewportGeometry";

const createRect = ({
  left,
  top,
  width,
  height,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
}) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

describe("resolveInlineStageRectFromRefs", () => {
  it("prefers the outer wrapper rect over transformed inner stage children", () => {
    const wrapper = document.createElement("div");
    const frame = document.createElement("div");
    const surface = document.createElement("div");
    const wrapperRect = createRect({ left: 10, top: 20, width: 900, height: 600 });
    const frameRect = createRect({ left: 120, top: 80, width: 540, height: 360 });
    const surfaceRect = createRect({ left: 120, top: 80, width: 540, height: 360 });
    wrapper.getBoundingClientRect = () => wrapperRect;
    frame.getBoundingClientRect = () => frameRect;
    surface.getBoundingClientRect = () => surfaceRect;

    const resolved = resolveInlineStageRectFromRefs({
      inlineStageWrapperRef: { current: wrapper },
      primaryCanvasFrameStackRef: { current: frame },
      primaryCompositionSurfaceRef: { current: surface },
    });

    expect(resolved).toBe(wrapperRect);
  });

  it("falls back to the frame stack rect when the wrapper has no usable size", () => {
    const wrapper = document.createElement("div");
    const frame = document.createElement("div");
    const surface = document.createElement("div");
    const wrapperRect = createRect({ left: 10, top: 20, width: 0, height: 0 });
    const frameRect = createRect({ left: 120, top: 80, width: 540, height: 360 });
    const surfaceRect = createRect({ left: 120, top: 80, width: 540, height: 360 });
    wrapper.getBoundingClientRect = () => wrapperRect;
    frame.getBoundingClientRect = () => frameRect;
    surface.getBoundingClientRect = () => surfaceRect;

    const resolved = resolveInlineStageRectFromRefs({
      inlineStageWrapperRef: { current: wrapper },
      primaryCanvasFrameStackRef: { current: frame },
      primaryCompositionSurfaceRef: { current: surface },
    });

    expect(resolved).toBe(frameRect);
  });
});
