/**
 * Transform-session ownership for Expert Edit.
 * Centralizes transform pointer refs, controller wiring, and transform-history sync/apply effects.
 */
import React from "react";

import { useExpertEditTransformController } from "./useExpertEditTransformController";
import {
  applyTransformHistoryEntryToLayers,
  areTransformHistoryEntriesEqual,
  buildTransformHistoryEntry,
  type LayerTransform,
  type TransformHistoryEntry,
  type TransformHistoryState,
} from "./expertEditLayerTransformUtils";
import type { ExpertEditLayer } from "./expertEditLayerSessionUtils";
import {
  createIdleTransformPointerSession,
  type TransformPointerSession,
} from "./expertEditInteractionUtils";
import {
  resolveRenderableStageViewportSize,
  type StageViewportSize,
} from "./expertEditViewportUtils";
import { ExpertEditTransformOverlay } from "./ExpertEditTransformOverlay";

type UseExpertEditTransformSessionParams = {
  layers: ExpertEditLayer[];
  setLayers: React.Dispatch<React.SetStateAction<ExpertEditLayer[]>>;
  selectedLayer: ExpertEditLayer | null;
  selectedLayerInteractionTransform: LayerTransform | null;
  selectedLayerImageAspectRatio: number;
  shouldShowSelectedLayerTransformOverlay: boolean;
  resolveRenderableLayerTransform: (layer: ExpertEditLayer) => ExpertEditLayer["transform"];
  sceneZoomScale: number;
  viewportOffsetXRatio: number;
  viewportOffsetYRatio: number;
  resolveViewportOffsetPixels: (
    interactionRect: DOMRect,
    currentTarget: HTMLDivElement
  ) => { offsetX: number; offsetY: number };
  commitTransformHistoryTransition: (
    nextEntry: TransformHistoryEntry,
    baselineEntry?: TransformHistoryEntry | null
  ) => void;
  showStatusToast: (message: string) => void;
  transformHistoryState: TransformHistoryState;
  setTransformHistoryState: React.Dispatch<React.SetStateAction<TransformHistoryState>>;
};

/**
 * Returns transform-session state, handlers, and overlay rendering for Expert Edit.
 */
export const useExpertEditTransformSession = ({
  layers,
  setLayers,
  selectedLayer,
  selectedLayerInteractionTransform,
  selectedLayerImageAspectRatio,
  shouldShowSelectedLayerTransformOverlay,
  resolveRenderableLayerTransform,
  sceneZoomScale,
  viewportOffsetXRatio,
  viewportOffsetYRatio,
  resolveViewportOffsetPixels,
  commitTransformHistoryTransition,
  showStatusToast,
  transformHistoryState,
  setTransformHistoryState,
}: UseExpertEditTransformSessionParams) => {
  const transformPointerSessionRef = React.useRef<TransformPointerSession>(
    createIdleTransformPointerSession()
  );
  const transformGestureBaselineRef = React.useRef<TransformHistoryEntry | null>(null);
  const pendingHistoryApplyEntryRef = React.useRef<TransformHistoryEntry | null>(null);
  const [isTransformPointerDragging, setIsTransformPointerDragging] = React.useState(false);
  const [activeTransformDragMode, setActiveTransformDragMode] =
    React.useState<TransformPointerSession["dragMode"]>("move");

  const currentTransformHistoryEntry = React.useMemo(
    () => buildTransformHistoryEntry(layers),
    [layers]
  );

  const {
    clearTransformPointerSession,
    endTransformPointerSession,
    handleMovePointerDown,
    handleMovePointerMove,
    handleMovePointerLeave,
  } = useExpertEditTransformController({
    layers,
    selectedLayer,
    selectedLayerInteractionTransform,
    selectedLayerImageAspectRatio,
    sceneZoomScale,
    shouldApplyViewportTransform: true,
    viewportOffsetXRatio,
    viewportOffsetYRatio,
    resolveViewportOffsetPixels,
    transformPointerSessionRef,
    transformGestureBaselineRef,
    setLayers,
    setActiveTransformDragMode,
    setIsTransformPointerDragging,
    commitTransformHistoryTransition,
    showStatusToast,
  });

  React.useEffect(() => {
    if (isTransformPointerDragging) return;
    setTransformHistoryState((previousHistory) => {
      if (areTransformHistoryEntriesEqual(previousHistory.present, currentTransformHistoryEntry)) {
        return previousHistory;
      }
      if (
        previousHistory.present.layerOrderSignature !==
        currentTransformHistoryEntry.layerOrderSignature
      ) {
        return {
          past: [],
          present: currentTransformHistoryEntry,
          future: [],
        };
      }
      return {
        past: previousHistory.past,
        present: currentTransformHistoryEntry,
        future: previousHistory.future,
      };
    });
  }, [currentTransformHistoryEntry, isTransformPointerDragging, setTransformHistoryState]);

  React.useEffect(() => {
    const pendingEntry = pendingHistoryApplyEntryRef.current;
    if (!pendingEntry) return;
    pendingHistoryApplyEntryRef.current = null;
    setLayers((previousLayers) => applyTransformHistoryEntryToLayers(previousLayers, pendingEntry));
  }, [setLayers, transformHistoryState]);

  const queuePendingHistoryApplyEntry = React.useCallback((entry: TransformHistoryEntry | null) => {
    pendingHistoryApplyEntryRef.current = entry;
  }, []);

  const renderSelectedLayerTransformOverlay = React.useCallback(
    (
      scope: "inline" | "modal",
      preferredViewportSize: StageViewportSize,
      stageElement: HTMLDivElement | null,
      interactionHandlers?: Pick<
        React.HTMLAttributes<HTMLDivElement>,
        "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onPointerLeave"
      >
    ) => {
      if (!shouldShowSelectedLayerTransformOverlay || !selectedLayer) {
        return null;
      }
      const viewportSize = resolveRenderableStageViewportSize({
        preferredSize: preferredViewportSize,
        stageElement,
      });
      const constrainedTransform = resolveRenderableLayerTransform(selectedLayer);
      return (
        <ExpertEditTransformOverlay
          scope={scope}
          viewportWidth={viewportSize.width}
          viewportHeight={viewportSize.height}
          imageAspectRatio={selectedLayerImageAspectRatio}
          transform={constrainedTransform}
          scale={Math.max(0.0001, constrainedTransform.scale)}
          interactionHandlers={interactionHandlers}
        />
      );
    },
    [
      resolveRenderableLayerTransform,
      selectedLayer,
      selectedLayerInteractionTransform,
      selectedLayerImageAspectRatio,
      shouldShowSelectedLayerTransformOverlay,
    ]
  );

  return {
    activeTransformDragMode,
    clearTransformPointerSession,
    endTransformPointerSession,
    handleMovePointerDown,
    handleMovePointerMove,
    handleMovePointerLeave,
    isTransformPointerDragging,
    queuePendingHistoryApplyEntry,
    renderSelectedLayerTransformOverlay,
  };
};
