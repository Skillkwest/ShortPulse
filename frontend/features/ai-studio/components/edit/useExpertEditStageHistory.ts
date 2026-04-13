import React from "react";

import { areInpaintMaskSnapshotsEqual, type InpaintMaskSnapshot } from "./useInpaintMaskController";
import {
  areLayerTransformsEqual,
  areTransformHistoryEntriesEqual,
  buildTransformHistoryEntry,
  defaultLayerTransform,
  type TransformHistoryEntry,
  type TransformHistoryState,
} from "./expertEditLayerTransformUtils";
import {
  areMarkupStrokeSnapshotsEqual,
  cloneInpaintHistoryState,
  cloneInpaintMaskSnapshot,
  cloneMarkupHistoryState,
  cloneMarkupStrokesSnapshot,
} from "./expertEditSessionState";
import { MARKUP_VIEWPORT_DEFAULT_SCALE, MARKUP_VIEWPORT_EPSILON } from "./expertEditViewportUtils";
import type { InpaintHistoryState, MarkupHistoryState } from "./expertEditPanelViewContract";
import type { ExpertEditLayer } from "./expertEditLayerSessionUtils";
import type { MarkupStroke } from "./markupStrokeController";

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
  isVideoToolSelected: boolean;
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
  isVideoToolSelected,
  queuePendingHistoryApplyEntry,
  transformHistoryState,
  setTransformHistoryState,
  commitTransformHistoryTransition,
}: UseExpertEditStageHistoryArgs) {
  const markupGestureBaselineRef = React.useRef<MarkupStroke[] | null>(null);
  const inpaintGestureBaselineRef = React.useRef<InpaintMaskSnapshot | null>(null);
  const pendingMarkupHistoryApplyRef = React.useRef<MarkupStroke[] | null>(null);
  const pendingInpaintHistoryApplyRef = React.useRef<InpaintMaskSnapshot | null>(null);
  const inpaintSessionRestorePendingRef = React.useRef(
    initialInpaintPresentSnapshot.layers.length > 0
  );

  const [markupHistoryState, setMarkupHistoryState] = React.useState<MarkupHistoryState>(() =>
    cloneMarkupHistoryState(initialMarkupHistoryState)
  );
  const [inpaintHistoryState, setInpaintHistoryState] = React.useState<InpaintHistoryState>(() =>
    cloneInpaintHistoryState(initialInpaintHistoryState)
  );

  const canUndoTransformHistory = transformHistoryState.past.length > 0;
  const canRedoTransformHistory = transformHistoryState.future.length > 0;
  const canUndoMarkupHistory = markupHistoryState.past.length > 0;
  const canRedoMarkupHistory = markupHistoryState.future.length > 0;
  const canUndoInpaintHistory = inpaintHistoryState.past.length > 0;
  const canRedoInpaintHistory = inpaintHistoryState.future.length > 0;

  React.useEffect(() => {
    if (hasPrimaryCompositePreview || markupStrokes.length <= 0) return;
    setMarkupStrokes([]);
    markupGestureBaselineRef.current = null;
    setMarkupHistoryState({
      past: [],
      present: [],
      future: [],
    });
  }, [hasPrimaryCompositePreview, markupStrokes.length, setMarkupStrokes]);

  React.useEffect(() => {
    if (!inpaintSessionRestorePendingRef.current) return;
    restoreInpaintMaskSnapshot(cloneInpaintMaskSnapshot(initialInpaintPresentSnapshot));
    inpaintSessionRestorePendingRef.current = false;
  }, [initialInpaintPresentSnapshot, restoreInpaintMaskSnapshot]);

  React.useEffect(() => {
    if (inpaintSessionRestorePendingRef.current) return;
    const snapshot = captureInpaintMaskSnapshot();
    setInpaintHistoryState((previousHistory) =>
      areInpaintMaskSnapshotsEqual(previousHistory.present, snapshot)
        ? previousHistory
        : {
            past: [],
            present: snapshot,
            future: [],
          }
    );
  }, [captureInpaintMaskSnapshot, inpaintLayerSources]);

  React.useEffect(() => {
    const pendingEntry = pendingMarkupHistoryApplyRef.current;
    if (!pendingEntry) return;
    pendingMarkupHistoryApplyRef.current = null;
    setMarkupStrokes(cloneMarkupStrokesSnapshot(pendingEntry));
  }, [markupHistoryState, setMarkupStrokes]);

  React.useEffect(() => {
    const pendingEntry = pendingInpaintHistoryApplyRef.current;
    if (!pendingEntry) return;
    pendingInpaintHistoryApplyRef.current = null;
    restoreInpaintMaskSnapshot(pendingEntry);
  }, [inpaintHistoryState, restoreInpaintMaskSnapshot]);

  const commitMarkupHistoryTransition = React.useCallback(
    (nextEntry: MarkupStroke[], baselineEntry?: MarkupStroke[] | null) => {
      setMarkupHistoryState((previousHistory) => {
        const previousEntry = baselineEntry ?? previousHistory.present;
        if (areMarkupStrokeSnapshotsEqual(previousEntry, nextEntry)) {
          return previousHistory;
        }
        const nextPast = [...previousHistory.past, previousEntry];
        return {
          past: nextPast,
          present: nextEntry,
          future: [],
        };
      });
    },
    []
  );

  const commitInpaintHistoryTransition = React.useCallback(
    (nextEntry: InpaintMaskSnapshot, baselineEntry?: InpaintMaskSnapshot | null) => {
      setInpaintHistoryState((previousHistory) => {
        const previousEntry = baselineEntry ?? previousHistory.present;
        if (areInpaintMaskSnapshotsEqual(previousEntry, nextEntry)) {
          return previousHistory;
        }
        const nextPast = [...previousHistory.past, previousEntry];
        return {
          past: nextPast,
          present: nextEntry,
          future: [],
        };
      });
    },
    []
  );

  const beginInpaintGestureHistory = React.useCallback(() => {
    inpaintGestureBaselineRef.current = captureInpaintMaskSnapshot();
  }, [captureInpaintMaskSnapshot]);

  const finalizeInpaintGestureHistory = React.useCallback(() => {
    const baselineEntry = inpaintGestureBaselineRef.current;
    if (!baselineEntry) return;
    inpaintGestureBaselineRef.current = null;
    const nextEntry = captureInpaintMaskSnapshot();
    commitInpaintHistoryTransition(nextEntry, baselineEntry);
  }, [captureInpaintMaskSnapshot, commitInpaintHistoryTransition]);

  const clearInpaintSelectionWithHistory = React.useCallback(() => {
    const baselineEntry = captureInpaintMaskSnapshot();
    clearSelectedLayerMask();
    const nextEntry = captureInpaintMaskSnapshot();
    commitInpaintHistoryTransition(nextEntry, baselineEntry);
  }, [captureInpaintMaskSnapshot, clearSelectedLayerMask, commitInpaintHistoryTransition]);

  const invertInpaintSelectionWithHistory = React.useCallback(() => {
    const baselineEntry = captureInpaintMaskSnapshot();
    invertSelectedLayerMask();
    const nextEntry = captureInpaintMaskSnapshot();
    commitInpaintHistoryTransition(nextEntry, baselineEntry);
  }, [captureInpaintMaskSnapshot, commitInpaintHistoryTransition, invertSelectedLayerMask]);

  const clearAllInpaintMasksWithHistory = React.useCallback(() => {
    const baselineEntry = captureInpaintMaskSnapshot();
    clearAllInpaintMasks();
    const nextEntry = captureInpaintMaskSnapshot();
    commitInpaintHistoryTransition(nextEntry, baselineEntry);
  }, [captureInpaintMaskSnapshot, clearAllInpaintMasks, commitInpaintHistoryTransition]);

  const beginMarkupGestureHistory = React.useCallback(() => {
    if (markupGestureBaselineRef.current) return;
    markupGestureBaselineRef.current = cloneMarkupStrokesSnapshot(markupStrokes);
  }, [markupStrokes]);

  const finalizeMarkupGestureHistory = React.useCallback(() => {
    const baselineEntry = markupGestureBaselineRef.current;
    if (!baselineEntry) return;
    markupGestureBaselineRef.current = null;
    const commit = () => {
      const nextEntry = cloneMarkupStrokesSnapshot(markupStrokes);
      commitMarkupHistoryTransition(nextEntry, baselineEntry);
    };
    if (typeof window === "undefined") {
      commit();
      return;
    }
    window.requestAnimationFrame(commit);
  }, [commitMarkupHistoryTransition, markupStrokes]);

  const clearMarkupStrokesWithHistory = React.useCallback(() => {
    const baselineEntry = cloneMarkupStrokesSnapshot(markupStrokes);
    setMarkupStrokes([]);
    commitMarkupHistoryTransition([], baselineEntry);
  }, [commitMarkupHistoryTransition, markupStrokes, setMarkupStrokes]);

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

  const handleUndoMarkupAction = React.useCallback(() => {
    setMarkupHistoryState((previousHistory) => {
      if (!previousHistory.past.length) return previousHistory;
      const targetEntry = previousHistory.past[previousHistory.past.length - 1] ?? null;
      if (!targetEntry) return previousHistory;
      pendingMarkupHistoryApplyRef.current = cloneMarkupStrokesSnapshot(targetEntry);
      return {
        past: previousHistory.past.slice(0, -1),
        present: targetEntry,
        future: [previousHistory.present, ...previousHistory.future],
      };
    });
  }, []);

  const handleRedoMarkupAction = React.useCallback(() => {
    setMarkupHistoryState((previousHistory) => {
      if (!previousHistory.future.length) return previousHistory;
      const targetEntry = previousHistory.future[0] ?? null;
      if (!targetEntry) return previousHistory;
      pendingMarkupHistoryApplyRef.current = cloneMarkupStrokesSnapshot(targetEntry);
      return {
        past: [...previousHistory.past, previousHistory.present],
        present: targetEntry,
        future: previousHistory.future.slice(1),
      };
    });
  }, []);

  const handleUndoInpaintAction = React.useCallback(() => {
    setInpaintHistoryState((previousHistory) => {
      if (!previousHistory.past.length) return previousHistory;
      const targetEntry = previousHistory.past[previousHistory.past.length - 1] ?? null;
      if (!targetEntry) return previousHistory;
      pendingInpaintHistoryApplyRef.current = targetEntry;
      return {
        past: previousHistory.past.slice(0, -1),
        present: targetEntry,
        future: [previousHistory.present, ...previousHistory.future],
      };
    });
  }, []);

  const handleRedoInpaintAction = React.useCallback(() => {
    setInpaintHistoryState((previousHistory) => {
      if (!previousHistory.future.length) return previousHistory;
      const targetEntry = previousHistory.future[0] ?? null;
      if (!targetEntry) return previousHistory;
      pendingInpaintHistoryApplyRef.current = targetEntry;
      return {
        past: [...previousHistory.past, previousHistory.present],
        present: targetEntry,
        future: previousHistory.future.slice(1),
      };
    });
  }, []);

  const canUndoGeneralAction =
    canUndoTransformHistory || canUndoMarkupHistory || canUndoInpaintHistory;
  const canRedoGeneralAction =
    canRedoTransformHistory || canRedoMarkupHistory || canRedoInpaintHistory;

  const handleUndoGeneralAction = React.useCallback(() => {
    if (isInpaintToolSelected && canUndoInpaintHistory) {
      handleUndoInpaintAction();
      return;
    }
    if (isVideoToolSelected && canUndoMarkupHistory) {
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
    isVideoToolSelected,
  ]);

  const handleRedoGeneralAction = React.useCallback(() => {
    if (isInpaintToolSelected && canRedoInpaintHistory) {
      handleRedoInpaintAction();
      return;
    }
    if (isVideoToolSelected && canRedoMarkupHistory) {
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
    isVideoToolSelected,
  ]);

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

  const isMoveTransformCentered = React.useMemo(() => {
    if (!selectedLayer) return true;
    return areLayerTransformsEqual(selectedLayer.transform, defaultLayerTransform());
  }, [selectedLayer]);

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
    pendingMarkupHistoryApplyRef.current = null;
    pendingInpaintHistoryApplyRef.current = null;
    markupGestureBaselineRef.current = null;
    inpaintGestureBaselineRef.current = null;
    inpaintSessionRestorePendingRef.current = false;
  }, []);

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
