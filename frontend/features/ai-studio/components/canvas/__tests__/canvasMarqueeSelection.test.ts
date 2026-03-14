import { describe, expect, it } from "vitest";
import {
  canvasRectanglesIntersect,
  getCanvasSceneItemBounds,
  normalizeCanvasRectFromPoints,
  resolveCanvasMarqueeSelectionIds,
} from "../canvasMarqueeSelection";
import type { CanvasSceneItem } from "../canvasTypes";

const IMAGE_ITEM: CanvasSceneItem = {
  id: "image-1",
  kind: "image",
  x: 100,
  y: 120,
  z: 1,
  selected: false,
  outputId: null,
  sourceSurface: null,
  mediaId: "media-1",
  src: "https://example.com/image.png",
  alt: "Image",
  width: 220,
  height: 275,
};

const TEXT_ITEM: CanvasSceneItem = {
  id: "text-1",
  kind: "text",
  x: 420,
  y: 180,
  z: 2,
  selected: false,
  outputId: null,
  sourceSurface: null,
  text: "Text",
  width: 260,
};

describe("canvasMarqueeSelection", () => {
  it("normalizes rectangles regardless of drag direction", () => {
    expect(
      normalizeCanvasRectFromPoints({
        startX: 200,
        startY: 200,
        endX: 120,
        endY: 80,
      })
    ).toEqual({
      x: 120,
      y: 80,
      width: 80,
      height: 120,
    });
  });

  it("treats touching rectangle edges as intersections", () => {
    expect(
      canvasRectanglesIntersect(
        { left: 0, top: 0, right: 100, bottom: 100 },
        { left: 100, top: 20, right: 180, bottom: 140 }
      )
    ).toBe(true);
  });

  it("resolves marquee-selected ids with touch intersection semantics", () => {
    const selectedIds = resolveCanvasMarqueeSelectionIds({
      items: [IMAGE_ITEM, TEXT_ITEM],
      marqueeRect: normalizeCanvasRectFromPoints({
        startX: 60,
        startY: 90,
        endX: 100,
        endY: 180,
      }),
    });
    expect(Array.from(selectedIds)).toEqual(["image-1"]);
  });

  it("uses explicit text item hit bounds with default text height", () => {
    const bounds = getCanvasSceneItemBounds(TEXT_ITEM);
    expect(bounds).toEqual({
      left: 420,
      top: 180,
      right: 680,
      bottom: 300,
    });
  });

  it("supports custom text height for hit-testing", () => {
    const selectedIds = resolveCanvasMarqueeSelectionIds({
      items: [TEXT_ITEM],
      marqueeRect: normalizeCanvasRectFromPoints({
        startX: 660,
        startY: 420,
        endX: 700,
        endY: 460,
      }),
      textItemHeight: 280,
    });
    expect(Array.from(selectedIds)).toEqual(["text-1"]);
  });
});
