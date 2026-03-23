/**
 * Unit tests for Expert Edit markup stroke controller helpers.
 */
import { describe, expect, it } from "vitest";
import {
  appendMarkupStrokePoints,
  resolveMarkupPointerPoint,
  resolveMarkupStrokeHit,
  resolvePointerSampleEvents,
  type MarkupStroke,
} from "../markupStrokeController";

describe("markupStrokeController", () => {
  it("falls back to the native pointer event when coalesced samples are unavailable", () => {
    const nativePointerEvent = {
      clientX: 12,
      clientY: 18,
    } as unknown as PointerEvent;

    const sampleEvents = resolvePointerSampleEvents(nativePointerEvent);
    expect(sampleEvents).toHaveLength(1);
    expect(sampleEvents[0]).toBe(nativePointerEvent);
  });

  it("uses coalesced events when provided", () => {
    const sampleA = { clientX: 10, clientY: 20 } as PointerEvent;
    const sampleB = { clientX: 14, clientY: 24 } as PointerEvent;
    const nativePointerEvent = {
      clientX: 0,
      clientY: 0,
      getCoalescedEvents: () => [sampleA, sampleB],
    } as unknown as PointerEvent;

    expect(resolvePointerSampleEvents(nativePointerEvent)).toEqual([sampleA, sampleB]);
  });

  it("resolves normalized pointer coordinates with viewport transform", () => {
    const rect = {
      left: 10,
      top: 20,
      width: 200,
      height: 100,
    } as DOMRect;

    const point = resolveMarkupPointerPoint({
      clientX: 110,
      clientY: 70,
      rect,
      viewport: {
        scale: 2,
        offsetXRatio: 0.1,
        offsetYRatio: -0.1,
      },
      applyViewportTransform: true,
    });

    expect(point).not.toBeNull();
    expect(point?.sceneX ?? 0).toBeCloseTo(-0.1, 3);
    expect(point?.sceneY ?? 0).toBeCloseTo(0.05, 3);
  });

  it("uses explicit viewport offset pixels when the camera authority differs from the interaction rect", () => {
    const rect = {
      left: 0,
      top: 0,
      width: 200,
      height: 100,
    } as DOMRect;

    const point = resolveMarkupPointerPoint({
      clientX: 130,
      clientY: 50,
      rect,
      viewport: {
        scale: 2,
        offsetXRatio: 0.25,
        offsetYRatio: 0,
      },
      applyViewportTransform: true,
      viewportOffsetX: 60,
      viewportOffsetY: 0,
    });

    expect(point).not.toBeNull();
    expect(point?.sceneX ?? 0).toBeCloseTo(-0.15, 6);
    expect(point?.sceneY ?? 0).toBeCloseTo(0, 6);
  });

  it("uses direct stage mapping when viewport transform is disabled", () => {
    const rect = {
      left: 10,
      top: 20,
      width: 200,
      height: 100,
    } as DOMRect;

    const point = resolveMarkupPointerPoint({
      clientX: 110,
      clientY: 70,
      rect,
      viewport: {
        scale: 2,
        offsetXRatio: 0.1,
        offsetYRatio: -0.1,
      },
      applyViewportTransform: false,
    });

    expect(point).toEqual({
      sceneX: 0,
      sceneY: 0,
    });
  });

  it("keeps pointer-to-scene mapping stable across canonical zoom and pan tuples", () => {
    const rect = {
      left: 20,
      top: 40,
      width: 1200,
      height: 900,
    } as DOMRect;
    const clientX = rect.left + 0.62 * rect.width;
    const clientY = rect.top + 0.41 * rect.height;
    const zoomLevels = [0.5, 1, 2, 4];
    const panTuples = [
      { x: 0, y: 0 },
      { x: 37, y: -19 },
      { x: -120, y: 80 },
    ];
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const sampleX = clientX - rect.left;
    const sampleY = clientY - rect.top;

    zoomLevels.forEach((zoom) => {
      panTuples.forEach((pan) => {
        const point = resolveMarkupPointerPoint({
          clientX,
          clientY,
          rect,
          viewport: {
            scale: zoom,
            offsetXRatio: pan.x / rect.width,
            offsetYRatio: pan.y / rect.height,
          },
          applyViewportTransform: true,
        });
        const expectedSurfaceX = centerX + (sampleX - centerX - pan.x) / zoom;
        const expectedSurfaceY = centerY + (sampleY - centerY - pan.y) / zoom;
        const expectedSceneX = (expectedSurfaceX - centerX) / rect.height;
        const expectedSceneY = (expectedSurfaceY - centerY) / rect.height;

        expect(point).not.toBeNull();
        expect(point?.sceneX ?? 0).toBeCloseTo(expectedSceneX, 6);
        expect(point?.sceneY ?? 0).toBeCloseTo(expectedSceneY, 6);
      });
    });
  });

  it("appends stroke points only after minimum movement threshold", () => {
    const stroke: MarkupStroke = {
      id: "stroke-1",
      color: "#ff4fa3",
      sizeRatio: 0.05,
      points: [{ sceneX: -0.3, sceneY: -0.3 }],
    };

    const nextStroke = appendMarkupStrokePoints({
      stroke,
      samples: [
        { sceneX: -0.2995, sceneY: -0.2995 },
        { sceneX: -0.22, sceneY: -0.22 },
      ],
      stageWidth: 300,
      stageHeight: 300,
      minDistancePx: 0.8,
    });

    expect(nextStroke.points).toHaveLength(2);
    expect(nextStroke.points[1]).toEqual({ sceneX: -0.22, sceneY: -0.22 });
  });

  it("detects stroke hit for eraser and ignores distant points", () => {
    const stroke: MarkupStroke = {
      id: "stroke-2",
      color: "#22d3ee",
      sizeRatio: 0.05,
      points: [
        { sceneX: -0.3, sceneY: -0.3 },
        { sceneX: 0.3, sceneY: 0.3 },
      ],
    };

    const hit = resolveMarkupStrokeHit({
      stroke,
      point: { sceneX: 0, sceneY: 0 },
      eraserRadiusPx: 6,
      stageWidth: 300,
      stageHeight: 300,
    });
    const miss = resolveMarkupStrokeHit({
      stroke,
      point: { sceneX: -0.4, sceneY: 0.35 },
      eraserRadiusPx: 6,
      stageWidth: 300,
      stageHeight: 300,
    });

    expect(hit).toBe(true);
    expect(miss).toBe(false);
  });
});
