/**
 * Markup history ownership for Expert Edit.
 * Isolates stroke-history state, gesture baselines, undo/redo, and pending snapshot application.
 */
import React from "react";

import type { MarkupHistoryState } from "./expertEditPanelViewContract";
import {
  areMarkupStrokeSnapshotsEqual,
  cloneMarkupHistoryState,
  cloneMarkupStrokesSnapshot,
} from "./expertEditSessionState";
import type { MarkupStroke } from "./markupStrokeController";

type UseExpertEditMarkupHistoryArgs = {
  initialMarkupHistoryState: MarkupHistoryState;
  markupStrokes: MarkupStroke[];
  setMarkupStrokes: React.Dispatch<React.SetStateAction<MarkupStroke[]>>;
  hasPrimaryCompositePreview: boolean;
};

/**
 * Returns the markup-only history domain for stroke edits.
 */
export function useExpertEditMarkupHistory({
  initialMarkupHistoryState,
  markupStrokes,
  setMarkupStrokes,
  hasPrimaryCompositePreview,
}: UseExpertEditMarkupHistoryArgs) {
  const markupGestureBaselineRef = React.useRef<MarkupStroke[] | null>(null);
  const pendingMarkupHistoryApplyRef = React.useRef<MarkupStroke[] | null>(null);

  const [markupHistoryState, setMarkupHistoryState] = React.useState<MarkupHistoryState>(() =>
    cloneMarkupHistoryState(initialMarkupHistoryState)
  );

  const canUndoMarkupHistory = markupHistoryState.past.length > 0;
  const canRedoMarkupHistory = markupHistoryState.future.length > 0;

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
    const pendingEntry = pendingMarkupHistoryApplyRef.current;
    if (!pendingEntry) return;
    pendingMarkupHistoryApplyRef.current = null;
    setMarkupStrokes(cloneMarkupStrokesSnapshot(pendingEntry));
  }, [markupHistoryState, setMarkupStrokes]);

  const commitMarkupHistoryTransition = React.useCallback(
    (nextEntry: MarkupStroke[], baselineEntry?: MarkupStroke[] | null) => {
      setMarkupHistoryState((previousHistory) => {
        const previousEntry = baselineEntry ?? previousHistory.present;
        if (areMarkupStrokeSnapshotsEqual(previousEntry, nextEntry)) {
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

  const clearMarkupHistoryEphemera = React.useCallback(() => {
    pendingMarkupHistoryApplyRef.current = null;
    markupGestureBaselineRef.current = null;
  }, []);

  return {
    markupHistoryState,
    canUndoMarkupHistory,
    canRedoMarkupHistory,
    beginMarkupGestureHistory,
    finalizeMarkupGestureHistory,
    clearMarkupStrokesWithHistory,
    handleUndoMarkupAction,
    handleRedoMarkupAction,
    clearMarkupHistoryEphemera,
  };
}
