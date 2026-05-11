import { describe, expect, it } from "vitest";

import {
  MOVE_STAGE_ZOOM_SLIDER_DEFAULT,
  MOVE_STAGE_ZOOM_SCALE_MIN,
  clampMarkupViewportState,
  createDefaultMarkupViewportState,
  isMarkupViewportEquivalentToSourceFraming,
  resolveMoveStageZoomScale,
  resolveMoveStageZoomSliderValue,
  resolveMoveStageZoomSliderValueFromWheelDelta,
} from "../expertEditViewportUtils";

describe("isMarkupViewportEquivalentToSourceFraming", () => {
  it("treats the default edit viewport as source-equivalent framing", () => {
    expect(isMarkupViewportEquivalentToSourceFraming(createDefaultMarkupViewportState())).toBe(
      true
    );
  });

  it("returns true only for 1x scale with no pan offsets", () => {
    expect(
      isMarkupViewportEquivalentToSourceFraming({
        scale: 1,
        offsetXRatio: 0,
        offsetYRatio: 0,
      })
    ).toBe(true);
    expect(
      isMarkupViewportEquivalentToSourceFraming({
        scale: 1,
        offsetXRatio: 0.02,
        offsetYRatio: 0,
      })
    ).toBe(false);
  });
});

describe("resolveMoveStageZoomScale", () => {
  it("keeps a small dedicated zoom-out band at the slider floor", () => {
    expect(resolveMoveStageZoomScale(0)).toBe(MOVE_STAGE_ZOOM_SCALE_MIN);
  });

  it("maps fit scale to the slider default and zooms in above it", () => {
    expect(resolveMoveStageZoomSliderValue(1)).toBe(MOVE_STAGE_ZOOM_SLIDER_DEFAULT);
    expect(resolveMoveStageZoomSliderValue(2)).toBeGreaterThan(resolveMoveStageZoomSliderValue(1));
  });
});

describe("resolveMoveStageZoomSliderValueFromWheelDelta", () => {
  it("treats zoom-in wheel input as an increase in visible scale", () => {
    const nextSliderValue = resolveMoveStageZoomSliderValueFromWheelDelta({
      sliderValue: resolveMoveStageZoomSliderValue(1),
      deltaY: -100,
    });
    const nextScale = resolveMoveStageZoomScale(nextSliderValue);

    expect(nextScale).toBeGreaterThan(1);
  });

  it("clamps zoom-out attempts at the shared zoom-out floor", () => {
    const nextSliderValue = resolveMoveStageZoomSliderValueFromWheelDelta({
      sliderValue: resolveMoveStageZoomSliderValue(1),
      deltaY: 10_000,
    });
    const nextScale = resolveMoveStageZoomScale(nextSliderValue);

    expect(nextScale).toBe(MOVE_STAGE_ZOOM_SCALE_MIN);
  });

  it("preserves fractional wheel progress instead of snapping to whole slider steps", () => {
    const nextSliderValue = resolveMoveStageZoomSliderValueFromWheelDelta({
      sliderValue: resolveMoveStageZoomSliderValue(1.4),
      deltaY: 7,
    });

    expect(nextSliderValue).not.toBe(Math.round(nextSliderValue));
  });
});

describe("clampMarkupViewportState", () => {
  it("keeps fit-scale framing centered instead of allowing blank-margin drift", () => {
    expect(
      clampMarkupViewportState({
        scale: 1,
        offsetXRatio: 0.3,
        offsetYRatio: -0.2,
      })
    ).toEqual({
      scale: 1,
      offsetXRatio: 0,
      offsetYRatio: 0,
    });
  });

  it("limits pan at zoomed-in scales to real image bounds", () => {
    expect(
      clampMarkupViewportState({
        scale: 1.4,
        offsetXRatio: 0.5,
        offsetYRatio: -0.5,
      })
    ).toEqual({
      scale: 1.4,
      offsetXRatio: 0.2,
      offsetYRatio: -0.2,
    });
  });

  it("uses content-frame bounds instead of full-stage bounds for letterboxed framing", () => {
    expect(
      clampMarkupViewportState(
        {
          scale: 1.4,
          offsetXRatio: 0.5,
          offsetYRatio: -0.5,
        },
        {
          viewportSize: { width: 800, height: 600 },
          contentFrameSize: { width: 400, height: 600 },
        }
      )
    ).toEqual({
      scale: 1.4,
      offsetXRatio: 0.1,
      offsetYRatio: -0.2,
    });
  });
});
