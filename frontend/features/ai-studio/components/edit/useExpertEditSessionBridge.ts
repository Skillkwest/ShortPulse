import React from "react";

import { clearWindowAnimationFrameRef, clearWindowTimeoutRef } from "./expertEditInteractionUtils";
import { collectOwnedLayerImageUrls, type ExpertEditLayer } from "./expertEditLayerSessionUtils";
import {
  areExpertEditSessionStatesEqual,
  cloneExpertEditSessionState,
  type ExpertEditSessionState,
} from "./expertEditSessionState";
import { useExpertEditSessionHostSync } from "./useExpertEditSessionHostSync";
import type { MarkupStroke } from "./markupStrokeController";
import type { InpaintMaskSnapshot } from "./useInpaintMaskController";

type UseExpertEditSessionBridgeArgs = {
  initialReferenceImageUrl: string | null;
  foundationLayerId: string | null;
  selectedLayerIndex: number | null;
  layers: ExpertEditLayer[];
  markupStrokes: MarkupStroke[];
  inpaintSnapshot: InpaintMaskSnapshot;
  referenceImageUrl: string | null;
  hostPrimaryImageUrl: string | null;
  removeBackgroundPendingLayerId: string | null;
  layerIdCounterRef: React.MutableRefObject<number>;
  removeBackgroundPendingSourceUrlRef: React.MutableRefObject<string | null>;
  setLayers: React.Dispatch<React.SetStateAction<ExpertEditLayer[]>>;
  clearRemoveBackgroundPending: () => void;
  onPrimaryImageChange: (url: string | null) => void;
  onSessionStateChange?: (nextState: ExpertEditSessionState) => void;
  revokeObjectUrlSafe: (url: string) => void;
};

export function useExpertEditSessionBridge({
  initialReferenceImageUrl,
  foundationLayerId,
  selectedLayerIndex,
  layers,
  markupStrokes,
  inpaintSnapshot,
  referenceImageUrl,
  hostPrimaryImageUrl,
  removeBackgroundPendingLayerId,
  layerIdCounterRef,
  removeBackgroundPendingSourceUrlRef,
  setLayers,
  clearRemoveBackgroundPending,
  onPrimaryImageChange,
  onSessionStateChange,
  revokeObjectUrlSafe,
}: UseExpertEditSessionBridgeArgs) {
  const previousLayersRef = React.useRef<ExpertEditLayer[]>([]);
  const lastDispatchedSessionStateRef = React.useRef<ExpertEditSessionState | null>(null);
  const pendingSessionStateRef = React.useRef<ExpertEditSessionState | null>(null);
  const sessionDispatchFrameRef = React.useRef<number | null>(null);
  const sessionDispatchTimeoutRef = React.useRef<number | null>(null);
  const lastSessionDispatchAtRef = React.useRef(0);
  const lastDispatchedPrimaryRef = React.useRef<string | null>(initialReferenceImageUrl);
  const previousPrimaryPropRef = React.useRef<string | null>(initialReferenceImageUrl);

  useExpertEditSessionHostSync({
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
  });

  React.useEffect(
    () => () => {
      const pendingState = pendingSessionStateRef.current;
      const lastDispatchedState = lastDispatchedSessionStateRef.current;
      if (
        onSessionStateChange &&
        pendingState &&
        (!lastDispatchedState ||
          !areExpertEditSessionStatesEqual(lastDispatchedState, pendingState))
      ) {
        const clonedState = cloneExpertEditSessionState(pendingState);
        lastDispatchedSessionStateRef.current = clonedState;
        onSessionStateChange(clonedState);
      }
      pendingSessionStateRef.current = null;
      lastDispatchedSessionStateRef.current = null;
      clearWindowAnimationFrameRef(sessionDispatchFrameRef);
      clearWindowTimeoutRef(sessionDispatchTimeoutRef);
      if (!onSessionStateChange) {
        const ownedUrlsOnUnmount = collectOwnedLayerImageUrls(previousLayersRef.current);
        ownedUrlsOnUnmount.forEach((url) => revokeObjectUrlSafe(url));
      }
      previousLayersRef.current = [];
    },
    [onSessionStateChange, revokeObjectUrlSafe]
  );
}
