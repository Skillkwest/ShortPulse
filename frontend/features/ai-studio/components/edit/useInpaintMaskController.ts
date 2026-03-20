/**
 * Inpaint mask interaction/render controller for Expert Edit.
 * Manages per-layer masks, brush/lasso compositing, and overlay/marching-ants rendering.
 */
import React from "react";
import {
  resolveContainSizeForStage,
  resolveStageFlattenCameraTransform,
  type StageFlattenCameraTransformInput,
} from "../../logic/expertEditStageFlatten";
import { resolveSceneMappedDrawRect } from "./stageSceneGeometry";
import {
  resolveInpaintBrushPaintRadius,
  resolveMaskInteractionPoint,
  resolveMaskSpaceScaleFromSurface,
  type InpaintPoint,
} from "./inpaintMaskGeometry";
import {
  analyzeMaskCanvas,
  renderOverlayFrame,
  resolveNextMarchingAntPhaseState,
  type MaskLayerMeta,
} from "./inpaintMaskOverlay";

export type InpaintPaintMode = "brush" | "lasso" | "auto";
export type InpaintSelectionMode = "select" | "unselect";

export type InpaintLayerSource = {
  id: string;
  imageUrl: string | null;
};

type PointerSession = {
  pointerId: number;
  active: boolean;
  lastPoint: InpaintPoint | null;
  lassoPoints: InpaintPoint[];
};

export type InpaintMaskLayerSnapshot = {
  layerId: string;
  width: number;
  height: number;
  alpha: Uint8ClampedArray;
};

export type InpaintMaskSnapshot = {
  layers: InpaintMaskLayerSnapshot[];
};

type UseInpaintMaskControllerParams = {
  dropzoneRef: React.RefObject<HTMLDivElement | null>;
  selectedLayerId: string | null;
  selectedLayerImageUrl: string | null;
  layerSources: InpaintLayerSource[];
  enabled: boolean;
  sceneScale: number;
  shouldApplyViewportTransform: boolean;
  viewportOffsetXRatio: number;
  viewportOffsetYRatio: number;
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
  camera?: StageFlattenCameraTransformInput | null;
};

