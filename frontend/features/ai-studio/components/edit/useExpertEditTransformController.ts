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
  areLayerTransformsEqual,
  buildTransformHistoryEntry,
  cloneLayerTransform,
  type LayerTransform,
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
  selectedLayerInteractionTransform: LayerTransform | null;
  selectedLayerImageAspectRatio?: number;
  sceneZoomScale: number;
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
  transformPointerSessionRef: React.MutableRefObject<TransformPointerSession>;
  transformGestureBaselineRef: React.MutableRefObject<TransformHistoryEntry | null>;
  beginPanelHistoryGestureForLayers: (layers: ExpertEditLayer[]) => void;
  finalizePanelHistoryGesture: () => void;
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

const resolveTransformInteractionTarget = (currentTarget: HTMLDivElement): HTMLDivElement => {
  if (!currentTarget.classList.contains("edit-expert-primary-layer-selection-overlay")) {
    return currentTarget;
  }
  return (
    currentTarget.closest<HTMLDivElement>(".edit-expert-markup-modal-stage") ??
    currentTarget.closest<HTMLDivElement>(".edit-expert-primary-canvas-frame-stack") ??
    currentTarget
  );
};

/**
 * Returns the pointer handlers for move/resize/rotate stage interactions.
 */
export const useExpertEditTransformController = ({
  layers,
  selectedLayer,
  selectedLayerInteractionTransform,
  selectedLayerImageAspectRatio = 1,
  sceneZoomScale,
  shouldApplyViewportTransform,
  viewportOffsetXRatio,
  viewportOffsetYRatio,
  resolveViewportOffsetPixels,
  transformPointerSessionRef,
  transformGestureBaselineRef,
  beginPanelHistoryGestureForLayers,
  finalizePanelHistoryGesture,
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
      finalizePanelHistoryGesture();
    },
    [
      clearTransformPointerSession,
      commitTransformHistoryTransition,
      finalizePanelHistoryGesture,
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
      const interactionTarget = resolveTransformInteractionTarget(event.currentTarget);
      const rect = interactionTarget.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const resolvedViewportOffset = resolveViewportOffsetPixels?.(rect, interactionTarget);
      const pointer = resolveCanvasSpacePoint({
        clientX: event.clientX,
        clientY: event.clientY,
        rect,
        sceneScale: sceneZoomScale,
        viewportOffsetX: shouldApplyViewportTransform
          ? (resolvedViewportOffset?.offsetX ?? viewportOffsetXRatio * rect.width)
          : 0,
        viewportOffsetY: shouldApplyViewportTransform
          ? (resolvedViewportOffset?.offsetY ?? viewportOffsetYRatio * rect.height)
          : 0,
      });
      const targetDragMode = resolveDragModeFromPointerTarget(event.target);
      const dragMode =
        targetDragMode ??
        resolveTransformDragMode({
          altKey: event.altKey,
          shiftKey: event.shiftKey,
        });
      const interactionTransform = selectedLayerInteractionTransform ?? selectedLayer.transform;
      const interactionLayers = areLayerTransformsEqual(
        selectedLayer.transform,
        interactionTransform
      )
        ? layers
        : layers.map((layer) =>
            layer.id === selectedLayer.id
              ? {
                  ...layer,
                  transform: cloneLayerTransform(interactionTransform),
                }
              : layer
          );
      event.preventDefault();
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      if (interactionLayers !== layers) {
        setLayers(interactionLayers);
      }
      beginPanelHistoryGestureForLayers(interactionLayers);
      transformGestureBaselineRef.current = buildTransformHistoryEntry(interactionLayers);
      transformPointerSessionRef.current = createTransformPointerSession({
        pointerId: event.pointerId,
        pointerX: pointer.x,
        pointerY: pointer.y,
        dropzoneWidth: width,
        dropzoneHeight: height,
        selectedLayerId: selectedLayer.id,
        selectedLayerTransform: interactionTransform,
        imageAspectRatio: selectedLayerImageAspectRatio,
        dragMode,
      });
      setActiveTransformDragMode(dragMode);
      setIsTransformPointerDragging(true);
    },
    [
      beginPanelHistoryGestureForLayers,
      layers,
      sceneZoomScale,
      selectedLayer,
      selectedLayerInteractionTransform,
      selectedLayerImageAspectRatio,
      setActiveTransformDragMode,
      setIsTransformPointerDragging,
      showStatusToast,
      shouldApplyViewportTransform,
      transformGestureBaselineRef,
      transformPointerSessionRef,
      resolveViewportOffsetPixels,
      setLayers,
      viewportOffsetXRatio,
      viewportOffsetYRatio,
    ]
  );

  const handleMovePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const interactionTarget = resolveTransformInteractionTarget(event.currentTarget);
      const rect = interactionTarget.getBoundingClientRect();
      const resolvedViewportOffset = resolveViewportOffsetPixels?.(rect, interactionTarget);
      const pointer = resolveCanvasSpacePoint({
        clientX: event.clientX,
        clientY: event.clientY,
        rect,
        sceneScale: sceneZoomScale,
        viewportOffsetX: shouldApplyViewportTransform
          ? (resolvedViewportOffset?.offsetX ?? viewportOffsetXRatio * rect.width)
          : 0,
        viewportOffsetY: shouldApplyViewportTransform
          ? (resolvedViewportOffset?.offsetY ?? viewportOffsetYRatio * rect.height)
          : 0,
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
      resolveViewportOffsetPixels,
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
