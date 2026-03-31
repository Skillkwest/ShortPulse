/**
 * Preview runtime owner for Reference Grid.
 * Consolidates hydration scheduling, image decode state, loaded-media bookkeeping,
 * and loading visual derivation behind one hook.
 */
import { useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { ReferenceGridPreviewQualityBand } from "../../logic/referenceGridMedia";
import type { ReferenceGridMediaOutput } from "../logic/referenceGridMediaOutput";
import type { ReferenceGridVisibleCardItem } from "./useReferenceGridCardItemsController";
import type { ReferenceGridResolvedCardMedia } from "./useReferenceGridResolvedMediaController";
import { useReferenceGridHydrationQueueController } from "./useReferenceGridHydrationQueueController";
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

type UseReferenceGridPreviewRuntimeSchedulingArgs = {
  decodeBudgetEnabled: boolean;
  suspendHydrationQueue?: boolean;
  activeOutput: ReferenceGridMediaOutput | null;
  visibleCardItems: ReferenceGridVisibleCardItem[];
  curatedVisibleCardItems: ReferenceGridVisibleCardItem[];
  hydrationQuickSlotPreferredIdSet: Set<string>;
  nearViewportOutputs: ReferenceGridMediaOutput[];
  nearViewportCuratedOutputs: ReferenceGridMediaOutput[];
  virtualRowHeight: number;
  curatedVirtualRowHeight: number;
  quickSlotAdaptiveSurfaceEnabled: boolean;
  resolveCardMedia: (args: {
    item: ReferenceGridMediaOutput;
    mediaSurface: "reference-grid" | "quick-slot";
    cardLongEdgePx: number;
  }) => ReferenceGridResolvedCardMedia;
  enqueueImageHydration: (
    id: string,
    url: string,
    options?: {
      priority?: "high" | "normal" | "low";
      mediaSurface?: "reference-grid" | "quick-slot";
      targetLongEdgePx?: number;
      previewQualityBand?: ReferenceGridPreviewQualityBand;
      fallbackUrl?: string;
    }
  ) => void;
  pruneHydrationQueueToCandidateIds: (candidateIdSet: Set<string>) => void;
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

/**
 * Co-locates hydration queue scheduling with the preview runtime boundary.
 * Visible-card derivation still lives outside this file for now, but the queue
 * orchestration no longer needs to be wired directly inside ReferenceGrid.
 */
export const useReferenceGridPreviewRuntimeScheduling = ({
  decodeBudgetEnabled,
  suspendHydrationQueue = false,
  activeOutput,
  visibleCardItems,
  curatedVisibleCardItems,
  hydrationQuickSlotPreferredIdSet,
  nearViewportOutputs,
  nearViewportCuratedOutputs,
  virtualRowHeight,
  curatedVirtualRowHeight,
  quickSlotAdaptiveSurfaceEnabled,
  resolveCardMedia,
  enqueueImageHydration,
  pruneHydrationQueueToCandidateIds,
}: UseReferenceGridPreviewRuntimeSchedulingArgs) => {
  useReferenceGridHydrationQueueController({
    decodeBudgetEnabled,
    suspendHydrationQueue,
    activeOutput,
    visibleCardItems,
    curatedVisibleCardItems,
    hydrationQuickSlotPreferredIdSet,
    nearViewportOutputs,
    nearViewportCuratedOutputs,
    virtualRowHeight,
    curatedVirtualRowHeight,
    quickSlotAdaptiveSurfaceEnabled,
    resolveCardMedia,
    enqueueImageHydration,
    pruneHydrationQueueToCandidateIds,
  });
};
