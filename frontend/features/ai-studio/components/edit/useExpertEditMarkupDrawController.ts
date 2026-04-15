/**
 * Markup draw controller for Expert Edit stage interactions.
 * Owns pen, lasso, and eraser pointer session lifecycle while keeping the panel focused on orchestration.
 */
import React from "react";

import { buildMarkupBrushReticleCursor } from "./expertEditCursorUtils";
import type { MarkupMode } from "./expertEditPanelViewContract";
import {
  elementHasPointerCapture,
  releasePointerCaptureSafely,
} from "./expertEditInteractionUtils";
import {
  appendMarkupStrokePoints,
  createIdleMarkupDrawPointerSession,
  resolveMarkupPointerPoint,
  resolveMarkupStrokeHit,
  resolveMarkupStrokeSizeRatio,
  resolvePointerSampleEvents,
  type MarkupDrawPointerSession,
  type MarkupStroke,
  type MarkupStrokePoint,
  type MarkupViewportState,
} from "./markupStrokeController";

type UseExpertEditMarkupDrawControllerParams = {
  isMarkupToolSelected: boolean;
  hasPrimaryCompositePreview: boolean;
  selectedMarkupMode: MarkupMode;
  resolvedMarkupStrokeSize: number;
  maxMarkupStrokeSize: number;
  renderScale: number;
  markupColor: string;
  markupViewport: MarkupViewportState;
  shouldApplyMarkupViewport: boolean;
  resolveViewportOffsetPixels?: (
    stageRect: DOMRect,
    currentTarget: HTMLDivElement
  ) => {
    offsetX: number;
    offsetY: number;
  };
  resolveClientPointToSurfacePoint?: (params: {
    clientX: number;
    clientY: number;
    currentTarget: HTMLDivElement;
    clampToBounds: boolean;
  }) => MarkupStrokePoint | null;
  markupStrokeIdCounterRef: React.MutableRefObject<number>;
  markupDrawPointerSessionRef: React.MutableRefObject<MarkupDrawPointerSession>;
  setMarkupStrokes: React.Dispatch<React.SetStateAction<MarkupStroke[]>>;
  beginMarkupGestureHistory: () => void;
  finalizeMarkupGestureHistory: () => void;
  lockGlobalCursor: (cursor: string) => void;
  unlockGlobalCursor: () => void;
  showStatusToast: (message: string) => void;
};

type UseExpertEditMarkupDrawControllerResult = {
  beginMarkupDrawGesture: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  continueMarkupDrawGesture: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  endMarkupDrawGesture: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  endMarkupDrawGestureOnLeave: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  clearMarkupDrawGestureSession: () => void;
};

/**
 * Returns the pointer handlers for markup draw/fill/erase stage interactions.
 */
