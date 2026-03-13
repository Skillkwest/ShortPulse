/**
 * Unit tests for shared scene-space geometry helpers used by markup/inpaint stage mapping.
 */
import { describe, expect, it } from "vitest";
import {
  mapPixelPointBetweenSpacesViaScene,
  mapPixelRectBetweenSpacesViaScene,
  resolvePixelPointFromSceneSpace,
  resolveSceneMappedDrawRect,
  resolveScenePointFromPixelSpace,
} from "../stageSceneGeometry";

describe("stageSceneGeometry", () => {
  it("round-trips points between pixel space and scene space", () => {
    const sourcePoint = { x: 220, y: 130 };
    const scenePoint = resolveScenePointFromPixelSpace({
      x: sourcePoint.x,
      y: sourcePoint.y,
      spaceWidth: 320,
      spaceHeight: 180,
    });
    const reconstructed = resolvePixelPointFromSceneSpace({
      point: scenePoint,
      spaceWidth: 320,
      spaceHeight: 180,
    });
    expect(reconstructed.x).toBeCloseTo(sourcePoint.x, 4);
    expect(reconstructed.y).toBeCloseTo(sourcePoint.y, 4);
  });

  it("preserves scene coordinates across aspect changes with frame cropping", () => {
    const point16x9 = { x: 220, y: 130 };
    const point9x16 = mapPixelPointBetweenSpacesViaScene({
      point: point16x9,
      fromWidth: 320,
      fromHeight: 180,
      toWidth: 180,
      toHeight: 320,
    });

    const scene16x9 = resolveScenePointFromPixelSpace({
      x: point16x9.x,
      y: point16x9.y,
      spaceWidth: 320,
      spaceHeight: 180,
    });
    const scene9x16 = resolveScenePointFromPixelSpace({
      x: point9x16.x,
      y: point9x16.y,
      spaceWidth: 180,
      spaceHeight: 320,
    });

    expect(scene9x16.x).toBeCloseTo(scene16x9.x, 4);
    expect(scene9x16.y).toBeCloseTo(scene16x9.y, 4);
  });

  it("maps rectangles across aspect changes through scene space", () => {
    const mapped = mapPixelRectBetweenSpacesViaScene({
      rect: {
        x: 90,
        y: 45,
        width: 140,
        height: 80,
      },
      fromWidth: 320,
      fromHeight: 180,
      toWidth: 180,
      toHeight: 320,
    });

    expect(mapped).not.toBeNull();
    expect(mapped?.x ?? 0).toBeCloseTo(0, 3);
    expect(mapped?.y ?? 0).toBeCloseTo(80, 3);
    expect(mapped?.width ?? 0).toBeCloseTo(180, 3);
    expect(mapped?.height ?? 0).toBeCloseTo(142.222, 3);
  });

  it("resolves a uniform draw rect for scene-preserving source rendering", () => {
    const drawRect = resolveSceneMappedDrawRect({
      sourceWidth: 320,
      sourceHeight: 180,
      targetWidth: 180,
      targetHeight: 320,
    });
    expect(drawRect.x).toBeCloseTo(-194.444, 2);
    expect(drawRect.y).toBeCloseTo(0, 2);
    expect(drawRect.width).toBeCloseTo(568.888, 2);
    expect(drawRect.height).toBeCloseTo(320, 2);
    expect(drawRect.scale).toBeCloseTo(1.777, 2);
  });
});
