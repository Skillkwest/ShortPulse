import React from "react";

import { clearWindowAnimationFrameRef, clearWindowTimeoutRef } from "./expertEditInteractionUtils";
import { collectOwnedLayerImageUrls, type ExpertEditLayer } from "./expertEditLayerSessionUtils";
import { type ExpertEditSessionState } from "./expertEditSessionState";
import {
  flushPendingPublishedSessionState,
  useExpertEditPublishedSessionSync,
} from "./useExpertEditPublishedSessionSync";
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
  suppressNextPrimaryPublishUrlRef: React.MutableRefObject<string | null>;
  removeBackgroundPendingSourceUrlRef: React.MutableRefObject<string | null>;
  setLayers: React.Dispatch<React.SetStateAction<ExpertEditLayer[]>>;
  rebasePanelHistoryLayerImage: (args: {
    layerId: string;
    previousImageUrl: string | null;
    nextImageUrl: string | null;
    ownsImageUrl: boolean;
  }) => void;
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
  suppressNextPrimaryPublishUrlRef,
  removeBackgroundPendingSourceUrlRef,
  setLayers,
  rebasePanelHistoryLayerImage,
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

  useExpertEditPublishedSessionSync({
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
  });

  useExpertEditSessionHostSync({
    selectedLayerIndex,
    layers,
    referenceImageUrl,
    hostPrimaryImageUrl,
    removeBackgroundPendingLayerId,
    previousLayersRef,
    foundationLayerId,
    lastDispatchedPrimaryRef,
    previousPrimaryPropRef,
    suppressNextPrimaryPublishUrlRef,
    removeBackgroundPendingSourceUrlRef,
    setLayers,
    rebasePanelHistoryLayerImage,
    clearRemoveBackgroundPending,
    onPrimaryImageChange,
    revokeObjectUrlSafe,
  });

  React.useEffect(
    () => () => {
      flushPendingPublishedSessionState({
        onSessionStateChange,
        pendingSessionStateRef,
        lastDispatchedSessionStateRef,
      });
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
