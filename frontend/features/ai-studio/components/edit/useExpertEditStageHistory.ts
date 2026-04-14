/**
 * General history arbiter for Expert Edit.
 * Coordinates transform history with the dedicated markup and inpaint history domains.
 */
import React from "react";

import type { InpaintMaskSnapshot } from "./useInpaintMaskController";
import {
  areLayerTransformsEqual,
  areTransformHistoryEntriesEqual,
  buildTransformHistoryEntry,
  defaultLayerTransform,
  type TransformHistoryEntry,
  type TransformHistoryState,
} from "./expertEditLayerTransformUtils";
import { MARKUP_VIEWPORT_DEFAULT_SCALE, MARKUP_VIEWPORT_EPSILON } from "./expertEditViewportUtils";
import type { InpaintHistoryState, MarkupHistoryState } from "./expertEditPanelViewContract";
import type { ExpertEditLayer } from "./expertEditLayerSessionUtils";
import type { MarkupStroke } from "./markupStrokeController";
import { useExpertEditInpaintHistory } from "./useExpertEditInpaintHistory";
import { useExpertEditMarkupHistory } from "./useExpertEditMarkupHistory";
import { useExpertEditTransformHistory } from "./useExpertEditTransformHistory";

type UseExpertEditStageHistoryArgs = {
  initialMarkupHistoryState: MarkupHistoryState;
  initialInpaintHistoryState: InpaintHistoryState;
  initialInpaintPresentSnapshot: InpaintMaskSnapshot;
  layers: ExpertEditLayer[];
  selectedLayer: ExpertEditLayer | null;
  setLayers: React.Dispatch<React.SetStateAction<ExpertEditLayer[]>>;
  markupStrokes: MarkupStroke[];
  setMarkupStrokes: React.Dispatch<React.SetStateAction<MarkupStroke[]>>;
  hasPrimaryCompositePreview: boolean;
  inpaintLayerSources: Array<{ id: string; imageUrl: string | null }>;
  markupViewport: {
    scale: number;
    offsetXRatio: number;
    offsetYRatio: number;
  };
  resetMarkupViewport: () => void;
  captureInpaintMaskSnapshot: () => InpaintMaskSnapshot;
  restoreInpaintMaskSnapshot: (snapshot: InpaintMaskSnapshot) => void;
  clearSelectedLayerMask: () => void;
  invertSelectedLayerMask: () => void;
  clearAllInpaintMasks: () => void;
  isInpaintToolSelected: boolean;
  isMarkupToolSelected: boolean;
  queuePendingHistoryApplyEntry: (entry: TransformHistoryEntry | null) => void;
  transformHistoryState: TransformHistoryState;
  setTransformHistoryState: React.Dispatch<React.SetStateAction<TransformHistoryState>>;
  commitTransformHistoryTransition: (
    nextEntry: TransformHistoryEntry,
    baselineEntry?: TransformHistoryEntry | null
  ) => void;
};

