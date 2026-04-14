/**
 * Transform history ownership for Expert Edit.
 * Isolates transform undo/redo/reset behavior from the cross-domain history arbiter.
 */
import React from "react";

import {
  areLayerTransformsEqual,
  areTransformHistoryEntriesEqual,
  buildTransformHistoryEntry,
  defaultLayerTransform,
  type TransformHistoryEntry,
  type TransformHistoryState,
} from "./expertEditLayerTransformUtils";
import type { ExpertEditLayer } from "./expertEditLayerSessionUtils";

type UseExpertEditTransformHistoryArgs = {
  layers: ExpertEditLayer[];
  selectedLayer: ExpertEditLayer | null;
  setLayers: React.Dispatch<React.SetStateAction<ExpertEditLayer[]>>;
  queuePendingHistoryApplyEntry: (entry: TransformHistoryEntry | null) => void;
  transformHistoryState: TransformHistoryState;
  setTransformHistoryState: React.Dispatch<React.SetStateAction<TransformHistoryState>>;
  commitTransformHistoryTransition: (
    nextEntry: TransformHistoryEntry,
    baselineEntry?: TransformHistoryEntry | null
  ) => void;
};

/**
 * Returns the transform-only history domain for move/reset operations.
 */
export function useExpertEditTransformHistory({
  layers,
  selectedLayer,
  setLayers,
  queuePendingHistoryApplyEntry,
  transformHistoryState,
  setTransformHistoryState,
  commitTransformHistoryTransition,
}: UseExpertEditTransformHistoryArgs) {
  const canUndoTransformHistory = transformHistoryState.past.length > 0;
  const canRedoTransformHistory = transformHistoryState.future.length > 0;

  const handleUndoMoveAction = React.useCallback(() => {
    setTransformHistoryState((previousHistory) => {
      if (!previousHistory.past.length) return previousHistory;
      const targetEntry = previousHistory.past[previousHistory.past.length - 1] ?? null;
      if (!targetEntry) return previousHistory;
      queuePendingHistoryApplyEntry(targetEntry);
      return {
        past: previousHistory.past.slice(0, -1),
        present: targetEntry,
        future: [previousHistory.present, ...previousHistory.future],
      };
    });
  }, [queuePendingHistoryApplyEntry, setTransformHistoryState]);

  const handleRedoMoveAction = React.useCallback(() => {
    setTransformHistoryState((previousHistory) => {
      if (!previousHistory.future.length) return previousHistory;
      const targetEntry = previousHistory.future[0] ?? null;
      if (!targetEntry) return previousHistory;
      queuePendingHistoryApplyEntry(targetEntry);
      return {
        past: [...previousHistory.past, previousHistory.present],
        present: targetEntry,
        future: previousHistory.future.slice(1),
      };
    });
  }, [queuePendingHistoryApplyEntry, setTransformHistoryState]);

  const resetAllMoveToolTransforms = React.useCallback(() => {
    const baselineEntry = buildTransformHistoryEntry(layers);
    const nextLayers = layers.map((layer) =>
      areLayerTransformsEqual(layer.transform, defaultLayerTransform())
        ? layer
        : {
            ...layer,
            transform: defaultLayerTransform(),
          }
    );
    const nextEntry = buildTransformHistoryEntry(nextLayers);
    if (areTransformHistoryEntriesEqual(baselineEntry, nextEntry)) return;
    setLayers(nextLayers);
    commitTransformHistoryTransition(nextEntry, baselineEntry);
  }, [commitTransformHistoryTransition, layers, setLayers]);

  const isMoveTransformCentered = React.useMemo(() => {
    if (!selectedLayer) return true;
    return areLayerTransformsEqual(selectedLayer.transform, defaultLayerTransform());
  }, [selectedLayer]);

  return {
    canUndoTransformHistory,
    canRedoTransformHistory,
    handleUndoMoveAction,
    handleRedoMoveAction,
    resetAllMoveToolTransforms,
    isMoveTransformCentered,
  };
}
