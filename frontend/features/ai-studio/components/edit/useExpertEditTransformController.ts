/**
 * Transform-session controller for Expert Edit move-stage interactions.
 * Owns pointer lifecycle, drag-mode state transitions, and transform-history commit wiring.
 */
import React from "react";

import {
  createTransformPointerSession,
  resolveTransformDragMode,
  resolveTransformSessionUpdate,
} from "./expertEditTransformGestureUtils";
import {
  buildTransformHistoryEntry,
  type TransformHistoryEntry,
} from "./expertEditLayerTransformUtils";
import type { ExpertEditLayer } from "./expertEditLayerSessionUtils";
import {
  createIdleTransformPointerSession,
  elementHasPointerCapture,
  releasePointerCaptureSafely,
  type TransformPointerSession,
} from "./expertEditInteractionUtils";
import { resolveCanvasSpacePoint } from "./expertEditPanelUtilities";

type UseExpertEditTransformControllerParams = {
  layers: ExpertEditLayer[];
  selectedLayer: ExpertEditLayer | null;
  sceneZoomScale: number;
  shouldApplyViewportTransform: boolean;
  viewportOffsetXRatio: number;
  viewportOffsetYRatio: number;
  transformPointerSessionRef: React.MutableRefObject<TransformPointerSession>;
  transformGestureBaselineRef: React.MutableRefObject<TransformHistoryEntry | null>;
  setLayers: React.Dispatch<React.SetStateAction<ExpertEditLayer[]>>;
  setActiveTransformDragMode: React.Dispatch<
    React.SetStateAction<TransformPointerSession["dragMode"]>
  >;
  setIsTransformPointerDragging: React.Dispatch<React.SetStateAction<boolean>>;
  commitTransformHistoryTransition: (
    nextEntry: TransformHistoryEntry,
    baselineEntry?: TransformHistoryEntry | null
  ) => void;
  showStatusToast: (message: string) => void;
};

type UseExpertEditTransformControllerResult = {
  clearTransformPointerSession: () => void;
  endTransformPointerSession: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleMovePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleMovePointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleMovePointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
};

const resolveDragModeFromPointerTarget = (
  target: EventTarget | null
): TransformPointerSession["dragMode"] | null => {
  if (!(target instanceof Element)) return null;
  const dragHandle = target.closest<HTMLElement>("[data-edit-expert-transform-drag-mode]");
  const dragMode = dragHandle?.dataset.editExpertTransformDragMode;
  if (dragMode === "move" || dragMode === "resize" || dragMode === "rotate") {
    return dragMode;
  }
  return null;
};

/**
 * Returns the pointer handlers for move/resize/rotate stage interactions.
 */
export const useExpertEditTransformController = ({
  layers,
  selectedLayer,
  sceneZoomScale,
  shouldApplyViewportTransform,
  viewportOffsetXRatio,
  viewportOffsetYRatio,
  transformPointerSessionRef,
  transformGestureBaselineRef,
  setLayers,
  setActiveTransformDragMode,
  setIsTransformPointerDragging,
  commitTransformHistoryTransition,
  showStatusToast,
}: UseExpertEditTransformControllerParams): UseExpertEditTransformControllerResult => {
  const clearTransformPointerSession = React.useCallback(() => {
    transformPointerSessionRef.current = createIdleTransformPointerSession();
    transformGestureBaselineRef.current = null;
    setActiveTransformDragMode("move");
    setIsTransformPointerDragging(false);
  }, [
    setActiveTransformDragMode,
    setIsTransformPointerDragging,
    transformGestureBaselineRef,
    transformPointerSessionRef,
  ]);

  const endTransformPointerSession = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = transformPointerSessionRef.current;
      if (!session.active || event.pointerId !== session.pointerId) return;
      releasePointerCaptureSafely(event.currentTarget, event.pointerId);
      const baselineEntry = transformGestureBaselineRef.current;
      clearTransformPointerSession();
      if (!baselineEntry) return;
      const nextEntry = buildTransformHistoryEntry(layers);
      commitTransformHistoryTransition(nextEntry, baselineEntry);
    },
    [
      clearTransformPointerSession,
      commitTransformHistoryTransition,
      layers,
      transformGestureBaselineRef,
      transformPointerSessionRef,
    ]
  );

  const handleMovePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!selectedLayer?.imageUrl) {
        showStatusToast("Select a layer image before transforming.");
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const pointer = resolveCanvasSpacePoint({
        clientX: event.clientX,
        clientY: event.clientY,
        rect,
        sceneScale: sceneZoomScale,
        viewportOffsetX: shouldApplyViewportTransform ? viewportOffsetXRatio * rect.width : 0,
        viewportOffsetY: shouldApplyViewportTransform ? viewportOffsetYRatio * rect.height : 0,
      });
      const targetDragMode = resolveDragModeFromPointerTarget(event.target);
      const dragMode =
        targetDragMode ??
        resolveTransformDragMode({
          altKey: event.altKey,
          shiftKey: event.shiftKey,
        });
      event.preventDefault();
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      transformGestureBaselineRef.current = buildTransformHistoryEntry(layers);
      transformPointerSessionRef.current = createTransformPointerSession({
        pointerId: event.pointerId,
        pointerX: pointer.x,
        pointerY: pointer.y,
        dropzoneWidth: width,
        dropzoneHeight: height,
        selectedLayerId: selectedLayer.id,
        selectedLayerTransform: selectedLayer.transform,
        dragMode,
      });
      setActiveTransformDragMode(dragMode);
      setIsTransformPointerDragging(true);
    },
    [
      layers,
      sceneZoomScale,
      selectedLayer,
      setActiveTransformDragMode,
      setIsTransformPointerDragging,
      showStatusToast,
      shouldApplyViewportTransform,
      transformGestureBaselineRef,
      transformPointerSessionRef,
      viewportOffsetXRatio,
      viewportOffsetYRatio,
    ]
  );

  const handleMovePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const pointer = resolveCanvasSpacePoint({
        clientX: event.clientX,
        clientY: event.clientY,
        rect,
        sceneScale: sceneZoomScale,
        viewportOffsetX: shouldApplyViewportTransform ? viewportOffsetXRatio * rect.width : 0,
        viewportOffsetY: shouldApplyViewportTransform ? viewportOffsetYRatio * rect.height : 0,
      });
      const session = transformPointerSessionRef.current;
      if (!session.active || event.pointerId !== session.pointerId || !session.layerId) return;
      event.preventDefault();
      const transformUpdate = resolveTransformSessionUpdate({
        session,
        pointerX: pointer.x,
        pointerY: pointer.y,
      });
      if (!transformUpdate) return;
      setLayers((previousLayers) =>
        previousLayers.map((layer) =>
          layer.id === session.layerId
            ? {
                ...layer,
                transform: {
                  ...layer.transform,
                  ...transformUpdate,
                },
              }
            : layer
        )
      );
    },
    [
      sceneZoomScale,
      setLayers,
      shouldApplyViewportTransform,
      transformPointerSessionRef,
      viewportOffsetXRatio,
      viewportOffsetYRatio,
    ]
  );

  const handleMovePointerLeave = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = transformPointerSessionRef.current;
      if (!session.active) return;
      const hasPointerCapture = elementHasPointerCapture(event.currentTarget, event.pointerId);
      if (event.pointerId === session.pointerId && !hasPointerCapture) {
        endTransformPointerSession(event);
      }
    },
    [endTransformPointerSession, transformPointerSessionRef]
  );

  return {
    clearTransformPointerSession,
    endTransformPointerSession,
    handleMovePointerDown,
    handleMovePointerMove,
    handleMovePointerLeave,
  };
};
