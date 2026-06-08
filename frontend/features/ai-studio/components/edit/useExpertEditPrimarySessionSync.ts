/**
 * Primary-image synchronization runtime for Expert Edit session hosting.
 * Owns host-to-layer primary image reconciliation and published-primary propagation back to the page host.
 */
import React from "react";

import { defaultLayerTransform } from "./expertEditLayerTransformUtils";
import {
  enforceLayerStackInvariants,
  isExpertEditImageUrl,
  resolveLayerIndexOrFallback,
  type ExpertEditLayer,
} from "./expertEditLayerSessionUtils";

type UseExpertEditPrimarySessionSyncArgs = {
  layers: ExpertEditLayer[];
  selectedLayerIndex: number | null;
  referenceImageUrl: string | null;
  hostPrimaryImageUrl: string | null;
  removeBackgroundPendingLayerId: string | null;
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
  onPrimaryImageChange: (url: string | null) => void;
};

/**
 * Keeps primary image authority synchronized between the page host and the Expert Edit layer stack.
 */
export function useExpertEditPrimarySessionSync({
  layers,
  selectedLayerIndex,
  referenceImageUrl,
  hostPrimaryImageUrl,
  removeBackgroundPendingLayerId,
  foundationLayerId,
  lastDispatchedPrimaryRef,
  previousPrimaryPropRef,
  suppressNextPrimaryPublishUrlRef,
  removeBackgroundPendingSourceUrlRef,
  setLayers,
  rebasePanelHistoryLayerImage,
  onPrimaryImageChange,
}: UseExpertEditPrimarySessionSyncArgs) {
  const normalizedReferenceImageUrl =
    isExpertEditImageUrl(referenceImageUrl) && typeof referenceImageUrl === "string"
      ? referenceImageUrl.trim()
      : null;
  const hasAppliedInitialPrimarySyncRef = React.useRef(false);

  React.useEffect(() => {
    const isInitialPrimarySync = !hasAppliedInitialPrimarySyncRef.current;
    if (!isInitialPrimarySync && previousPrimaryPropRef.current === normalizedReferenceImageUrl) {
      return;
    }
    hasAppliedInitialPrimarySyncRef.current = true;
    previousPrimaryPropRef.current = normalizedReferenceImageUrl;
    if (!isInitialPrimarySync && normalizedReferenceImageUrl === lastDispatchedPrimaryRef.current) {
      return;
    }

    if (!layers.length) {
      return;
    }
    const lockedRemoveBackgroundIndex = removeBackgroundPendingLayerId
      ? layers.findIndex((layer) => layer.id === removeBackgroundPendingLayerId)
      : -1;
    const foundationLayerIndex = foundationLayerId
      ? layers.findIndex((layer) => layer.id === foundationLayerId)
      : -1;
    const targetIndex =
      lockedRemoveBackgroundIndex >= 0
        ? lockedRemoveBackgroundIndex
        : foundationLayerIndex >= 0
          ? foundationLayerIndex
          : resolveLayerIndexOrFallback({
              selectedLayerIndex,
              layerCount: layers.length,
            });
    const targetLayer = layers[targetIndex];
    if (!targetLayer) {
      return;
    }
    if (targetLayer.imageUrl === normalizedReferenceImageUrl) {
      return;
    }
    const preserveLayerTransform = lockedRemoveBackgroundIndex >= 0;
    const nextLayers = [...layers];
    nextLayers[targetIndex] = {
      ...targetLayer,
      imageUrl: normalizedReferenceImageUrl,
      ownsImageUrl: false,
      transform: preserveLayerTransform ? targetLayer.transform : defaultLayerTransform(),
    };
    setLayers(
      enforceLayerStackInvariants({
        layers: nextLayers,
        foundationLayerId,
      })
    );
    const previousRemoveBackgroundSourceUrl = removeBackgroundPendingSourceUrlRef.current;
    if (
      lockedRemoveBackgroundIndex >= 0 &&
      previousRemoveBackgroundSourceUrl != null &&
      previousRemoveBackgroundSourceUrl !== normalizedReferenceImageUrl
    ) {
      rebasePanelHistoryLayerImage({
        layerId: targetLayer.id,
        previousImageUrl: previousRemoveBackgroundSourceUrl,
        nextImageUrl: normalizedReferenceImageUrl,
        ownsImageUrl: false,
      });
    }
  }, [
    foundationLayerId,
    lastDispatchedPrimaryRef,
    layers,
    previousPrimaryPropRef,
    rebasePanelHistoryLayerImage,
    removeBackgroundPendingLayerId,
    removeBackgroundPendingSourceUrlRef,
    selectedLayerIndex,
    setLayers,
    normalizedReferenceImageUrl,
  ]);

  React.useEffect(() => {
    if (lastDispatchedPrimaryRef.current === hostPrimaryImageUrl) return;
    if (
      suppressNextPrimaryPublishUrlRef.current != null &&
      suppressNextPrimaryPublishUrlRef.current === hostPrimaryImageUrl
    ) {
      suppressNextPrimaryPublishUrlRef.current = null;
      return;
    }
    lastDispatchedPrimaryRef.current = hostPrimaryImageUrl;
    onPrimaryImageChange(hostPrimaryImageUrl);
  }, [
    hostPrimaryImageUrl,
    lastDispatchedPrimaryRef,
    onPrimaryImageChange,
    suppressNextPrimaryPublishUrlRef,
  ]);
}
