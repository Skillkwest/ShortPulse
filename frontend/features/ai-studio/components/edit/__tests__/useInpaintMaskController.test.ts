/**
 * Verifies pure inpaint mask helpers used by the Expert Edit overlay renderer.
 */
import { describe, expect, it } from "vitest";
import {
  deriveMaskContourFromAlpha,
  INPAINT_MARCHING_ANTS_DASH_PATTERN,
  INPAINT_MARCHING_ANTS_STEP_MS,
  resolveNextMarchingAntPhaseState,
  shouldRenderLassoPreview,
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
  });

  it("returns no contour for an empty mask", () => {
    const emptyMask = deriveMaskContourFromAlpha(3, 3, makeMaskData(3, 3, []));
    expect(emptyMask.hasContent).toBe(false);
    expect(emptyMask.contourSegments).toEqual([]);
  });

  it("shows live preview only while lasso is active", () => {
    expect(shouldRenderLassoPreview(true, "lasso")).toBe(true);
    expect(shouldRenderLassoPreview(true, "brush")).toBe(false);
    expect(shouldRenderLassoPreview(false, "lasso")).toBe(false);
  });
});
