import React from "react";

import type { InpaintHistoryState, MarkupHistoryState } from "./expertEditPanelViewContract";
import { defaultLayerTransform } from "./expertEditLayerTransformUtils";
import {
  cloneLayerForSessionState,
  enforceLayerStackInvariants,
  resolveLayerIndexOrFallback,
  resolveLayerIndexOrNull,
  resolveLayerIdCounterFromLayers,
  resolveStaleOwnedLayerImageUrls,
  type ExpertEditLayer,
} from "./expertEditLayerSessionUtils";
import {
  EXPERT_EDIT_SESSION_STATE_VERSION,
  areExpertEditSessionStatesEqual,
  cloneExpertEditSessionState,
  cloneInpaintHistoryState,
  cloneMarkupHistoryState,
  cloneMarkupStrokesSnapshot,
  type ExpertEditSessionState,
} from "./expertEditSessionState";
import {
  clearWindowAnimationFrameRef,
  scheduleWindowAnimationFrame,
} from "./expertEditInteractionUtils";
import type { MarkupStroke } from "./markupStrokeController";

type UseExpertEditSessionHostSyncArgs = {
  foundationLayerId: string | null;
  selectedLayerIndex: number | null;
  layers: ExpertEditLayer[];
  markupStrokes: MarkupStroke[];
  markupHistoryState: MarkupHistoryState;
  inpaintHistoryState: InpaintHistoryState;
  referenceImageUrl: string | null;
  hostPrimaryImageUrl: string | null;
  removeBackgroundPendingLayerId: string | null;
  layerIdCounterRef: React.MutableRefObject<number>;
  previousLayersRef: React.MutableRefObject<ExpertEditLayer[]>;
  lastDispatchedSessionStateRef: React.MutableRefObject<ExpertEditSessionState | null>;
  pendingSessionStateRef: React.MutableRefObject<ExpertEditSessionState | null>;
  sessionDispatchFrameRef: React.MutableRefObject<number | null>;
  lastDispatchedPrimaryRef: React.MutableRefObject<string | null>;
  previousPrimaryPropRef: React.MutableRefObject<string | null>;
  removeBackgroundPendingSourceUrlRef: React.MutableRefObject<string | null>;
  setLayers: React.Dispatch<React.SetStateAction<ExpertEditLayer[]>>;
  clearRemoveBackgroundPending: () => void;
  onPrimaryImageChange: (url: string | null) => void;
  onSessionStateChange?: (nextState: ExpertEditSessionState) => void;
  revokeObjectUrlSafe: (url: string) => void;
};

