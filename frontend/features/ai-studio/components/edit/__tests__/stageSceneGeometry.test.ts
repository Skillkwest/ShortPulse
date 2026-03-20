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
  resolveSurfacePointFromClientPoint,
  resolveSurfacePointFromViewportSamplePoint,
  resolveViewportSamplePointFromSurfacePoint,
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

  it("round-trips viewport-transformed sample points through a single inverse", () => {
    const surfacePoint = { x: 84.5, y: 52.25 };
    const viewportTransform = {
      scale: 2,
      offsetX: 12,
      offsetY: -8,
    };
    const samplePoint = resolveViewportSamplePointFromSurfacePoint({
      point: surfacePoint,
      viewportTransform,
      viewportWidth: 200,
      viewportHeight: 100,
    });
    const resolvedSurfacePoint = resolveSurfacePointFromViewportSamplePoint({
      point: samplePoint,
      viewportTransform,
      viewportWidth: 200,
      viewportHeight: 100,
    });
    expect(resolvedSurfacePoint.x).toBeCloseTo(surfacePoint.x, 6);
    expect(resolvedSurfacePoint.y).toBeCloseTo(surfacePoint.y, 6);
  });

  it("resolves client points through viewport inverse and clamps when requested", () => {
    const rect = {
      left: 10,
      top: 20,
      width: 200,
      height: 100,
    } as DOMRect;
    const unclamped = resolveSurfacePointFromClientPoint({
      clientX: 60,
      clientY: 45,
      rect,
      viewportTransform: {
        scale: 0.5,
        offsetX: 0,
        offsetY: 0,
      },
      clampToBounds: false,
    });
    expect(unclamped).toEqual({
      x: 0,
      y: 0,
    });

    const clamped = resolveSurfacePointFromClientPoint({
      clientX: -30,
      clientY: 400,
      rect,
      viewportTransform: {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      },
      clampToBounds: true,
    });
    expect(clamped).toEqual({
      x: 0,
      y: 100,
    });
  });

  it("round-trips canonical zoom and pan tuples through viewport transforms", () => {
    const zoomLevels = [0.5, 1, 2, 4];
    const panTuples = [
      { x: 0, y: 0 },
      { x: 37, y: -19 },
      { x: -120, y: 80 },
    ];
    const surfacePoints = [
      { x: 100, y: 80 },
      { x: 640.25, y: 450.5 },
      { x: 1110, y: 760 },
    ];
    const rect = {
      left: 24,
      top: 16,
      width: 1200,
      height: 900,
    } as DOMRect;

    zoomLevels.forEach((zoom) => {
      panTuples.forEach((pan) => {
        surfacePoints.forEach((surfacePoint) => {
          const samplePoint = resolveViewportSamplePointFromSurfacePoint({
            point: surfacePoint,
            viewportTransform: {
              scale: zoom,
              offsetX: pan.x,
              offsetY: pan.y,
            },
            viewportWidth: rect.width,
            viewportHeight: rect.height,
          });
          const inverseSurfacePoint = resolveSurfacePointFromViewportSamplePoint({
            point: samplePoint,
            viewportTransform: {
              scale: zoom,
              offsetX: pan.x,
              offsetY: pan.y,
            },
            viewportWidth: rect.width,
            viewportHeight: rect.height,
          });
          const clientResolvedPoint = resolveSurfacePointFromClientPoint({
            clientX: rect.left + samplePoint.x,
            clientY: rect.top + samplePoint.y,
            rect,
            viewportTransform: {
              scale: zoom,
              offsetX: pan.x,
              offsetY: pan.y,
            },
            clampToBounds: false,
          });

          expect(inverseSurfacePoint.x).toBeCloseTo(surfacePoint.x, 6);
          expect(inverseSurfacePoint.y).toBeCloseTo(surfacePoint.y, 6);
          const sampleIsInBounds =
            samplePoint.x >= 0 &&
            samplePoint.x <= rect.width &&
            samplePoint.y >= 0 &&
            samplePoint.y <= rect.height;
          if (!sampleIsInBounds) {
            expect(clientResolvedPoint).toBeNull();
            return;
          }
          expect(clientResolvedPoint).not.toBeNull();
          expect(clientResolvedPoint?.x ?? 0).toBeCloseTo(surfacePoint.x, 6);
          expect(clientResolvedPoint?.y ?? 0).toBeCloseTo(surfacePoint.y, 6);
        });
      });
    });
  });
});
