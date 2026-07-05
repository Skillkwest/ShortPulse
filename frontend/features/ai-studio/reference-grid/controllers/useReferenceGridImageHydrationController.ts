/**
 * Image hydration/decode runtime controller for Reference Grid.
 * Owns decode queueing, adaptive local transcode, stale-id pruning, and object URL cleanup.
 */
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { ReferenceGridPreviewQualityBand } from "../../logic/referenceGridMedia";
import { isVideoUrl } from "../../logic/stateParsers";
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
import { revokeRememberedObjectUrl } from "../../utils/objectUrlBlobRegistry";

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
  mediaSurface?: "reference-grid" | "quick-slot";
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
  validOutputIds: string[];
  runNonUrgentUpdate: (updater: () => void) => void;
  liveWatchdogDegradeLevelRef: MutableRefObject<0 | 1 | 2>;
};

type UseReferenceGridImageHydrationControllerResult = {
  imageHydrationState: ImageHydrationState;
  enqueueImageHydration: (id: string, url: string, options?: EnqueueImageHydrationOptions) => void;
  pruneHydrationQueueToCandidateIds: (candidateIdSet: Set<string>) => void;
};

const MAX_FAILED_OPTIMIZER_SOURCE_CACHE_SIZE = 256;
const MAX_FAILED_HYDRATION_URLS_PER_OUTPUT = 8;
export const REFERENCE_GRID_HYDRATED_IMAGE_ENTRY_LIMIT = 256;

