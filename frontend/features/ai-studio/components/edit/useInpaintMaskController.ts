/**
 * Inpaint mask interaction/render controller for Expert Edit.
 * Manages per-layer masks, brush/lasso compositing, and overlay/marching-ants rendering.
 */
import React from "react";

export type InpaintPaintMode = "brush" | "lasso" | "auto";
export type InpaintSelectionMode = "select" | "unselect";

export type InpaintLayerSource = {
  id: string;
  imageUrl: string | null;
};

type InpaintPoint = {
  x: number;
  y: number;
};

type InpaintImageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type MaskExportSourceWindow = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

type MaskLayerMeta = {
  hasContent: boolean;
  width: number;
  height: number;
  contourSegments: number[];
  contourPaths: number[][];
};

type PointerSession = {
  pointerId: number;
  active: boolean;
  lastPoint: InpaintPoint | null;
  lassoPoints: InpaintPoint[];
};

type UseInpaintMaskControllerParams = {
  dropzoneRef: React.RefObject<HTMLDivElement | null>;
  selectedLayerId: string | null;
  selectedLayerImageUrl: string | null;
  layerSources: InpaintLayerSource[];
  enabled: boolean;
  paintMode: InpaintPaintMode;
  selectionMode: InpaintSelectionMode;
  strokeSize: number;
  onAutoToolAttempt?: () => void;
  onPaintAttemptWithoutImage?: () => void;
};

type ExportMaskBlobParams = {
  targetWidth: number;
  targetHeight: number;
  mimeType?: "image/png" | "image/jpeg";
};

type UseInpaintMaskControllerResult = {
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  hasSelectedLayerMask: boolean;
  imageHasInteractiveMask: boolean;
  clearSelectedLayerMask: () => void;
  invertSelectedLayerMask: () => void;
  exportSelectedLayerMaskBlob: (params: ExportMaskBlobParams) => Promise<Blob | null>;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
};

const MASK_ANALYSIS_THROTTLE_MS = 90;
const MARCHING_ANTS_PHASE_MODULO = 120;
export const INPAINT_MARCHING_ANTS_STEP_MS = 110;
export const INPAINT_MARCHING_ANTS_DASH_PATTERN = [6, 4] as const;
const MARCHING_ANTS_DASH_OFFSET_STEP = 1;
const LASSO_PREVIEW_ANTS_PHYSICAL_PX = 1;
const LASSO_PREVIEW_GUIDE_STROKE_WIDTH = 1.25;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toCanvasPoint = (
  event: { clientX: number; clientY: number },
  rect: DOMRect
): InpaintPoint | null => {
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
  return {
    x,
    y,
  };
};

export const toClampedCanvasPoint = (
  event: { clientX: number; clientY: number },
  rect: DOMRect
): InpaintPoint => ({
  x: clamp(event.clientX - rect.left, 0, rect.width),
  y: clamp(event.clientY - rect.top, 0, rect.height),
});

/**
 * Normalizes pointer sampling across browsers.
 * Some engines expose getCoalescedEvents but may return an empty list for a move event.
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

const resolveLassoAntStrokeWidth = (dpr: number) =>
  LASSO_PREVIEW_ANTS_PHYSICAL_PX / Math.max(1, dpr);

const tracePolylinePath = (ctx: CanvasRenderingContext2D, points: InpaintPoint[]) => {
  if (!points.length) return;
  const firstPoint = points[0]!;
  ctx.beginPath();
  ctx.moveTo(firstPoint.x, firstPoint.y);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    ctx.lineTo(point.x, point.y);
  }
};

const createMaskCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

const resizeMaskCanvasPreservingPixels = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): HTMLCanvasElement => {
  const nextWidth = Math.max(1, Math.round(width));
  const nextHeight = Math.max(1, Math.round(height));
  if (canvas.width === nextWidth && canvas.height === nextHeight) {
    return canvas;
  }
  const resized = createMaskCanvas(nextWidth, nextHeight);
  const resizedCtx = resized.getContext("2d");
  if (resizedCtx) {
    resizedCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, nextWidth, nextHeight);
  }
  return resized;
};

const resolveImageRectForContain = (
  dropzoneWidth: number,
  dropzoneHeight: number,
  naturalWidth: number,
  naturalHeight: number
): InpaintImageRect => {
  if (naturalWidth <= 0 || naturalHeight <= 0 || dropzoneWidth <= 0 || dropzoneHeight <= 0) {
    return {
      x: 0,
      y: 0,
      width: dropzoneWidth,
      height: dropzoneHeight,
    };
  }
  const scale = Math.min(dropzoneWidth / naturalWidth, dropzoneHeight / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  return {
    x: (dropzoneWidth - width) / 2,
    y: (dropzoneHeight - height) / 2,
    width,
    height,
  };
};

/**
 * Resolves source sampling bounds for mask export.
 * Editing can happen anywhere in the dropzone, but submit-time mask export is clipped
 * to the visible image rect so provider payloads remain aligned with the flattened base image.
 */
