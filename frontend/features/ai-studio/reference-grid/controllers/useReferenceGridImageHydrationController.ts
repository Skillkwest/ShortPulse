/**
 * Image hydration/decode runtime controller for Reference Grid.
 * Owns decode queueing, adaptive local transcode, stale-id pruning, and object URL cleanup.
 */
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { ReferenceGridPreviewQualityBand } from "../../logic/referenceGridMedia";
import { isVideoUrl } from "../../logic/stateParsers";
import type { StudioOutput } from "../../types";
import {
  logAdaptiveLocalTranscode,
  resolveAdaptivePolicyDecision,
  resolveAdaptiveSourceKind,
  shouldTranscodeLocalAdaptiveImage,
  transcodeLocalImageToObjectUrl,
} from "../../../../lib/adaptive-media";
import {
  hasAdaptiveQueryParams,
  isNextOptimizerUrl,
  resolveOptimizerSourceUrl,
} from "../logic/referenceGridMediaHelpers";

type HydratedImageEntry = {
  sourceUrl: string;
  renderUrl: string;
};

type ImageHydrationState = {
  hydratedById: Record<string, HydratedImageEntry>;
  queueSize: number;
  decodeInflight: number;
  optimizerFailoverBypassCount: number;
  optimizerFailoverErrorCount: number;
};

type EnqueueImageHydrationOptions = {
  priority?: "high" | "normal" | "low";
  targetLongEdgePx?: number;
  previewQualityBand?: ReferenceGridPreviewQualityBand;
  fallbackUrl?: string;
};

type UseReferenceGridImageHydrationControllerArgs = {
  decodeBudgetEnabled: boolean;
  suspendHydrationProcessing?: boolean;
  adaptivePreviewRoutingEnabled: boolean;
  imageDecodeBudget: number;
  activeOutputId: string | null;
  outputs: StudioOutput[];
  runNonUrgentUpdate: (updater: () => void) => void;
  liveWatchdogDegradeLevelRef: MutableRefObject<0 | 1 | 2>;
};

type UseReferenceGridImageHydrationControllerResult = {
  imageHydrationState: ImageHydrationState;
  enqueueImageHydration: (id: string, url: string, options?: EnqueueImageHydrationOptions) => void;
  pruneHydrationQueueToCandidateIds: (candidateIdSet: Set<string>) => void;
};

const MAX_FAILED_OPTIMIZER_SOURCE_CACHE_SIZE = 256;

