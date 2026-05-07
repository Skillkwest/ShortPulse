import React from "react";

import type { InpaintMaskSnapshot } from "./useInpaintMaskController";
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
  cloneInpaintMaskSnapshot,
  cloneMarkupStrokesSnapshot,
  type ExpertEditSessionState,
} from "./expertEditSessionState";
import {
  clearWindowTimeoutRef,
  clearWindowAnimationFrameRef,
  scheduleWindowAnimationFrame,
} from "./expertEditInteractionUtils";
import type { MarkupStroke } from "./markupStrokeController";

const SESSION_STATE_DISPATCH_INTERVAL_MS = 300;

type UseExpertEditSessionHostSyncArgs = {
  foundationLayerId: string | null;
  selectedLayerIndex: number | null;
  layers: ExpertEditLayer[];
  markupStrokes: MarkupStroke[];
  inpaintSnapshot: InpaintMaskSnapshot;
  referenceImageUrl: string | null;
  hostPrimaryImageUrl: string | null;
  removeBackgroundPendingLayerId: string | null;
  layerIdCounterRef: React.MutableRefObject<number>;
  previousLayersRef: React.MutableRefObject<ExpertEditLayer[]>;
  lastDispatchedSessionStateRef: React.MutableRefObject<ExpertEditSessionState | null>;
  pendingSessionStateRef: React.MutableRefObject<ExpertEditSessionState | null>;
  sessionDispatchFrameRef: React.MutableRefObject<number | null>;
  sessionDispatchTimeoutRef: React.MutableRefObject<number | null>;
  lastSessionDispatchAtRef: React.MutableRefObject<number>;
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
  inpaintSnapshot,
  referenceImageUrl,
  hostPrimaryImageUrl,
  removeBackgroundPendingLayerId,
  layerIdCounterRef,
  previousLayersRef,
  lastDispatchedSessionStateRef,
  pendingSessionStateRef,
  sessionDispatchFrameRef,
  sessionDispatchTimeoutRef,
  lastSessionDispatchAtRef,
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
