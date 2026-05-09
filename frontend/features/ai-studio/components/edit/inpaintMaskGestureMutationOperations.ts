/**
 * Pure brush and lasso mutation helpers for the Expert Edit inpaint gesture runtime.
 * Keeps gesture hooks focused on event orchestration while these helpers own mask writes.
 */
import type { InpaintPoint } from "./inpaintMaskGeometry";
import type { InpaintSelectionMode } from "./inpaintMaskInteractionTypes";
import type { InpaintPointerSession } from "./useInpaintMaskPointerSessionRuntime";
import {
  resolveMaskCanvasBrushRadius,
  resolveMaskCanvasInteractionPointWithFallback,
} from "./inpaintMaskInteractionSampling";

export type ResolveClientPointToSurfacePoint = (params: {
  clientX: number;
  clientY: number;
  currentTarget: HTMLDivElement;
  clampToBounds: boolean;
}) => InpaintPoint | null;

export type ViewportOffsets = {
  viewportOffsetX: number;
  viewportOffsetY: number;
};

const drawBrushSegment = ({
  ctx,
  from,
  to,
  radius,
  selectionMode,
}: {
  ctx: CanvasRenderingContext2D;
  from: InpaintPoint;
  to: InpaintPoint;
  radius: number;
  selectionMode: InpaintSelectionMode;
}) => {
  ctx.save();
  ctx.globalCompositeOperation = selectionMode === "select" ? "source-over" : "destination-out";
  ctx.strokeStyle = "rgba(255,255,255,1)";
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1, radius * 2);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  const isTapSample = Math.abs(from.x - to.x) < 0.001 && Math.abs(from.y - to.y) < 0.001;
  if (isTapSample) {
    ctx.beginPath();
    ctx.arc(to.x, to.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

/**
 * Applies the initial brush tap at the start of a brush gesture.
 */
export const applyBrushPointerDown = ({
  ctx,
  point,
  logicalInteractionRect,
  maskWidth,
  maskHeight,
  strokeSize,
  selectionMode,
}: {
  ctx: CanvasRenderingContext2D;
  point: InpaintPoint;
  logicalInteractionRect: DOMRect;
  maskWidth: number;
  maskHeight: number;
  strokeSize: number;
  selectionMode: InpaintSelectionMode;
}) => {
  const radius = resolveMaskCanvasBrushRadius({
    logicalInteractionRect,
    maskWidth,
    maskHeight,
    strokeSize,
  });
  drawBrushSegment({
    ctx,
    from: point,
    to: point,
    radius,
    selectionMode,
  });
};

/**
 * Applies sampled lasso points to the live pointer session.
 */
export const applyLassoPointerMoveSamples = ({
  session,
  sampleEvents,
  currentTarget,
  interactionRect,
  logicalInteractionRect,
  maskWidth,
  maskHeight,
  sceneScale,
  viewportOffsets,
  resolveClientPointToSurfacePoint,
}: {
  session: InpaintPointerSession;
  sampleEvents: PointerEvent[];
  currentTarget: HTMLDivElement;
  interactionRect: DOMRect;
  logicalInteractionRect: DOMRect;
  maskWidth: number;
  maskHeight: number;
  sceneScale: number;
  viewportOffsets: ViewportOffsets;
  resolveClientPointToSurfacePoint?: ResolveClientPointToSurfacePoint;
}) => {
  sampleEvents.forEach((sampleEvent) => {
    const point = resolveMaskCanvasInteractionPointWithFallback({
      sampleEvent,
      currentTarget,
      interactionRect,
      logicalInteractionRect,
      maskWidth,
      maskHeight,
      sceneScale,
      viewportOffsets,
      resolveClientPointToSurfacePoint,
    });
    if (!point) return;
    session.lassoPoints.push(point);
    session.lastPoint = point;
  });
};

/**
 * Applies sampled brush points and returns the next gesture state.
 */
export const applyBrushPointerMoveSamples = ({
  ctx,
  session,
  sampleEvents,
  currentTarget,
  interactionRect,
  logicalInteractionRect,
  maskWidth,
  maskHeight,
  sceneScale,
  viewportOffsets,
  resolveClientPointToSurfacePoint,
  strokeSize,
  selectionMode,
}: {
  ctx: CanvasRenderingContext2D;
  session: InpaintPointerSession;
  sampleEvents: PointerEvent[];
  currentTarget: HTMLDivElement;
  interactionRect: DOMRect;
  logicalInteractionRect: DOMRect;
  maskWidth: number;
  maskHeight: number;
  sceneScale: number;
  viewportOffsets: ViewportOffsets;
  resolveClientPointToSurfacePoint?: ResolveClientPointToSurfacePoint;
  strokeSize: number;
  selectionMode: InpaintSelectionMode;
}) => {
  let didPaint = false;
  let previousPoint = session.lastPoint;
  const radius = resolveMaskCanvasBrushRadius({
    logicalInteractionRect,
    maskWidth,
    maskHeight,
    strokeSize,
  });
  sampleEvents.forEach((sampleEvent) => {
    const point = resolveMaskCanvasInteractionPointWithFallback({
      sampleEvent,
      currentTarget,
      interactionRect,
      logicalInteractionRect,
      maskWidth,
      maskHeight,
      sceneScale,
      viewportOffsets,
      resolveClientPointToSurfacePoint,
    });
    if (!point) return;
    if (!previousPoint) previousPoint = point;
    drawBrushSegment({
      ctx,
      from: previousPoint,
      to: point,
      radius,
      selectionMode,
    });
    previousPoint = point;
    didPaint = true;
  });
  return {
    didPaint,
    previousPoint,
  };
};
