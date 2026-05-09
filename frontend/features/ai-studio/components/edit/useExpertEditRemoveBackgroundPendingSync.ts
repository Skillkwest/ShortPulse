/**
 * Remove-background pending reconciliation runtime for Expert Edit session hosting.
 * Owns cleanup of stale pending state once the targeted layer disappears or its image source changes.
 */
import React from "react";

import type { ExpertEditLayer } from "./expertEditLayerSessionUtils";

type UseExpertEditRemoveBackgroundPendingSyncArgs = {
  layers: ExpertEditLayer[];
  removeBackgroundPendingLayerId: string | null;
  removeBackgroundPendingSourceUrlRef: React.MutableRefObject<string | null>;
  clearRemoveBackgroundPending: () => void;
};

/**
 * Reconciles remove-background pending state against the current layer stack.
 */
export function useExpertEditRemoveBackgroundPendingSync({
  layers,
  removeBackgroundPendingLayerId,
  removeBackgroundPendingSourceUrlRef,
  clearRemoveBackgroundPending,
}: UseExpertEditRemoveBackgroundPendingSyncArgs) {
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
}
