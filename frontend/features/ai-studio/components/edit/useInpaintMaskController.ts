/**
 * Inpaint mask interaction/render controller for Expert Edit.
 * Manages per-layer masks, brush/lasso compositing, and overlay/marching-ants rendering.
 */
import React from "react";
import {
  mapSurfacePointToMaskCanvasPoint,
  resolveInpaintBrushPaintRadius,
  resolveMaskInteractionPoint,
  resolveMaskSpaceScaleFromSurface,
  type InpaintPoint,
} from "./inpaintMaskGeometry";
import {
  renderOverlayFrame,
  renderLivePreviewFrame,
  resolveNextMarchingAntPhaseState,
  type MaskLayerMeta,
} from "./inpaintMaskOverlay";
import type {
  ExportMaskBlobParams,
  InpaintLayerSource,
  InpaintMaskSnapshot,
} from "./inpaintMaskControllerTypes";
import { useInpaintMaskDocumentRuntime } from "./useInpaintMaskDocumentRuntime";

export type InpaintPaintMode = "brush" | "lasso" | "auto";
export type InpaintSelectionMode = "select" | "unselect";
export type {
  ExportMaskBlobParams,
  InpaintLayerSource,
  InpaintMaskLayerSnapshot,
  InpaintMaskSnapshot,
} from "./inpaintMaskControllerTypes";

type ResolveClientPointToSurfacePoint = (params: {
  clientX: number;
  clientY: number;
  currentTarget: HTMLDivElement;
  clampToBounds: boolean;
}) => InpaintPoint | null;

type PointerSession = {
  pointerId: number;
  active: boolean;
  lastPoint: InpaintPoint | null;
  lassoPoints: InpaintPoint[];
};

type UseInpaintMaskControllerParams = {
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  selectedLayerId: string | null;
  selectedLayerImageUrl: string | null;
  layerSources: InpaintLayerSource[];
  enabled: boolean;
  sceneScale: number;
  shouldApplyViewportTransform: boolean;
  viewportOffsetXRatio: number;
  viewportOffsetYRatio: number;
  resolveViewportOffsetPixels?: (
    interactionRect: DOMRect,
    currentTarget: HTMLDivElement
  ) => {
    offsetX: number;
    offsetY: number;
  };
  resolveClientPointToSurfacePoint?: ResolveClientPointToSurfacePoint;
  paintMode: InpaintPaintMode;
  selectionMode: InpaintSelectionMode;
  strokeSize: number;
  onAutoToolAttempt?: () => void;
  onPaintAttemptWithoutImage?: () => void;
};

