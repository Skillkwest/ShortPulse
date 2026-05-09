/**
 * Live gesture-mutation runtime for the Expert Edit inpaint controller.
 * Owns pointer-down/move mask mutation while the parent controller composes document, overlay,
 * and terminal pointer-session behavior.
 */
import React from "react";

import type { InpaintPaintMode, InpaintSelectionMode } from "./inpaintMaskInteractionTypes";
import type { InpaintPointerSession } from "./useInpaintMaskPointerSessionRuntime";
import {
  resolveMaskCanvasInteractionPointWithFallback,
  resolveMaskLogicalInteractionRect,
} from "./inpaintMaskInteractionSampling";
import {
  applyBrushPointerDown,
  applyBrushPointerMoveSamples,
  applyLassoPointerMoveSamples,
  type ResolveClientPointToSurfacePoint,
  type ViewportOffsets,
} from "./inpaintMaskGestureMutationOperations";

type UseInpaintMaskGestureMutationRuntimeArgs = {
  pointerSessionRef: React.MutableRefObject<InpaintPointerSession>;
  setPointerSession: (nextSession: InpaintPointerSession) => void;
  enabled: boolean;
  selectedLayerId: string | null;
  selectedLayerImageUrl: string | null;
  paintMode: InpaintPaintMode;
  selectionMode: InpaintSelectionMode;
  strokeSize: number;
  sceneScale: number;
  onAutoToolAttempt?: () => void;
  onPaintAttemptWithoutImage?: () => void;
  resolveClientPointToSurfacePoint?: ResolveClientPointToSurfacePoint;
  ensureMaskCanvasForLayer: (layerId: string) => HTMLCanvasElement;
  queueLayerAnalysis: (layerId: string, immediate?: boolean) => void;
  renderOverlayNow: () => void;
  animateOverlay: () => void;
  resolveViewportOffsets: (
    interactionRect: DOMRect,
    currentTarget: HTMLDivElement
  ) => ViewportOffsets;
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

/**
 * Builds live gesture handlers for inpaint paint/lasso mutations.
 */
export function useInpaintMaskGestureMutationRuntime({
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
}: UseInpaintMaskGestureMutationRuntimeArgs) {
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
      const logicalInteractionRect = resolveMaskLogicalInteractionRect({
        currentTarget: event.currentTarget,
        interactionRect,
      });
      const canvas = ensureMaskCanvasForLayer(selectedLayerId);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const viewportOffsets = resolveViewportOffsets(interactionRect, event.currentTarget);
      const point = resolveMaskCanvasInteractionPointWithFallback({
        sampleEvent: event,
        currentTarget: event.currentTarget,
        interactionRect,
        logicalInteractionRect,
        maskWidth: canvas.width,
        maskHeight: canvas.height,
        sceneScale,
        viewportOffsets,
        resolveClientPointToSurfacePoint,
      });
      if (!point) return;

      event.preventDefault();
      if ((event.currentTarget as HTMLElement | null)?.setPointerCapture) {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      }

      setPointerSession({
        pointerId: event.pointerId,
        active: true,
        lastPoint: point,
        lassoPoints: [point],
      });

      if (paintMode === "brush") {
        applyBrushPointerDown({
          ctx,
          point,
          logicalInteractionRect,
          maskWidth: canvas.width,
          maskHeight: canvas.height,
          strokeSize,
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
      resolveClientPointToSurfacePoint,
      resolveViewportOffsets,
      sceneScale,
      selectedLayerId,
      selectedLayerImageUrl,
      selectionMode,
      setPointerSession,
      strokeSize,
    ]
  );

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = pointerSessionRef.current;
      if (!session.active || event.pointerId !== session.pointerId || !selectedLayerId) return;

      event.preventDefault();
      const interactionRect = event.currentTarget.getBoundingClientRect();
      const logicalInteractionRect = resolveMaskLogicalInteractionRect({
        currentTarget: event.currentTarget,
        interactionRect,
      });
      const canvas = ensureMaskCanvasForLayer(selectedLayerId);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const events = resolvePointerSampleEvents(event.nativeEvent as PointerEvent);
      const viewportOffsets = resolveViewportOffsets(interactionRect, event.currentTarget);

      if (paintMode === "lasso") {
        applyLassoPointerMoveSamples({
          session,
          sampleEvents: events,
          currentTarget: event.currentTarget,
          interactionRect,
          logicalInteractionRect,
          maskWidth: canvas.width,
          maskHeight: canvas.height,
          sceneScale,
          viewportOffsets,
          resolveClientPointToSurfacePoint,
        });
        setPointerSession({ ...session });
        renderOverlayNow();
        animateOverlay();
        return;
      }

      if (paintMode !== "brush") return;
      const { didPaint, previousPoint } = applyBrushPointerMoveSamples({
        ctx,
        session,
        sampleEvents: events,
        currentTarget: event.currentTarget,
        interactionRect,
        logicalInteractionRect,
        maskWidth: canvas.width,
        maskHeight: canvas.height,
        sceneScale,
        viewportOffsets,
        resolveClientPointToSurfacePoint,
        strokeSize,
        selectionMode,
      });
      setPointerSession({
        ...session,
        lastPoint: previousPoint,
      });
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
      pointerSessionRef,
      queueLayerAnalysis,
      renderOverlayNow,
      resolveClientPointToSurfacePoint,
      resolveViewportOffsets,
      sceneScale,
      selectedLayerId,
      selectionMode,
      setPointerSession,
      strokeSize,
    ]
  );

  return {
    onPointerDown,
    onPointerMove,
  };
}
