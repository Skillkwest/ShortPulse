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
        offsetX: 20,
        offsetY: -10,
      },
      applyViewportTransform: true,
    });

    expect(point).not.toBeNull();
    expect(point?.xRatio ?? 0).toBeCloseTo(0.45, 3);
    expect(point?.yRatio ?? 0).toBeCloseTo(0.55, 3);
  });

  it("appends stroke points only after minimum movement threshold", () => {
    const stroke: MarkupStroke = {
      id: "stroke-1",
      color: "#ff4fa3",
      sizeRatio: 0.05,
      points: [{ xRatio: 0.2, yRatio: 0.2 }],
    };

    const nextStroke = appendMarkupStrokePoints({
      stroke,
      samples: [
        { xRatio: 0.2005, yRatio: 0.2005 },
        { xRatio: 0.28, yRatio: 0.28 },
      ],
      stageWidth: 300,
      stageHeight: 300,
      minDistancePx: 0.8,
    });

    expect(nextStroke.points).toHaveLength(2);
    expect(nextStroke.points[1]).toEqual({ xRatio: 0.28, yRatio: 0.28 });
  });

  it("detects stroke hit for eraser and ignores distant points", () => {
    const stroke: MarkupStroke = {
      id: "stroke-2",
      color: "#22d3ee",
      sizeRatio: 0.05,
      points: [
        { xRatio: 0.2, yRatio: 0.2 },
        { xRatio: 0.8, yRatio: 0.8 },
      ],
    };

    const hit = resolveMarkupStrokeHit({
      stroke,
      point: { xRatio: 0.5, yRatio: 0.5 },
      eraserRadiusPx: 6,
      stageWidth: 300,
      stageHeight: 300,
    });
    const miss = resolveMarkupStrokeHit({
      stroke,
      point: { xRatio: 0.1, yRatio: 0.85 },
      eraserRadiusPx: 6,
      stageWidth: 300,
      stageHeight: 300,
    });

    expect(hit).toBe(true);
    expect(miss).toBe(false);
  });
});
