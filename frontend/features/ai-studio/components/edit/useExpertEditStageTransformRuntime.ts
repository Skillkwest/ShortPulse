import React from "react";

import type { MarkupViewportState } from "./markupStrokeController";
import {
  buildInpaintBrushReticleCursor,
  buildInpaintLassoCursor,
  buildMarkupBrushReticleCursor,
} from "./expertEditCursorUtils";
import {
  areTransformHistoryEntriesEqual,
  buildTransformHistoryEntry,
  defaultLayerTransform,
  resolveClippedLayerTransform,
  resolveSingleImageEditSafeTransform,
  type TransformHistoryEntry,
  type TransformHistoryState,
} from "./expertEditLayerTransformUtils";
import { layerHasImage, type ExpertEditLayer } from "./expertEditLayerSessionUtils";
import type { StageViewportSize } from "./expertEditViewportUtils";
import { useExpertEditTransformSession } from "./useExpertEditTransformSession";

type UseExpertEditStageTransformRuntimeParams = {
  layers: ExpertEditLayer[];
  setLayers: React.Dispatch<React.SetStateAction<ExpertEditLayer[]>>;
  selectedLayer: ExpertEditLayer | null;
  selectedLayerImageUrl: string | null;
  hasPrimaryCompositePreview: boolean;
  isMoveToolSelected: boolean;
  isMorePresetsSurfaceOpen: boolean;
  isMarkupToolSelected: boolean;
  stageViewport: MarkupViewportState;
  stageViewportCursor: React.CSSProperties["cursor"];
  markupModalStageSize: StageViewportSize | null;
  primaryCompositionSurfaceAspectRatio: number | string;
  shouldShowInpaintBrushReticle: boolean;
  shouldShowInpaintLassoCursor: boolean;
  shouldShowMarkupBrushReticle: boolean;
  inpaintStrokeSize: number;
  resolvedMarkupStrokeSize: number;
  maxMarkupStrokeSize: number;
  transformHistoryLimit: number;
  resolveLayerImageAspectRatio: (layer: ExpertEditLayer | null) => number;
  resolveViewportOffsetPixels: (
    interactionRect: DOMRect,
    currentTarget: HTMLDivElement
  ) => { offsetX: number; offsetY: number };
  showStatusToast: (message: string) => void;
  transformHistoryState: TransformHistoryState;
  setTransformHistoryState: React.Dispatch<React.SetStateAction<TransformHistoryState>>;
  resetStageViewport: () => void;
};

