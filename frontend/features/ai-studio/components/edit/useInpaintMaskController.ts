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

type MaskLayerMeta = {
  hasContent: boolean;
  width: number;
  height: number;
  contourSegments: number[];
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toCanvasPoint = (
  event: { clientX: number; clientY: number },
  rect: DOMRect,
  imageRect: InpaintImageRect | null
): InpaintPoint | null => {
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
  if (imageRect) {
    const withinX = x >= imageRect.x && x <= imageRect.x + imageRect.width;
    const withinY = y >= imageRect.y && y <= imageRect.y + imageRect.height;
    if (!withinX || !withinY) return null;
  }
  return {
    x,
    y,
  };
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
    return { hasContent: false, contourSegments: [] };
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

  return {
    hasContent,
    contourSegments,
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
    };
  }
  const imageData = ctx.getImageData(0, 0, width, height);
  const derivedContour = deriveMaskContourFromAlpha(width, height, imageData.data);

  return {
    hasContent: derivedContour.hasContent,
    width,
    height,
    contourSegments: derivedContour.contourSegments,
  };
};

const drawBrushSegment = ({
  ctx,
  from,
  to,
  radius,
  selectionMode,
  imageRect,
}: {
  ctx: CanvasRenderingContext2D;
  from: InpaintPoint;
  to: InpaintPoint;
  radius: number;
  selectionMode: InpaintSelectionMode;
  imageRect: InpaintImageRect | null;
}) => {
  ctx.save();
  if (imageRect) {
    ctx.beginPath();
    ctx.rect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
    ctx.clip();
  }
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
  ctx.beginPath();
  ctx.arc(to.x, to.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const applyLassoSelection = ({
  ctx,
  points,
  selectionMode,
  imageRect,
}: {
  ctx: CanvasRenderingContext2D;
  points: InpaintPoint[];
  selectionMode: InpaintSelectionMode;
  imageRect: InpaintImageRect | null;
}) => {
  if (points.length < 3) return;
  ctx.save();
  if (imageRect) {
    ctx.beginPath();
    ctx.rect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
    ctx.clip();
  }
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
    ctx.fillStyle = "rgba(43, 212, 255, 0.36)";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    if (meta.width > 0 && meta.height > 0 && meta.contourSegments.length > 0) {
      const scaleX = width / meta.width;
      const scaleY = height / meta.height;
      const [dashSize, dashGap] = INPAINT_MARCHING_ANTS_DASH_PATTERN;
      const baseOffset = -(phase * MARCHING_ANTS_DASH_OFFSET_STEP);
      const drawContourStroke = (strokeStyle: string, lineDashOffset: number) => {
        ctx.save();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([dashSize, dashGap]);
        ctx.lineDashOffset = lineDashOffset;
        ctx.beginPath();
        for (let index = 0; index < meta.contourSegments.length; index += 4) {
          const x1 = meta.contourSegments[index] ?? 0;
          const y1 = meta.contourSegments[index + 1] ?? 0;
          const x2 = meta.contourSegments[index + 2] ?? 0;
          const y2 = meta.contourSegments[index + 3] ?? 0;
          ctx.moveTo(x1 * scaleX, y1 * scaleY);
          ctx.lineTo(x2 * scaleX, y2 * scaleY);
        }
        ctx.stroke();
        ctx.restore();
      };

      drawContourStroke("rgba(0,0,0,0.92)", baseOffset);
      drawContourStroke("rgba(255,255,255,0.98)", baseOffset + dashSize);
    }
  }

  if (lassoPreviewPoints.length > 1) {
    ctx.save();
    if (imageRect) {
      ctx.beginPath();
      ctx.rect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
      ctx.clip();
    }

    if (lassoPreviewPoints.length > 2) {
      ctx.fillStyle = "rgba(43, 212, 255, 0.14)";
      ctx.beginPath();
      ctx.moveTo(lassoPreviewPoints[0]!.x, lassoPreviewPoints[0]!.y);
      for (let index = 1; index < lassoPreviewPoints.length; index += 1) {
        const point = lassoPreviewPoints[index]!;
        ctx.lineTo(point.x, point.y);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.68)";
    ctx.beginPath();
    ctx.moveTo(lassoPreviewPoints[0]!.x, lassoPreviewPoints[0]!.y);
    for (let index = 1; index < lassoPreviewPoints.length; index += 1) {
      const point = lassoPreviewPoints[index]!;
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();

    const [dashSize, dashGap] = INPAINT_MARCHING_ANTS_DASH_PATTERN;
    const baseOffset = -(phase * MARCHING_ANTS_DASH_OFFSET_STEP);

    ctx.strokeStyle = "rgba(95, 231, 255, 0.98)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([dashSize, dashGap]);
    ctx.lineDashOffset = baseOffset;
    ctx.beginPath();
    ctx.moveTo(lassoPreviewPoints[0]!.x, lassoPreviewPoints[0]!.y);
    for (let index = 1; index < lassoPreviewPoints.length; index += 1) {
      const point = lassoPreviewPoints[index]!;
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();

    if (lassoPreviewPoints.length > 2) {
      const firstPoint = lassoPreviewPoints[0]!;
      const lastPoint = lassoPreviewPoints[lassoPreviewPoints.length - 1]!;

      ctx.strokeStyle = "rgba(95, 231, 255, 0.78)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([dashSize, dashGap]);
      ctx.lineDashOffset = baseOffset + dashSize;
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(firstPoint.x, firstPoint.y);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(95, 231, 255, 0.98)";
      ctx.beginPath();
      ctx.arc(firstPoint.x, firstPoint.y, 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
      ctx.beginPath();
      ctx.arc(lastPoint.x, lastPoint.y, 2.4, 0, Math.PI * 2);
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
      const bounds = imageRect ?? { x: 0, y: 0, width: canvas.width, height: canvas.height };
      const startX = clamp(Math.floor(bounds.x), 0, canvas.width);
      const startY = clamp(Math.floor(bounds.y), 0, canvas.height);
      const endX = clamp(Math.ceil(bounds.x + bounds.width), 0, canvas.width);
      const endY = clamp(Math.ceil(bounds.y + bounds.height), 0, canvas.height);
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
    [imageRect, queueLayerAnalysis]
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
            imageRect,
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
      imageRect,
      paintMode,
      queueLayerAnalysis,
      renderOverlayNow,
      selectedLayerId,
      selectionMode,
    ]
  );

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled || !selectedLayerId || !selectedLayerImageUrl) return;
      if (paintMode === "auto") {
        onAutoToolAttempt?.();
        return;
      }
      if (paintMode !== "brush" && paintMode !== "lasso") return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const dropzone = dropzoneRef.current;
      if (!dropzone) return;
      const rect = dropzone.getBoundingClientRect();
      const point = toCanvasPoint(event, rect, imageRect);
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
          imageRect,
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
      imageRect,
      onAutoToolAttempt,
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
      const events =
        typeof (event.nativeEvent as PointerEvent).getCoalescedEvents === "function"
          ? (event.nativeEvent as PointerEvent).getCoalescedEvents()
          : [event.nativeEvent as PointerEvent];

      if (paintMode === "lasso") {
        events.forEach((sampleEvent) => {
          const point = toCanvasPoint(sampleEvent, rect, imageRect);
          if (!point) return;
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
        const point = toCanvasPoint(sampleEvent, rect, imageRect);
        if (!point) return;
        if (!previousPoint) previousPoint = point;
        drawBrushSegment({
          ctx,
          from: previousPoint,
          to: point,
          radius,
          selectionMode,
          imageRect,
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
      imageRect,
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

      const sourceImageRect = imageRect ?? {
        x: 0,
        y: 0,
        width: maskCanvas.width,
        height: maskCanvas.height,
      };
      const sx = clamp(Math.floor(sourceImageRect.x), 0, maskCanvas.width);
      const sy = clamp(Math.floor(sourceImageRect.y), 0, maskCanvas.height);
      const sw = clamp(Math.ceil(sourceImageRect.width), 1, maskCanvas.width - sx);
      const sh = clamp(Math.ceil(sourceImageRect.height), 1, maskCanvas.height - sy);

      exportCtx.drawImage(maskCanvas, sx, sy, sw, sh, 0, 0, width, height);

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