type UseInpaintMaskControllerResult = {
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  modalOverlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  hasSelectedLayerMask: boolean;
  imageHasInteractiveMask: boolean;
  captureMaskSnapshot: () => InpaintMaskSnapshot;
  restoreMaskSnapshot: (snapshot: InpaintMaskSnapshot) => void;
  clearAllMasks: () => void;
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
export const INPAINT_LASSO_FILL_RULE: CanvasFillRule = "evenodd";

export const areInpaintMaskSnapshotsEqual = (
  left: InpaintMaskSnapshot,
  right: InpaintMaskSnapshot
) => {
  if (left.layers.length !== right.layers.length) return false;
  for (let index = 0; index < left.layers.length; index += 1) {
    const leftLayer = left.layers[index];
    const rightLayer = right.layers[index];
    if (!leftLayer || !rightLayer) return false;
    if (leftLayer.layerId !== rightLayer.layerId) return false;
    if (leftLayer.width !== rightLayer.width || leftLayer.height !== rightLayer.height)
      return false;
    if (leftLayer.alpha.length !== rightLayer.alpha.length) return false;
    for (let alphaIndex = 0; alphaIndex < leftLayer.alpha.length; alphaIndex += 1) {
      if (leftLayer.alpha[alphaIndex] !== rightLayer.alpha[alphaIndex]) {
        return false;
      }
    }
  }
  return true;
};

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

const createMaskCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

const remapMaskCanvasToSize = ({
  source,
  target,
}: {
  source: HTMLCanvasElement;
  target: HTMLCanvasElement;
}) => {
  if (source.width <= 0 || source.height <= 0 || target.width <= 0 || target.height <= 0) {
    return;
  }
  const targetCtx = target.getContext("2d");
  if (!targetCtx) return;
  targetCtx.clearRect(0, 0, target.width, target.height);
  const drawRect = resolveSceneMappedDrawRect({
    sourceWidth: source.width,
    sourceHeight: source.height,
    targetWidth: target.width,
    targetHeight: target.height,
  });
  targetCtx.drawImage(source, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
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

export const applyLassoSelection = ({
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
  ctx.fill(INPAINT_LASSO_FILL_RULE);
  ctx.restore();
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
  sceneScale,
  shouldApplyViewportTransform,
  viewportOffsetXRatio,
  viewportOffsetYRatio,
  paintMode,
  selectionMode,
  strokeSize,
  onAutoToolAttempt,
  onPaintAttemptWithoutImage,
}: UseInpaintMaskControllerParams): UseInpaintMaskControllerResult => {
  const overlayCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const modalOverlayCanvasRef = React.useRef<HTMLCanvasElement>(null);
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
  const resolveViewportOffsets = React.useCallback(
    (interactionRect: DOMRect) => ({
      viewportOffsetX: shouldApplyViewportTransform
        ? viewportOffsetXRatio * interactionRect.width
        : 0,
      viewportOffsetY: shouldApplyViewportTransform
        ? viewportOffsetYRatio * interactionRect.height
        : 0,
    }),
    [shouldApplyViewportTransform, viewportOffsetXRatio, viewportOffsetYRatio]
  );

  const ensureMaskCanvasForLayer = React.useCallback(
    (layerId: string) => {
      const isSelectedLayer = selectedLayerId === layerId;
      const targetWidth =
        isSelectedLayer && selectedImageNaturalSize
          ? Math.max(1, Math.round(selectedImageNaturalSize.width))
          : Math.max(1, Math.round(dropzoneSize.width));
      const targetHeight =
        isSelectedLayer && selectedImageNaturalSize
          ? Math.max(1, Math.round(selectedImageNaturalSize.height))
          : Math.max(1, Math.round(dropzoneSize.height));
      const existing = maskCanvasesRef.current.get(layerId);
      if (existing) {
        if (existing.width === targetWidth && existing.height === targetHeight) {
          return existing;
        }
        const resized = createMaskCanvas(targetWidth, targetHeight);
        remapMaskCanvasToSize({
          source: existing,
          target: resized,
        });
        maskCanvasesRef.current.set(layerId, resized);
        maskMetaRef.current.delete(layerId);
        return resized;
      }
      const canvas = createMaskCanvas(targetWidth, targetHeight);
      maskCanvasesRef.current.set(layerId, canvas);
      return canvas;
    },
    [dropzoneSize.height, dropzoneSize.width, selectedImageNaturalSize, selectedLayerId]
  );

  const renderOverlay = React.useCallback(
    (phase: number) => {
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
      const overlayTargets = [overlayCanvasRef.current, modalOverlayCanvasRef.current];
      overlayTargets.forEach((overlayCanvas) => {
        if (!overlayCanvas) return;
        renderOverlayFrame({
          canvas: overlayCanvas,
          maskCanvas: selectedMaskCanvas,
          meta: selectedMaskMeta,
          lassoPreviewPoints,
          phase,
        });
      });
    },
    [paintMode, selectedLayerId]
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

  React.useEffect(() => {
    if (!selectedLayerId) return;
    ensureMaskCanvasForLayer(selectedLayerId);
    queueLayerAnalysis(selectedLayerId, true);
  }, [ensureMaskCanvasForLayer, queueLayerAnalysis, selectedImageNaturalSize, selectedLayerId]);

  const captureMaskSnapshot = React.useCallback((): InpaintMaskSnapshot => {
    const layers: InpaintMaskLayerSnapshot[] = [];
    maskCanvasesRef.current.forEach((canvas, layerId) => {
      if (canvas.width <= 0 || canvas.height <= 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
      let hasContent = false;
      for (let pixelIndex = 0, alphaIndex = 0; alphaIndex < alpha.length; alphaIndex += 1) {
        const alphaValue = imageData.data[pixelIndex + 3] ?? 0;
        alpha[alphaIndex] = alphaValue;
        if (alphaValue > 0) {
          hasContent = true;
        }
        pixelIndex += 4;
      }
      if (!hasContent) return;
      layers.push({
        layerId,
        width: canvas.width,
        height: canvas.height,
        alpha,
      });
    });
    layers.sort((left, right) => left.layerId.localeCompare(right.layerId));
    return { layers };
  }, []);

  const restoreMaskSnapshot = React.useCallback(
    (snapshot: InpaintMaskSnapshot) => {
      const activeLayerIds = new Set(layerSources.map((source) => source.id));
      const nextCanvases = new Map<string, HTMLCanvasElement>();

      layerSources.forEach((source) => {
        const sourceCanvas = ensureMaskCanvasForLayer(source.id);
        const seedCanvas = createMaskCanvas(sourceCanvas.width, sourceCanvas.height);
        nextCanvases.set(source.id, seedCanvas);
      });

      snapshot.layers.forEach((layerSnapshot) => {
        if (!activeLayerIds.has(layerSnapshot.layerId)) return;
        const canvas = createMaskCanvas(layerSnapshot.width, layerSnapshot.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const imageData = ctx.createImageData(layerSnapshot.width, layerSnapshot.height);
        for (
          let alphaIndex = 0, pixelIndex = 0;
          alphaIndex < layerSnapshot.alpha.length;
          alphaIndex += 1
        ) {
          const alphaValue = layerSnapshot.alpha[alphaIndex] ?? 0;
          imageData.data[pixelIndex] = 255;
          imageData.data[pixelIndex + 1] = 255;
          imageData.data[pixelIndex + 2] = 255;
          imageData.data[pixelIndex + 3] = alphaValue;
          pixelIndex += 4;
        }
        ctx.putImageData(imageData, 0, 0);
        nextCanvases.set(layerSnapshot.layerId, canvas);
      });

      maskCanvasesRef.current = nextCanvases;
      maskMetaRef.current.clear();
      layerSources.forEach((source) => {
        queueLayerAnalysis(source.id, true);
      });
      if (!selectedLayerId) {
        setHasSelectedLayerMask(false);
      }
      renderOverlayNow();
      animateOverlay();
    },
    [
      animateOverlay,
      ensureMaskCanvasForLayer,
      layerSources,
      queueLayerAnalysis,
      renderOverlayNow,
      selectedLayerId,
    ]
  );

  const clearAllMasks = React.useCallback(() => {
    const nextCanvases = new Map<string, HTMLCanvasElement>();
    layerSources.forEach((source) => {
      const sourceCanvas = ensureMaskCanvasForLayer(source.id);
      nextCanvases.set(source.id, createMaskCanvas(sourceCanvas.width, sourceCanvas.height));
    });
    maskCanvasesRef.current = nextCanvases;
    maskMetaRef.current.clear();
    setHasSelectedLayerMask(false);
    stopOverlayAnimation();
    renderOverlayNow();
  }, [ensureMaskCanvasForLayer, layerSources, renderOverlayNow, stopOverlayAnimation]);

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
      const interactionRect = event.currentTarget.getBoundingClientRect();
      const canvas = ensureMaskCanvasForLayer(selectedLayerId);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const viewportOffsets = resolveViewportOffsets(interactionRect);
      const point = resolveMaskInteractionPoint({
        sampleEvent: event,
        interactionRect,
        maskWidth: canvas.width,
        maskHeight: canvas.height,
        sceneScale,
        ...viewportOffsets,
        clampToBounds: false,
      });
      if (!point) return;

      event.preventDefault();
      if ((event.currentTarget as HTMLElement | null)?.setPointerCapture) {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      }

      pointerSessionRef.current = {
        pointerId: event.pointerId,
        active: true,
        lastPoint: point,
        lassoPoints: [point],
      };

      if (paintMode === "brush") {
        const surfaceToMaskScale = resolveMaskSpaceScaleFromSurface({
          surfaceWidth: interactionRect.width,
          surfaceHeight: interactionRect.height,
          maskWidth: canvas.width,
          maskHeight: canvas.height,
        });
        const radius = resolveInpaintBrushPaintRadius({
          strokeSize,
          surfaceToMaskScale,
        });
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
      sceneScale,
      strokeSize,
      resolveViewportOffsets,
    ]
  );

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = pointerSessionRef.current;
      if (!session.active || event.pointerId !== session.pointerId || !selectedLayerId) return;

      event.preventDefault();
      const interactionRect = event.currentTarget.getBoundingClientRect();
      const canvas = ensureMaskCanvasForLayer(selectedLayerId);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const events = resolvePointerSampleEvents(event.nativeEvent as PointerEvent);
      const viewportOffsets = resolveViewportOffsets(interactionRect);

      if (paintMode === "lasso") {
        events.forEach((sampleEvent) => {
          const point =
            resolveMaskInteractionPoint({
              sampleEvent,
              interactionRect,
              maskWidth: canvas.width,
              maskHeight: canvas.height,
              sceneScale,
              ...viewportOffsets,
              clampToBounds: false,
            }) ??
            resolveMaskInteractionPoint({
              sampleEvent,
              interactionRect,
              maskWidth: canvas.width,
              maskHeight: canvas.height,
              sceneScale,
              ...viewportOffsets,
              clampToBounds: true,
            });
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
      let didPaint = false;
      let previousPoint = session.lastPoint;
      const surfaceToMaskScale = resolveMaskSpaceScaleFromSurface({
        surfaceWidth: interactionRect.width,
        surfaceHeight: interactionRect.height,
        maskWidth: canvas.width,
        maskHeight: canvas.height,
      });
      const radius = resolveInpaintBrushPaintRadius({
        strokeSize,
        surfaceToMaskScale,
      });
      events.forEach((sampleEvent) => {
        const point =
          resolveMaskInteractionPoint({
            sampleEvent,
            interactionRect,
            maskWidth: canvas.width,
            maskHeight: canvas.height,
            sceneScale,
            ...viewportOffsets,
            clampToBounds: false,
          }) ??
          resolveMaskInteractionPoint({
            sampleEvent,
            interactionRect,
            maskWidth: canvas.width,
            maskHeight: canvas.height,
            sceneScale,
            ...viewportOffsets,
            clampToBounds: true,
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
      ensureMaskCanvasForLayer,
      paintMode,
      queueLayerAnalysis,
      renderOverlayNow,
      selectedLayerId,
      selectionMode,
      sceneScale,
      strokeSize,
      resolveViewportOffsets,
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
    renderOverlayNow();
  }, [dropzoneSize.height, dropzoneSize.width, renderOverlayNow]);

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
    async ({ targetWidth, targetHeight, mimeType = "image/png", camera }: ExportMaskBlobParams) => {
      if (!selectedLayerId) return null;
      const maskMeta = maskMetaRef.current.get(selectedLayerId);
      if (!maskMeta?.hasContent) return null;
      const maskCanvas = ensureMaskCanvasForLayer(selectedLayerId);
      const width = Math.max(1, Math.round(targetWidth));
      const height = Math.max(1, Math.round(targetHeight));
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = width;
      exportCanvas.height = height;
      const exportCtx = exportCanvas.getContext("2d");
      if (!exportCtx) return null;
      const cameraTransform = resolveStageFlattenCameraTransform({
        camera,
        outputWidth: width,
        outputHeight: height,
      });
      const containSize = resolveContainSizeForStage(
        maskCanvas.width,
        maskCanvas.height,
        width,
        height
      );

      exportCtx.fillStyle = "black";
      exportCtx.fillRect(0, 0, width, height);
      exportCtx.save();
      exportCtx.translate(
        width / 2 + cameraTransform.offsetX,
        height / 2 + cameraTransform.offsetY
      );
      if (cameraTransform.scale !== 1) {
        exportCtx.scale(cameraTransform.scale, cameraTransform.scale);
      }
      exportCtx.drawImage(
        maskCanvas,
        -containSize.drawWidth / 2,
        -containSize.drawHeight / 2,
        containSize.drawWidth,
        containSize.drawHeight
      );
      exportCtx.restore();

      const blob = await new Promise<Blob | null>((resolve) => {
        exportCanvas.toBlob(resolve, mimeType);
      });
      return blob;
    },
    [ensureMaskCanvasForLayer, selectedLayerId]
  );

  return {
    overlayCanvasRef,
    modalOverlayCanvasRef,
    hasSelectedLayerMask,
    imageHasInteractiveMask,
    captureMaskSnapshot,
    restoreMaskSnapshot,
    clearAllMasks,
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
