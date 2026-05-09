/**
 * Terminal pointer-session runtime for the Expert Edit inpaint controller.
 * Owns pointer-up/cancel/leave closure behavior while the controller retains live gesture state.
 */
import React from "react";

import type { InpaintPoint } from "./inpaintMaskGeometry";

export type InpaintPointerSession = {
  pointerId: number;
  active: boolean;
  lastPoint: InpaintPoint | null;
  lassoPoints: InpaintPoint[];
};

export const createIdleInpaintPointerSession = (): InpaintPointerSession => ({
  pointerId: -1,
  active: false,
  lastPoint: null,
  lassoPoints: [],
});

export const applyLassoSelection = ({
  ctx,
  points,
  selectionMode,
}: {
  ctx: CanvasRenderingContext2D;
  points: InpaintPoint[];
  selectionMode: "select" | "unselect";
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
  ctx.fill("evenodd");
  ctx.restore();
};

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

type UseInpaintMaskPointerSessionRuntimeArgs = {
  pointerSessionRef: React.MutableRefObject<InpaintPointerSession>;
  shouldApplyLassoSelection: boolean;
  selectedLayerId: string | null;
  selectionMode: "select" | "unselect";
  ensureMaskCanvasForLayer: (layerId: string) => HTMLCanvasElement;
  queueLayerAnalysis: (layerId: string, immediate?: boolean) => void;
  renderOverlayNow: () => void;
};

export function useInpaintMaskPointerSessionRuntime({
  pointerSessionRef,
  shouldApplyLassoSelection,
  selectedLayerId,
  selectionMode,
  ensureMaskCanvasForLayer,
  queueLayerAnalysis,
  renderOverlayNow,
}: UseInpaintMaskPointerSessionRuntimeArgs) {
  const endPointerSession = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>, shouldApply: boolean) => {
      const session = pointerSessionRef.current;
      if (!session.active || event.pointerId !== session.pointerId) return;
      if (shouldApplyLassoSelection && shouldApply && selectedLayerId) {
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
      pointerSessionRef.current = createIdleInpaintPointerSession();
      if (selectedLayerId) {
        queueLayerAnalysis(selectedLayerId, true);
      } else {
        renderOverlayNow();
      }
    },
    [
      ensureMaskCanvasForLayer,
      pointerSessionRef,
      queueLayerAnalysis,
      renderOverlayNow,
      selectedLayerId,
      selectionMode,
      shouldApplyLassoSelection,
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
    [endPointerSession, pointerSessionRef]
  );

  return {
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
  };
}
