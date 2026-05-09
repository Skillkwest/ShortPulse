/**
 * Inpaint mask interaction/render controller for Expert Edit.
 * Manages per-layer masks, brush/lasso compositing, and overlay/marching-ants rendering.
 */
import React from "react";
import { type InpaintPoint } from "./inpaintMaskGeometry";
import { type MaskLayerMeta } from "./inpaintMaskOverlay";
import type {
  ExportMaskBlobParams,
  InpaintLayerSource,
  InpaintMaskSnapshot,
} from "./inpaintMaskControllerTypes";
import { useInpaintMaskDocumentRuntime } from "./useInpaintMaskDocumentRuntime";
import { useInpaintMaskOverlayRuntime } from "./useInpaintMaskOverlayRuntime";
import {
  useInpaintMaskPointerSessionRuntime,
  createIdleInpaintPointerSession,
  type InpaintPointerSession,
} from "./useInpaintMaskPointerSessionRuntime";
import { useInpaintMaskGestureMutationRuntime } from "./useInpaintMaskGestureMutationRuntime";
import type { InpaintPaintMode, InpaintSelectionMode } from "./inpaintMaskInteractionTypes";

export type { InpaintPaintMode, InpaintSelectionMode } from "./inpaintMaskInteractionTypes";
export type {
  ExportMaskBlobParams,
  InpaintLayerSource,
  InpaintMaskLayerSnapshot,
  InpaintMaskSnapshot,
} from "./inpaintMaskControllerTypes";
export {
  applyLassoSelection,
  shouldEndPointerSessionOnLeave,
} from "./useInpaintMaskPointerSessionRuntime";
export { resolvePointerSampleEvents } from "./useInpaintMaskGestureMutationRuntime";

type ResolveClientPointToSurfacePoint = (params: {
  clientX: number;
  clientY: number;
  currentTarget: HTMLDivElement;
  clampToBounds: boolean;
}) => InpaintPoint | null;

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
 * Returns true when live lasso preview rendering should be visible.
 */
export const shouldRenderLassoPreview = (isPointerActive: boolean, paintMode: InpaintPaintMode) =>
  isPointerActive && paintMode === "lasso";

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
  const maskCanvasesRef = React.useRef<Map<string, HTMLCanvasElement>>(new Map());
  const maskMetaRef = React.useRef<Map<string, MaskLayerMeta>>(new Map());
  const pointerSessionRef = React.useRef<InpaintPointerSession>(createIdleInpaintPointerSession());
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

  const getIsPointerActive = React.useCallback(() => pointerSessionRef.current.active, []);

  const {
    overlayCanvasRef,
    modalOverlayCanvasRef,
    previewCanvasRef,
    modalPreviewCanvasRef,
    renderOverlayNow,
    animateOverlay,
    stopOverlayAnimation,
  } = useInpaintMaskOverlayRuntime({
    selectedLayerId,
    paintMode,
    maskCanvasesRef,
    maskMetaRef,
    pointerSessionRef,
    surfaceSize,
    shouldRenderLassoPreview,
  });

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

  const { onPointerUp, onPointerCancel, onPointerLeave } = useInpaintMaskPointerSessionRuntime({
    pointerSessionRef,
    shouldApplyLassoSelection: paintMode === "lasso",
    selectedLayerId,
    selectionMode,
    ensureMaskCanvasForLayer,
    queueLayerAnalysis,
    renderOverlayNow,
  });

  const setPointerSession = React.useCallback((nextSession: InpaintPointerSession) => {
    pointerSessionRef.current = nextSession;
  }, []);

  const { onPointerDown, onPointerMove } = useInpaintMaskGestureMutationRuntime({
    pointerSessionRef,
    setPointerSession,
    enabled,
    selectedLayerId,
    selectedLayerImageUrl,
    paintMode,
    selectionMode,
    strokeSize,
    sceneScale,
    onAutoToolAttempt,
    onPaintAttemptWithoutImage,
    resolveClientPointToSurfacePoint,
    ensureMaskCanvasForLayer,
    queueLayerAnalysis,
    renderOverlayNow,
    animateOverlay,
    resolveViewportOffsets,
  });

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
