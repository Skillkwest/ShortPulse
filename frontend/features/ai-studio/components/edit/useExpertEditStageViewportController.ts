/**
 * Shared stage viewport controller for Expert Edit interactions.
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
  MOVE_STAGE_ZOOM_SLIDER_DEFAULT,
  MOVE_STAGE_ZOOM_SLIDER_MAX,
  MOVE_STAGE_ZOOM_SLIDER_MIN,
  clampMarkupViewportState,
  clampMarkupViewportScale,
  createDefaultMarkupViewportState,
  createIdleMarkupPanPointerSession,
  resolveMarkupViewportOffsetPixels,
  resolveMoveStageZoomScale,
  resolveMoveStageZoomSliderValue,
  resolveMoveStageZoomSliderValueFromWheelDelta,
  resolveStageViewportSize,
  type MarkupPanPointerSession,
  type StageViewportSize,
} from "./expertEditViewportUtils";
import type { MarkupViewportState } from "./markupStrokeController";

type UseExpertEditStageViewportControllerParams = {
  markupViewport: MarkupViewportState;
  shouldApplyMarkupViewport: boolean;
  isMarkupPanSpacePressed: boolean;
  markupPanPointerSessionRef: React.MutableRefObject<MarkupPanPointerSession>;
  setMoveStageZoomSliderValue: React.Dispatch<React.SetStateAction<number>>;
  setMarkupViewport: React.Dispatch<React.SetStateAction<MarkupViewportState>>;
  setIsMarkupPanDragging: React.Dispatch<React.SetStateAction<boolean>>;
  setInlineStageViewportSize: React.Dispatch<React.SetStateAction<StageViewportSize>>;
  setMarkupModalViewportSize: React.Dispatch<React.SetStateAction<StageViewportSize>>;
  resolveStageRect?: (scope: ExpertEditStageScope, currentTarget: HTMLDivElement) => DOMRect | null;
  resolveContentFrameSize?: (
    scope: ExpertEditStageScope,
    currentTarget: HTMLDivElement,
    viewportSize: StageViewportSize
  ) => StageViewportSize | null;
  resolvePreferredViewportClampOptions?: () => {
    viewportSize: StageViewportSize;
    contentFrameSize: StageViewportSize;
  } | null;
};

type UseExpertEditStageViewportControllerResult = {
  clearMarkupPanGestureState: () => void;
  handleMoveZoomSliderChange: (value: number) => void;
  resetStageViewport: () => void;
  beginMarkupPanGesture: (
    event: React.PointerEvent<HTMLDivElement>,
    scope: ExpertEditStageScope,
    options?: {
      allowPrimaryPanWithoutModifier?: boolean;
    }
  ) => boolean;
  continueMarkupPanGesture: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  endMarkupPanGesture: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  endMarkupPanGestureOnLeave: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  handleStageViewportWheel: (
    event: Pick<
      React.WheelEvent<HTMLDivElement>,
      "clientX" | "clientY" | "currentTarget" | "deltaY" | "preventDefault"
    >,
    scope: ExpertEditStageScope
  ) => void;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const isPointerButtonPressed = (buttons: number | undefined, mask: number) =>
  typeof buttons === "number" && (buttons & mask) === mask;

/**
 * Returns shared stage viewport and pan interaction handlers for Expert Edit.
 */