type UseInpaintMaskControllerResult = {
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  modalOverlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  previewCanvasRef: React.RefObject<HTMLCanvasElement>;
  modalPreviewCanvasRef: React.RefObject<HTMLCanvasElement>;
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
  surfaceRef,
  selectedLayerId,
  selectedLayerImageUrl,
  layerSources,
  enabled,
  sceneScale,
  shouldApplyViewportTransform,
  viewportOffsetXRatio,
  viewportOffsetYRatio,
  resolveViewportOffsetPixels,
  resolveClientPointToSurfacePoint,
  paintMode,
  selectionMode,
  strokeSize,
  onAutoToolAttempt,
  onPaintAttemptWithoutImage,
}: UseInpaintMaskControllerParams): UseInpaintMaskControllerResult => {
  const overlayCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const modalOverlayCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const modalPreviewCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const maskCanvasesRef = React.useRef<Map<string, HTMLCanvasElement>>(new Map());
  const maskMetaRef = React.useRef<Map<string, MaskLayerMeta>>(new Map());
  const pointerSessionRef = React.useRef<PointerSession>({
    pointerId: -1,
    active: false,
    lastPoint: null,
    lassoPoints: [],
  });
  const antsPhaseRef = React.useRef(0);
  const lastAntsTickRef = React.useRef(0);
  const overlayRafRef = React.useRef<number | null>(null);
  const [surfaceSize, setSurfaceSize] = React.useState({ width: 0, height: 0 });
  const resolveViewportOffsets = React.useCallback(
    (interactionRect: DOMRect, currentTarget: HTMLDivElement) => {
      const resolvedViewportOffset = resolveViewportOffsetPixels?.(interactionRect, currentTarget);
      return {
        viewportOffsetX: shouldApplyViewportTransform
          ? (resolvedViewportOffset?.offsetX ?? viewportOffsetXRatio * interactionRect.width)
          : 0,
        viewportOffsetY: shouldApplyViewportTransform
          ? (resolvedViewportOffset?.offsetY ?? viewportOffsetYRatio * interactionRect.height)
          : 0,
      };
    },
    [
      resolveViewportOffsetPixels,
      shouldApplyViewportTransform,
      viewportOffsetXRatio,
      viewportOffsetYRatio,
    ]
  );

  const renderOverlay = React.useCallback(
    (phase: number) => {
      const selectedMaskCanvas = selectedLayerId
        ? (maskCanvasesRef.current.get(selectedLayerId) ?? null)
        : null;
      const selectedMaskMeta = selectedLayerId
        ? (maskMetaRef.current.get(selectedLayerId) ?? null)
        : null;
      const isBrushPreviewActive = pointerSessionRef.current.active && paintMode === "brush";
      const lassoPreviewPoints = shouldRenderLassoPreview(
        pointerSessionRef.current.active,
        paintMode
      )
        ? pointerSessionRef.current.lassoPoints
        : [];
      const committedOverlayTargets = [overlayCanvasRef.current, modalOverlayCanvasRef.current];
      committedOverlayTargets.forEach((overlayCanvas) => {
        if (!overlayCanvas) return;
        renderOverlayFrame({
          canvas: overlayCanvas,
          maskCanvas: selectedMaskCanvas,
          meta: selectedMaskMeta,
          showCommittedMask: !isBrushPreviewActive,
          phase,
        });
      });
      const previewOverlayTargets = [previewCanvasRef.current, modalPreviewCanvasRef.current];
      previewOverlayTargets.forEach((previewCanvas) => {
        if (!previewCanvas) return;
        renderLivePreviewFrame({
          canvas: previewCanvas,
          maskCanvas: selectedMaskCanvas,
          showBrushPreview: isBrushPreviewActive,
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
      const hasAnimatedMask =
        Boolean(selectedMaskMeta?.hasContent) && !pointerSessionRef.current.active;
      const isAnimatingLasso = pointerSessionRef.current.active && paintMode === "lasso";
      if (hasAnimatedMask || isAnimatingLasso) {
        overlayRafRef.current = window.requestAnimationFrame(run);
      } else {
        overlayRafRef.current = null;
      }
    };
    overlayRafRef.current = window.requestAnimationFrame(run);
  }, [paintMode, renderOverlay, selectedLayerId]);
  const getIsPointerActive = React.useCallback(() => pointerSessionRef.current.active, []);

  const {
    hasSelectedLayerMask,
    imageHasInteractiveMask,
    ensureMaskCanvasForLayer,
    queueLayerAnalysis,
    captureMaskSnapshot,
    restoreMaskSnapshot,
    clearAllMasks,
    clearSelectedLayerMask,
    invertSelectedLayerMask,
    exportSelectedLayerMaskBlob,
  } = useInpaintMaskDocumentRuntime({
    maskCanvasesRef,
    maskMetaRef,
    selectedLayerId,
    selectedLayerImageUrl,
    layerSources,
    surfaceSize,
    renderOverlayNow,
    animateOverlay,
    stopOverlayAnimation,
    getIsPointerActive,
    shouldAnimateLasso: paintMode === "lasso",
  });

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
      const logicalInteractionRect = new DOMRect(
        0,
        0,
        Math.max(1, event.currentTarget.clientWidth || interactionRect.width),
        Math.max(1, event.currentTarget.clientHeight || interactionRect.height)
      );
      const canvas = ensureMaskCanvasForLayer(selectedLayerId);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const viewportOffsets = resolveViewportOffsets(interactionRect, event.currentTarget);
      const resolvedSurfacePoint =
        resolveClientPointToSurfacePoint?.({
          clientX: event.clientX,
          clientY: event.clientY,
          currentTarget: event.currentTarget,
          clampToBounds: false,
        }) ?? null;
      const point =
        resolvedSurfacePoint != null
          ? mapSurfacePointToMaskCanvasPoint({
              point: resolvedSurfacePoint,
              interactionRect: logicalInteractionRect,
              maskWidth: canvas.width,
              maskHeight: canvas.height,
            })
          : resolveMaskInteractionPoint({
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
          surfaceWidth: logicalInteractionRect.width,
          surfaceHeight: logicalInteractionRect.height,
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
      resolveClientPointToSurfacePoint,
      resolveViewportOffsets,
    ]
  );

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = pointerSessionRef.current;
      if (!session.active || event.pointerId !== session.pointerId || !selectedLayerId) return;

      event.preventDefault();
      const interactionRect = event.currentTarget.getBoundingClientRect();
      const logicalInteractionRect = new DOMRect(
        0,
        0,
        Math.max(1, event.currentTarget.clientWidth || interactionRect.width),
        Math.max(1, event.currentTarget.clientHeight || interactionRect.height)
      );
      const canvas = ensureMaskCanvasForLayer(selectedLayerId);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const events = resolvePointerSampleEvents(event.nativeEvent as PointerEvent);
      const viewportOffsets = resolveViewportOffsets(interactionRect, event.currentTarget);

      if (paintMode === "lasso") {
        events.forEach((sampleEvent) => {
          const resolvedSurfacePoint =
            resolveClientPointToSurfacePoint?.({
              clientX: sampleEvent.clientX,
              clientY: sampleEvent.clientY,
              currentTarget: event.currentTarget,
              clampToBounds: false,
            }) ??
            resolveClientPointToSurfacePoint?.({
              clientX: sampleEvent.clientX,
              clientY: sampleEvent.clientY,
              currentTarget: event.currentTarget,
              clampToBounds: true,
            }) ??
            null;
          const point =
            resolvedSurfacePoint != null
              ? mapSurfacePointToMaskCanvasPoint({
                  point: resolvedSurfacePoint,
                  interactionRect: logicalInteractionRect,
                  maskWidth: canvas.width,
                  maskHeight: canvas.height,
                })
              : (resolveMaskInteractionPoint({
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
                }));
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
        surfaceWidth: logicalInteractionRect.width,
        surfaceHeight: logicalInteractionRect.height,
        maskWidth: canvas.width,
        maskHeight: canvas.height,
      });
      const radius = resolveInpaintBrushPaintRadius({
        strokeSize,
        surfaceToMaskScale,
      });
      events.forEach((sampleEvent) => {
        const resolvedSurfacePoint =
          resolveClientPointToSurfacePoint?.({
            clientX: sampleEvent.clientX,
            clientY: sampleEvent.clientY,
            currentTarget: event.currentTarget,
            clampToBounds: false,
          }) ??
          resolveClientPointToSurfacePoint?.({
            clientX: sampleEvent.clientX,
            clientY: sampleEvent.clientY,
            currentTarget: event.currentTarget,
            clampToBounds: true,
          }) ??
          null;
        const point =
          resolvedSurfacePoint != null
            ? mapSurfacePointToMaskCanvasPoint({
                point: resolvedSurfacePoint,
                interactionRect: logicalInteractionRect,
                maskWidth: canvas.width,
                maskHeight: canvas.height,
              })
            : (resolveMaskInteractionPoint({
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
              }));
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
      resolveClientPointToSurfacePoint,
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
    const surface = surfaceRef.current;
    if (!surface) return;
    const updateSize = () => {
      const nextWidth = Math.max(1, Math.round(surface.clientWidth));
      const nextHeight = Math.max(1, Math.round(surface.clientHeight));
      setSurfaceSize((current) =>
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
    observer.observe(surface);
    return () => observer.disconnect();
  }, [surfaceRef]);

  React.useEffect(() => {
    if (!surfaceSize.width || !surfaceSize.height) return;
    renderOverlayNow();
  }, [renderOverlayNow, surfaceSize.height, surfaceSize.width]);

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

  React.useEffect(
    () => () => {
      stopOverlayAnimation();
    },
    [stopOverlayAnimation]
  );

  return {
    overlayCanvasRef,
    modalOverlayCanvasRef,
    previewCanvasRef,
    modalPreviewCanvasRef,
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
