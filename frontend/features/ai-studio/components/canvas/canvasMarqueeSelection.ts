/**
 * Canvas marquee selection geometry helpers.
 * Keeps rectangle normalization and hit-testing logic pure and reusable.
 */
import { CANVAS_TEXT_ITEM_MIN_HEIGHT } from "./canvasGeometry";
import type { CanvasSceneItem } from "./canvasTypes";

export type CanvasNormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CanvasRectBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const roundRectCoordinate = (value: number): number => Math.round(value * 100) / 100;

/**
 * Returns a normalized rectangle from any two points.
 */
export const normalizeCanvasRectFromPoints = ({
  startX,
  startY,
  endX,
  endY,
}: {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}): CanvasNormalizedRect => {
  const minX = Math.min(startX, endX);
  const minY = Math.min(startY, endY);
  const maxX = Math.max(startX, endX);
  const maxY = Math.max(startY, endY);
  return {
    x: roundRectCoordinate(minX),
    y: roundRectCoordinate(minY),
    width: roundRectCoordinate(maxX - minX),
    height: roundRectCoordinate(maxY - minY),
  };
};

const toRectBounds = (rect: CanvasNormalizedRect): CanvasRectBounds => ({
  left: rect.x,
  top: rect.y,
  right: rect.x + rect.width,
  bottom: rect.y + rect.height,
});

/**
 * Resolves world-space bounds for a scene item using stable layout contracts.
 */
export const getCanvasSceneItemBounds = (
  item: CanvasSceneItem,
  options?: { textItemHeight?: number }
): CanvasRectBounds => {
  if (item.kind === "image" || item.kind === "video" || item.kind === "audio") {
    return {
      left: item.x,
      top: item.y,
      right: item.x + item.width,
      bottom: item.y + item.height,
    };
  }
  const textItemHeight = Math.max(
    1,
    item.height ?? options?.textItemHeight ?? CANVAS_TEXT_ITEM_MIN_HEIGHT
  );
  return {
    left: item.x,
    top: item.y,
    right: item.x + item.width,
    bottom: item.y + textItemHeight,
  };
};

/**
 * Returns true when two rects overlap or touch at edges.
 */
export const canvasRectanglesIntersect = (
  left: CanvasRectBounds,
  right: CanvasRectBounds
): boolean =>
  !(
    left.right < right.left ||
    left.left > right.right ||
    left.bottom < right.top ||
    left.top > right.bottom
  );

/**
 * Resolves scene item ids touched by the marquee rectangle.
 */
export const resolveCanvasMarqueeSelectionIds = ({
  items,
  marqueeRect,
  textItemHeight,
}: {
  items: CanvasSceneItem[];
  marqueeRect: CanvasNormalizedRect;
  textItemHeight?: number;
}): Set<string> => {
  const selectionBounds = toRectBounds(marqueeRect);
  const selectedIds = new Set<string>();
  items.forEach((item) => {
    const itemBounds = getCanvasSceneItemBounds(item, { textItemHeight });
    if (canvasRectanglesIntersect(selectionBounds, itemBounds)) {
      selectedIds.add(item.id);
    }
  });
  return selectedIds;
};
