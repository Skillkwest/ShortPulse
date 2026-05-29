/**
 * Preview runtime owner for Reference Grid.
 * Consolidates hydration scheduling, image decode state, loaded-media bookkeeping,
 * and loading visual derivation behind one hook.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { ReferenceGridPreviewQualityBand } from "../../logic/referenceGridMedia";
import { incrementFreezeInvestigationCounter } from "../../logic/freezeInvestigationTelemetry";
import type { ReferenceGridMediaOutput } from "../logic/referenceGridMediaOutput";
import type { ReferenceGridVisibleCardItem } from "./useReferenceGridCardItemsController";
import type { ReferenceGridResolvedCardMedia } from "./useReferenceGridResolvedMediaController";
import { useReferenceGridHydrationQueueController } from "./useReferenceGridHydrationQueueController";
import { useReferenceGridImageHydrationController } from "./useReferenceGridImageHydrationController";

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
  const pendingLoadedMapIdsRef = useRef<Set<string>>(new Set());
  const pendingAnimationFrameIdsRef = useRef<number[]>([]);
  const loadedMapFlushScheduledRef = useRef(false);
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

  const flushPendingLoadedMap = useCallback(() => {
    loadedMapFlushScheduledRef.current = false;
    const pendingIds = Array.from(pendingLoadedMapIdsRef.current);
    pendingLoadedMapIdsRef.current.clear();
    if (!pendingIds.length) return;

    runNonUrgentUpdate(() => {
      setLoadedMap((prev) => {
        let next: Record<string, boolean> | null = null;
        pendingIds.forEach((id) => {
          if (prev[id]) return;
          next ??= { ...prev };
          next[id] = true;
        });
        if (!next) return prev;
        incrementFreezeInvestigationCounter("referenceGrid.loadedMap.commit");
        return next;
      });
    });
  }, [runNonUrgentUpdate]);

  const schedulePendingLoadedMapFlush = useCallback(
    (delayPaintFrames: number) => {
      if (loadedMapFlushScheduledRef.current) return;
      loadedMapFlushScheduledRef.current = true;
      if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
        flushPendingLoadedMap();
        return;
      }

      const scheduleFrame = (remainingFrames: number) => {
        const frameId = window.requestAnimationFrame(() => {
          pendingAnimationFrameIdsRef.current = pendingAnimationFrameIdsRef.current.filter(
            (pendingFrameId) => pendingFrameId !== frameId
          );
          if (remainingFrames <= 1) {
            flushPendingLoadedMap();
            return;
          }
          scheduleFrame(remainingFrames - 1);
        });
        pendingAnimationFrameIdsRef.current.push(frameId);
      };

      scheduleFrame(Math.max(1, delayPaintFrames));
    },
    [flushPendingLoadedMap]
  );

  const scheduleLoadedMapCommit = useCallback(
    (id: string) => {
      pendingLoadedMapIdsRef.current.add(id);
      const delayPaintFrames = stabilizeLoadingVisual ? 2 : 1;
      schedulePendingLoadedMapFlush(delayPaintFrames);
    },
    [schedulePendingLoadedMapFlush, stabilizeLoadingVisual]
  );

  const markLoaded = useCallback(
    (id: string, options?: { notifyAutoSave?: boolean }) => {
      const shouldNotify = options?.notifyAutoSave ?? true;
      if (loadedIdsRef.current.has(id)) return;
      loadedIdsRef.current.add(id);
      scheduleLoadedMapCommit(id);
      if (shouldNotify) {
        onOutputMediaLoaded?.(id);
      }
    },
    [onOutputMediaLoaded, scheduleLoadedMapCommit]
  );

  useEffect(
    () => () => {
      if (typeof window === "undefined" || typeof window.cancelAnimationFrame !== "function")
        return;
      pendingAnimationFrameIdsRef.current.forEach((frameId) => {
        window.cancelAnimationFrame(frameId);
      });
      pendingAnimationFrameIdsRef.current = [];
      pendingLoadedMapIdsRef.current.clear();
      loadedMapFlushScheduledRef.current = false;
    },
    []
  );

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