export const resolveMaskExportSourceWindow = ({
  imageRect,
  maskWidth,
  maskHeight,
}: {
  imageRect: InpaintImageRect | null;
  maskWidth: number;
  maskHeight: number;
}): MaskExportSourceWindow | null => {
  if (maskWidth <= 0 || maskHeight <= 0) return null;
  if (!imageRect) {
    return {
      sx: 0,
      sy: 0,
      sw: maskWidth,
      sh: maskHeight,
    };
  }
  const sx = clamp(Math.floor(imageRect.x), 0, maskWidth);
  const sy = clamp(Math.floor(imageRect.y), 0, maskHeight);
  const endX = clamp(Math.ceil(imageRect.x + imageRect.width), 0, maskWidth);
  const endY = clamp(Math.ceil(imageRect.y + imageRect.height), 0, maskHeight);
  const sw = Math.max(0, endX - sx);
  const sh = Math.max(0, endY - sy);
  if (sw <= 0 || sh <= 0) return null;
  return {
    sx,
    sy,
    sw,
    sh,
  };
};

type MarchingAntPhaseState = {
  phase: number;
  lastTickMs: number;
};

/**
 * Advances the marching-ants phase using the configured cadence.
 */
export const resolveNextMarchingAntPhaseState = ({
  phase,
  lastTickMs,
  nowMs,
}: MarchingAntPhaseState & { nowMs: number }): MarchingAntPhaseState => {
  if (!lastTickMs) {
    return {
      phase,
      lastTickMs: nowMs,
    };
  }
  if (nowMs - lastTickMs < INPAINT_MARCHING_ANTS_STEP_MS) {
    return {
      phase,
      lastTickMs,
    };
  }
  return {
    phase: (phase + 1) % MARCHING_ANTS_PHASE_MODULO,
    lastTickMs: nowMs,
  };
};

type DerivedMaskContour = {
  hasContent: boolean;
  contourSegments: number[];
  contourPaths: number[][];
};

type ContourEdge = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startKey: string;
  endKey: string;
};

const toContourPointKey = (x: number, y: number) => `${x},${y}`;

/**
 * Chains directed contour segments into longer connected paths so dashed strokes
 * animate smoothly instead of resetting on each 1px boundary segment.
 */
export const buildContourPathsFromSegments = (contourSegments: number[]): number[][] => {
  if (contourSegments.length < 4) return [];

  const edges: ContourEdge[] = [];
  for (let index = 0; index < contourSegments.length; index += 4) {
    const startX = contourSegments[index];
    const startY = contourSegments[index + 1];
    const endX = contourSegments[index + 2];
    const endY = contourSegments[index + 3];
    if (
      typeof startX !== "number" ||
      typeof startY !== "number" ||
      typeof endX !== "number" ||
      typeof endY !== "number"
    ) {
      continue;
    }
    if (startX === endX && startY === endY) continue;
    edges.push({
      startX,
      startY,
      endX,
      endY,
      startKey: toContourPointKey(startX, startY),
      endKey: toContourPointKey(endX, endY),
    });
  }

  if (!edges.length) return [];

  const outgoingByStart = new Map<string, number[]>();
  edges.forEach((edge, edgeIndex) => {
    const entry = outgoingByStart.get(edge.startKey);
    if (entry) {
      entry.push(edgeIndex);
      return;
    }
    outgoingByStart.set(edge.startKey, [edgeIndex]);
  });

  const edgeUsed = new Uint8Array(edges.length);
  const paths: number[][] = [];

  const resolveNextEdgeIndex = (currentKey: string, previousKey: string | null): number | null => {
    const candidates = outgoingByStart.get(currentKey);
    if (!candidates?.length) return null;
    let fallback: number | null = null;
    for (const candidateIndex of candidates) {
      if (edgeUsed[candidateIndex]) continue;
      const candidate = edges[candidateIndex];
      if (!candidate) continue;
      if (previousKey != null && candidate.endKey === previousKey) {
        if (fallback == null) fallback = candidateIndex;
        continue;
      }
      return candidateIndex;
    }
    return fallback;
  };

  edges.forEach((edge, edgeIndex) => {
    if (edgeUsed[edgeIndex]) return;
    edgeUsed[edgeIndex] = 1;

    const path: number[] = [edge.startX, edge.startY, edge.endX, edge.endY];
    const startKey = edge.startKey;
    let previousKey: string | null = edge.startKey;
    let currentKey: string = edge.endKey;
    let guard = 0;
    const guardLimit = edges.length + 1;

    while (currentKey !== startKey && guard < guardLimit) {
      const nextEdgeIndex = resolveNextEdgeIndex(currentKey, previousKey);
      if (nextEdgeIndex == null) break;
      const nextEdge = edges[nextEdgeIndex];
      if (!nextEdge) break;
      edgeUsed[nextEdgeIndex] = 1;
      path.push(nextEdge.endX, nextEdge.endY);
      previousKey = currentKey;
      currentKey = nextEdge.endKey;
      guard += 1;
    }

    if (path.length >= 4) {
      paths.push(path);
    }
  });

  return paths;
};

