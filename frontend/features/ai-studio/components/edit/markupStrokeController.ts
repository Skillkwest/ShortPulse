/**
 * Markup stroke interaction helpers for Expert Edit.
 * Encapsulates stroke geometry, pointer sampling, and draw/erase hit-testing behavior.
 */

export type MarkupStrokePoint = {
  xRatio: number;
  yRatio: number;
};

export type MarkupStroke = {
  id: string;
  color: string;
  sizeRatio: number;
  points: MarkupStrokePoint[];
};

export type MarkupViewportState = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type MarkupDrawPointerSession = {
  active: boolean;
  pointerId: number | null;
  mode: "pen" | "eraser" | null;
  strokeId: string | null;
};

export const MARKUP_STROKE_SIZE_RATIO_MIN = 0.002;
export const MARKUP_STROKE_SIZE_RATIO_MAX = 0.4;
export const MARKUP_DRAW_MIN_POINT_DISTANCE_PX = 0.8;

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const createIdleMarkupDrawPointerSession = (): MarkupDrawPointerSession => ({
  active: false,
  pointerId: null,
  mode: null,
  strokeId: null,
});

/**
 * Normalizes pointer sampling across browsers.
 * Some engines expose getCoalescedEvents but may return an empty list.
 */
export const resolvePointerSampleEvents = (
  nativeEvent: PointerEvent & {
    getCoalescedEvents?: () => PointerEvent[];
  }
) => {
  if (typeof nativeEvent.getCoalescedEvents !== "function") {
    return [nativeEvent];
  }
  const coalescedEvents = nativeEvent.getCoalescedEvents();
  if (!coalescedEvents.length) {
    return [nativeEvent];
  }
  return coalescedEvents;
};

export const resolveMarkupPointerPoint = ({
  clientX,
  clientY,
  rect,
  viewport,
  applyViewportTransform,
}: {
  clientX: number;
  clientY: number;
  rect: DOMRect;
  viewport: MarkupViewportState;
  applyViewportTransform: boolean;
}): MarkupStrokePoint | null => {
  if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return null;
  if (rect.width <= 0 || rect.height <= 0) return null;
  let x = clientX - rect.left;
  let y = clientY - rect.top;
  if (applyViewportTransform) {
    const safeScale = Math.max(0.0001, viewport.scale);
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    x = centerX + (x - centerX - viewport.offsetX) / safeScale;
    y = centerY + (y - centerY - viewport.offsetY) / safeScale;
  }
  return {
    xRatio: clampNumber(x / rect.width, 0, 1),
    yRatio: clampNumber(y / rect.height, 0, 1),
  };
};

export const resolveMarkupStrokeSizeRatio = ({
  strokeSizePx,
  stageWidth,
  stageHeight,
}: {
  strokeSizePx: number;
  stageWidth: number;
  stageHeight: number;
}) => {
  const stageMinDimension = Math.max(1, Math.min(stageWidth, stageHeight));
  return clampNumber(
    strokeSizePx / stageMinDimension,
    MARKUP_STROKE_SIZE_RATIO_MIN,
    MARKUP_STROKE_SIZE_RATIO_MAX
  );
};

export const resolveMarkupPointDistancePx = ({
  left,
  right,
  stageWidth,
  stageHeight,
}: {
  left: MarkupStrokePoint;
  right: MarkupStrokePoint;
  stageWidth: number;
  stageHeight: number;
}) => {
  const deltaX = (left.xRatio - right.xRatio) * stageWidth;
  const deltaY = (left.yRatio - right.yRatio) * stageHeight;
  return Math.hypot(deltaX, deltaY);
};

export const appendMarkupStrokePoints = ({
  stroke,
  samples,
  stageWidth,
  stageHeight,
  minDistancePx = MARKUP_DRAW_MIN_POINT_DISTANCE_PX,
}: {
  stroke: MarkupStroke;
  samples: MarkupStrokePoint[];
  stageWidth: number;
  stageHeight: number;
  minDistancePx?: number;
}) => {
  if (!samples.length) return stroke;
  const sourcePoints = stroke.points;
  let nextPoints = sourcePoints;
  let lastPoint = sourcePoints[sourcePoints.length - 1] ?? null;

  samples.forEach((sample) => {
    if (!lastPoint) {
      if (nextPoints === sourcePoints) {
        nextPoints = [...sourcePoints, sample];
      } else {
        nextPoints.push(sample);
      }
      lastPoint = sample;
      return;
    }
    const distance = resolveMarkupPointDistancePx({
      left: lastPoint,
      right: sample,
      stageWidth,
      stageHeight,
    });
    if (distance < minDistancePx) {
      return;
    }
    if (nextPoints === sourcePoints) {
      nextPoints = [...sourcePoints, sample];
    } else {
      nextPoints.push(sample);
    }
    lastPoint = sample;
  });

  if (nextPoints === sourcePoints) {
    return stroke;
  }

  return {
    ...stroke,
    points: nextPoints,
  };
};

const resolvePointToSegmentDistancePx = ({
  point,
  start,
  end,
}: {
  point: { x: number; y: number };
  start: { x: number; y: number };
  end: { x: number; y: number };
}) => {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (segmentLengthSquared <= Number.EPSILON) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const projection = clampNumber(
    ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / segmentLengthSquared,
    0,
    1
  );
  const nearestX = start.x + segmentX * projection;
  const nearestY = start.y + segmentY * projection;
  return Math.hypot(point.x - nearestX, point.y - nearestY);
};

export const resolveMarkupStrokeHit = ({
  stroke,
  point,
  eraserRadiusPx,
  stageWidth,
  stageHeight,
}: {
  stroke: MarkupStroke;
  point: MarkupStrokePoint;
  eraserRadiusPx: number;
  stageWidth: number;
  stageHeight: number;
}) => {
  if (!stroke.points.length) return false;
  const pointPx = {
    x: point.xRatio * stageWidth,
    y: point.yRatio * stageHeight,
  };
  const minDimension = Math.max(1, Math.min(stageWidth, stageHeight));
  const strokeRadius = (stroke.sizeRatio * minDimension) / 2;
  const hitRadius = eraserRadiusPx + strokeRadius;
  const first = stroke.points[0];
  if (!first) return false;
  if (stroke.points.length === 1) {
    return (
      Math.hypot(pointPx.x - first.xRatio * stageWidth, pointPx.y - first.yRatio * stageHeight) <=
      hitRadius
    );
  }
  for (let index = 1; index < stroke.points.length; index += 1) {
    const previousPoint = stroke.points[index - 1];
    const currentPoint = stroke.points[index];
    if (!previousPoint || !currentPoint) continue;
    const distance = resolvePointToSegmentDistancePx({
      point: pointPx,
      start: {
        x: previousPoint.xRatio * stageWidth,
        y: previousPoint.yRatio * stageHeight,
      },
      end: {
        x: currentPoint.xRatio * stageWidth,
        y: currentPoint.yRatio * stageHeight,
      },
    });
    if (distance <= hitRadius) {
      return true;
    }
  }
  return false;
};

export const resolveMarkupStrokeWidthPercent = (stroke: MarkupStroke) =>
  Math.max(0.05, Math.min(40, stroke.sizeRatio * 100));

export const resolveMarkupStrokePointRadiusPercent = (stroke: MarkupStroke) =>
  Math.max(0.08, resolveMarkupStrokeWidthPercent(stroke) / 2);