export function useExpertEditSessionHostSync({
  foundationLayerId,
  selectedLayerIndex,
  layers,
  markupStrokes,
  markupHistoryState,
  inpaintHistoryState,
  referenceImageUrl,
  hostPrimaryImageUrl,
  removeBackgroundPendingLayerId,
  layerIdCounterRef,
  previousLayersRef,
  lastDispatchedSessionStateRef,
  pendingSessionStateRef,
  sessionDispatchFrameRef,
  lastDispatchedPrimaryRef,
  previousPrimaryPropRef,
  removeBackgroundPendingSourceUrlRef,
  setLayers,
  clearRemoveBackgroundPending,
  onPrimaryImageChange,
  onSessionStateChange,
  revokeObjectUrlSafe,
}: UseExpertEditSessionHostSyncArgs) {
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
        history: cloneMarkupHistoryState(markupHistoryState),
      },
      inpaint: {
        history: cloneInpaintHistoryState(inpaintHistoryState),
      },
    };
  }, [
    foundationLayerId,
    inpaintHistoryState,
    layerIdCounterRef,
    layers,
    markupHistoryState,
    markupStrokes,
    selectedLayerIndex,
  ]);

  React.useEffect(() => {
    if (!onSessionStateChange) {
      pendingSessionStateRef.current = null;
      clearWindowAnimationFrameRef(sessionDispatchFrameRef);
      return;
    }
    const nextState = buildCurrentSessionState();
    const lastState = lastDispatchedSessionStateRef.current;
    if (lastState && areExpertEditSessionStatesEqual(lastState, nextState)) {
      return;
    }
    pendingSessionStateRef.current = nextState;
    const dispatch = () => {
      const pendingState = pendingSessionStateRef.current;
      pendingSessionStateRef.current = null;
      if (!pendingState) return;
      const previousState = lastDispatchedSessionStateRef.current;
      if (previousState && areExpertEditSessionStatesEqual(previousState, pendingState)) {
        return;
      }
      const clonedState = cloneExpertEditSessionState(pendingState);
      lastDispatchedSessionStateRef.current = clonedState;
      onSessionStateChange(clonedState);
    };
    scheduleWindowAnimationFrame({
      frameRef: sessionDispatchFrameRef,
      callback: dispatch,
    });
  }, [
    buildCurrentSessionState,
    lastDispatchedSessionStateRef,
    onSessionStateChange,
    pendingSessionStateRef,
    sessionDispatchFrameRef,
  ]);

  React.useEffect(() => {
    const previousLayers = previousLayersRef.current;
    if (!previousLayers.length) {
      previousLayersRef.current = layers;
      return;
    }
    resolveStaleOwnedLayerImageUrls({
      previousLayers,
      activeLayers: layers,
    }).forEach((url) => {
      revokeObjectUrlSafe(url);
    });
    previousLayersRef.current = layers;
  }, [layers, previousLayersRef, revokeObjectUrlSafe]);

  React.useEffect(() => {
    if (previousPrimaryPropRef.current === referenceImageUrl) return;
    previousPrimaryPropRef.current = referenceImageUrl;
    if (referenceImageUrl === lastDispatchedPrimaryRef.current) return;

    setLayers((previous) => {
      if (!previous.length) return previous;
      const lockedRemoveBackgroundIndex = removeBackgroundPendingLayerId
        ? previous.findIndex((layer) => layer.id === removeBackgroundPendingLayerId)
        : -1;
      const targetIndex =
        lockedRemoveBackgroundIndex >= 0
          ? lockedRemoveBackgroundIndex
          : resolveLayerIndexOrFallback({
              selectedLayerIndex,
              layerCount: previous.length,
            });
      const targetLayer = previous[targetIndex];
      if (!targetLayer) return previous;
      if (targetLayer.imageUrl === referenceImageUrl && !targetLayer.ownsImageUrl) {
        return previous;
      }
      const preserveLayerTransform = lockedRemoveBackgroundIndex >= 0;
      const nextLayers = [...previous];
      nextLayers[targetIndex] = {
        ...targetLayer,
        imageUrl: referenceImageUrl,
        ownsImageUrl: false,
        transform: preserveLayerTransform ? targetLayer.transform : defaultLayerTransform(),
      };
      return enforceLayerStackInvariants({
        layers: nextLayers,
        foundationLayerId,
      });
    });
  }, [
    foundationLayerId,
    lastDispatchedPrimaryRef,
    previousPrimaryPropRef,
    referenceImageUrl,
    removeBackgroundPendingLayerId,
    selectedLayerIndex,
    setLayers,
  ]);

  React.useEffect(() => {
    if (!removeBackgroundPendingLayerId) return;
    const pendingLayer =
      layers.find((layer) => layer.id === removeBackgroundPendingLayerId) ?? null;
    if (!pendingLayer) {
      clearRemoveBackgroundPending();
      return;
    }
    const pendingSourceUrl = removeBackgroundPendingSourceUrlRef.current;
    if (
      typeof pendingLayer.imageUrl === "string" &&
      pendingLayer.imageUrl.length > 0 &&
      pendingLayer.imageUrl !== pendingSourceUrl
    ) {
      clearRemoveBackgroundPending();
    }
  }, [
    clearRemoveBackgroundPending,
    layers,
    removeBackgroundPendingLayerId,
    removeBackgroundPendingSourceUrlRef,
  ]);

  React.useEffect(() => {
    if (lastDispatchedPrimaryRef.current === hostPrimaryImageUrl) return;
    lastDispatchedPrimaryRef.current = hostPrimaryImageUrl;
    onPrimaryImageChange(hostPrimaryImageUrl);
  }, [hostPrimaryImageUrl, lastDispatchedPrimaryRef, onPrimaryImageChange]);
}
