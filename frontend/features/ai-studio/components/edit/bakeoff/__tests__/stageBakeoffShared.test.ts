/**
 * Unit tests for shared stage-bakeoff geometry helpers.
 */
import { describe, expect, it } from "vitest";

import {
  createStageBakeoffCamera,
  resolveStageBakeoffArtboardRect,
  resolveStageBakeoffZoomAboutClientPoint,
} from "../stageBakeoffShared";
import { resolveSurfacePointFromClientPoint } from "../../stageSceneGeometry";

describe("stageBakeoffShared", () => {
  it("fits the canonical artboard inside the fixed viewport", () => {
    const artboardRect = resolveStageBakeoffArtboardRect();
    expect(artboardRect.width).toBeGreaterThan(0);
    expect(artboardRect.height).toBeGreaterThan(0);
    expect(artboardRect.left).toBeGreaterThanOrEqual(0);
    expect(artboardRect.top).toBeGreaterThanOrEqual(0);
    expect(artboardRect.width / artboardRect.height).toBeCloseTo(16 / 9, 4);
  });

  it("keeps the workspace point under the pointer stable when zooming", () => {
    const viewportRect = {
      left: 40,
      top: 20,
      width: 920,
      height: 560,
    } as DOMRect;
    const camera = createStageBakeoffCamera();
    const clientX = 328;
    const clientY = 214;
    const before = resolveSurfacePointFromClientPoint({
      clientX,
      clientY,
      rect: viewportRect,
      viewportTransform: camera,
      clampToBounds: false,
    });
    expect(before).not.toBeNull();

    const nextCamera = resolveStageBakeoffZoomAboutClientPoint({
      clientX,
      clientY,
      viewportRect,
      camera,
      nextScale: 1.75,
    });

    const after = resolveSurfacePointFromClientPoint({
      clientX,
      clientY,
      rect: viewportRect,
      viewportTransform: nextCamera,
      clampToBounds: false,
    });

    expect(after).not.toBeNull();
    expect(after?.x ?? 0).toBeCloseTo(before?.x ?? 0, 6);
    expect(after?.y ?? 0).toBeCloseTo(before?.y ?? 0, 6);
  });
});