export function useExpertEditStageHistory({
  initialMarkupHistoryState,
  initialInpaintHistoryState,
  initialInpaintPresentSnapshot,
  layers,
  selectedLayer,
  setLayers,
  markupStrokes,
  setMarkupStrokes,
  hasPrimaryCompositePreview,
  inpaintLayerSources,
  markupViewport,
  resetMarkupViewport,
  captureInpaintMaskSnapshot,
  restoreInpaintMaskSnapshot,
  clearSelectedLayerMask,
  invertSelectedLayerMask,
  clearAllInpaintMasks,
  isInpaintToolSelected,
  isMarkupToolSelected,
  queuePendingHistoryApplyEntry,
  transformHistoryState,
  setTransformHistoryState,
  commitTransformHistoryTransition,
}: UseExpertEditStageHistoryArgs) {
  const {
    canRedoInpaintHistory,
    canUndoInpaintHistory,
    clearAllInpaintMasksWithHistory,
    clearInpaintHistoryEphemera,
    clearInpaintSelectionWithHistory,
    beginInpaintGestureHistory,
    finalizeInpaintGestureHistory,
    handleRedoInpaintAction,
    handleUndoInpaintAction,
    inpaintHistoryState,
    invertInpaintSelectionWithHistory,
  } = useExpertEditInpaintHistory({
    initialInpaintHistoryState,
    initialInpaintPresentSnapshot,
    inpaintLayerSources,
    captureInpaintMaskSnapshot,
    restoreInpaintMaskSnapshot,
    clearSelectedLayerMask,
    invertSelectedLayerMask,
    clearAllInpaintMasks,
  });

  const {
    canRedoMarkupHistory,
    canUndoMarkupHistory,
    clearMarkupHistoryEphemera,
    clearMarkupStrokesWithHistory,
    beginMarkupGestureHistory,
    finalizeMarkupGestureHistory,
    handleRedoMarkupAction,
    handleUndoMarkupAction,
    markupHistoryState,
  } = useExpertEditMarkupHistory({
    initialMarkupHistoryState,
    markupStrokes,
    setMarkupStrokes,
    hasPrimaryCompositePreview,
  });

  const {
    canRedoTransformHistory,
    canUndoTransformHistory,
    handleRedoMoveAction,
    handleUndoMoveAction,
    isMoveTransformCentered,
    resetAllMoveToolTransforms,
  } = useExpertEditTransformHistory({
    layers,
    selectedLayer,
    setLayers,
    queuePendingHistoryApplyEntry,
    transformHistoryState,
    setTransformHistoryState,
    commitTransformHistoryTransition,
  });

  const canUndoGeneralAction =
    canUndoTransformHistory || canUndoMarkupHistory || canUndoInpaintHistory;
  const canRedoGeneralAction =
    canRedoTransformHistory || canRedoMarkupHistory || canRedoInpaintHistory;

  const handleUndoGeneralAction = React.useCallback(() => {
    if (isInpaintToolSelected && canUndoInpaintHistory) {
      handleUndoInpaintAction();
      return;
    }
    if (isMarkupToolSelected && canUndoMarkupHistory) {
      handleUndoMarkupAction();
      return;
    }
    if (canUndoTransformHistory) {
      handleUndoMoveAction();
      return;
    }
    if (canUndoInpaintHistory) {
      handleUndoInpaintAction();
      return;
    }
    if (canUndoMarkupHistory) {
      handleUndoMarkupAction();
    }
  }, [
    canUndoInpaintHistory,
    canUndoMarkupHistory,
    canUndoTransformHistory,
    handleUndoInpaintAction,
    handleUndoMarkupAction,
    handleUndoMoveAction,
    isInpaintToolSelected,
    isMarkupToolSelected,
  ]);

  const handleRedoGeneralAction = React.useCallback(() => {
    if (isInpaintToolSelected && canRedoInpaintHistory) {
      handleRedoInpaintAction();
      return;
    }
    if (isMarkupToolSelected && canRedoMarkupHistory) {
      handleRedoMarkupAction();
      return;
    }
    if (canRedoTransformHistory) {
      handleRedoMoveAction();
      return;
    }
    if (canRedoInpaintHistory) {
      handleRedoInpaintAction();
      return;
    }
    if (canRedoMarkupHistory) {
      handleRedoMarkupAction();
    }
  }, [
    canRedoInpaintHistory,
    canRedoMarkupHistory,
    canRedoTransformHistory,
    handleRedoInpaintAction,
    handleRedoMarkupAction,
    handleRedoMoveAction,
    isInpaintToolSelected,
    isMarkupToolSelected,
  ]);

  const handleResetGeneralAction = React.useCallback(() => {
    resetAllMoveToolTransforms();
    resetMarkupViewport();
    clearAllInpaintMasksWithHistory();
    clearMarkupStrokesWithHistory();
  }, [
    clearAllInpaintMasksWithHistory,
    clearMarkupStrokesWithHistory,
    resetAllMoveToolTransforms,
    resetMarkupViewport,
  ]);

  const clearGenerationModeSelectionArtifacts = React.useCallback(() => {
    clearAllInpaintMasksWithHistory();
    clearMarkupStrokesWithHistory();
  }, [clearAllInpaintMasksWithHistory, clearMarkupStrokesWithHistory]);

  const isMarkupViewportAtRest = React.useMemo(
    () =>
      Math.abs(markupViewport.scale - MARKUP_VIEWPORT_DEFAULT_SCALE) <= MARKUP_VIEWPORT_EPSILON &&
      Math.abs(markupViewport.offsetXRatio) <= MARKUP_VIEWPORT_EPSILON &&
      Math.abs(markupViewport.offsetYRatio) <= MARKUP_VIEWPORT_EPSILON,
    [markupViewport]
  );

  const hasInpaintMaskContent = inpaintHistoryState.present.layers.length > 0;
  const hasAnyMoveTransformChanges = React.useMemo(
    () =>
      layers.some((layer) => !areLayerTransformsEqual(layer.transform, defaultLayerTransform())),
    [layers]
  );
  const isGeneralResetDisabled =
    !hasAnyMoveTransformChanges &&
    isMarkupViewportAtRest &&
    markupStrokes.length === 0 &&
    !hasInpaintMaskContent;

  const clearHistoryEphemera = React.useCallback(() => {
    clearMarkupHistoryEphemera();
    clearInpaintHistoryEphemera();
  }, [clearInpaintHistoryEphemera, clearMarkupHistoryEphemera]);

  return {
    markupHistoryState,
    inpaintHistoryState,
    beginInpaintGestureHistory,
    finalizeInpaintGestureHistory,
    clearInpaintSelectionWithHistory,
    invertInpaintSelectionWithHistory,
    beginMarkupGestureHistory,
    finalizeMarkupGestureHistory,
    clearMarkupStrokesWithHistory,
    canUndoGeneralAction,
    canRedoGeneralAction,
    handleUndoGeneralAction,
    handleRedoGeneralAction,
    handleResetGeneralAction,
    clearGenerationModeSelectionArtifacts,
    isMoveTransformCentered,
    isMarkupViewportAtRest,
    isGeneralResetDisabled,
    clearHistoryEphemera,
  };
}