export const useExpertEditStageTransformRuntime = ({
  layers,
  setLayers,
  selectedLayer,
  selectedLayerImageUrl,
  hasPrimaryCompositePreview,
  isMoveToolSelected,
  isMorePresetsSurfaceOpen,
  isMarkupToolSelected,
  stageViewport,
  stageViewportCursor,
  markupModalStageSize,
  primaryCompositionSurfaceAspectRatio,
  shouldShowInpaintBrushReticle,
  shouldShowInpaintLassoCursor,
  shouldShowMarkupBrushReticle,
  inpaintStrokeSize,
  resolvedMarkupStrokeSize,
  maxMarkupStrokeSize,
  transformHistoryLimit,
  resolveLayerImageAspectRatio,
  resolveViewportOffsetPixels,
  showStatusToast,
  transformHistoryState,
  setTransformHistoryState,
  resetStageViewport,
}: UseExpertEditStageTransformRuntimeParams) => {
  const activeStageRenderScale = stageViewport.scale;
  const shouldShowSelectedLayerTransformOverlay =
    isMoveToolSelected && Boolean(selectedLayerImageUrl) && hasPrimaryCompositePreview;
  const selectedLayerImageAspectRatio = React.useMemo(
    () => resolveLayerImageAspectRatio(selectedLayer),
    [resolveLayerImageAspectRatio, selectedLayer]
  );
  const populatedLayerCount = React.useMemo(
    () => layers.filter((layer) => layerHasImage(layer)).length,
    [layers]
  );
  const resolveRenderableLayerTransform = React.useCallback(
    (layer: ExpertEditLayer) => {
      const clippedTransform = resolveClippedLayerTransform({
        transform: layer.transform,
      });
      if (populatedLayerCount === 1 && layerHasImage(layer)) {
        return resolveSingleImageEditSafeTransform({
          transform: clippedTransform,
        });
      }
      return clippedTransform;
    },
    [populatedLayerCount]
  );
  const selectedLayerInteractionTransform = React.useMemo(
    () => (selectedLayer ? resolveRenderableLayerTransform(selectedLayer) : null),
    [resolveRenderableLayerTransform, selectedLayer]
  );

  const commitTransformHistoryTransition = React.useCallback(
    (nextEntry: TransformHistoryEntry, baselineEntry?: TransformHistoryEntry | null) => {
      setTransformHistoryState((previousHistory) => {
        const previousEntry = baselineEntry ?? previousHistory.present;
        if (areTransformHistoryEntriesEqual(previousEntry, nextEntry)) {
          return previousHistory;
        }
        const nextPast = [...previousHistory.past, previousEntry];
        const trimmedPast =
          nextPast.length > transformHistoryLimit
            ? nextPast.slice(nextPast.length - transformHistoryLimit)
            : nextPast;
        return {
          past: trimmedPast,
          present: nextEntry,
          future: [],
        };
      });
    },
    [setTransformHistoryState, transformHistoryLimit]
  );

  const {
    activeTransformDragMode,
    clearTransformPointerSession,
    endTransformPointerSession,
    handleMovePointerDown,
    handleMovePointerMove,
    handleMovePointerLeave,
    isTransformPointerDragging,
    queuePendingHistoryApplyEntry,
    renderSelectedLayerTransformOverlay,
  } = useExpertEditTransformSession({
    layers,
    setLayers,
    selectedLayer,
    selectedLayerInteractionTransform,
    selectedLayerImageAspectRatio,
    shouldShowSelectedLayerTransformOverlay,
    resolveRenderableLayerTransform,
    sceneZoomScale: stageViewport.scale,
    viewportOffsetXRatio: stageViewport.offsetXRatio,
    viewportOffsetYRatio: stageViewport.offsetYRatio,
    resolveViewportOffsetPixels,
    commitTransformHistoryTransition,
    showStatusToast,
    transformHistoryState,
    setTransformHistoryState,
  });

  const primaryCompositionSurfaceCursor = React.useMemo(() => {
    if (isMoveToolSelected && selectedLayerImageUrl) {
      if (activeTransformDragMode === "rotate") {
        return isTransformPointerDragging ? "grabbing" : "crosshair";
      }
      if (activeTransformDragMode === "resize") {
        return "nwse-resize";
      }
      if (activeTransformDragMode === "move" && isTransformPointerDragging) {
        return "grabbing";
      }
      return "grab";
    }
    if (shouldShowInpaintBrushReticle) {
      return buildInpaintBrushReticleCursor(inpaintStrokeSize, activeStageRenderScale);
    }
    if (shouldShowInpaintLassoCursor) {
      return buildInpaintLassoCursor();
    }
    if (shouldShowMarkupBrushReticle) {
      return buildMarkupBrushReticleCursor(
        resolvedMarkupStrokeSize,
        maxMarkupStrokeSize,
        activeStageRenderScale
      );
    }
    return undefined;
  }, [
    activeStageRenderScale,
    activeTransformDragMode,
    inpaintStrokeSize,
    isMoveToolSelected,
    isTransformPointerDragging,
    maxMarkupStrokeSize,
    resolvedMarkupStrokeSize,
    selectedLayerImageUrl,
    shouldShowInpaintBrushReticle,
    shouldShowInpaintLassoCursor,
    shouldShowMarkupBrushReticle,
  ]);

  const primaryCompositionSurfaceStyle = React.useMemo(() => {
    const style: React.CSSProperties = {};
    if (!isMorePresetsSurfaceOpen) {
      if (stageViewportCursor) {
        style.cursor = stageViewportCursor;
      } else if (primaryCompositionSurfaceCursor) {
        style.cursor = primaryCompositionSurfaceCursor;
      }
    }
    return style;
  }, [isMorePresetsSurfaceOpen, primaryCompositionSurfaceCursor, stageViewportCursor]);

  const emptyPrimaryCompositionSurfaceStyle = React.useMemo<React.CSSProperties>(
    () => ({
      cursor: "default",
    }),
    []
  );

  const markupModalStageStyle = React.useMemo<React.CSSProperties>(() => {
    const modalCursor =
      stageViewportCursor ??
      primaryCompositionSurfaceCursor ??
      (isMarkupToolSelected ? "crosshair" : undefined);
    const cursorStyle = modalCursor ? { cursor: modalCursor } : null;
    if (markupModalStageSize) {
      return {
        width: `${markupModalStageSize.width}px`,
        height: `${markupModalStageSize.height}px`,
        maxWidth: "100%",
        maxHeight: "100%",
        ...(cursorStyle ?? {}),
      };
    }
    return {
      aspectRatio: primaryCompositionSurfaceAspectRatio,
      width: "100%",
      maxWidth: "100%",
      maxHeight: "100%",
      ...(cursorStyle ?? {}),
    };
  }, [
    isMarkupToolSelected,
    markupModalStageSize,
    stageViewportCursor,
    primaryCompositionSurfaceAspectRatio,
    primaryCompositionSurfaceCursor,
  ]);

  const handleRecenterMoveAction = React.useCallback(() => {
    if (selectedLayer) {
      const nextLayers = layers.map((layer) =>
        layer.id === selectedLayer.id
          ? {
              ...layer,
              transform: defaultLayerTransform(),
            }
          : layer
      );
      const baselineEntry = buildTransformHistoryEntry(layers);
      const nextEntry = buildTransformHistoryEntry(nextLayers);
      if (!areTransformHistoryEntriesEqual(baselineEntry, nextEntry)) {
        setLayers(nextLayers);
        commitTransformHistoryTransition(nextEntry, baselineEntry);
      }
    }
    resetStageViewport();
  }, [commitTransformHistoryTransition, layers, resetStageViewport, selectedLayer, setLayers]);

  return {
    activeStageRenderScale,
    clearTransformPointerSession,
    commitTransformHistoryTransition,
    endTransformPointerSession,
    handleMovePointerDown,
    handleMovePointerMove,
    handleMovePointerLeave,
    handleRecenterMoveAction,
    markupModalStageStyle,
    primaryCompositionSurfaceStyle,
    emptyPrimaryCompositionSurfaceStyle,
    queuePendingHistoryApplyEntry,
    renderSelectedLayerTransformOverlay,
    resolveRenderableLayerTransform,
  };
};
