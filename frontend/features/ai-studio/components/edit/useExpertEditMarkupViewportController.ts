/**
 * Markup viewport controller for Expert Edit stage interactions.
 * Owns zoom, pan-session lifecycle, and viewport-size synchronization for inline and modal surfaces.
 */
import React from "react";

import type { ExpertEditStageScope } from "./useExpertEditStageInteractionRouter";
import {
  elementHasPointerCapture,
  releasePointerCaptureSafely,
} from "./expertEditInteractionUtils";
import {
  MARKUP_VIEWPORT_EPSILON,
  MARKUP_VIEWPORT_ZOOM_INTENSITY,
  MOVE_STAGE_ZOOM_SLIDER_DEFAULT,
  MOVE_STAGE_ZOOM_SLIDER_MAX,
  MOVE_STAGE_ZOOM_SLIDER_MIN,
  clampMarkupViewportScale,
  createDefaultMarkupViewportState,
  createIdleMarkupPanPointerSession,
  resolveMarkupViewportOffsetPixels,
  resolveMoveStageZoomScale,
  resolveStageViewportSize,
  type MarkupPanPointerSession,
  type StageViewportSize,
} from "./expertEditViewportUtils";
import type { MarkupViewportState } from "./markupStrokeController";

type UseExpertEditMarkupViewportControllerParams = {
  markupViewport: MarkupViewportState;
  shouldApplyMarkupViewport: boolean;
  isMarkupExpandSelected: boolean;
  isMarkupPanSpacePressed: boolean;
  markupPanPointerSessionRef: React.MutableRefObject<MarkupPanPointerSession>;
  setMoveStageZoomSliderValue: React.Dispatch<React.SetStateAction<number>>;
  setMarkupViewport: React.Dispatch<React.SetStateAction<MarkupViewportState>>;
  setIsMarkupPanDragging: React.Dispatch<React.SetStateAction<boolean>>;
  setInlineStageViewportSize: React.Dispatch<React.SetStateAction<StageViewportSize>>;
  setMarkupModalViewportSize: React.Dispatch<React.SetStateAction<StageViewportSize>>;
};

