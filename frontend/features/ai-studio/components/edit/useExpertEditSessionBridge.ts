import React from "react";

import { clearWindowAnimationFrameRef } from "./expertEditInteractionUtils";
import { collectOwnedLayerImageUrls, type ExpertEditLayer } from "./expertEditLayerSessionUtils";
import type { InpaintHistoryState, MarkupHistoryState } from "./expertEditPanelViewContract";
import type { ExpertEditSessionState } from "./expertEditSessionState";
import { useExpertEditSessionHostSync } from "./useExpertEditSessionHostSync";
import type { MarkupStroke } from "./markupStrokeController";

type UseExpertEditSessionBridgeArgs = {
  initialReferenceImageUrl: string | null;
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
  markupHistoryState,
  inpaintHistoryState,
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
  const lastDispatchedPrimaryRef = React.useRef<string | null>(initialReferenceImageUrl);
  const previousPrimaryPropRef = React.useRef<string | null>(initialReferenceImageUrl);

  useExpertEditSessionHostSync({
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
  });

  React.useEffect(
    () => () => {
      pendingSessionStateRef.current = null;
      lastDispatchedSessionStateRef.current = null;
      clearWindowAnimationFrameRef(sessionDispatchFrameRef);
      if (!onSessionStateChange) {
        const ownedUrlsOnUnmount = collectOwnedLayerImageUrls(previousLayersRef.current);
        ownedUrlsOnUnmount.forEach((url) => revokeObjectUrlSafe(url));
      }
      previousLayersRef.current = [];
    },
    [onSessionStateChange, revokeObjectUrlSafe]
  );
}
