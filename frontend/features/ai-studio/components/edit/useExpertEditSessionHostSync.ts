import React from "react";

import {
  resolveStaleOwnedLayerImageUrls,
  type ExpertEditLayer,
} from "./expertEditLayerSessionUtils";
import { useExpertEditPrimarySessionSync } from "./useExpertEditPrimarySessionSync";
import { useExpertEditRemoveBackgroundPendingSync } from "./useExpertEditRemoveBackgroundPendingSync";

type UseExpertEditSessionHostSyncArgs = {
  selectedLayerIndex: number | null;
  layers: ExpertEditLayer[];
  referenceImageUrl: string | null;
  hostPrimaryImageUrl: string | null;
  removeBackgroundPendingLayerId: string | null;
  previousLayersRef: React.MutableRefObject<ExpertEditLayer[]>;
  foundationLayerId: string | null;
  lastDispatchedPrimaryRef: React.MutableRefObject<string | null>;
  previousPrimaryPropRef: React.MutableRefObject<string | null>;
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
  revokeObjectUrlSafe: (url: string) => void;
};

export function useExpertEditSessionHostSync({
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
}: UseExpertEditSessionHostSyncArgs) {
  useExpertEditPrimarySessionSync({
    selectedLayerIndex,
    referenceImageUrl,
    hostPrimaryImageUrl,
    removeBackgroundPendingLayerId,
    foundationLayerId,
    lastDispatchedPrimaryRef,
    previousPrimaryPropRef,
    suppressNextPrimaryPublishUrlRef,
    removeBackgroundPendingSourceUrlRef,
    layers,
    setLayers,
    rebasePanelHistoryLayerImage,
    onPrimaryImageChange,
  });

  useExpertEditRemoveBackgroundPendingSync({
    layers,
    removeBackgroundPendingLayerId,
    removeBackgroundPendingSourceUrlRef,
    clearRemoveBackgroundPending,
  });

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
}
