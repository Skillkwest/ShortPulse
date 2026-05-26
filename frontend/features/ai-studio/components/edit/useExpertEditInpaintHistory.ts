/**
 * Inpaint history ownership for Expert Edit.
 * Isolates mask-history state, snapshot restoration, gesture baselines, and undo/redo.
 */
import React from "react";

import type { InpaintHistoryState } from "./expertEditPanelViewContract";
import { areInpaintMaskSnapshotsEqual, type InpaintMaskSnapshot } from "./useInpaintMaskController";
import { cloneInpaintHistoryState, cloneInpaintMaskSnapshot } from "./expertEditSessionState";

type UseExpertEditInpaintHistoryArgs = {
  initialInpaintHistoryState: InpaintHistoryState;
  initialInpaintPresentSnapshot: InpaintMaskSnapshot;
  inpaintLayerSources: Array<{ id: string; imageUrl: string | null }>;
  captureInpaintMaskSnapshot: () => InpaintMaskSnapshot;
  restoreInpaintMaskSnapshot: (snapshot: InpaintMaskSnapshot) => void;
  clearSelectedLayerMask: () => void;
  invertSelectedLayerMask: () => void;
  clearAllInpaintMasks: () => void;
  beginPanelHistoryGesture: () => void;
  finalizePanelHistoryGesture: () => void;
  queuePanelHistoryBaselineFromCurrent: () => void;
};

/**
 * Returns the inpaint-only history domain for mask edits.
 */
export function useExpertEditInpaintHistory({
  initialInpaintHistoryState,
  initialInpaintPresentSnapshot,
  inpaintLayerSources,
  captureInpaintMaskSnapshot,
  restoreInpaintMaskSnapshot,
  clearSelectedLayerMask,
  invertSelectedLayerMask,
  clearAllInpaintMasks,
  beginPanelHistoryGesture,
  finalizePanelHistoryGesture,
  queuePanelHistoryBaselineFromCurrent,
}: UseExpertEditInpaintHistoryArgs) {
  const inpaintGestureBaselineRef = React.useRef<InpaintMaskSnapshot | null>(null);
  const pendingInpaintHistoryApplyRef = React.useRef<InpaintMaskSnapshot | null>(null);
  const inpaintSessionRestorePendingRef = React.useRef(
    initialInpaintPresentSnapshot.layers.length > 0
  );

  const [inpaintHistoryState, setInpaintHistoryState] = React.useState<InpaintHistoryState>(() =>
    cloneInpaintHistoryState(initialInpaintHistoryState)
  );

  const canUndoInpaintHistory = inpaintHistoryState.past.length > 0;
  const canRedoInpaintHistory = inpaintHistoryState.future.length > 0;

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
    const pendingEntry = pendingInpaintHistoryApplyRef.current;
    if (!pendingEntry) return;
    pendingInpaintHistoryApplyRef.current = null;
    restoreInpaintMaskSnapshot(pendingEntry);
  }, [inpaintHistoryState, restoreInpaintMaskSnapshot]);

  const commitInpaintHistoryTransition = React.useCallback(
    (nextEntry: InpaintMaskSnapshot, baselineEntry?: InpaintMaskSnapshot | null) => {
      setInpaintHistoryState((previousHistory) => {
        const previousEntry = baselineEntry ?? previousHistory.present;
        if (areInpaintMaskSnapshotsEqual(previousEntry, nextEntry)) {
          return previousHistory;
        }
        return {
          past: [...previousHistory.past, previousEntry],
          present: nextEntry,
          future: [],
        };
      });
    },
    []
  );

  const beginInpaintGestureHistory = React.useCallback(() => {
    beginPanelHistoryGesture();
    inpaintGestureBaselineRef.current = captureInpaintMaskSnapshot();
  }, [beginPanelHistoryGesture, captureInpaintMaskSnapshot]);

  const finalizeInpaintGestureHistory = React.useCallback(() => {
    const baselineEntry = inpaintGestureBaselineRef.current;
    if (!baselineEntry) return;
    inpaintGestureBaselineRef.current = null;
    const nextEntry = captureInpaintMaskSnapshot();
    commitInpaintHistoryTransition(nextEntry, baselineEntry);
    finalizePanelHistoryGesture();
  }, [captureInpaintMaskSnapshot, commitInpaintHistoryTransition, finalizePanelHistoryGesture]);

  const clearInpaintSelectionWithHistory = React.useCallback(() => {
    const baselineEntry = captureInpaintMaskSnapshot();
    queuePanelHistoryBaselineFromCurrent();
    clearSelectedLayerMask();
    const nextEntry = captureInpaintMaskSnapshot();
    commitInpaintHistoryTransition(nextEntry, baselineEntry);
  }, [
    captureInpaintMaskSnapshot,
    clearSelectedLayerMask,
    commitInpaintHistoryTransition,
    queuePanelHistoryBaselineFromCurrent,
  ]);

  const invertInpaintSelectionWithHistory = React.useCallback(() => {
    const baselineEntry = captureInpaintMaskSnapshot();
    queuePanelHistoryBaselineFromCurrent();
    invertSelectedLayerMask();
    const nextEntry = captureInpaintMaskSnapshot();
    commitInpaintHistoryTransition(nextEntry, baselineEntry);
  }, [
    captureInpaintMaskSnapshot,
    commitInpaintHistoryTransition,
    invertSelectedLayerMask,
    queuePanelHistoryBaselineFromCurrent,
  ]);

  const clearAllInpaintMasksWithHistory = React.useCallback(() => {
    const baselineEntry = captureInpaintMaskSnapshot();
    queuePanelHistoryBaselineFromCurrent();
    clearAllInpaintMasks();
    const nextEntry = captureInpaintMaskSnapshot();
    commitInpaintHistoryTransition(nextEntry, baselineEntry);
  }, [
    captureInpaintMaskSnapshot,
    clearAllInpaintMasks,
    commitInpaintHistoryTransition,
    queuePanelHistoryBaselineFromCurrent,
  ]);

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

  const clearInpaintHistoryEphemera = React.useCallback(() => {
    pendingInpaintHistoryApplyRef.current = null;
    inpaintGestureBaselineRef.current = null;
    inpaintSessionRestorePendingRef.current = false;
  }, []);

  return {
    inpaintHistoryState,
    canUndoInpaintHistory,
    canRedoInpaintHistory,
    beginInpaintGestureHistory,
    finalizeInpaintGestureHistory,
    clearInpaintSelectionWithHistory,
    invertInpaintSelectionWithHistory,
    clearAllInpaintMasksWithHistory,
    handleUndoInpaintAction,
    handleRedoInpaintAction,
    clearInpaintHistoryEphemera,
  };
}