export const useReferenceGridImageHydrationController = ({
  decodeBudgetEnabled,
  suspendHydrationProcessing = false,
  adaptivePreviewRoutingEnabled,
  imageDecodeBudget,
  activeOutputId,
  outputs,
  runNonUrgentUpdate,
  liveWatchdogDegradeLevelRef,
}: UseReferenceGridImageHydrationControllerArgs): UseReferenceGridImageHydrationControllerResult => {
  const [imageHydrationState, setImageHydrationState] = useState<ImageHydrationState>({
    hydratedById: {},
    queueSize: 0,
    decodeInflight: 0,
    optimizerFailoverBypassCount: 0,
    optimizerFailoverErrorCount: 0,
  });
  const hydrationQueueRef = useRef<string[]>([]);
  const hydrationQueuedIdSetRef = useRef<Set<string>>(new Set());
  const hydrationInflightIdSetRef = useRef<Set<string>>(new Set());
  const hydrationUrlByIdRef = useRef<Record<string, string>>({});
  const hydrationFallbackUrlByIdRef = useRef<Record<string, string>>({});
  const hydrationFailedOptimizedUrlByIdRef = useRef<Record<string, string>>({});
  const hydrationBypassCountedOptimizedUrlByIdRef = useRef<Record<string, string>>({});
  const hydrationFailedOptimizerSourceSetRef = useRef<Set<string>>(new Set());
  const hydrationPreviewMetaByIdRef = useRef<
    Record<
      string,
      {
        targetLongEdgePx: number;
        previewQualityBand: ReferenceGridPreviewQualityBand;
      }
    >
  >({});
  const hydrationGeneratedObjectUrlByIdRef = useRef<Record<string, string>>({});
  const hydrationHydratedByIdRef = useRef<Record<string, HydratedImageEntry>>({});
  const hydrationQueueSizeRef = useRef(0);
  const hydrationDecodeInflightRef = useRef(0);
  const hydrationRafFlushRef = useRef<number | null>(null);
  const hydrationPendingLoadedRef = useRef<Record<string, HydratedImageEntry>>({});
  const processHydrationQueueRef = useRef<() => void>(() => {});
  const validOutputIdSetRef = useRef<Set<string>>(new Set(outputs.map((output) => output.id)));

  const recordOptimizerFailoverBypass = useCallback(() => {
    runNonUrgentUpdate(() => {
      setImageHydrationState((prev) => ({
        ...prev,
        optimizerFailoverBypassCount: prev.optimizerFailoverBypassCount + 1,
      }));
    });
  }, [runNonUrgentUpdate]);

  const recordOptimizerFailoverError = useCallback(() => {
    runNonUrgentUpdate(() => {
      setImageHydrationState((prev) => ({
        ...prev,
        optimizerFailoverErrorCount: prev.optimizerFailoverErrorCount + 1,
      }));
    });
  }, [runNonUrgentUpdate]);

  const rememberFailedOptimizerSource = useCallback((sourceUrl: string) => {
    const cache = hydrationFailedOptimizerSourceSetRef.current;
    if (cache.has(sourceUrl)) return;
    if (cache.size >= MAX_FAILED_OPTIMIZER_SOURCE_CACHE_SIZE) {
      const oldest = cache.values().next().value;
      if (typeof oldest === "string") {
        cache.delete(oldest);
      }
    }
    cache.add(sourceUrl);
  }, []);

  const revokeGeneratedHydrationUrl = useCallback((id: string) => {
    const existing = hydrationGeneratedObjectUrlByIdRef.current[id];
    if (!existing) return;
    URL.revokeObjectURL(existing);
    delete hydrationGeneratedObjectUrlByIdRef.current[id];
  }, []);

  const maybeCreateLocalAdaptivePreviewUrl = useCallback(
    async (id: string, sourceUrl: string, image: HTMLImageElement): Promise<string> => {
      if (!adaptivePreviewRoutingEnabled) return sourceUrl;
      if (hasAdaptiveQueryParams(sourceUrl) || isNextOptimizerUrl(sourceUrl)) return sourceUrl;
      if (isVideoUrl(sourceUrl)) return sourceUrl;
      const previewMeta = hydrationPreviewMetaByIdRef.current[id];
      if (!previewMeta) return sourceUrl;
      const naturalWidth = image.naturalWidth;
      const naturalHeight = image.naturalHeight;
      if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight)) {
        return sourceUrl;
      }
      if (naturalWidth <= 0 || naturalHeight <= 0) return sourceUrl;
      const decision = resolveAdaptivePolicyDecision({
        surface: "reference-grid",
        mediaKind: "image",
        source: resolveAdaptiveSourceKind(sourceUrl),
        urls: {
          previewUrl: sourceUrl,
        },
        storage: {},
        pressureLevel: liveWatchdogDegradeLevelRef.current,
        cardLongEdgePx: previewMeta.targetLongEdgePx,
        devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        adaptivePreviewQuality: true,
      });
      if (
        !shouldTranscodeLocalAdaptiveImage({
          sourceUrl,
          naturalWidth,
          naturalHeight,
          decision,
        })
      ) {
        return sourceUrl;
      }
      const objectUrl = await transcodeLocalImageToObjectUrl({ image, decision });
      if (!objectUrl) return sourceUrl;
      const previousUrl = hydrationGeneratedObjectUrlByIdRef.current[id];
      if (previousUrl && previousUrl !== objectUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      hydrationGeneratedObjectUrlByIdRef.current[id] = objectUrl;
      logAdaptiveLocalTranscode({
        surface: "reference-grid",
        pressureLevel: liveWatchdogDegradeLevelRef.current,
        qualityBand: decision.qualityBand,
        targetLongEdgePx: decision.targetLongEdgePx,
      });
      return objectUrl;
    },
    [adaptivePreviewRoutingEnabled, liveWatchdogDegradeLevelRef]
  );

  const syncImageHydrationState = useCallback(() => {
    const nextQueueSize = hydrationQueueRef.current.length;
    const nextInflight = hydrationInflightIdSetRef.current.size;
    if (
      hydrationQueueSizeRef.current === nextQueueSize &&
      hydrationDecodeInflightRef.current === nextInflight
    ) {
      return;
    }
    hydrationQueueSizeRef.current = nextQueueSize;
    hydrationDecodeInflightRef.current = nextInflight;
    runNonUrgentUpdate(() => {
      setImageHydrationState((prev) => {
        if (prev.queueSize === nextQueueSize && prev.decodeInflight === nextInflight) return prev;
        return {
          ...prev,
          queueSize: nextQueueSize,
          decodeInflight: nextInflight,
        };
      });
    });
  }, [runNonUrgentUpdate]);

  useEffect(() => {
    hydrationHydratedByIdRef.current = imageHydrationState.hydratedById;
    hydrationQueueSizeRef.current = imageHydrationState.queueSize;
    hydrationDecodeInflightRef.current = imageHydrationState.decodeInflight;
  }, [
    imageHydrationState.decodeInflight,
    imageHydrationState.hydratedById,
    imageHydrationState.queueSize,
  ]);

  const flushHydratedImages = useCallback(() => {
    hydrationRafFlushRef.current = null;
    const pending = hydrationPendingLoadedRef.current;
    hydrationPendingLoadedRef.current = {};
    if (!Object.keys(pending).length) {
      syncImageHydrationState();
      return;
    }
    runNonUrgentUpdate(() => {
      const nextQueueSize = hydrationQueueRef.current.length;
      const nextInflight = hydrationInflightIdSetRef.current.size;
      hydrationQueueSizeRef.current = nextQueueSize;
      hydrationDecodeInflightRef.current = nextInflight;
      setImageHydrationState((prev) => {
        let hydratedChanged = false;
        const nextHydratedById = { ...prev.hydratedById };
        Object.entries(pending).forEach(([id, hydrated]) => {
          const existing = prev.hydratedById[id];
          if (
            existing?.sourceUrl === hydrated.sourceUrl &&
            existing?.renderUrl === hydrated.renderUrl
          ) {
            return;
          }
          hydratedChanged = true;
          nextHydratedById[id] = hydrated;
        });
        if (
          !hydratedChanged &&
          prev.queueSize === nextQueueSize &&
          prev.decodeInflight === nextInflight
        ) {
          return prev;
        }
        return {
          ...prev,
          hydratedById: hydratedChanged ? nextHydratedById : prev.hydratedById,
          queueSize: nextQueueSize,
          decodeInflight: nextInflight,
        };
      });
    });
  }, [runNonUrgentUpdate, syncImageHydrationState]);

  const scheduleHydrationFlush = useCallback(() => {
    if (hydrationRafFlushRef.current != null) return;
    if (typeof window === "undefined") return;
    hydrationRafFlushRef.current = window.requestAnimationFrame(() => {
      flushHydratedImages();
    });
  }, [flushHydratedImages]);

  const pruneStaleHydrationWork = useCallback(
    (validOutputIds: Set<string>) => {
      const currentQueue = hydrationQueueRef.current;
      const nextQueue = currentQueue.filter((id) => validOutputIds.has(id));
      const queueChanged =
        nextQueue.length !== currentQueue.length ||
        nextQueue.some((id, index) => currentQueue[index] !== id);
      if (queueChanged) {
        hydrationQueueRef.current = nextQueue;
        hydrationQueuedIdSetRef.current = new Set(nextQueue);
      }

      const currentInflight = hydrationInflightIdSetRef.current;
      let inflightChanged = false;
      currentInflight.forEach((id) => {
        if (validOutputIds.has(id)) return;
        currentInflight.delete(id);
        inflightChanged = true;
      });

      const pendingLoaded = hydrationPendingLoadedRef.current;
      let pendingChanged = false;
      Object.keys(pendingLoaded).forEach((id) => {
        if (validOutputIds.has(id)) return;
        delete pendingLoaded[id];
        pendingChanged = true;
      });

      if (queueChanged || inflightChanged || pendingChanged) {
        syncImageHydrationState();
      }
    },
    [syncImageHydrationState]
  );

  const processHydrationQueue = useCallback(() => {
    if (!decodeBudgetEnabled || typeof window === "undefined") return;
    if (suspendHydrationProcessing) {
      syncImageHydrationState();
      return;
    }
    const maxInflight = imageDecodeBudget;
    while (
      hydrationInflightIdSetRef.current.size < maxInflight &&
      hydrationQueueRef.current.length > 0
    ) {
      const nextId = hydrationQueueRef.current.shift();
      if (!nextId) continue;
      hydrationQueuedIdSetRef.current.delete(nextId);
      const nextUrl = hydrationUrlByIdRef.current[nextId];
      if (!nextUrl) continue;
      const fallbackUrl = hydrationFallbackUrlByIdRef.current[nextId];

      hydrationInflightIdSetRef.current.add(nextId);
      const image = new Image();
      image.decoding = "async";
      const shouldPrioritize = nextId === activeOutputId;
      try {
        (image as HTMLImageElement & { fetchPriority?: "high" | "low" | "auto" }).fetchPriority =
          shouldPrioritize ? "high" : "low";
      } catch {
        // Keep compatibility with runtimes that do not expose fetchPriority.
      }
      const finalize = (sourceUrl: string, renderUrl: string) => {
        hydrationInflightIdSetRef.current.delete(nextId);
        if (!validOutputIdSetRef.current.has(nextId)) {
          delete hydrationPendingLoadedRef.current[nextId];
          revokeGeneratedHydrationUrl(nextId);
          syncImageHydrationState();
          processHydrationQueueRef.current();
          return;
        }
        hydrationPendingLoadedRef.current[nextId] = {
          sourceUrl,
          renderUrl,
        };
        scheduleHydrationFlush();
        processHydrationQueueRef.current();
      };
      image.onload = () => {
        if (hydrationFailedOptimizedUrlByIdRef.current[nextId] === nextUrl) {
          delete hydrationFailedOptimizedUrlByIdRef.current[nextId];
        }
        void (async () => {
          const renderUrl = await maybeCreateLocalAdaptivePreviewUrl(nextId, nextUrl, image).catch(
            () => nextUrl
          );
          finalize(nextUrl, renderUrl);
        })();
      };
      image.onerror = () => {
        const resolvedFallback = fallbackUrl && fallbackUrl !== nextUrl ? fallbackUrl : nextUrl;
        if (isNextOptimizerUrl(nextUrl)) {
          hydrationFailedOptimizedUrlByIdRef.current[nextId] = nextUrl;
          const optimizerSourceUrl = resolveOptimizerSourceUrl(nextUrl);
          if (optimizerSourceUrl) {
            rememberFailedOptimizerSource(optimizerSourceUrl);
          }
          recordOptimizerFailoverError();
          if (resolvedFallback !== nextUrl) {
            hydrationUrlByIdRef.current[nextId] = resolvedFallback;
          }
        }
        finalize(resolvedFallback, resolvedFallback);
      };
      image.src = nextUrl;
    }
    syncImageHydrationState();
  }, [
    activeOutputId,
    decodeBudgetEnabled,
    imageDecodeBudget,
    maybeCreateLocalAdaptivePreviewUrl,
    recordOptimizerFailoverError,
    rememberFailedOptimizerSource,
    scheduleHydrationFlush,
    suspendHydrationProcessing,
    syncImageHydrationState,
  ]);

  const enqueueImageHydration = useCallback(
    (id: string, url: string, options?: EnqueueImageHydrationOptions) => {
      if (!decodeBudgetEnabled) return;
      const previousUrl = hydrationUrlByIdRef.current[id];
      if (typeof options?.targetLongEdgePx === "number" && options.previewQualityBand) {
        hydrationPreviewMetaByIdRef.current[id] = {
          targetLongEdgePx: options.targetLongEdgePx,
          previewQualityBand: options.previewQualityBand,
        };
      }
      if (typeof options?.fallbackUrl === "string" && options.fallbackUrl.length > 0) {
        hydrationFallbackUrlByIdRef.current[id] = options.fallbackUrl;
      }
      const fallbackUrl = hydrationFallbackUrlByIdRef.current[id];
      const optimizerSourceUrl = resolveOptimizerSourceUrl(url);
      const hasFailedOptimizerSource =
        typeof optimizerSourceUrl === "string" &&
        hydrationFailedOptimizerSourceSetRef.current.has(optimizerSourceUrl);
      const shouldBypassBySourceCache =
        isNextOptimizerUrl(url) &&
        hasFailedOptimizerSource &&
        typeof fallbackUrl === "string" &&
        fallbackUrl.length > 0 &&
        fallbackUrl !== url;
      const shouldBypassOptimizedUrl =
        shouldBypassBySourceCache ||
        (isNextOptimizerUrl(url) &&
          hydrationFailedOptimizedUrlByIdRef.current[id] === url &&
          typeof fallbackUrl === "string" &&
          fallbackUrl.length > 0);
      if (shouldBypassBySourceCache) {
        hydrationFailedOptimizedUrlByIdRef.current[id] = url;
        if (hydrationBypassCountedOptimizedUrlByIdRef.current[id] !== url) {
          hydrationBypassCountedOptimizedUrlByIdRef.current[id] = url;
          recordOptimizerFailoverBypass();
        }
      }
      const nextHydrationUrl =
        shouldBypassOptimizedUrl && typeof fallbackUrl === "string" ? fallbackUrl : url;
      hydrationUrlByIdRef.current[id] = nextHydrationUrl;
      if (
        hydrationFailedOptimizedUrlByIdRef.current[id] &&
        hydrationFailedOptimizedUrlByIdRef.current[id] !== url
      ) {
        delete hydrationFailedOptimizedUrlByIdRef.current[id];
      }
      if (
        hydrationBypassCountedOptimizedUrlByIdRef.current[id] &&
        hydrationBypassCountedOptimizedUrlByIdRef.current[id] !== url
      ) {
        delete hydrationBypassCountedOptimizedUrlByIdRef.current[id];
      }
      if (previousUrl && previousUrl !== nextHydrationUrl) {
        revokeGeneratedHydrationUrl(id);
      }
      const pendingHydratedEntry = hydrationPendingLoadedRef.current[id];
      if (pendingHydratedEntry?.sourceUrl === nextHydrationUrl) return;
      const hydratedEntry = hydrationHydratedByIdRef.current[id];
      if (hydratedEntry?.sourceUrl === nextHydrationUrl) return;
      if (hydrationInflightIdSetRef.current.has(id)) return;
      const priority = options?.priority ?? "normal";
      if (hydrationQueuedIdSetRef.current.has(id)) {
        if (priority === "high") {
          const currentIndex = hydrationQueueRef.current.indexOf(id);
          if (currentIndex > 0) {
            hydrationQueueRef.current.splice(currentIndex, 1);
            hydrationQueueRef.current.unshift(id);
            syncImageHydrationState();
            processHydrationQueue();
          }
        }
        return;
      }
      hydrationQueuedIdSetRef.current.add(id);
      if (priority === "high") {
        hydrationQueueRef.current.unshift(id);
      } else {
        hydrationQueueRef.current.push(id);
      }
      syncImageHydrationState();
      processHydrationQueue();
    },
    [
      decodeBudgetEnabled,
      processHydrationQueue,
      recordOptimizerFailoverBypass,
      revokeGeneratedHydrationUrl,
      syncImageHydrationState,
    ]
  );

  const pruneHydrationQueueToCandidateIds = useCallback(
    (candidateIdSet: Set<string>) => {
      const currentQueue = hydrationQueueRef.current;
      const nextQueue = currentQueue.filter((id) => candidateIdSet.has(id));
      const queueChanged =
        nextQueue.length !== currentQueue.length ||
        nextQueue.some((id, index) => currentQueue[index] !== id);
      if (!queueChanged) return;
      hydrationQueueRef.current = nextQueue;
      hydrationQueuedIdSetRef.current = new Set(nextQueue);
      syncImageHydrationState();
      processHydrationQueue();
    },
    [processHydrationQueue, syncImageHydrationState]
  );

  useEffect(() => {
    processHydrationQueueRef.current = processHydrationQueue;
  }, [processHydrationQueue]);

  useEffect(() => {
    if (!decodeBudgetEnabled) return;
    if (suspendHydrationProcessing) return;
    processHydrationQueue();
  }, [decodeBudgetEnabled, processHydrationQueue, suspendHydrationProcessing]);

  useEffect(() => {
    if (!decodeBudgetEnabled) return;
    validOutputIdSetRef.current = new Set(outputs.map((output) => output.id));
    const validOutputIds = new Set(outputs.map((output) => output.id));
    pruneStaleHydrationWork(validOutputIds);
    Object.keys(hydrationGeneratedObjectUrlByIdRef.current).forEach((id) => {
      if (validOutputIds.has(id)) return;
      revokeGeneratedHydrationUrl(id);
    });
    Object.keys(hydrationPreviewMetaByIdRef.current).forEach((id) => {
      if (validOutputIds.has(id)) return;
      delete hydrationPreviewMetaByIdRef.current[id];
    });
    Object.keys(hydrationUrlByIdRef.current).forEach((id) => {
      if (validOutputIds.has(id)) return;
      delete hydrationUrlByIdRef.current[id];
    });
    Object.keys(hydrationFallbackUrlByIdRef.current).forEach((id) => {
      if (validOutputIds.has(id)) return;
      delete hydrationFallbackUrlByIdRef.current[id];
    });
    Object.keys(hydrationFailedOptimizedUrlByIdRef.current).forEach((id) => {
      if (validOutputIds.has(id)) return;
      delete hydrationFailedOptimizedUrlByIdRef.current[id];
    });
    Object.keys(hydrationBypassCountedOptimizedUrlByIdRef.current).forEach((id) => {
      if (validOutputIds.has(id)) return;
      delete hydrationBypassCountedOptimizedUrlByIdRef.current[id];
    });

    const hasStaleHydratedIds = Object.keys(hydrationHydratedByIdRef.current).some(
      (id) => !validOutputIds.has(id)
    );
    if (!hasStaleHydratedIds) return;

    runNonUrgentUpdate(() => {
      setImageHydrationState((prev) => {
        let changed = false;
        const nextHydratedById = Object.fromEntries(
          Object.entries(prev.hydratedById).filter(([id]) => {
            const keep = validOutputIds.has(id);
            if (!keep) changed = true;
            return keep;
          })
        );
        if (!changed) return prev;
        return {
          ...prev,
          hydratedById: nextHydratedById,
        };
      });
    });
  }, [
    decodeBudgetEnabled,
    outputs,
    pruneStaleHydrationWork,
    revokeGeneratedHydrationUrl,
    runNonUrgentUpdate,
  ]);

  useEffect(
    () => () => {
      if (hydrationRafFlushRef.current != null && typeof window !== "undefined") {
        window.cancelAnimationFrame(hydrationRafFlushRef.current);
        hydrationRafFlushRef.current = null;
      }
      Object.keys(hydrationGeneratedObjectUrlByIdRef.current).forEach((id) => {
        revokeGeneratedHydrationUrl(id);
      });
    },
    [revokeGeneratedHydrationUrl]
  );

  return {
    imageHydrationState,
    enqueueImageHydration,
    pruneHydrationQueueToCandidateIds,
  };
};