/**
 * Derives alpha-mask contour segments in pixel-space for consistent dashed-stroke rendering.
 */
export const deriveMaskContourFromAlpha = (
  width: number,
  height: number,
  data: Uint8ClampedArray
): DerivedMaskContour => {
  if (width <= 0 || height <= 0) {
    return { hasContent: false, contourSegments: [], contourPaths: [] };
  }

  const contourSegments: number[] = [];
  let hasContent = false;
  const alphaAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    return data[(y * width + x) * 4 + 3] ?? 0;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(x, y) <= 0) continue;
      hasContent = true;

      if (alphaAt(x, y - 1) <= 0) {
        contourSegments.push(x, y, x + 1, y);
      }
      if (alphaAt(x + 1, y) <= 0) {
        contourSegments.push(x + 1, y, x + 1, y + 1);
      }
      if (alphaAt(x, y + 1) <= 0) {
        contourSegments.push(x + 1, y + 1, x, y + 1);
      }
      if (alphaAt(x - 1, y) <= 0) {
        contourSegments.push(x, y + 1, x, y);
      }
    }
  }

  const contourPaths = buildContourPathsFromSegments(contourSegments);

  return {
    hasContent,
    contourSegments,
    contourPaths,
  };
};

const analyzeMaskCanvas = (canvas: HTMLCanvasElement): MaskLayerMeta => {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || width <= 0 || height <= 0) {
    return {
      hasContent: false,
      width,
      height,
      contourSegments: [],
      contourPaths: [],
    };
  }
  const imageData = ctx.getImageData(0, 0, width, height);
  const derivedContour = deriveMaskContourFromAlpha(width, height, imageData.data);

  return {
    hasContent: derivedContour.hasContent,
    width,
    height,
    contourSegments: derivedContour.contourSegments,
    contourPaths: derivedContour.contourPaths,
  };
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

