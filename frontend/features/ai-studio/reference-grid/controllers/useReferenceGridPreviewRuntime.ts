/**
 * Preview runtime owner for Reference Grid.
 * Consolidates hydration scheduling, image decode state, loaded-media bookkeeping,
 * and loading visual derivation behind one hook.
 */
import { useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { useReferenceGridImageHydrationController } from "./useReferenceGridImageHydrationController";
import { useReferenceGridLoadedMediaController } from "./useReferenceGridLoadedMediaController";

type UseReferenceGridPreviewRuntimeArgs = {
  decodeBudgetEnabled: boolean;
  suspendPreviewRuntime?: boolean;
  adaptivePreviewRoutingEnabled: boolean;
  imageDecodeBudget: number;
  activeOutputId: string | null;
  validOutputIds: string[];
  runNonUrgentUpdate: (updater: () => void) => void;
  liveWatchdogDegradeLevelRef: MutableRefObject<0 | 1 | 2>;
  onOutputMediaLoaded?: (id: string) => void;
  stabilizeLoadingVisual?: boolean;
};

/**
 * Returns the unified preview runtime contract used by ReferenceGrid.
 */
export const useReferenceGridPreviewRuntime = ({
  decodeBudgetEnabled,
  suspendPreviewRuntime = false,
  adaptivePreviewRoutingEnabled,
  imageDecodeBudget,
  activeOutputId,
  validOutputIds,
  runNonUrgentUpdate,
  liveWatchdogDegradeLevelRef,
  onOutputMediaLoaded,
  stabilizeLoadingVisual = false,
}: UseReferenceGridPreviewRuntimeArgs) => {
  const [loadedMap, setLoadedMap] = useState<Record<string, boolean>>({});
  const loadedIdsRef = useRef<Set<string>>(new Set());
  const { imageHydrationState, enqueueImageHydration, pruneHydrationQueueToCandidateIds } =
    useReferenceGridImageHydrationController({
      decodeBudgetEnabled,
      suspendHydrationProcessing: suspendPreviewRuntime,
      adaptivePreviewRoutingEnabled,
      imageDecodeBudget,
      activeOutputId,
      validOutputIds,
      runNonUrgentUpdate,
      liveWatchdogDegradeLevelRef,
    });

  const { markLoaded } = useReferenceGridLoadedMediaController({
    loadedIdsRef,
    setLoadedMap,
    runNonUrgentUpdate,
    onOutputMediaLoaded,
    stabilizeLoadingVisual,
  });

  return {
    imageHydrationState,
    loadedMap,
    markLoaded,
    enqueueImageHydration,
    pruneHydrationQueueToCandidateIds,
  };
};
