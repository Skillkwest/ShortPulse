/**
 * Primary-image synchronization runtime for Expert Edit session hosting.
 * Owns host-to-layer primary image reconciliation and published-primary propagation back to the page host.
 */
import React from "react";

import { defaultLayerTransform } from "./expertEditLayerTransformUtils";
import {
  enforceLayerStackInvariants,
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
  React.useEffect(() => {
    if (previousPrimaryPropRef.current === referenceImageUrl) return;
    previousPrimaryPropRef.current = referenceImageUrl;
    if (referenceImageUrl === lastDispatchedPrimaryRef.current) return;

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
    if (lastDispatchedPrimaryRef.current === hostPrimaryImageUrl) return;
    lastDispatchedPrimaryRef.current = hostPrimaryImageUrl;
    onPrimaryImageChange(hostPrimaryImageUrl);
  }, [hostPrimaryImageUrl, lastDispatchedPrimaryRef, onPrimaryImageChange]);
}
