/**
 * Panel-wide undo/redo ownership for Expert Edit.
 * Tracks cross-surface state snapshots so keyboard shortcuts and toolbar buttons can restore
 * layer, transform, markup, and inpaint changes from one shared history stack.
 */
import React from "react";

import type { MarkupStroke } from "./markupStrokeController";
import type { InpaintMaskSnapshot } from "./useInpaintMaskController";
import type { ExpertEditLayer } from "./expertEditLayerSessionUtils";
import type { ExpertEditLayerSessionState } from "./expertEditSessionState";
import {
  areLayerSessionStatesEqual,
  areMarkupStrokeSnapshotsEqual,
  cloneInpaintMaskSnapshot,
  cloneLayerSessionState,
  cloneLayerSessionTransform,
  cloneMarkupStrokesSnapshot,
  type ExpertEditLayerSessionLayer,
} from "./expertEditSessionState";
import { areInpaintMaskSnapshotsEqual } from "./useInpaintMaskController";

type ExpertEditPanelHistorySnapshot = {
  layers: ExpertEditLayerSessionState;
  markupStrokes: MarkupStroke[];
  inpaintSnapshot: InpaintMaskSnapshot;
};

type ExpertEditPanelHistoryState = {
  past: ExpertEditPanelHistorySnapshot[];
  present: ExpertEditPanelHistorySnapshot;
  future: ExpertEditPanelHistorySnapshot[];
};

type BuildHistorySnapshotOverrides = {
  layersOverride?: ExpertEditLayer[];
  markupStrokesOverride?: MarkupStroke[];
  inpaintSnapshotOverride?: InpaintMaskSnapshot;
};

type RebasePanelHistoryLayerImageArgs = {
  layerId: string;
  previousImageUrl: string | null;
  nextImageUrl: string | null;
  ownsImageUrl: boolean;
};

type UseExpertEditPanelHistoryArgs = {
  historyLimit: number;
  foundationLayerId: string | null;
  selectedLayerIndex: number | null;
  layerIdCounter: number;
  layerIdCounterRef: React.MutableRefObject<number>;
  layers: ExpertEditLayer[];
  markupStrokes: MarkupStroke[];
  inpaintSnapshot: InpaintMaskSnapshot;
  setFoundationLayerId: React.Dispatch<React.SetStateAction<string | null>>;
  setLayerIdCounter: React.Dispatch<React.SetStateAction<number>>;
  setSelectedLayerIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setLayers: React.Dispatch<React.SetStateAction<ExpertEditLayer[]>>;
  setMarkupStrokes: React.Dispatch<React.SetStateAction<MarkupStroke[]>>;
  restoreInpaintMaskSnapshot: (snapshot: InpaintMaskSnapshot) => void;
  clearLayerEditing: () => void;
};

const clonePanelHistoryLayer = (layer: ExpertEditLayerSessionLayer): ExpertEditLayer => ({
  id: layer.id,
  name: layer.name,
  imageUrl: layer.imageUrl,
  opacity: layer.opacity,
  isAutoNamed: layer.isAutoNamed,
  ownsImageUrl: layer.ownsImageUrl,
  transform: cloneLayerSessionTransform(layer.transform),
});

const clonePanelHistorySnapshot = (
  snapshot: ExpertEditPanelHistorySnapshot
): ExpertEditPanelHistorySnapshot => ({
  layers: cloneLayerSessionState(snapshot.layers),
  markupStrokes: cloneMarkupStrokesSnapshot(snapshot.markupStrokes),
  inpaintSnapshot: cloneInpaintMaskSnapshot(snapshot.inpaintSnapshot),
});

const arePanelHistorySnapshotsEqual = (
  left: ExpertEditPanelHistorySnapshot,
  right: ExpertEditPanelHistorySnapshot
) =>
  areLayerSessionStatesEqual(left.layers, right.layers) &&
  areMarkupStrokeSnapshotsEqual(left.markupStrokes, right.markupStrokes) &&
  areInpaintMaskSnapshotsEqual(left.inpaintSnapshot, right.inpaintSnapshot);

const arePanelHistorySnapshotsExternallyEqual = (
  left: ExpertEditPanelHistorySnapshot,
  right: ExpertEditPanelHistorySnapshot
) =>
  left.layers.foundationLayerId === right.layers.foundationLayerId &&
  left.layers.layerIdCounter === right.layers.layerIdCounter &&
  areLayerSessionStatesEqual(
    {
      ...left.layers,
      selectedLayerIndex: right.layers.selectedLayerIndex,
    },
    right.layers
  ) &&
  areMarkupStrokeSnapshotsEqual(left.markupStrokes, right.markupStrokes) &&
  areInpaintMaskSnapshotsEqual(left.inpaintSnapshot, right.inpaintSnapshot);