export const useReferenceGridImageHydrationController = ({
  decodeBudgetEnabled,
  suspendHydrationProcessing = false,
  adaptivePreviewRoutingEnabled,
  imageDecodeBudget,
  activeOutputId,
  validOutputIds,
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
  const hydrationFailedImageUrlSetByIdRef = useRef<Record<string, Set<string>>>({});
  const hydrationFailedOptimizedUrlByIdRef = useRef<Record<string, string>>({});
  const hydrationBypassCountedOptimizedUrlByIdRef = useRef<Record<string, string>>({});
  const hydrationFailedOptimizerSourceSetRef = useRef<Set<string>>(new Set());
  const hydrationPreviewMetaByIdRef = useRef<
    Record<
      string,
      {
        mediaSurface: "reference-grid" | "quick-slot";
        targetLongEdgePx: number;
        previewQualityBand: ReferenceGridPreviewQualityBand;
      }
    >
  >({});
  const hydrationGeneratedObjectUrlByIdRef = useRef<Record<string, string>>({});
  const hydrationHydratedByIdRef = useRef<Record<string, HydratedImageEntry>>({});
  const hydrationHydratedEntryOrderRef = useRef<string[]>([]);
  const hydrationRetainedCandidateIdSetRef = useRef<Set<string>>(new Set());
  const hydrationQueueSizeRef = useRef(0);
  const hydrationDecodeInflightRef = useRef(0);
  const hydrationRafFlushRef = useRef<number | null>(null);
  const hydrationQueueWorkScheduledRef = useRef(false);
  const hydrationPendingLoadedRef = useRef<Record<string, HydratedImageEntry>>({});
  const processHydrationQueueRef = useRef<() => void>(() => {});
  const validOutputIdSetRef = useRef<Set<string>>(new Set(validOutputIds));

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

  const rememberFailedHydrationUrl = useCallback((id: string, url: string) => {
    let failedUrlSet = hydrationFailedImageUrlSetByIdRef.current[id];
    if (!failedUrlSet) {
      failedUrlSet = new Set();
      hydrationFailedImageUrlSetByIdRef.current[id] = failedUrlSet;
    }
    if (failedUrlSet.has(url)) return;
    if (failedUrlSet.size >= MAX_FAILED_HYDRATION_URLS_PER_OUTPUT) {
      const oldest = failedUrlSet.values().next().value;
      if (typeof oldest === "string") {
        failedUrlSet.delete(oldest);
      }
    }
    failedUrlSet.add(url);
  }, []);

  const forgetFailedHydrationUrl = useCallback((id: string, url: string) => {
    const failedUrlSet = hydrationFailedImageUrlSetByIdRef.current[id];
    if (!failedUrlSet?.has(url)) return;
    failedUrlSet.delete(url);
    if (failedUrlSet.size === 0) {
      delete hydrationFailedImageUrlSetByIdRef.current[id];
    }
  }, []);

  const revokeGeneratedHydrationUrl = useCallback((id: string) => {
    const existing = hydrationGeneratedObjectUrlByIdRef.current[id];
    if (!existing) return;
    revokeRememberedObjectUrl(existing);
    delete hydrationGeneratedObjectUrlByIdRef.current[id];
  }, []);

  const normalizeHydratedEntryOrder = useCallback(
    (hydratedById: Record<string, HydratedImageEntry>) => {
      const nextOrder = hydrationHydratedEntryOrderRef.current.filter((id) => hydratedById[id]);
      Object.keys(hydratedById).forEach((id) => {
        if (nextOrder.includes(id)) return;
        nextOrder.push(id);
      });
      hydrationHydratedEntryOrderRef.current = nextOrder;
      return nextOrder;
    },
    []
  );

  const touchHydratedEntry = useCallback((id: string) => {
    const order = hydrationHydratedEntryOrderRef.current;
    const currentIndex = order.indexOf(id);
    if (currentIndex >= 0) {
      order.splice(currentIndex, 1);
    }
    order.push(id);
  }, []);

  const limitHydratedEntries = useCallback(
    (
      hydratedById: Record<string, HydratedImageEntry>,
      retainedCandidateIds = hydrationRetainedCandidateIdSetRef.current
    ): Record<string, HydratedImageEntry> => {
      let nextHydratedById = hydratedById;
      const order = normalizeHydratedEntryOrder(hydratedById);
      const retainedIds = new Set(retainedCandidateIds);
      if (activeOutputId && validOutputIdSetRef.current.has(activeOutputId)) {
        retainedIds.add(activeOutputId);
      }
      let hydratedCount = Object.keys(nextHydratedById).length;
      while (hydratedCount > REFERENCE_GRID_HYDRATED_IMAGE_ENTRY_LIMIT && order.length > 0) {
        const evictionIndex = order.findIndex((id) => !retainedIds.has(id));
        if (evictionIndex < 0) break;
        const [evictedId] = order.splice(evictionIndex, 1);
        if (!evictedId || !nextHydratedById[evictedId]) continue;
        if (nextHydratedById === hydratedById) {
          nextHydratedById = { ...hydratedById };
        }
        delete nextHydratedById[evictedId];
        hydratedCount -= 1;
      }
      hydrationHydratedEntryOrderRef.current = order.filter((id) => nextHydratedById[id]);
      return nextHydratedById;
    },
    [activeOutputId, normalizeHydratedEntryOrder]
  );

  const applyHydratedEntryLimit = useCallback(
    (retainedCandidateIds = hydrationRetainedCandidateIdSetRef.current) => {
      const limitedHydratedById = limitHydratedEntries(
        hydrationHydratedByIdRef.current,
        retainedCandidateIds
      );
      if (limitedHydratedById === hydrationHydratedByIdRef.current) return;
      hydrationHydratedByIdRef.current = limitedHydratedById;
      runNonUrgentUpdate(() => {
        setImageHydrationState((prev) => {
          if (prev.hydratedById === limitedHydratedById) return prev;
          return {
            ...prev,
            hydratedById: limitedHydratedById,
          };
        });
      });
    },
    [limitHydratedEntries, runNonUrgentUpdate]
  );

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
        surface: previewMeta.mediaSurface,
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
        revokeRememberedObjectUrl(previousUrl);
      }
      hydrationGeneratedObjectUrlByIdRef.current[id] = objectUrl;
      logAdaptiveLocalTranscode({
        surface: previewMeta.mediaSurface,
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
        let nextHydratedById = prev.hydratedById;
        Object.entries(pending).forEach(([id, hydrated]) => {
          touchHydratedEntry(id);
          const existing = prev.hydratedById[id];
          if (
            existing?.sourceUrl === hydrated.sourceUrl &&
            existing?.renderUrl === hydrated.renderUrl
          ) {
            return;
          }
          hydratedChanged = true;
          if (nextHydratedById === prev.hydratedById) {
            nextHydratedById = { ...prev.hydratedById };
          }
          nextHydratedById[id] = hydrated;
        });
        const limitedHydratedById = limitHydratedEntries(nextHydratedById);
        const limitedHydratedChanged = hydratedChanged || limitedHydratedById !== nextHydratedById;
        if (
          !limitedHydratedChanged &&
          prev.queueSize === nextQueueSize &&
          prev.decodeInflight === nextInflight
        ) {
          return prev;
        }
        return {
          ...prev,
          hydratedById: limitedHydratedChanged ? limitedHydratedById : prev.hydratedById,
          queueSize: nextQueueSize,
          decodeInflight: nextInflight,
        };
      });
    });
  }, [limitHydratedEntries, runNonUrgentUpdate, syncImageHydrationState, touchHydratedEntry]);

  const scheduleHydrationFlush = useCallback(() => {
    if (hydrationRafFlushRef.current != null) return;
    if (typeof window === "undefined") return;
    hydrationRafFlushRef.current = window.requestAnimationFrame(() => {
      flushHydratedImages();
    });
  }, [flushHydratedImages]);

  const scheduleHydrationQueueWork = useCallback(() => {
    if (hydrationQueueWorkScheduledRef.current) return;
    hydrationQueueWorkScheduledRef.current = true;
    const run = () => {
      hydrationQueueWorkScheduledRef.current = false;
      syncImageHydrationState();
      processHydrationQueueRef.current();
    };
    if (typeof queueMicrotask === "function") {
      queueMicrotask(run);
      return;
    }
    void Promise.resolve().then(run);
  }, [syncImageHydrationState]);

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
        const currentUrl = hydrationUrlByIdRef.current[nextId];
        if (currentUrl && currentUrl !== sourceUrl) {
          if (!hydrationQueuedIdSetRef.current.has(nextId)) {
            hydrationQueuedIdSetRef.current.add(nextId);
            hydrationQueueRef.current.unshift(nextId);
          }
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
        forgetFailedHydrationUrl(nextId, nextUrl);
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
        const resolvedFallback = fallbackUrl && fallbackUrl !== nextUrl ? fallbackUrl : null;
        rememberFailedHydrationUrl(nextId, nextUrl);
        if (isNextOptimizerUrl(nextUrl)) {
          hydrationFailedOptimizedUrlByIdRef.current[nextId] = nextUrl;
          const optimizerSourceUrl = resolveOptimizerSourceUrl(nextUrl);
          if (optimizerSourceUrl) {
            rememberFailedOptimizerSource(optimizerSourceUrl);
          }
          recordOptimizerFailoverError();
        }
        if (resolvedFallback) {
          hydrationUrlByIdRef.current[nextId] = resolvedFallback;
        }
        hydrationInflightIdSetRef.current.delete(nextId);
        if (resolvedFallback && validOutputIdSetRef.current.has(nextId)) {
          hydrationQueuedIdSetRef.current.add(nextId);
          hydrationQueueRef.current.unshift(nextId);
        }
        syncImageHydrationState();
        processHydrationQueueRef.current();
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
    forgetFailedHydrationUrl,
    rememberFailedHydrationUrl,
    rememberFailedOptimizerSource,
    revokeGeneratedHydrationUrl,
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
          mediaSurface: options.mediaSurface ?? "reference-grid",
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
      const failedHydrationUrlSet = hydrationFailedImageUrlSetByIdRef.current[id];
      const shouldBypassFailedHydrationUrl =
        failedHydrationUrlSet?.has(nextHydrationUrl) &&
        typeof fallbackUrl === "string" &&
        fallbackUrl.length > 0 &&
        fallbackUrl !== nextHydrationUrl &&
        !failedHydrationUrlSet.has(fallbackUrl);
      const resolvedHydrationUrl = shouldBypassFailedHydrationUrl ? fallbackUrl : nextHydrationUrl;
      if (failedHydrationUrlSet?.has(resolvedHydrationUrl)) return;
      hydrationUrlByIdRef.current[id] = resolvedHydrationUrl;
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
      if (previousUrl && previousUrl !== resolvedHydrationUrl) {
        revokeGeneratedHydrationUrl(id);
      }
      const pendingHydratedEntry = hydrationPendingLoadedRef.current[id];
      if (pendingHydratedEntry?.sourceUrl === resolvedHydrationUrl) return;
      const hydratedEntry = hydrationHydratedByIdRef.current[id];
      if (hydratedEntry?.sourceUrl === resolvedHydrationUrl) {
        touchHydratedEntry(id);
        return;
      }
      if (hydrationInflightIdSetRef.current.has(id)) return;
      const priority = options?.priority ?? "normal";
      if (hydrationQueuedIdSetRef.current.has(id)) {
        if (priority === "high") {
          const currentIndex = hydrationQueueRef.current.indexOf(id);
          if (currentIndex > 0) {
            hydrationQueueRef.current.splice(currentIndex, 1);
            hydrationQueueRef.current.unshift(id);
            scheduleHydrationQueueWork();
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
      scheduleHydrationQueueWork();
    },
    [
      decodeBudgetEnabled,
      recordOptimizerFailoverBypass,
      revokeGeneratedHydrationUrl,
      scheduleHydrationQueueWork,
      touchHydratedEntry,
    ]
  );

  const pruneHydrationQueueToCandidateIds = useCallback(
    (candidateIdSet: Set<string>) => {
      const retainedCandidateIds = new Set(candidateIdSet);
      if (activeOutputId && validOutputIdSetRef.current.has(activeOutputId)) {
        retainedCandidateIds.add(activeOutputId);
      }
      hydrationRetainedCandidateIdSetRef.current = retainedCandidateIds;
      retainedCandidateIds.forEach(touchHydratedEntry);
      const currentQueue = hydrationQueueRef.current;
      const nextQueue = currentQueue.filter((id) => retainedCandidateIds.has(id));
      const queueChanged =
        nextQueue.length !== currentQueue.length ||
        nextQueue.some((id, index) => currentQueue[index] !== id);
      if (queueChanged) {
        hydrationQueueRef.current = nextQueue;
        hydrationQueuedIdSetRef.current = new Set(nextQueue);
        scheduleHydrationQueueWork();
      }
      applyHydratedEntryLimit(retainedCandidateIds);
    },
    [activeOutputId, applyHydratedEntryLimit, scheduleHydrationQueueWork, touchHydratedEntry]
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
    validOutputIdSetRef.current = new Set(validOutputIds);
    const validOutputIdSet = new Set(validOutputIds);
    pruneStaleHydrationWork(validOutputIdSet);
    Object.keys(hydrationGeneratedObjectUrlByIdRef.current).forEach((id) => {
      if (validOutputIdSet.has(id)) return;
      revokeGeneratedHydrationUrl(id);
    });
    Object.keys(hydrationPreviewMetaByIdRef.current).forEach((id) => {
      if (validOutputIdSet.has(id)) return;
      delete hydrationPreviewMetaByIdRef.current[id];
    });
    Object.keys(hydrationUrlByIdRef.current).forEach((id) => {
      if (validOutputIdSet.has(id)) return;
      delete hydrationUrlByIdRef.current[id];
    });
    Object.keys(hydrationFallbackUrlByIdRef.current).forEach((id) => {
      if (validOutputIdSet.has(id)) return;
      delete hydrationFallbackUrlByIdRef.current[id];
    });
    Object.keys(hydrationFailedImageUrlSetByIdRef.current).forEach((id) => {
      if (validOutputIdSet.has(id)) return;
      delete hydrationFailedImageUrlSetByIdRef.current[id];
    });
    Object.keys(hydrationFailedOptimizedUrlByIdRef.current).forEach((id) => {
      if (validOutputIdSet.has(id)) return;
      delete hydrationFailedOptimizedUrlByIdRef.current[id];
    });
    Object.keys(hydrationBypassCountedOptimizedUrlByIdRef.current).forEach((id) => {
      if (validOutputIdSet.has(id)) return;
      delete hydrationBypassCountedOptimizedUrlByIdRef.current[id];
    });
    hydrationHydratedEntryOrderRef.current = hydrationHydratedEntryOrderRef.current.filter((id) =>
      validOutputIdSet.has(id)
    );

    const hasStaleHydratedIds = Object.keys(hydrationHydratedByIdRef.current).some(
      (id) => !validOutputIdSet.has(id)
    );
    if (!hasStaleHydratedIds) return;

    runNonUrgentUpdate(() => {
      setImageHydrationState((prev) => {
        let changed = false;
        const nextHydratedById = Object.fromEntries(
          Object.entries(prev.hydratedById).filter(([id]) => {
            const keep = validOutputIdSet.has(id);
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
    pruneStaleHydrationWork,
    revokeGeneratedHydrationUrl,
    runNonUrgentUpdate,
    validOutputIds,
  ]);

  useEffect(() => {
    const hydratedIdSet = new Set(Object.keys(imageHydrationState.hydratedById));
    Object.keys(hydrationGeneratedObjectUrlByIdRef.current).forEach((id) => {
      if (hydratedIdSet.has(id)) return;
      revokeGeneratedHydrationUrl(id);
    });
  }, [imageHydrationState.hydratedById, revokeGeneratedHydrationUrl]);

  useEffect(
    () => () => {
      if (hydrationRafFlushRef.current != null && typeof window !== "undefined") {
        window.cancelAnimationFrame(hydrationRafFlushRef.current);
        hydrationRafFlushRef.current = null;
      }
      hydrationQueueWorkScheduledRef.current = false;
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