export const useExpertEditMarkupDrawController = ({
  isMarkupToolSelected,
  hasPrimaryCompositePreview,
  selectedMarkupMode,
  resolvedMarkupStrokeSize,
  maxMarkupStrokeSize,
  renderScale,
  markupColor,
  markupViewport,
  shouldApplyMarkupViewport,
  resolveViewportOffsetPixels,
  resolveClientPointToSurfacePoint,
  markupStrokeIdCounterRef,
  markupDrawPointerSessionRef,
  setMarkupStrokes,
  beginMarkupGestureHistory,
  finalizeMarkupGestureHistory,
  lockGlobalCursor,
  unlockGlobalCursor,
  showStatusToast,
}: UseExpertEditMarkupDrawControllerParams): UseExpertEditMarkupDrawControllerResult => {
  const eraseMarkupStrokesAtPoints = React.useCallback(
    (points: MarkupStrokePoint[], stageRect: DOMRect) => {
      if (!points.length) return;
      const stageWidth = Math.max(1, stageRect.width);
      const stageHeight = Math.max(1, stageRect.height);
      const eraserRadius = Math.max(1, resolvedMarkupStrokeSize / 2);
      setMarkupStrokes((previousStrokes) =>
        previousStrokes.filter(
          (stroke) =>
            !points.some((point) =>
              resolveMarkupStrokeHit({
                stroke,
                point,
                eraserRadiusPx: eraserRadius,
                stageWidth,
                stageHeight,
              })
            )
        )
      );
    },
    [resolvedMarkupStrokeSize, setMarkupStrokes]
  );

  const clearMarkupDrawGestureSession = React.useCallback(() => {
    markupDrawPointerSessionRef.current = createIdleMarkupDrawPointerSession();
  }, [markupDrawPointerSessionRef]);

  const activateMarkupDrawGestureSession = React.useCallback(
    (pointerId: number, mode: MarkupDrawPointerSession["mode"], strokeId: string | null) => {
      lockGlobalCursor(
        buildMarkupBrushReticleCursor(resolvedMarkupStrokeSize, maxMarkupStrokeSize, renderScale)
      );
      markupDrawPointerSessionRef.current = {
        active: true,
        pointerId,
        mode,
        strokeId,
      };
    },
    [
      lockGlobalCursor,
      markupDrawPointerSessionRef,
      maxMarkupStrokeSize,
      renderScale,
      resolvedMarkupStrokeSize,
    ]
  );

  const finalizeMarkupDrawGestureSession = React.useCallback(() => {
    clearMarkupDrawGestureSession();
    unlockGlobalCursor();
    finalizeMarkupGestureHistory();
  }, [clearMarkupDrawGestureSession, finalizeMarkupGestureHistory, unlockGlobalCursor]);

  const beginMarkupDrawGesture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isMarkupToolSelected) return false;
      if (!hasPrimaryCompositePreview) {
        showStatusToast("Add a layer image before drawing markup.");
        return false;
      }
      if (event.pointerType === "mouse" && event.button !== 0) return false;
      const stageRect = event.currentTarget.getBoundingClientRect();
      const logicalStageWidth = Math.max(1, event.currentTarget.clientWidth || stageRect.width);
      const logicalStageHeight = Math.max(1, event.currentTarget.clientHeight || stageRect.height);
      const logicalStageRect = new DOMRect(0, 0, logicalStageWidth, logicalStageHeight);
      const viewportOffset = resolveViewportOffsetPixels?.(stageRect, event.currentTarget);
      const point =
        resolveClientPointToSurfacePoint?.({
          clientX: event.clientX,
          clientY: event.clientY,
          currentTarget: event.currentTarget,
          clampToBounds: false,
        }) ??
        resolveMarkupPointerPoint({
          clientX: event.clientX,
          clientY: event.clientY,
          rect: stageRect,
          viewport: markupViewport,
          applyViewportTransform: shouldApplyMarkupViewport,
          viewportOffsetX: viewportOffset?.offsetX,
          viewportOffsetY: viewportOffset?.offsetY,
        });
      if (!point) return false;
      event.preventDefault();
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      beginMarkupGestureHistory();
      if (selectedMarkupMode === "eraser") {
        eraseMarkupStrokesAtPoints([point], logicalStageRect);
        activateMarkupDrawGestureSession(event.pointerId, "eraser", null);
        return true;
      }
      const strokeId = `markup-stroke-${markupStrokeIdCounterRef.current++}`;
      const stroke: MarkupStroke = {
        id: strokeId,
        color: markupColor,
        sizeRatio: resolveMarkupStrokeSizeRatio({
          strokeSizePx: resolvedMarkupStrokeSize,
          stageHeight: logicalStageHeight,
        }),
        points: [point],
        kind: selectedMarkupMode === "lasso" ? "lasso" : "pen",
      };
      setMarkupStrokes((previousStrokes) => [...previousStrokes, stroke]);
      activateMarkupDrawGestureSession(event.pointerId, selectedMarkupMode, strokeId);
      return true;
    },
    [
      activateMarkupDrawGestureSession,
      beginMarkupGestureHistory,
      eraseMarkupStrokesAtPoints,
      hasPrimaryCompositePreview,
      isMarkupToolSelected,
      markupColor,
      markupStrokeIdCounterRef,
      markupViewport,
      resolveClientPointToSurfacePoint,
      resolveViewportOffsetPixels,
      resolvedMarkupStrokeSize,
      selectedMarkupMode,
      setMarkupStrokes,
      shouldApplyMarkupViewport,
      showStatusToast,
    ]
  );

  const continueMarkupDrawGesture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = markupDrawPointerSessionRef.current;
      if (!session.active || event.pointerId !== session.pointerId) {
        return false;
      }
      const stageRect = event.currentTarget.getBoundingClientRect();
      const logicalStageWidth = Math.max(1, event.currentTarget.clientWidth || stageRect.width);
      const logicalStageHeight = Math.max(1, event.currentTarget.clientHeight || stageRect.height);
      const logicalStageRect = new DOMRect(0, 0, logicalStageWidth, logicalStageHeight);
      const viewportOffset = resolveViewportOffsetPixels?.(stageRect, event.currentTarget);
      const sampleEvents = resolvePointerSampleEvents(event.nativeEvent as PointerEvent);
      const points = sampleEvents
        .map((sampleEvent) => {
          return (
            resolveClientPointToSurfacePoint?.({
              clientX: sampleEvent.clientX,
              clientY: sampleEvent.clientY,
              currentTarget: event.currentTarget,
              clampToBounds: false,
            }) ??
            resolveMarkupPointerPoint({
              clientX: sampleEvent.clientX,
              clientY: sampleEvent.clientY,
              rect: stageRect,
              viewport: markupViewport,
              applyViewportTransform: shouldApplyMarkupViewport,
              viewportOffsetX: viewportOffset?.offsetX,
              viewportOffsetY: viewportOffset?.offsetY,
            })
          );
        })
        .filter((sample): sample is MarkupStrokePoint => sample != null);
      if (!points.length) return false;
      event.preventDefault();
      if (session.mode === "eraser") {
        eraseMarkupStrokesAtPoints(points, logicalStageRect);
        return true;
      }
      if (!session.strokeId) return false;
      setMarkupStrokes((previousStrokes) =>
        previousStrokes.map((stroke) => {
          if (stroke.id !== session.strokeId) {
            return stroke;
          }
          return appendMarkupStrokePoints({
            stroke,
            samples: points,
            stageWidth: logicalStageWidth,
            stageHeight: logicalStageHeight,
          });
        })
      );
      return true;
    },
    [
      eraseMarkupStrokesAtPoints,
      markupDrawPointerSessionRef,
      markupViewport,
      resolveClientPointToSurfacePoint,
      resolveViewportOffsetPixels,
      setMarkupStrokes,
      shouldApplyMarkupViewport,
    ]
  );

  const endMarkupDrawGesture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = markupDrawPointerSessionRef.current;
      if (!session.active || event.pointerId !== session.pointerId) {
        return false;
      }
      releasePointerCaptureSafely(event.currentTarget, event.pointerId);
      finalizeMarkupDrawGestureSession();
      return true;
    },
    [finalizeMarkupDrawGestureSession, markupDrawPointerSessionRef]
  );

  const endMarkupDrawGestureOnLeave = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = markupDrawPointerSessionRef.current;
      if (!session.active || event.pointerId !== session.pointerId) {
        return false;
      }
      const hasPointerCapture = elementHasPointerCapture(event.currentTarget, event.pointerId);
      if (hasPointerCapture) {
        return false;
      }
      finalizeMarkupDrawGestureSession();
      return true;
    },
    [finalizeMarkupDrawGestureSession, markupDrawPointerSessionRef]
  );

  return {
    beginMarkupDrawGesture,
    continueMarkupDrawGesture,
    endMarkupDrawGesture,
    endMarkupDrawGestureOnLeave,
    clearMarkupDrawGestureSession,
  };
};