export const useExpertEditStageViewportController = ({
  markupViewport,
  shouldApplyMarkupViewport,
  isMarkupPanSpacePressed,
  markupPanPointerSessionRef,
  setMoveStageZoomSliderValue,
  setMarkupViewport,
  setIsMarkupPanDragging,
  setInlineStageViewportSize,
  setMarkupModalViewportSize,
  resolveStageRect,
  resolveContentFrameSize,
  resolvePreferredViewportClampOptions,
}: UseExpertEditStageViewportControllerParams): UseExpertEditStageViewportControllerResult => {
  const resolveViewportClampOptions = React.useCallback(
    (
      scope: ExpertEditStageScope,
      currentTarget: HTMLDivElement,
      viewportSize: StageViewportSize
    ) => ({
      viewportSize,
      contentFrameSize:
        resolveContentFrameSize?.(scope, currentTarget, viewportSize) ?? viewportSize,
    }),
    [resolveContentFrameSize]
  );

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
      const nextSliderValue = clampedSliderValue;
      const nextScale = resolveMoveStageZoomScale(nextSliderValue);
      setMoveStageZoomSliderValue(nextSliderValue);
      setMarkupViewport((previous) => {
        const nextViewport = clampMarkupViewportState(
          {
            ...previous,
            scale: nextScale,
          },
          resolvePreferredViewportClampOptions?.() ?? undefined
        );
        return Math.abs(previous.scale - nextViewport.scale) <= MARKUP_VIEWPORT_EPSILON &&
          Math.abs(previous.offsetXRatio - nextViewport.offsetXRatio) <= MARKUP_VIEWPORT_EPSILON &&
          Math.abs(previous.offsetYRatio - nextViewport.offsetYRatio) <= MARKUP_VIEWPORT_EPSILON
          ? previous
          : nextViewport;
      });
    },
    [resolvePreferredViewportClampOptions, setMarkupViewport, setMoveStageZoomSliderValue]
  );

  const resetStageViewport = React.useCallback(() => {
    const defaultViewport = createDefaultMarkupViewportState();
    setMoveStageZoomSliderValue(resolveMoveStageZoomSliderValue(defaultViewport.scale));
    setMarkupViewport(defaultViewport);
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
    (
      event: React.PointerEvent<HTMLDivElement>,
      scope: ExpertEditStageScope,
      options?: {
        allowPrimaryPanWithoutModifier?: boolean;
      }
    ) => {
      if (!shouldApplyMarkupViewport) {
        return false;
      }
      const isMiddleMousePanGesture =
        event.button === 1 || isPointerButtonPressed(event.buttons, 0b100);
      const isPrimaryPointerPanButton =
        event.button === 0 || isPointerButtonPressed(event.buttons, 0b001);
      const isSpacePanGesture = isMarkupPanSpacePressed && isPrimaryPointerPanButton;
      const isBackdropPrimaryPanGesture =
        Boolean(options?.allowPrimaryPanWithoutModifier) && isPrimaryPointerPanButton;
      if (!isMiddleMousePanGesture && !isSpacePanGesture && !isBackdropPrimaryPanGesture) {
        return false;
      }
      event.preventDefault();
      const stageRect = resolveStageRect
        ? resolveStageRect(scope, event.currentTarget)
        : event.currentTarget.getBoundingClientRect();
      if (!stageRect) {
        return false;
      }
      if (stageRect.width <= 0 || stageRect.height <= 0) {
        return false;
      }
      const stageSize = syncViewportSizeByScope(scope, stageRect);
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      markupPanPointerSessionRef.current = {
        active: true,
        scope,
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
      isMarkupPanSpacePressed,
      markupPanPointerSessionRef,
      markupViewport.offsetXRatio,
      markupViewport.offsetYRatio,
      resolveStageRect,
      setIsMarkupPanDragging,
      shouldApplyMarkupViewport,
      syncViewportSizeByScope,
    ]
  );

  const continueMarkupPanGesture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = markupPanPointerSessionRef.current;
      if (!session.active) {
        return false;
      }
      event.preventDefault();
      const deltaX = event.clientX - session.startClientX;
      const deltaY = event.clientY - session.startClientY;
      const deltaXRatio = deltaX / Math.max(1, session.stageWidth);
      const deltaYRatio = deltaY / Math.max(1, session.stageHeight);
      setMarkupViewport(
        (previous) =>
          ({
            ...previous,
            offsetXRatio: session.startOffsetXRatio + deltaXRatio,
            offsetYRatio: session.startOffsetYRatio + deltaYRatio,
          }) satisfies MarkupViewportState
      );
      return true;
    },
    [markupPanPointerSessionRef, setMarkupViewport]
  );

  const endMarkupPanGesture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = markupPanPointerSessionRef.current;
      if (!session.active) {
        return false;
      }
      if (session.pointerId != null) {
        releasePointerCaptureSafely(event.currentTarget, session.pointerId);
      }
      clearMarkupPanGestureState();
      return true;
    },
    [clearMarkupPanGestureState, markupPanPointerSessionRef]
  );

  const endMarkupPanGestureOnLeave = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = markupPanPointerSessionRef.current;
      if (!session.active) {
        return false;
      }
      if (session.pointerId == null) {
        clearMarkupPanGestureState();
        return true;
      }
      const hasPointerCapture = elementHasPointerCapture(event.currentTarget, session.pointerId);
      if (hasPointerCapture) {
        return false;
      }
      clearMarkupPanGestureState();
      return true;
    },
    [clearMarkupPanGestureState, markupPanPointerSessionRef]
  );

  const applyMarkupViewportWheel = React.useCallback(
    ({
      clientX,
      clientY,
      deltaY,
      scope,
      currentTarget,
      preventDefault,
    }: {
      clientX: number;
      clientY: number;
      deltaY: number;
      scope: ExpertEditStageScope;
      currentTarget: HTMLDivElement;
      preventDefault: () => void;
    }) => {
      if (!shouldApplyMarkupViewport) return false;
      const stageRect = resolveStageRect
        ? resolveStageRect(scope, currentTarget)
        : currentTarget.getBoundingClientRect();
      if (!stageRect) return false;
      if (stageRect.width <= 0 || stageRect.height <= 0) return false;
      preventDefault();
      const stageSize = syncViewportSizeByScope(scope, stageRect);
      const clampOptions = resolveViewportClampOptions(scope, currentTarget, stageSize);
      const pointerX = clientX - stageRect.left;
      const pointerY = clientY - stageRect.top;
      const centerX = stageRect.width / 2;
      const centerY = stageRect.height / 2;
      setMarkupViewport((previous) => {
        const currentSliderValue = resolveMoveStageZoomSliderValue(previous.scale);
        const nextSliderValue = resolveMoveStageZoomSliderValueFromWheelDelta({
          sliderValue: currentSliderValue,
          deltaY,
        });
        const nextScale = clampMarkupViewportScale(resolveMoveStageZoomScale(nextSliderValue));
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
        return clampMarkupViewportState(
          {
            scale: nextScale,
            offsetXRatio: nextOffsetX / stageSize.width,
            offsetYRatio: nextOffsetY / stageSize.height,
          },
          clampOptions
        );
      });
      return true;
    },
    [
      resolveStageRect,
      resolveViewportClampOptions,
      setMarkupViewport,
      shouldApplyMarkupViewport,
      syncViewportSizeByScope,
    ]
  );

  const handleStageViewportWheel = React.useCallback(
    (
      event: Pick<
        React.WheelEvent<HTMLDivElement>,
        "clientX" | "clientY" | "currentTarget" | "deltaY" | "preventDefault"
      >,
      scope: ExpertEditStageScope
    ) => {
      applyMarkupViewportWheel({
        clientX: event.clientX,
        clientY: event.clientY,
        deltaY: event.deltaY,
        scope,
        currentTarget: event.currentTarget,
        preventDefault: () => {
          event.preventDefault();
        },
      });
    },
    [applyMarkupViewportWheel]
  );

  return {
    clearMarkupPanGestureState,
    handleMoveZoomSliderChange,
    resetStageViewport,
    beginMarkupPanGesture,
    continueMarkupPanGesture,
    endMarkupPanGesture,
    endMarkupPanGestureOnLeave,
    handleStageViewportWheel,
  };
};
