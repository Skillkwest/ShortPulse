/**
 * Verifies pure inpaint mask helpers used by the Expert Edit overlay renderer.
 */
import { describe, expect, it } from "vitest";
import {
  buildContourPathsFromSegments,
  deriveMaskContourFromAlpha,
  INPAINT_MARCHING_ANTS_DASH_PATTERN,
  INPAINT_MARCHING_ANTS_STEP_MS,
  resolvePointerSampleEvents,
  resolveMaskExportSourceWindow,
  resolveNextMarchingAntPhaseState,
  shouldEndPointerSessionOnLeave,
  shouldRenderLassoPreview,
  toClampedCanvasPoint,
} from "../useInpaintMaskController";

const makeMaskData = (width: number, height: number, activePixels: Array<[number, number]>) => {
  const data = new Uint8ClampedArray(width * height * 4);
  activePixels.forEach(([x, y]) => {
    const alphaIndex = (y * width + x) * 4 + 3;
    data[alphaIndex] = 255;
  });
  return data;
};

describe("useInpaintMaskController helpers", () => {
  it("keeps a uniform marching-ants dash pattern", () => {
    expect(INPAINT_MARCHING_ANTS_DASH_PATTERN).toEqual([6, 4]);
  });

  it("throttles marching-ants phase by configured cadence", () => {
    const initial = resolveNextMarchingAntPhaseState({
      phase: 0,
      lastTickMs: 0,
      nowMs: 100,
    });
    expect(initial).toEqual({ phase: 0, lastTickMs: 100 });

    const unchanged = resolveNextMarchingAntPhaseState({
      phase: initial.phase,
      lastTickMs: initial.lastTickMs,
      nowMs: initial.lastTickMs + INPAINT_MARCHING_ANTS_STEP_MS - 1,
    });
    expect(unchanged).toEqual({
      phase: initial.phase,
      lastTickMs: initial.lastTickMs,
    });

    const advanced = resolveNextMarchingAntPhaseState({
      phase: unchanged.phase,
      lastTickMs: unchanged.lastTickMs,
      nowMs: unchanged.lastTickMs + INPAINT_MARCHING_ANTS_STEP_MS + 1,
    });
    expect(advanced.phase).toBe(1);
    expect(advanced.lastTickMs).toBe(unchanged.lastTickMs + INPAINT_MARCHING_ANTS_STEP_MS + 1);
  });

  it("derives contour segments for active mask pixels", () => {
    const singlePixelMask = deriveMaskContourFromAlpha(2, 2, makeMaskData(2, 2, [[0, 0]]));
    expect(singlePixelMask.hasContent).toBe(true);
    expect(singlePixelMask.contourSegments).toEqual([
      0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 0, 0,
    ]);
    expect(singlePixelMask.contourPaths).toEqual([[0, 0, 1, 0, 1, 1, 0, 1, 0, 0]]);
  });

  it("returns no contour for an empty mask", () => {
    const emptyMask = deriveMaskContourFromAlpha(3, 3, makeMaskData(3, 3, []));
    expect(emptyMask.hasContent).toBe(false);
    expect(emptyMask.contourSegments).toEqual([]);
    expect(emptyMask.contourPaths).toEqual([]);
  });

  it("chains adjacent boundary segments into a continuous contour path", () => {
    const twoPixelMask = deriveMaskContourFromAlpha(
      3,
      2,
      makeMaskData(3, 2, [
        [0, 0],
        [1, 0],
      ])
    );
    expect(twoPixelMask.hasContent).toBe(true);
    expect(twoPixelMask.contourPaths).toHaveLength(1);
    expect(twoPixelMask.contourPaths[0]).toEqual([0, 0, 1, 0, 2, 0, 2, 1, 1, 1, 0, 1, 0, 0]);
  });

  it("returns no paths when contour segments are empty", () => {
    expect(buildContourPathsFromSegments([])).toEqual([]);
  });

  it("clips export source window to image bounds inside the mask canvas", () => {
    expect(
      resolveMaskExportSourceWindow({
        imageRect: {
          x: -12.4,
          y: 8.2,
          width: 160.8,
          height: 120.6,
        },
        maskWidth: 100,
        maskHeight: 90,
      })
    ).toEqual({
      sx: 0,
      sy: 8,
      sw: 100,
      sh: 82,
    });
  });

  it("falls back to full mask canvas window when image rect is absent", () => {
    expect(
      resolveMaskExportSourceWindow({
        imageRect: null,
        maskWidth: 128,
        maskHeight: 72,
      })
    ).toEqual({
      sx: 0,
      sy: 0,
      sw: 128,
      sh: 72,
    });
  });

  it("returns null for degenerate export windows", () => {
    expect(
      resolveMaskExportSourceWindow({
        imageRect: {
          x: 150,
          y: 10,
          width: 25,
          height: 40,
        },
        maskWidth: 100,
        maskHeight: 90,
      })
    ).toBeNull();
    expect(
      resolveMaskExportSourceWindow({
        imageRect: null,
        maskWidth: 0,
        maskHeight: 90,
      })
    ).toBeNull();
  });

  it("falls back to the native pointer event when coalesced sampling is empty", () => {
    const nativePointerEvent = {
      clientX: 12,
      clientY: 18,
      getCoalescedEvents: () => [] as PointerEvent[],
    } as unknown as PointerEvent;
    const sampleEvents = resolvePointerSampleEvents(nativePointerEvent);
    expect(sampleEvents).toHaveLength(1);
    expect(sampleEvents[0]).toBe(nativePointerEvent);
  });

  it("uses coalesced pointer events when available", () => {
    const sampleA = { clientX: 10, clientY: 20 } as PointerEvent;
    const sampleB = { clientX: 14, clientY: 24 } as PointerEvent;
    const nativePointerEvent = {
      clientX: 8,
      clientY: 16,
      getCoalescedEvents: () => [sampleA, sampleB],
    } as unknown as PointerEvent;
    expect(resolvePointerSampleEvents(nativePointerEvent)).toEqual([sampleA, sampleB]);
  });

  it("clamps sampled pointer coordinates to the dropzone bounds", () => {
    const rect = {
      left: 10,
      top: 20,
      width: 200,
      height: 100,
    } as DOMRect;
    expect(toClampedCanvasPoint({ clientX: -30, clientY: 400 }, rect)).toEqual({
      x: 0,
      y: 100,
    });
    expect(toClampedCanvasPoint({ clientX: 99, clientY: 65 }, rect)).toEqual({
      x: 89,
      y: 45,
    });
  });

  it("shows live preview only while lasso is active", () => {
    expect(shouldRenderLassoPreview(true, "lasso")).toBe(true);
    expect(shouldRenderLassoPreview(true, "brush")).toBe(false);
    expect(shouldRenderLassoPreview(false, "lasso")).toBe(false);
  });

  it("keeps active pointer sessions alive on leave while capture is held", () => {
    expect(
      shouldEndPointerSessionOnLeave({
        isSessionActive: true,
        sessionPointerId: 44,
        eventPointerId: 44,
        hasPointerCapture: true,
      })
    ).toBe(false);
  });

  it("ends active pointer sessions on leave when capture is not held", () => {
    expect(
      shouldEndPointerSessionOnLeave({
        isSessionActive: true,
        sessionPointerId: 44,
        eventPointerId: 44,
        hasPointerCapture: false,
      })
    ).toBe(true);
    expect(
      shouldEndPointerSessionOnLeave({
        isSessionActive: false,
        sessionPointerId: 44,
        eventPointerId: 44,
        hasPointerCapture: false,
      })
    ).toBe(false);
    expect(
      shouldEndPointerSessionOnLeave({
        isSessionActive: true,
        sessionPointerId: 44,
        eventPointerId: 45,
        hasPointerCapture: false,
      })
    ).toBe(false);
  });
});