const applyLassoSelection = ({
  ctx,
  points,
  selectionMode,
}: {
  ctx: CanvasRenderingContext2D;
  points: InpaintPoint[];
  selectionMode: InpaintSelectionMode;
}) => {
  if (points.length < 3) return;
  ctx.save();
  ctx.globalCompositeOperation = selectionMode === "select" ? "source-over" : "destination-out";
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const renderOverlayFrame = ({
  canvas,
  maskCanvas,
  meta,
  lassoPreviewPoints,
  phase,
  imageRect,
}: {
  canvas: HTMLCanvasElement;
  maskCanvas: HTMLCanvasElement | null;
  meta: MaskLayerMeta | null;
  lassoPreviewPoints: InpaintPoint[];
  phase: number;
  imageRect: InpaintImageRect | null;
}) => {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (maskCanvas && meta?.hasContent) {
    ctx.save();
    ctx.drawImage(maskCanvas, 0, 0, width, height);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = "rgba(255, 0, 60, 0.58)";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    if (meta.width > 0 && meta.height > 0 && meta.contourSegments.length > 0) {
      const scaleX = width / meta.width;
      const scaleY = height / meta.height;
      const [dashSize, dashGap] = INPAINT_MARCHING_ANTS_DASH_PATTERN;
      const baseOffset = -(phase * MARCHING_ANTS_DASH_OFFSET_STEP);
      const contourStrokeWidth = 1 / dpr;
      const contourPaths = meta.contourPaths;
      const drawContourStroke = (strokeStyle: string, lineDashOffset: number) => {
        ctx.save();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = contourStrokeWidth;
        ctx.setLineDash([dashSize, dashGap]);
        ctx.lineDashOffset = lineDashOffset;
        ctx.beginPath();
        if (contourPaths.length > 0) {
          for (const path of contourPaths) {
            if (path.length < 4) continue;
            ctx.moveTo((path[0] ?? 0) * scaleX, (path[1] ?? 0) * scaleY);
            for (let pointIndex = 2; pointIndex < path.length; pointIndex += 2) {
              const pathX = path[pointIndex] ?? 0;
              const pathY = path[pointIndex + 1] ?? 0;
              ctx.lineTo(pathX * scaleX, pathY * scaleY);
            }
          }
        } else {
          for (let index = 0; index < meta.contourSegments.length; index += 4) {
            const x1 = meta.contourSegments[index] ?? 0;
            const y1 = meta.contourSegments[index + 1] ?? 0;
            const x2 = meta.contourSegments[index + 2] ?? 0;
            const y2 = meta.contourSegments[index + 3] ?? 0;
            ctx.moveTo(x1 * scaleX, y1 * scaleY);
            ctx.lineTo(x2 * scaleX, y2 * scaleY);
          }
        }
        ctx.stroke();
        ctx.restore();
      };

      drawContourStroke("rgba(0,0,0,0.62)", baseOffset);
      drawContourStroke("rgba(255,255,255,0.82)", baseOffset + dashSize);
    }
  }

  if (lassoPreviewPoints.length > 0) {
    ctx.save();
    const firstPoint = lassoPreviewPoints[0]!;
    const lastPoint = lassoPreviewPoints[lassoPreviewPoints.length - 1]!;
    const [dashSize, dashGap] = INPAINT_MARCHING_ANTS_DASH_PATTERN;
    const baseOffset = -(phase * MARCHING_ANTS_DASH_OFFSET_STEP);
    const lassoAntStrokeWidth = resolveLassoAntStrokeWidth(dpr);

    if (lassoPreviewPoints.length > 1) {
      if (lassoPreviewPoints.length > 2) {
        ctx.fillStyle = "rgba(43, 212, 255, 0.22)";
        tracePolylinePath(ctx, lassoPreviewPoints);
        ctx.closePath();
        ctx.fill();
      }

      ctx.setLineDash([]);
      ctx.lineWidth = LASSO_PREVIEW_GUIDE_STROKE_WIDTH + 1.1;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
      tracePolylinePath(ctx, lassoPreviewPoints);
      ctx.stroke();

      ctx.lineWidth = LASSO_PREVIEW_GUIDE_STROKE_WIDTH;
      ctx.strokeStyle = "rgba(95, 231, 255, 0.56)";
      tracePolylinePath(ctx, lassoPreviewPoints);
      ctx.stroke();

      ctx.lineWidth = lassoAntStrokeWidth;
      ctx.setLineDash([dashSize, dashGap]);
      ctx.lineDashOffset = baseOffset;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
      tracePolylinePath(ctx, lassoPreviewPoints);
      ctx.stroke();
      ctx.lineDashOffset = baseOffset + dashSize;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      tracePolylinePath(ctx, lassoPreviewPoints);
      ctx.stroke();

      if (lassoPreviewPoints.length > 2) {
        ctx.setLineDash([]);
        ctx.lineWidth = LASSO_PREVIEW_GUIDE_STROKE_WIDTH + 0.95;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.66)";
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(firstPoint.x, firstPoint.y);
        ctx.stroke();

        ctx.lineWidth = LASSO_PREVIEW_GUIDE_STROKE_WIDTH;
        ctx.strokeStyle = "rgba(95, 231, 255, 0.5)";
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(firstPoint.x, firstPoint.y);
        ctx.stroke();

        ctx.lineWidth = lassoAntStrokeWidth;
        ctx.setLineDash([dashSize, dashGap]);
        ctx.lineDashOffset = baseOffset + dashSize;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(firstPoint.x, firstPoint.y);
        ctx.stroke();
      }

      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(95, 231, 255, 0.98)";
      ctx.beginPath();
      ctx.arc(firstPoint.x, firstPoint.y, 3.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
      ctx.beginPath();
      ctx.arc(lastPoint.x, lastPoint.y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const pulseRadius = 4.2 + ((phase % 12) / 12) * 1.2;
      ctx.setLineDash([]);
      ctx.lineWidth = 1.65;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.74)";
      ctx.beginPath();
      ctx.arc(firstPoint.x, firstPoint.y, pulseRadius + 1, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(95, 231, 255, 0.98)";
      ctx.lineWidth = Math.max(lassoAntStrokeWidth, 1);
      ctx.beginPath();
      ctx.arc(firstPoint.x, firstPoint.y, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(95, 231, 255, 0.98)";
      ctx.beginPath();
      ctx.arc(firstPoint.x, firstPoint.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
};

export const resolveInpaintBrushDiameter = (strokeSize: number) => {
  const clampedStrokeSize = clamp(strokeSize, 1, 100);
  const mappedDiameter = Math.round(6 + clampedStrokeSize * 0.46);
  return clamp(mappedDiameter, 8, 52);
};

/**
 * Returns true when live lasso preview rendering should be visible.
 */
export const shouldRenderLassoPreview = (isPointerActive: boolean, paintMode: InpaintPaintMode) =>
  isPointerActive && paintMode === "lasso";

/**
 * Pointer leave should only cancel an active session when capture is not held.
 */
export const shouldEndPointerSessionOnLeave = ({
  isSessionActive,
  sessionPointerId,
  eventPointerId,
  hasPointerCapture,
}: {
  isSessionActive: boolean;
  sessionPointerId: number;
  eventPointerId: number;
  hasPointerCapture: boolean;
}) => {
  if (!isSessionActive) return false;
  if (eventPointerId !== sessionPointerId) return false;
  return !hasPointerCapture;
};

/**
 * Manages mask painting interactions and overlay rendering for Expert Edit inpaint.
 */
export const useInpaintMaskController = ({
  dropzoneRef,
  selectedLayerId,
  selectedLayerImageUrl,
  layerSources,
  enabled,
  paintMode,
  selectionMode,
  strokeSize,
  onAutoToolAttempt,
  onPaintAttemptWithoutImage,
}: UseInpaintMaskControllerParams): UseInpaintMaskControllerResult => {
  const overlayCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const maskCanvasesRef = React.useRef<Map<string, HTMLCanvasElement>>(new Map());
  const maskMetaRef = React.useRef<Map<string, MaskLayerMeta>>(new Map());
  const layerImageSignatureRef = React.useRef<Map<string, string | null>>(new Map());
  const imageNaturalSizeCacheRef = React.useRef<Map<string, { width: number; height: number }>>(
    new Map()
  );
  const pointerSessionRef = React.useRef<PointerSession>({
    pointerId: -1,
    active: false,
    lastPoint: null,
    lassoPoints: [],
  });
  const antsPhaseRef = React.useRef(0);
  const lastAntsTickRef = React.useRef(0);
  const overlayRafRef = React.useRef<number | null>(null);
  const maskAnalysisTimersRef = React.useRef<Map<string, number>>(new Map());
  const [dropzoneSize, setDropzoneSize] = React.useState({ width: 0, height: 0 });
  const [selectedImageNaturalSize, setSelectedImageNaturalSize] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const [hasSelectedLayerMask, setHasSelectedLayerMask] = React.useState(false);

  const imageRect = React.useMemo(() => {
    if (!dropzoneSize.width || !dropzoneSize.height) return null;
    if (!selectedImageNaturalSize) {
      return {
        x: 0,
        y: 0,
        width: dropzoneSize.width,
        height: dropzoneSize.height,
      } satisfies InpaintImageRect;
    }
    return resolveImageRectForContain(
      dropzoneSize.width,
      dropzoneSize.height,
      selectedImageNaturalSize.width,
      selectedImageNaturalSize.height
    );
  }, [dropzoneSize.height, dropzoneSize.width, selectedImageNaturalSize]);

  const ensureMaskCanvasForLayer = React.useCallback(
    (layerId: string) => {
      const existing = maskCanvasesRef.current.get(layerId);
      if (existing) {
        const resized = resizeMaskCanvasPreservingPixels(
          existing,
          dropzoneSize.width,
          dropzoneSize.height
        );
        if (resized !== existing) {
          maskCanvasesRef.current.set(layerId, resized);
          return resized;
        }
        return existing;
      }
      const canvas = createMaskCanvas(dropzoneSize.width, dropzoneSize.height);
      maskCanvasesRef.current.set(layerId, canvas);
      return canvas;
    },
    [dropzoneSize.height, dropzoneSize.width]
  );

  const renderOverlay = React.useCallback(
    (phase: number) => {
      const overlayCanvas = overlayCanvasRef.current;
      if (!overlayCanvas) return;
      const selectedMaskCanvas = selectedLayerId
        ? (maskCanvasesRef.current.get(selectedLayerId) ?? null)
        : null;
      const selectedMaskMeta = selectedLayerId
        ? (maskMetaRef.current.get(selectedLayerId) ?? null)
        : null;
      const lassoPreviewPoints = shouldRenderLassoPreview(
        pointerSessionRef.current.active,
        paintMode
      )
        ? pointerSessionRef.current.lassoPoints
        : [];
      renderOverlayFrame({
        canvas: overlayCanvas,
        maskCanvas: selectedMaskCanvas,
        meta: selectedMaskMeta,
        lassoPreviewPoints,
        phase,
        imageRect,
      });
    },
    [imageRect, paintMode, selectedLayerId]
  );

  const stopOverlayAnimation = React.useCallback(() => {
    if (overlayRafRef.current != null) {
      window.cancelAnimationFrame(overlayRafRef.current);
      overlayRafRef.current = null;
    }
    lastAntsTickRef.current = 0;
  }, []);

  const renderOverlayNow = React.useCallback(() => {
    renderOverlay(antsPhaseRef.current);
  }, [renderOverlay]);

  const animateOverlay = React.useCallback(() => {
    if (overlayRafRef.current != null) return;
    const run = (timestamp: number) => {
      const nextPhaseState = resolveNextMarchingAntPhaseState({
        phase: antsPhaseRef.current,
        lastTickMs: lastAntsTickRef.current,
        nowMs: timestamp,
      });
      antsPhaseRef.current = nextPhaseState.phase;
      lastAntsTickRef.current = nextPhaseState.lastTickMs;
      renderOverlay(antsPhaseRef.current);
      const selectedMaskMeta = selectedLayerId ? maskMetaRef.current.get(selectedLayerId) : null;
      const hasAnimatedMask = Boolean(selectedMaskMeta?.hasContent);
      const isAnimatingLasso = pointerSessionRef.current.active && paintMode === "lasso";
      if (hasAnimatedMask || isAnimatingLasso) {
        overlayRafRef.current = window.requestAnimationFrame(run);
      } else {
        overlayRafRef.current = null;
      }
    };
    overlayRafRef.current = window.requestAnimationFrame(run);
  }, [paintMode, renderOverlay, selectedLayerId]);

  const analyzeLayerMask = React.useCallback(
    (layerId: string) => {
      const canvas = maskCanvasesRef.current.get(layerId);
      if (!canvas) {
        maskMetaRef.current.delete(layerId);
        if (selectedLayerId === layerId) {
          setHasSelectedLayerMask(false);
        }
        renderOverlayNow();
        return;
      }
      const meta = analyzeMaskCanvas(canvas);
      maskMetaRef.current.set(layerId, meta);
      if (selectedLayerId === layerId) {
        setHasSelectedLayerMask(meta.hasContent);
      }
      renderOverlayNow();
      if (meta.hasContent || (pointerSessionRef.current.active && paintMode === "lasso")) {
        animateOverlay();
      } else {
        stopOverlayAnimation();
      }
    },
    [animateOverlay, paintMode, renderOverlayNow, selectedLayerId, stopOverlayAnimation]
  );

  const queueLayerAnalysis = React.useCallback(
    (layerId: string, immediate = false) => {
      const existingTimer = maskAnalysisTimersRef.current.get(layerId);
      if (existingTimer != null) {
        window.clearTimeout(existingTimer);
        maskAnalysisTimersRef.current.delete(layerId);
      }
      if (immediate) {
        analyzeLayerMask(layerId);
        return;
      }
      const timerId = window.setTimeout(() => {
        maskAnalysisTimersRef.current.delete(layerId);
        analyzeLayerMask(layerId);
      }, MASK_ANALYSIS_THROTTLE_MS);
      maskAnalysisTimersRef.current.set(layerId, timerId);
    },
    [analyzeLayerMask]
  );

  const clearLayerMask = React.useCallback(
    (layerId: string) => {
      const canvas = maskCanvasesRef.current.get(layerId);
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      queueLayerAnalysis(layerId, true);
    },
    [queueLayerAnalysis]
  );

  const invertLayerMask = React.useCallback(
    (layerId: string) => {
      const canvas = maskCanvasesRef.current.get(layerId);
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx || canvas.width <= 0 || canvas.height <= 0) return;
      const startX = 0;
      const startY = 0;
      const endX = canvas.width;
      const endY = canvas.height;
      const width = Math.max(0, endX - startX);
      const height = Math.max(0, endY - startY);
      if (!width || !height) return;
      const imageData = ctx.getImageData(startX, startY, width, height);
      const { data } = imageData;
      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3] ?? 0;
        if (alpha > 0) {
          data[index] = 0;
          data[index + 1] = 0;
          data[index + 2] = 0;
          data[index + 3] = 0;
        } else {
          data[index] = 255;
          data[index + 1] = 255;
          data[index + 2] = 255;
          data[index + 3] = 255;
        }
      }
      ctx.putImageData(imageData, startX, startY);
      queueLayerAnalysis(layerId, true);
    },
    [queueLayerAnalysis]
  );

  const endPointerSession = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>, shouldApply: boolean) => {
      const session = pointerSessionRef.current;
      if (!session.active || event.pointerId !== session.pointerId) return;
      if (paintMode === "lasso" && shouldApply && selectedLayerId) {
        const canvas = ensureMaskCanvasForLayer(selectedLayerId);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          applyLassoSelection({
            ctx,
            points: session.lassoPoints,
            selectionMode,
          });
        }
      }
      if ((event.target as HTMLElement | null)?.releasePointerCapture) {
        try {
          (event.target as HTMLElement).releasePointerCapture(event.pointerId);
        } catch {
          // Pointer capture can already be released.
        }
      }
      pointerSessionRef.current = {
        pointerId: -1,
        active: false,
        lastPoint: null,
        lassoPoints: [],
      };
      if (selectedLayerId) {
        queueLayerAnalysis(selectedLayerId, true);
      } else {
        renderOverlayNow();
      }
    },
    [
      ensureMaskCanvasForLayer,
      paintMode,
      queueLayerAnalysis,
      renderOverlayNow,
      selectedLayerId,
      selectionMode,
    ]
  );

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled || !selectedLayerId) return;
      if (paintMode === "auto") {
        onAutoToolAttempt?.();
        return;
      }
      if (paintMode !== "brush" && paintMode !== "lasso") return;
      if (!selectedLayerImageUrl) {
        onPaintAttemptWithoutImage?.();
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const dropzone = dropzoneRef.current;
      if (!dropzone) return;
      const rect = dropzone.getBoundingClientRect();
      const point = toCanvasPoint(event, rect);
      if (!point) return;

      event.preventDefault();
      if ((event.currentTarget as HTMLElement | null)?.setPointerCapture) {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      }

      const canvas = ensureMaskCanvasForLayer(selectedLayerId);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      pointerSessionRef.current = {
        pointerId: event.pointerId,
        active: true,
        lastPoint: point,
        lassoPoints: [point],
      };

      if (paintMode === "brush") {
        const radius = resolveInpaintBrushDiameter(strokeSize) / 2;
        drawBrushSegment({
          ctx,
          from: point,
          to: point,
          radius,
          selectionMode,
        });
        queueLayerAnalysis(selectedLayerId);
      }

      renderOverlayNow();
      animateOverlay();
    },
    [
      animateOverlay,
      dropzoneRef,
      enabled,
      ensureMaskCanvasForLayer,
      onAutoToolAttempt,
      onPaintAttemptWithoutImage,
      paintMode,
      queueLayerAnalysis,
      renderOverlayNow,
      selectedLayerId,
      selectedLayerImageUrl,
      selectionMode,
      strokeSize,
    ]
  );

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = pointerSessionRef.current;
      if (!session.active || event.pointerId !== session.pointerId || !selectedLayerId) return;
      const dropzone = dropzoneRef.current;
      if (!dropzone) return;

      event.preventDefault();
      const rect = dropzone.getBoundingClientRect();
      const events = resolvePointerSampleEvents(event.nativeEvent as PointerEvent);

      if (paintMode === "lasso") {
        events.forEach((sampleEvent) => {
          const point = toCanvasPoint(sampleEvent, rect) ?? toClampedCanvasPoint(sampleEvent, rect);
          session.lassoPoints.push(point);
          session.lastPoint = point;
        });
        pointerSessionRef.current = { ...session };
        renderOverlayNow();
        animateOverlay();
        return;
      }

      if (paintMode !== "brush") return;
      const canvas = ensureMaskCanvasForLayer(selectedLayerId);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      let didPaint = false;
      let previousPoint = session.lastPoint;
      const radius = resolveInpaintBrushDiameter(strokeSize) / 2;
      events.forEach((sampleEvent) => {
        const point = toCanvasPoint(sampleEvent, rect) ?? toClampedCanvasPoint(sampleEvent, rect);
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
      pointerSessionRef.current = {
        ...session,
        lastPoint: previousPoint,
      };
      if (didPaint) {
        queueLayerAnalysis(selectedLayerId);
        renderOverlayNow();
        animateOverlay();
      }
    },
    [
      animateOverlay,
      dropzoneRef,
      ensureMaskCanvasForLayer,
      paintMode,
      queueLayerAnalysis,
      renderOverlayNow,
      selectedLayerId,
      selectionMode,
      strokeSize,
    ]
  );

  const onPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      endPointerSession(event, true);
    },
    [endPointerSession]
  );

  const onPointerCancel = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      endPointerSession(event, false);
    },
    [endPointerSession]
  );

  const onPointerLeave = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = pointerSessionRef.current;
      const currentTarget = event.currentTarget as HTMLElement | null;
      const hasPointerCapture = Boolean(
        currentTarget &&
        typeof currentTarget.hasPointerCapture === "function" &&
        currentTarget.hasPointerCapture(event.pointerId)
      );
      if (
        !shouldEndPointerSessionOnLeave({
          isSessionActive: session.active,
          sessionPointerId: session.pointerId,
          eventPointerId: event.pointerId,
          hasPointerCapture,
        })
      ) {
        return;
      }
      endPointerSession(event, false);
    },
    [endPointerSession]
  );

  React.useEffect(() => {
    const dropzone = dropzoneRef.current;
    if (!dropzone) return;
    const updateSize = () => {
      const nextWidth = Math.max(1, Math.round(dropzone.clientWidth));
      const nextHeight = Math.max(1, Math.round(dropzone.clientHeight));
      setDropzoneSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      );
    };
    updateSize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => {
        window.removeEventListener("resize", updateSize);
      };
    }
    const observer = new ResizeObserver(updateSize);
    observer.observe(dropzone);
    return () => observer.disconnect();
  }, [dropzoneRef]);

  React.useEffect(() => {
    if (!selectedLayerImageUrl) {
      setSelectedImageNaturalSize(null);
      return;
    }
    const cached = imageNaturalSizeCacheRef.current.get(selectedLayerImageUrl);
    if (cached) {
      setSelectedImageNaturalSize(cached);
      return;
    }
    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      const naturalSize = {
        width: Math.max(1, image.naturalWidth || 1),
        height: Math.max(1, image.naturalHeight || 1),
      };
      imageNaturalSizeCacheRef.current.set(selectedLayerImageUrl, naturalSize);
      setSelectedImageNaturalSize(naturalSize);
    };
    image.onerror = () => {
      if (disposed) return;
      setSelectedImageNaturalSize(null);
    };
    image.src = selectedLayerImageUrl;
    return () => {
      disposed = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [selectedLayerImageUrl]);

  React.useEffect(() => {
    const activeLayerIds = new Set(layerSources.map((source) => source.id));
    maskCanvasesRef.current.forEach((_, layerId) => {
      if (activeLayerIds.has(layerId)) return;
      maskCanvasesRef.current.delete(layerId);
      maskMetaRef.current.delete(layerId);
      const existingTimer = maskAnalysisTimersRef.current.get(layerId);
      if (existingTimer != null) {
        window.clearTimeout(existingTimer);
        maskAnalysisTimersRef.current.delete(layerId);
      }
      layerImageSignatureRef.current.delete(layerId);
    });

    layerSources.forEach((source) => {
      const previousImageUrl = layerImageSignatureRef.current.get(source.id);
      if (previousImageUrl === source.imageUrl) return;
      layerImageSignatureRef.current.set(source.id, source.imageUrl);
      if (previousImageUrl !== undefined) {
        maskCanvasesRef.current.delete(source.id);
        maskMetaRef.current.delete(source.id);
        const existingTimer = maskAnalysisTimersRef.current.get(source.id);
        if (existingTimer != null) {
          window.clearTimeout(existingTimer);
          maskAnalysisTimersRef.current.delete(source.id);
        }
      }
    });

    if (!selectedLayerId) {
      setHasSelectedLayerMask(false);
    } else {
      setHasSelectedLayerMask(Boolean(maskMetaRef.current.get(selectedLayerId)?.hasContent));
    }
    renderOverlayNow();
  }, [layerSources, renderOverlayNow, selectedLayerId]);

  React.useEffect(() => {
    if (!dropzoneSize.width || !dropzoneSize.height) return;
    maskCanvasesRef.current.forEach((canvas, layerId) => {
      const resized = resizeMaskCanvasPreservingPixels(
        canvas,
        dropzoneSize.width,
        dropzoneSize.height
      );
      if (resized !== canvas) {
        maskCanvasesRef.current.set(layerId, resized);
        queueLayerAnalysis(layerId, true);
      }
    });
    renderOverlayNow();
  }, [dropzoneSize.height, dropzoneSize.width, queueLayerAnalysis, renderOverlayNow]);

  React.useEffect(() => {
    renderOverlayNow();
    if (!selectedLayerId || !hasSelectedLayerMask) {
      stopOverlayAnimation();
      return;
    }
    animateOverlay();
  }, [
    animateOverlay,
    hasSelectedLayerMask,
    renderOverlayNow,
    selectedLayerId,
    stopOverlayAnimation,
  ]);

  React.useEffect(() => {
    if (!selectedLayerId) {
      setHasSelectedLayerMask(false);
      return;
    }
    setHasSelectedLayerMask(Boolean(maskMetaRef.current.get(selectedLayerId)?.hasContent));
  }, [selectedLayerId]);

  React.useEffect(
    () => () => {
      stopOverlayAnimation();
      maskAnalysisTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      maskAnalysisTimersRef.current.clear();
    },
    [stopOverlayAnimation]
  );

  const imageHasInteractiveMask = Boolean(selectedLayerImageUrl);

  const clearSelectedLayerMask = React.useCallback(() => {
    if (!selectedLayerId) return;
    clearLayerMask(selectedLayerId);
  }, [clearLayerMask, selectedLayerId]);

  const invertSelectedLayerMask = React.useCallback(() => {
    if (!selectedLayerId || !imageHasInteractiveMask) return;
    ensureMaskCanvasForLayer(selectedLayerId);
    invertLayerMask(selectedLayerId);
  }, [ensureMaskCanvasForLayer, imageHasInteractiveMask, invertLayerMask, selectedLayerId]);

  const exportSelectedLayerMaskBlob = React.useCallback(
    async ({ targetWidth, targetHeight, mimeType = "image/png" }: ExportMaskBlobParams) => {
      if (!selectedLayerId) return null;
      const maskMeta = maskMetaRef.current.get(selectedLayerId);
      if (!maskMeta?.hasContent) return null;
      const maskCanvas = maskCanvasesRef.current.get(selectedLayerId);
      if (!maskCanvas) return null;
      const width = Math.max(1, Math.round(targetWidth));
      const height = Math.max(1, Math.round(targetHeight));
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = width;
      exportCanvas.height = height;
      const exportCtx = exportCanvas.getContext("2d");
      if (!exportCtx) return null;

      exportCtx.fillStyle = "black";
      exportCtx.fillRect(0, 0, width, height);

      // Inpaint drawing is intentionally dropzone-wide, but only the visible image area
      // is exported for provider submit so the mask aligns with flattened image pixels.
      const exportSourceWindow = resolveMaskExportSourceWindow({
        imageRect,
        maskWidth: maskCanvas.width,
        maskHeight: maskCanvas.height,
      });
      if (!exportSourceWindow) return null;
      exportCtx.drawImage(
        maskCanvas,
        exportSourceWindow.sx,
        exportSourceWindow.sy,
        exportSourceWindow.sw,
        exportSourceWindow.sh,
        0,
        0,
        width,
        height
      );

      const blob = await new Promise<Blob | null>((resolve) => {
        exportCanvas.toBlob(resolve, mimeType);
      });
      return blob;
    },
    [imageRect, selectedLayerId]
  );

  return {
    overlayCanvasRef,
    hasSelectedLayerMask,
    imageHasInteractiveMask,
    clearSelectedLayerMask,
    invertSelectedLayerMask,
    exportSelectedLayerMaskBlob,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
  };
};