const trimHistoryPast = (
  history: ExpertEditPanelHistorySnapshot[],
  historyLimit: number
): ExpertEditPanelHistorySnapshot[] =>
  history.length > historyLimit ? history.slice(history.length - historyLimit) : history;

const rebasePanelHistorySnapshotLayerImage = (
  snapshot: ExpertEditPanelHistorySnapshot,
  { layerId, previousImageUrl, nextImageUrl, ownsImageUrl }: RebasePanelHistoryLayerImageArgs
): ExpertEditPanelHistorySnapshot => {
  let didChange = false;
  const nextLayers = snapshot.layers.layers.map((layer) => {
    if (layer.id !== layerId || layer.imageUrl !== previousImageUrl) {
      return layer;
    }
    didChange = true;
    return {
      ...layer,
      imageUrl: nextImageUrl,
      ownsImageUrl,
    };
  });
  if (!didChange) {
    return snapshot;
  }
  return {
    ...snapshot,
    layers: {
      ...snapshot.layers,
      layers: nextLayers,
    },
  };
};

/**
 * Returns one shared history stack for cross-panel Expert Edit undo/redo behavior.
 */
export function useExpertEditPanelHistory({
  historyLimit,
  foundationLayerId,
  selectedLayerIndex,
  layerIdCounter,
  layerIdCounterRef,
  layers,
  markupStrokes,
  inpaintSnapshot,
  setFoundationLayerId,
  setLayerIdCounter,
  setSelectedLayerIndex,
  setLayers,
  setMarkupStrokes,
  restoreInpaintMaskSnapshot,
  clearLayerEditing,
}: UseExpertEditPanelHistoryArgs) {
  const buildPanelHistorySnapshot = React.useCallback(
    (overrides?: BuildHistorySnapshotOverrides): ExpertEditPanelHistorySnapshot => {
      const resolvedLayers = overrides?.layersOverride ?? layers;
      return {
        layers: {
          layerIdCounter,
          foundationLayerId,
          selectedLayerIndex,
          layers: resolvedLayers.map((layer) => ({
            id: layer.id,
            name: layer.name,
            imageUrl: layer.imageUrl,
            opacity: layer.opacity,
            isAutoNamed: layer.isAutoNamed,
            ownsImageUrl: layer.ownsImageUrl,
            transform: cloneLayerSessionTransform(layer.transform),
          })),
        },
        markupStrokes: cloneMarkupStrokesSnapshot(
          overrides?.markupStrokesOverride ?? markupStrokes
        ),
        inpaintSnapshot: cloneInpaintMaskSnapshot(
          overrides?.inpaintSnapshotOverride ?? inpaintSnapshot
        ),
      };
    },
    [foundationLayerId, inpaintSnapshot, layerIdCounter, layers, markupStrokes, selectedLayerIndex]
  );

  const currentSnapshot = React.useMemo(
    () => buildPanelHistorySnapshot(),
    [buildPanelHistorySnapshot]
  );

  const currentSnapshotRef = React.useRef(currentSnapshot);
  const pendingBaselineRef = React.useRef<ExpertEditPanelHistorySnapshot | null>(null);
  const activeGestureBaselineRef = React.useRef<ExpertEditPanelHistorySnapshot | null>(null);
  const finalizeGestureFrameRef = React.useRef<number | null>(null);
  const [historyState, setHistoryState] = React.useState<ExpertEditPanelHistoryState>(() => ({
    past: [],
    present: clonePanelHistorySnapshot(currentSnapshot),
    future: [],
  }));
  const historyStateRef = React.useRef(historyState);

  const clearPendingPanelHistoryBaseline = React.useCallback(() => {
    pendingBaselineRef.current = null;
  }, []);

  const clearPanelHistoryEphemera = React.useCallback(() => {
    pendingBaselineRef.current = null;
    activeGestureBaselineRef.current = null;
    if (finalizeGestureFrameRef.current != null && typeof window !== "undefined") {
      window.cancelAnimationFrame(finalizeGestureFrameRef.current);
    }
    finalizeGestureFrameRef.current = null;
  }, []);

  const queuePanelHistoryBaseline = React.useCallback(
    (baselineSnapshot: ExpertEditPanelHistorySnapshot) => {
      pendingBaselineRef.current = clonePanelHistorySnapshot(baselineSnapshot);
    },
    []
  );

  const queuePanelHistoryBaselineFromCurrent = React.useCallback(() => {
    pendingBaselineRef.current = clonePanelHistorySnapshot(currentSnapshot);
  }, [currentSnapshot]);

  const rebasePanelHistoryLayerImage = React.useCallback(
    (args: RebasePanelHistoryLayerImageArgs) => {
      setHistoryState((previousHistory) => {
        const nextPresent = rebasePanelHistorySnapshotLayerImage(previousHistory.present, args);
        const nextPast = previousHistory.past.map((snapshot) =>
          rebasePanelHistorySnapshotLayerImage(snapshot, args)
        );
        const nextFuture = previousHistory.future.map((snapshot) =>
          rebasePanelHistorySnapshotLayerImage(snapshot, args)
        );
        const didChange =
          nextPresent !== previousHistory.present ||
          nextPast.some((snapshot, index) => snapshot !== previousHistory.past[index]) ||
          nextFuture.some((snapshot, index) => snapshot !== previousHistory.future[index]);
        if (!didChange) {
          return previousHistory;
        }
        const nextHistoryState = {
          past: nextPast,
          present: nextPresent,
          future: nextFuture,
        };
        historyStateRef.current = nextHistoryState;
        return nextHistoryState;
      });
    },
    []
  );

  const commitPanelHistorySnapshotTransition = React.useCallback(
    (
      nextSnapshot: ExpertEditPanelHistorySnapshot,
      baselineSnapshot?: ExpertEditPanelHistorySnapshot | null
    ) => {
      setHistoryState((previousHistory) => {
        const previousEntry = baselineSnapshot ?? previousHistory.present;
        if (arePanelHistorySnapshotsEqual(previousEntry, nextSnapshot)) {
          const nextHistoryState = arePanelHistorySnapshotsEqual(
            previousHistory.present,
            nextSnapshot
          )
            ? previousHistory
            : {
                ...previousHistory,
                present: clonePanelHistorySnapshot(nextSnapshot),
              };
          historyStateRef.current = nextHistoryState;
          return nextHistoryState;
        }
        const nextHistoryState = {
          past: trimHistoryPast(
            [...previousHistory.past, clonePanelHistorySnapshot(previousEntry)],
            historyLimit
          ),
          present: clonePanelHistorySnapshot(nextSnapshot),
          future: [],
        };
        historyStateRef.current = nextHistoryState;
        return nextHistoryState;
      });
    },
    [historyLimit]
  );

  const beginPanelHistoryGesture = React.useCallback(
    (baselineSnapshot?: ExpertEditPanelHistorySnapshot | null) => {
      if (activeGestureBaselineRef.current) {
        return;
      }
      activeGestureBaselineRef.current = clonePanelHistorySnapshot(
        baselineSnapshot ?? currentSnapshotRef.current
      );
    },
    []
  );

  const finalizePanelHistoryGesture = React.useCallback(() => {
    const baselineSnapshot = activeGestureBaselineRef.current;
    if (!baselineSnapshot) {
      return;
    }
    const commit = () => {
      finalizeGestureFrameRef.current = null;
      const pendingBaseline = activeGestureBaselineRef.current;
      activeGestureBaselineRef.current = null;
      if (!pendingBaseline) {
        return;
      }
      commitPanelHistorySnapshotTransition(currentSnapshotRef.current, pendingBaseline);
    };
    if (typeof window === "undefined") {
      commit();
      return;
    }
    if (finalizeGestureFrameRef.current != null) {
      window.cancelAnimationFrame(finalizeGestureFrameRef.current);
    }
    finalizeGestureFrameRef.current = window.requestAnimationFrame(commit);
  }, [commitPanelHistorySnapshotTransition]);

  const flushPendingPanelHistoryGesture = React.useCallback(() => {
    const pendingBaseline = activeGestureBaselineRef.current;
    if (!pendingBaseline) {
      return;
    }
    if (finalizeGestureFrameRef.current != null && typeof window !== "undefined") {
      window.cancelAnimationFrame(finalizeGestureFrameRef.current);
    }
    finalizeGestureFrameRef.current = null;
    activeGestureBaselineRef.current = null;
    commitPanelHistorySnapshotTransition(currentSnapshotRef.current, pendingBaseline);
  }, [commitPanelHistorySnapshotTransition]);

  const applyPanelHistorySnapshot = React.useCallback(
    (snapshot: ExpertEditPanelHistorySnapshot) => {
      clearPanelHistoryEphemera();
      clearLayerEditing();
      layerIdCounterRef.current = snapshot.layers.layerIdCounter;
      setLayerIdCounter(snapshot.layers.layerIdCounter);
      setFoundationLayerId(snapshot.layers.foundationLayerId);
      setLayers(snapshot.layers.layers.map(clonePanelHistoryLayer));
      setSelectedLayerIndex(snapshot.layers.selectedLayerIndex);
      setMarkupStrokes(cloneMarkupStrokesSnapshot(snapshot.markupStrokes));
      restoreInpaintMaskSnapshot(cloneInpaintMaskSnapshot(snapshot.inpaintSnapshot));
    },
    [
      clearLayerEditing,
      clearPanelHistoryEphemera,
      layerIdCounterRef,
      restoreInpaintMaskSnapshot,
      setFoundationLayerId,
      setLayerIdCounter,
      setLayers,
      setMarkupStrokes,
      setSelectedLayerIndex,
    ]
  );

  const handleUndoPanelHistoryAction = React.useCallback(() => {
    flushPendingPanelHistoryGesture();
    const previousHistory = historyStateRef.current;
    const targetSnapshot = previousHistory.past[previousHistory.past.length - 1] ?? null;
    if (!targetSnapshot) {
      return;
    }
    const nextHistoryState = {
      past: previousHistory.past.slice(0, -1),
      present: targetSnapshot,
      future: [previousHistory.present, ...previousHistory.future],
    };
    historyStateRef.current = nextHistoryState;
    setHistoryState(nextHistoryState);
    applyPanelHistorySnapshot(targetSnapshot);
  }, [applyPanelHistorySnapshot, flushPendingPanelHistoryGesture]);

  const handleRedoPanelHistoryAction = React.useCallback(() => {
    flushPendingPanelHistoryGesture();
    const previousHistory = historyStateRef.current;
    const targetSnapshot = previousHistory.future[0] ?? null;
    if (!targetSnapshot) {
      return;
    }
    const nextHistoryState = {
      past: trimHistoryPast([...previousHistory.past, previousHistory.present], historyLimit),
      present: targetSnapshot,
      future: previousHistory.future.slice(1),
    };
    historyStateRef.current = nextHistoryState;
    setHistoryState(nextHistoryState);
    applyPanelHistorySnapshot(targetSnapshot);
  }, [applyPanelHistorySnapshot, flushPendingPanelHistoryGesture, historyLimit]);

  React.useEffect(() => {
    currentSnapshotRef.current = currentSnapshot;
    setHistoryState((previousHistory) => {
      if (activeGestureBaselineRef.current) {
        historyStateRef.current = previousHistory;
        return previousHistory;
      }
      const pendingBaseline = pendingBaselineRef.current;
      if (pendingBaseline) {
        pendingBaselineRef.current = null;
        if (arePanelHistorySnapshotsEqual(pendingBaseline, currentSnapshot)) {
          const nextHistoryState = arePanelHistorySnapshotsEqual(
            previousHistory.present,
            currentSnapshot
          )
            ? previousHistory
            : {
                ...previousHistory,
                present: clonePanelHistorySnapshot(currentSnapshot),
              };
          historyStateRef.current = nextHistoryState;
          return nextHistoryState;
        }
        const nextHistoryState = {
          past: trimHistoryPast(
            [...previousHistory.past, clonePanelHistorySnapshot(pendingBaseline)],
            historyLimit
          ),
          present: clonePanelHistorySnapshot(currentSnapshot),
          future: [],
        };
        historyStateRef.current = nextHistoryState;
        return nextHistoryState;
      }
      if (arePanelHistorySnapshotsExternallyEqual(previousHistory.present, currentSnapshot)) {
        historyStateRef.current = previousHistory;
        return previousHistory;
      }
      const nextHistoryState = {
        past: [],
        present: clonePanelHistorySnapshot(currentSnapshot),
        future: [],
      };
      historyStateRef.current = nextHistoryState;
      return nextHistoryState;
    });
  }, [currentSnapshot, historyLimit]);

  React.useEffect(
    () => () => {
      if (finalizeGestureFrameRef.current == null || typeof window === "undefined") {
        return;
      }
      window.cancelAnimationFrame(finalizeGestureFrameRef.current);
    },
    []
  );

  React.useEffect(() => {
    historyStateRef.current = historyState;
  }, [historyState]);

  return {
    canUndoPanelHistoryAction: historyState.past.length > 0,
    canRedoPanelHistoryAction: historyState.future.length > 0,
    buildPanelHistorySnapshot,
    beginPanelHistoryGesture,
    clearPanelHistoryEphemera,
    commitPanelHistorySnapshotTransition,
    finalizePanelHistoryGesture,
    queuePanelHistoryBaseline,
    queuePanelHistoryBaselineFromCurrent,
    rebasePanelHistoryLayerImage,
    clearPendingPanelHistoryBaseline,
    handleUndoPanelHistoryAction,
    handleRedoPanelHistoryAction,
  };
}