type UseExpertEditMarkupViewportControllerResult = {
  clearMarkupPanGestureState: () => void;
  handleMoveZoomSliderChange: (value: number) => void;
  resetMarkupViewport: () => void;
  beginMarkupPanGesture: (
    event: React.PointerEvent<HTMLDivElement>,
    scope: ExpertEditStageScope
  ) => boolean;
  continueMarkupPanGesture: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  endMarkupPanGesture: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  endMarkupPanGestureOnLeave: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  handleMarkupViewportWheel: (
    event: React.WheelEvent<HTMLDivElement>,
    scope: ExpertEditStageScope
  ) => void;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Returns the viewport and pan interaction handlers for markup mode.
 */
export const useExpertEditMarkupViewportController = ({
  markupViewport,
  shouldApplyMarkupViewport,
  isMarkupExpandSelected,
  isMarkupPanSpacePressed,
  markupPanPointerSessionRef,
  setMoveStageZoomSliderValue,
  setMarkupViewport,
  setIsMarkupPanDragging,
  setInlineStageViewportSize,
  setMarkupModalViewportSize,
}: UseExpertEditMarkupViewportControllerParams): UseExpertEditMarkupViewportControllerResult => {
  const clearMarkupPanGestureState = React.useCallback(() => {
    markupPanPointerSessionRef.current = createIdleMarkupPanPointerSession();
    setIsMarkupPanDragging(false);
  }, [markupPanPointerSessionRef, setIsMarkupPanDragging]);

  const handleMoveZoomSliderChange = React.useCallback(
    (value: number) => {
      const clampedSliderValue = clampNumber(
        Number.isFinite(value) ? value : MOVE_STAGE_ZOOM_SLIDER_DEFAULT,
        MOVE_STAGE_ZOOM_SLIDER_MIN,
        MOVE_STAGE_ZOOM_SLIDER_MAX
      );
      const nextSliderValue = Math.round(clampedSliderValue);
      const nextScale = resolveMoveStageZoomScale(nextSliderValue);
      setMoveStageZoomSliderValue(nextSliderValue);
      setMarkupViewport((previous) =>
        Math.abs(previous.scale - nextScale) <= MARKUP_VIEWPORT_EPSILON
          ? previous
          : {
              ...previous,
              scale: nextScale,
            }
      );
    },
    [setMarkupViewport, setMoveStageZoomSliderValue]
  );

  const resetMarkupViewport = React.useCallback(() => {
    setMoveStageZoomSliderValue(MOVE_STAGE_ZOOM_SLIDER_DEFAULT);
    setMarkupViewport(createDefaultMarkupViewportState());
    clearMarkupPanGestureState();
  }, [clearMarkupPanGestureState, setMarkupViewport, setMoveStageZoomSliderValue]);

  const syncViewportSizeByScope = React.useCallback(
    (scope: ExpertEditStageScope, rect: DOMRect) => {
      const viewportSize = resolveStageViewportSize(rect);
      if (scope === "modal") {
        setMarkupModalViewportSize((previous) =>
          previous.width === viewportSize.width && previous.height === viewportSize.height
            ? previous
            : viewportSize
        );
        return viewportSize;
      }
      setInlineStageViewportSize((previous) =>
        previous.width === viewportSize.width && previous.height === viewportSize.height
          ? previous
          : viewportSize
      );
      return viewportSize;
    },
    [setInlineStageViewportSize, setMarkupModalViewportSize]
  );

  const beginMarkupPanGesture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>, scope: ExpertEditStageScope) => {
      if (!shouldApplyMarkupViewport) {
        return false;
      }
      const isMiddleMousePanGesture =
        event.pointerType === "mouse" && event.button === 1 && isMarkupExpandSelected;
      const isSpacePanGesture =
        isMarkupPanSpacePressed && (event.pointerType !== "mouse" || event.button === 0);
      if (!isMiddleMousePanGesture && !isSpacePanGesture) {
        return false;
      }
      event.preventDefault();
      const stageRect = event.currentTarget.getBoundingClientRect();
      if (stageRect.width <= 0 || stageRect.height <= 0) {
        return false;
      }
      const stageSize = syncViewportSizeByScope(scope, stageRect);
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      markupPanPointerSessionRef.current = {
        active: true,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startOffsetXRatio: markupViewport.offsetXRatio,
        startOffsetYRatio: markupViewport.offsetYRatio,
        stageWidth: stageSize.width,
        stageHeight: stageSize.height,
      };
      setIsMarkupPanDragging(true);
      return true;
    },
    [
      isMarkupExpandSelected,
      isMarkupPanSpacePressed,
      markupPanPointerSessionRef,
      markupViewport.offsetXRatio,
      markupViewport.offsetYRatio,
      setIsMarkupPanDragging,
      shouldApplyMarkupViewport,
      syncViewportSizeByScope,
    ]
  );

  const continueMarkupPanGesture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = markupPanPointerSessionRef.current;
      if (!session.active || event.pointerId !== session.pointerId) {
        return false;
      }
      event.preventDefault();
      const deltaX = event.clientX - session.startClientX;
      const deltaY = event.clientY - session.startClientY;
      const deltaXRatio = deltaX / Math.max(1, session.stageWidth);
      const deltaYRatio = deltaY / Math.max(1, session.stageHeight);
      setMarkupViewport((previous) => ({
        ...previous,
        offsetXRatio: session.startOffsetXRatio + deltaXRatio,
        offsetYRatio: session.startOffsetYRatio + deltaYRatio,
      }));
      return true;
    },
    [markupPanPointerSessionRef, setMarkupViewport]
  );

  const endMarkupPanGesture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = markupPanPointerSessionRef.current;
      if (!session.active || event.pointerId !== session.pointerId) {
        return false;
      }
      releasePointerCaptureSafely(event.currentTarget, event.pointerId);
      clearMarkupPanGestureState();
      return true;
    },
    [clearMarkupPanGestureState, markupPanPointerSessionRef]
  );

  const endMarkupPanGestureOnLeave = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = markupPanPointerSessionRef.current;
      if (!session.active || event.pointerId !== session.pointerId) {
        return false;
      }
      const hasPointerCapture = elementHasPointerCapture(event.currentTarget, event.pointerId);
      if (hasPointerCapture) {
        return false;
      }
      clearMarkupPanGestureState();
      return true;
    },
    [clearMarkupPanGestureState, markupPanPointerSessionRef]
  );

  const handleMarkupViewportWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>, scope: ExpertEditStageScope) => {
      if (!shouldApplyMarkupViewport) return;
      if (!event.metaKey && !event.ctrlKey) return;
      const stageRect = event.currentTarget.getBoundingClientRect();
      if (stageRect.width <= 0 || stageRect.height <= 0) return;
      event.preventDefault();
      const stageSize = syncViewportSizeByScope(scope, stageRect);
      const pointerX = event.clientX - stageRect.left;
      const pointerY = event.clientY - stageRect.top;
      const centerX = stageRect.width / 2;
      const centerY = stageRect.height / 2;
      const zoomMultiplier = Math.exp(-event.deltaY * MARKUP_VIEWPORT_ZOOM_INTENSITY);
      setMarkupViewport((previous) => {
        const nextScale = clampMarkupViewportScale(previous.scale * zoomMultiplier);
        if (Math.abs(nextScale - previous.scale) <= MARKUP_VIEWPORT_EPSILON) {
          return previous;
        }
        const relativeX = pointerX - centerX;
        const relativeY = pointerY - centerY;
        const previousOffset = resolveMarkupViewportOffsetPixels(previous, stageSize);
        const nextOffsetX =
          relativeX - ((relativeX - previousOffset.offsetX) / previous.scale) * nextScale;
        const nextOffsetY =
          relativeY - ((relativeY - previousOffset.offsetY) / previous.scale) * nextScale;
        return {
          scale: nextScale,
          offsetXRatio: nextOffsetX / stageSize.width,
          offsetYRatio: nextOffsetY / stageSize.height,
        };
      });
    },
    [setMarkupViewport, shouldApplyMarkupViewport, syncViewportSizeByScope]
  );

  return {
    clearMarkupPanGestureState,
    handleMoveZoomSliderChange,
    resetMarkupViewport,
    beginMarkupPanGesture,
    continueMarkupPanGesture,
    endMarkupPanGesture,
    endMarkupPanGestureOnLeave,
    handleMarkupViewportWheel,
  };
};
