import React from "react";

import {
  renderOverlayFrame,
  renderLivePreviewFrame,
  resolveNextMarchingAntPhaseState,
  type MaskLayerMeta,
} from "./inpaintMaskOverlay";

type PointerSessionState = {
  active: boolean;
  lassoPoints: Array<{ x: number; y: number }>;
};

type UseInpaintMaskOverlayRuntimeArgs = {
  selectedLayerId: string | null;
  paintMode: "brush" | "lasso" | "auto";
  maskCanvasesRef: React.MutableRefObject<Map<string, HTMLCanvasElement>>;
  maskMetaRef: React.MutableRefObject<Map<string, MaskLayerMeta>>;
  pointerSessionRef: React.MutableRefObject<PointerSessionState>;
  surfaceSize: {
    width: number;
    height: number;
  };
  shouldRenderLassoPreview: (
    isPointerActive: boolean,
    paintMode: "brush" | "lasso" | "auto"
  ) => boolean;
};

export function useInpaintMaskOverlayRuntime({
  selectedLayerId,
  paintMode,
  maskCanvasesRef,
  maskMetaRef,
  pointerSessionRef,
  surfaceSize,
  shouldRenderLassoPreview,
}: UseInpaintMaskOverlayRuntimeArgs) {
  const overlayCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const modalOverlayCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const modalPreviewCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const antsPhaseRef = React.useRef(0);
  const lastAntsTickRef = React.useRef(0);
  const overlayRafRef = React.useRef<number | null>(null);

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
      [overlayCanvasRef.current, modalOverlayCanvasRef.current].forEach((overlayCanvas) => {
        if (!overlayCanvas) return;
        renderOverlayFrame({
          canvas: overlayCanvas,
          maskCanvas: selectedMaskCanvas,
          meta: selectedMaskMeta,
          showCommittedMask: !isBrushPreviewActive,
          phase,
        });
      });
      [previewCanvasRef.current, modalPreviewCanvasRef.current].forEach((previewCanvas) => {
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
    [
      maskCanvasesRef,
      maskMetaRef,
      paintMode,
      pointerSessionRef,
      selectedLayerId,
      shouldRenderLassoPreview,
    ]
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
  }, [maskMetaRef, paintMode, pointerSessionRef, renderOverlay, selectedLayerId]);

  React.useEffect(() => {
    if (!surfaceSize.width || !surfaceSize.height) return;
    renderOverlayNow();
  }, [renderOverlayNow, surfaceSize.height, surfaceSize.width]);

  React.useEffect(() => {
    renderOverlayNow();
    const hasSelectedMaskContent = selectedLayerId
      ? Boolean(maskMetaRef.current.get(selectedLayerId)?.hasContent)
      : false;
    if (!selectedLayerId || !hasSelectedMaskContent) {
      stopOverlayAnimation();
      return;
    }
    animateOverlay();
  }, [animateOverlay, maskMetaRef, renderOverlayNow, selectedLayerId, stopOverlayAnimation]);

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
    renderOverlayNow,
    animateOverlay,
    stopOverlayAnimation,
  };
}
