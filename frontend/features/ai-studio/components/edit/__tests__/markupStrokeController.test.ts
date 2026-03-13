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
