/**
 * Markup stroke interaction helpers for Expert Edit.
 * Encapsulates scene-space geometry, pointer sampling, and draw/erase hit-testing behavior.
 */

import {
  resolvePixelPointFromSceneSpace,
  resolveScenePointFromPixelSpace,
  resolveSurfacePointFromClientPoint,
} from "./stageSceneGeometry";

export type MarkupStrokePoint = {
  sceneX: number;
  sceneY: number;
};

export type MarkupStroke = {
  id: string;
  color: string;
  sizeRatio: number;
  points: MarkupStrokePoint[];
};

export type MarkupViewportState = {
  scale: number;
  offsetXRatio: number;
  offsetYRatio: number;
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
  viewportOffsetX,
  viewportOffsetY,
}: {
  clientX: number;
  clientY: number;
  rect: DOMRect;
  viewport: MarkupViewportState;
  applyViewportTransform: boolean;
  viewportOffsetX?: number;
  viewportOffsetY?: number;
}): MarkupStrokePoint | null => {
  const resolvedViewportOffsetX = applyViewportTransform
    ? typeof viewportOffsetX === "number" && Number.isFinite(viewportOffsetX)
      ? viewportOffsetX
      : viewport.offsetXRatio * rect.width
    : 0;
  const resolvedViewportOffsetY = applyViewportTransform
    ? typeof viewportOffsetY === "number" && Number.isFinite(viewportOffsetY)
      ? viewportOffsetY
      : viewport.offsetYRatio * rect.height
    : 0;
  const surfacePoint = resolveSurfacePointFromClientPoint({
    clientX,
    clientY,
    rect,
    viewportTransform: {
      scale: applyViewportTransform ? viewport.scale : 1,
      offsetX: resolvedViewportOffsetX,
      offsetY: resolvedViewportOffsetY,
    },
    clampToBounds: false,
  });
  if (!surfacePoint) return null;
  const scenePoint = resolveScenePointFromPixelSpace({
    x: surfacePoint.x,
    y: surfacePoint.y,
    spaceWidth: rect.width,
    spaceHeight: rect.height,
  });
  return {
    sceneX: scenePoint.x,
    sceneY: scenePoint.y,
  };
};

export const resolveMarkupStrokeSizeRatio = ({
  strokeSizePx,
  stageHeight,
}: {
  strokeSizePx: number;
  stageHeight: number;
}) => {
  const safeStageHeight = Math.max(1, stageHeight);
  return clampNumber(
    strokeSizePx / safeStageHeight,
    MARKUP_STROKE_SIZE_RATIO_MIN,
    MARKUP_STROKE_SIZE_RATIO_MAX
  );
};

export const resolveMarkupStrokeWidthPx = ({
  stroke,
  stageHeight,
}: {
  stroke: MarkupStroke;
  stageHeight: number;
}) => Math.max(0.5, stroke.sizeRatio * Math.max(1, stageHeight));

export const resolveMarkupStrokePointRadiusPx = ({
  stroke,
  stageHeight,
}: {
  stroke: MarkupStroke;
  stageHeight: number;
}) => Math.max(0.5, resolveMarkupStrokeWidthPx({ stroke, stageHeight }) / 2);

export const resolveMarkupStrokePointToSurfacePoint = ({
  point,
  stageWidth,
  stageHeight,
}: {
  point: MarkupStrokePoint;
  stageWidth: number;
  stageHeight: number;
}) =>
  resolvePixelPointFromSceneSpace({
    point: {
      x: point.sceneX,
      y: point.sceneY,
    },
    spaceWidth: stageWidth,
    spaceHeight: stageHeight,
  });

export const resolveMarkupPointDistancePx = ({
  left,
  right,
  stageHeight,
}: {
  left: MarkupStrokePoint;
  right: MarkupStrokePoint;
  stageWidth: number;
  stageHeight: number;
}) => {
  const safeStageHeight = Math.max(1, stageHeight);
  const deltaX = (left.sceneX - right.sceneX) * safeStageHeight;
  const deltaY = (left.sceneY - right.sceneY) * safeStageHeight;
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
  const pointPx = resolveMarkupStrokePointToSurfacePoint({
    point,
    stageWidth,
    stageHeight,
  });
  const strokeRadius = resolveMarkupStrokePointRadiusPx({ stroke, stageHeight });
  const hitRadius = eraserRadiusPx + strokeRadius;
  const first = stroke.points[0];
  if (!first) return false;
  if (stroke.points.length === 1) {
    const firstPx = resolveMarkupStrokePointToSurfacePoint({
      point: first,
      stageWidth,
      stageHeight,
    });
    return Math.hypot(pointPx.x - firstPx.x, pointPx.y - firstPx.y) <= hitRadius;
  }
  for (let index = 1; index < stroke.points.length; index += 1) {
    const previousPoint = stroke.points[index - 1];
    const currentPoint = stroke.points[index];
    if (!previousPoint || !currentPoint) continue;
    const previousPointPx = resolveMarkupStrokePointToSurfacePoint({
      point: previousPoint,
      stageWidth,
      stageHeight,
    });
    const currentPointPx = resolveMarkupStrokePointToSurfacePoint({
      point: currentPoint,
      stageWidth,
      stageHeight,
    });
    const distance = resolvePointToSegmentDistancePx({
      point: pointPx,
      start: previousPointPx,
      end: currentPointPx,
    });
    if (distance <= hitRadius) {
      return true;
    }
  }
  return false;
};
