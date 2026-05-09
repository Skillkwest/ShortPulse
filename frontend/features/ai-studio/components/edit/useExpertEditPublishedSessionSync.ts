/**
 * Published-session synchronization runtime for Expert Edit.
 * Owns snapshot building, throttled host publication, and the final pending-state flush helper.
 */
import React from "react";

import type { InpaintMaskSnapshot } from "./useInpaintMaskController";
import {
  cloneLayerForSessionState,
  resolveLayerIdCounterFromLayers,
  resolveLayerIndexOrNull,
  type ExpertEditLayer,
} from "./expertEditLayerSessionUtils";
import {
  EXPERT_EDIT_SESSION_STATE_VERSION,
  areExpertEditSessionStatesEqual,
  cloneExpertEditSessionState,
  cloneInpaintMaskSnapshot,
  cloneMarkupStrokesSnapshot,
  type ExpertEditSessionState,
} from "./expertEditSessionState";
import {
  clearWindowAnimationFrameRef,
  clearWindowTimeoutRef,
  scheduleWindowAnimationFrame,
} from "./expertEditInteractionUtils";
import type { MarkupStroke } from "./markupStrokeController";

const SESSION_STATE_DISPATCH_INTERVAL_MS = 300;

type UseExpertEditPublishedSessionSyncArgs = {
  foundationLayerId: string | null;
  selectedLayerIndex: number | null;
  layers: ExpertEditLayer[];
  markupStrokes: MarkupStroke[];
  inpaintSnapshot: InpaintMaskSnapshot;
  layerIdCounterRef: React.MutableRefObject<number>;
  lastDispatchedSessionStateRef: React.MutableRefObject<ExpertEditSessionState | null>;
  pendingSessionStateRef: React.MutableRefObject<ExpertEditSessionState | null>;
  sessionDispatchFrameRef: React.MutableRefObject<number | null>;
  sessionDispatchTimeoutRef: React.MutableRefObject<number | null>;
  lastSessionDispatchAtRef: React.MutableRefObject<number>;
  onSessionStateChange?: (nextState: ExpertEditSessionState) => void;
};

/**
 * Flushes any queued published session state to the host callback before teardown.
 */
export const flushPendingPublishedSessionState = ({
  onSessionStateChange,
  pendingSessionStateRef,
  lastDispatchedSessionStateRef,
}: {
  onSessionStateChange?: (nextState: ExpertEditSessionState) => void;
  pendingSessionStateRef: React.MutableRefObject<ExpertEditSessionState | null>;
  lastDispatchedSessionStateRef: React.MutableRefObject<ExpertEditSessionState | null>;
}) => {
  const pendingState = pendingSessionStateRef.current;
  const lastDispatchedState = lastDispatchedSessionStateRef.current;
  if (
    onSessionStateChange &&
    pendingState &&
    (!lastDispatchedState || !areExpertEditSessionStatesEqual(lastDispatchedState, pendingState))
  ) {
    const clonedState = cloneExpertEditSessionState(pendingState);
    lastDispatchedSessionStateRef.current = clonedState;
    onSessionStateChange(clonedState);
  }
  pendingSessionStateRef.current = null;
  lastDispatchedSessionStateRef.current = null;
};

/**
 * Publishes Expert Edit session snapshots to the host on a bounded cadence.
 */
export function useExpertEditPublishedSessionSync({
  foundationLayerId,
  selectedLayerIndex,
  layers,
  markupStrokes,
  inpaintSnapshot,
  layerIdCounterRef,
  lastDispatchedSessionStateRef,
  pendingSessionStateRef,
  sessionDispatchFrameRef,
  sessionDispatchTimeoutRef,
  lastSessionDispatchAtRef,
  onSessionStateChange,
}: UseExpertEditPublishedSessionSyncArgs) {
  const buildCurrentSessionState = React.useCallback((): ExpertEditSessionState => {
    const normalizedSelectedLayerIndex = resolveLayerIndexOrNull({
      selectedLayerIndex,
      layerCount: layers.length,
    });
    const normalizedLayerIdCounter = Math.max(
      layerIdCounterRef.current,
      resolveLayerIdCounterFromLayers(layers)
    );
    return {
      version: EXPERT_EDIT_SESSION_STATE_VERSION,
      layers: {
        layerIdCounter: normalizedLayerIdCounter,
        foundationLayerId,
        selectedLayerIndex: normalizedSelectedLayerIndex,
        layers: layers.map((layer) => cloneLayerForSessionState(layer)),
      },
      markup: {
        strokes: cloneMarkupStrokesSnapshot(markupStrokes),
      },
      inpaint: {
        snapshot: cloneInpaintMaskSnapshot(inpaintSnapshot),
      },
    };
  }, [
    foundationLayerId,
    inpaintSnapshot,
    layerIdCounterRef,
    layers,
    markupStrokes,
    selectedLayerIndex,
  ]);

  React.useEffect(() => {
    if (!onSessionStateChange) {
      pendingSessionStateRef.current = null;
      clearWindowAnimationFrameRef(sessionDispatchFrameRef);
      clearWindowTimeoutRef(sessionDispatchTimeoutRef);
      return;
    }
    const nextState = buildCurrentSessionState();
    const lastState = lastDispatchedSessionStateRef.current;
    if (lastState && areExpertEditSessionStatesEqual(lastState, nextState)) {
      return;
    }
    pendingSessionStateRef.current = nextState;
    const dispatch = () => {
      clearWindowAnimationFrameRef(sessionDispatchFrameRef);
      clearWindowTimeoutRef(sessionDispatchTimeoutRef);
      const pendingState = pendingSessionStateRef.current;
      pendingSessionStateRef.current = null;
      if (!pendingState) return;
      const previousState = lastDispatchedSessionStateRef.current;
      if (previousState && areExpertEditSessionStatesEqual(previousState, pendingState)) {
        return;
      }
      const clonedState = cloneExpertEditSessionState(pendingState);
      lastDispatchedSessionStateRef.current = clonedState;
      lastSessionDispatchAtRef.current = Date.now();
      onSessionStateChange(clonedState);
    };
    const msSinceLastDispatch = Date.now() - lastSessionDispatchAtRef.current;
    if (
      lastSessionDispatchAtRef.current <= 0 ||
      msSinceLastDispatch >= SESSION_STATE_DISPATCH_INTERVAL_MS
    ) {
      scheduleWindowAnimationFrame({
        frameRef: sessionDispatchFrameRef,
        callback: dispatch,
      });
      return;
    }
    if (sessionDispatchTimeoutRef.current != null) {
      return;
    }
    sessionDispatchTimeoutRef.current = window.setTimeout(
      () => {
        sessionDispatchTimeoutRef.current = null;
        dispatch();
      },
      Math.max(0, SESSION_STATE_DISPATCH_INTERVAL_MS - msSinceLastDispatch)
    );
  }, [
    buildCurrentSessionState,
    lastDispatchedSessionStateRef,
    lastSessionDispatchAtRef,
    onSessionStateChange,
    pendingSessionStateRef,
    sessionDispatchFrameRef,
    sessionDispatchTimeoutRef,
  ]);
}
