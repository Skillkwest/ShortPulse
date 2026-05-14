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
  selectedLayerIndex: number | null;
  referenceImageUrl: string | null;
  hostPrimaryImageUrl: string | null;
  removeBackgroundPendingLayerId: string | null;
  foundationLayerId: string | null;
  lastDispatchedPrimaryRef: React.MutableRefObject<string | null>;
  previousPrimaryPropRef: React.MutableRefObject<string | null>;
  setLayers: React.Dispatch<React.SetStateAction<ExpertEditLayer[]>>;
  onPrimaryImageChange: (url: string | null) => void;
};

/**
 * Keeps primary image authority synchronized between the page host and the Expert Edit layer stack.
 */
export function useExpertEditPrimarySessionSync({
  selectedLayerIndex,
  referenceImageUrl,
  hostPrimaryImageUrl,
  removeBackgroundPendingLayerId,
  foundationLayerId,
  lastDispatchedPrimaryRef,
  previousPrimaryPropRef,
  setLayers,
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

    setLayers((previous) => {
      if (!previous.length) return previous;
      const lockedRemoveBackgroundIndex = removeBackgroundPendingLayerId
        ? previous.findIndex((layer) => layer.id === removeBackgroundPendingLayerId)
        : -1;
      const foundationLayerIndex = foundationLayerId
        ? previous.findIndex((layer) => layer.id === foundationLayerId)
        : -1;
      const targetIndex =
        lockedRemoveBackgroundIndex >= 0
          ? lockedRemoveBackgroundIndex
          : foundationLayerIndex >= 0
            ? foundationLayerIndex
            : resolveLayerIndexOrFallback({
                selectedLayerIndex,
                layerCount: previous.length,
              });
      const targetLayer = previous[targetIndex];
      if (!targetLayer) return previous;
      if (targetLayer.imageUrl === normalizedReferenceImageUrl && !targetLayer.ownsImageUrl) {
        return previous;
      }
      const preserveLayerTransform = lockedRemoveBackgroundIndex >= 0;
      const nextLayers = [...previous];
      nextLayers[targetIndex] = {
        ...targetLayer,
        imageUrl: normalizedReferenceImageUrl,
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
    removeBackgroundPendingLayerId,
    selectedLayerIndex,
    setLayers,
    normalizedReferenceImageUrl,
  ]);

  React.useEffect(() => {
    if (lastDispatchedPrimaryRef.current === hostPrimaryImageUrl) return;
    lastDispatchedPrimaryRef.current = hostPrimaryImageUrl;
    onPrimaryImageChange(hostPrimaryImageUrl);
  }, [hostPrimaryImageUrl, lastDispatchedPrimaryRef, onPrimaryImageChange]);
}
