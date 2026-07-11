/**
 * Video lifecycle controller for Reference Grid cards.
 * Encapsulates node registration, visibility observers, autoplay detachment, and cleanup.
 */
import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { logMediaPerf } from "../../../../lib/mediaPerfTelemetry";

type UseReferenceGridVideoLifecycleControllerArgs = {
  activeOutputId: string | null;
  validOutputIds: string[];
  shouldVirtualize: boolean;
  renderedOutputIdSet: Set<string>;
  autoplayEnabledIds: string[];
  autoplayEnabledIdSet: Set<string>;
  isCuratedSplitEnabled: boolean;
  scrollContainerRef: MutableRefObject<HTMLDivElement | null>;
  curatedScrollContainerRef: MutableRefObject<HTMLDivElement | null>;
  autoplayingIdsRef: MutableRefObject<Set<string>>;
  videoVisibleKeySetRef: MutableRefObject<Set<string>>;
  videoOutputIdByKeyRef: MutableRefObject<Map<string, string>>;
  videoNodeByKeyRef: MutableRefObject<Map<string, HTMLVideoElement>>;
  videoDetachTimeoutByKeyRef: MutableRefObject<Map<string, number>>;
  videoIntersectionObserverBySurfaceRef: MutableRefObject<
    Map<"all-refs" | "curated", IntersectionObserver>
  >;
  metricsTargetRef?: MutableRefObject<HTMLElement | null>;
  autoplayEnabledIdsStateRef?: MutableRefObject<string[]>;
  autoplayDetachDelayMs: number;
  autoplayVisibilityThreshold: number;
  recomputeAutoplayBudget: () => void;
};

type UseReferenceGridVideoLifecycleControllerResult = {
  registerVideoNode: (nodeKey: string, outputId: string, node: HTMLVideoElement | null) => void;
};

/**
 * Returns card-video node registration callback and installs lifecycle effects for autoplay control.
 */
export const useReferenceGridVideoLifecycleController = ({
  activeOutputId,
  validOutputIds,
  shouldVirtualize,
  renderedOutputIdSet,
  autoplayEnabledIds,
  autoplayEnabledIdSet,
  isCuratedSplitEnabled,
  scrollContainerRef,
  curatedScrollContainerRef,
  autoplayingIdsRef,
  videoVisibleKeySetRef,
  videoOutputIdByKeyRef,
  videoNodeByKeyRef,
  videoDetachTimeoutByKeyRef,
  videoIntersectionObserverBySurfaceRef,
  metricsTargetRef,
  autoplayEnabledIdsStateRef,
  autoplayDetachDelayMs,
  autoplayVisibilityThreshold,
  recomputeAutoplayBudget,
}: UseReferenceGridVideoLifecycleControllerArgs): UseReferenceGridVideoLifecycleControllerResult => {
  const resolveVideoSurfaceFromNodeKey = useCallback(
    (nodeKey: string): "all-refs" | "curated" =>
      nodeKey.startsWith("curated:") ? "curated" : "all-refs",
    []
  );
  const recomputeAutoplayBudgetRafIdRef = useRef<number | null>(null);
  const metricsRafIdRef = useRef<number | null>(null);

  const detachVideoNodeMedia = useCallback((node: HTMLVideoElement) => {
    node.pause();
    node.removeAttribute("src");
    try {
      node.load();
    } catch {
      // Some browser/test environments throw while resetting detached media.
    }
  }, []);

  const scheduleAutoplayBudgetRecompute = useCallback(() => {
    if (typeof window === "undefined") {
      recomputeAutoplayBudget();
      return;
    }
    if (recomputeAutoplayBudgetRafIdRef.current != null) return;
    recomputeAutoplayBudgetRafIdRef.current = window.requestAnimationFrame(() => {
      recomputeAutoplayBudgetRafIdRef.current = null;
      recomputeAutoplayBudget();
    });
  }, [recomputeAutoplayBudget]);

  const fallbackMetricsTargetRef = useRef<HTMLElement | null>(null);
  const fallbackAutoplayEnabledIdsStateRef = useRef<string[]>(autoplayEnabledIds);
  const resolvedMetricsTargetRef = metricsTargetRef ?? fallbackMetricsTargetRef;
  const resolvedAutoplayEnabledIdsStateRef =
    autoplayEnabledIdsStateRef ?? fallbackAutoplayEnabledIdsStateRef;
  const metricsTargetRefStateRef = useRef(resolvedMetricsTargetRef);
  const autoplayEnabledIdsRefStateRef = useRef(resolvedAutoplayEnabledIdsStateRef);

  useEffect(() => {
    metricsTargetRefStateRef.current = resolvedMetricsTargetRef;
    autoplayEnabledIdsRefStateRef.current = resolvedAutoplayEnabledIdsStateRef;
  }, [resolvedAutoplayEnabledIdsStateRef, resolvedMetricsTargetRef]);

  useEffect(() => {
    if (!autoplayEnabledIdsStateRef) {
      fallbackAutoplayEnabledIdsStateRef.current = autoplayEnabledIds;
    }
  }, [autoplayEnabledIds, autoplayEnabledIdsStateRef]);

  const emitVideoLifecycleMetrics = useCallback(() => {
    const nodes = Array.from(videoNodeByKeyRef.current.entries());
    const attachedSourceCount = nodes.reduce((count, [, node]) => {
      return count + (node.getAttribute("src") || node.currentSrc ? 1 : 0);
    }, 0);
    const allRefsNodeCount = nodes.reduce(
      (count, [nodeKey]) => count + (nodeKey.startsWith("curated:") ? 0 : 1),
      0
    );
    const quickSlotNodeCount = nodes.length - allRefsNodeCount;
    const outputNodeCounts = new Map<string, number>();
    videoOutputIdByKeyRef.current.forEach((outputId) => {
      outputNodeCounts.set(outputId, (outputNodeCounts.get(outputId) ?? 0) + 1);
    });
    const duplicateOutputCount = Array.from(outputNodeCounts.values()).filter(
      (count) => count > 1
    ).length;
    const performanceMemory =
      typeof performance === "undefined"
        ? null
        : (
            performance as Performance & {
              memory?: {
                usedJSHeapSize?: number;
                totalJSHeapSize?: number;
                jsHeapSizeLimit?: number;
              };
            }
          ).memory;
    const usedJsHeapSize = performanceMemory?.usedJSHeapSize;
    const totalJsHeapSize = performanceMemory?.totalJSHeapSize;
    const jsHeapSizeLimit = performanceMemory?.jsHeapSizeLimit;
    const metrics = {
      tracked_video_node_count: nodes.length,
      attached_video_source_count: attachedSourceCount,
      visible_video_key_count: videoVisibleKeySetRef.current.size,
      autoplay_enabled_output_count: autoplayEnabledIdsRefStateRef.current.current.length,
      all_refs_video_node_count: allRefsNodeCount,
      quick_slot_video_node_count: quickSlotNodeCount,
      duplicate_video_output_count: duplicateOutputCount,
      used_js_heap_size: typeof usedJsHeapSize === "number" ? Math.round(usedJsHeapSize) : null,
      total_js_heap_size: typeof totalJsHeapSize === "number" ? Math.round(totalJsHeapSize) : null,
      js_heap_size_limit: typeof jsHeapSizeLimit === "number" ? Math.round(jsHeapSizeLimit) : null,
    };
    const metricsTarget = metricsTargetRefStateRef.current.current;
    if (metricsTarget) {
      metricsTarget.dataset.gridTrackedVideoNodeCount = String(metrics.tracked_video_node_count);
      metricsTarget.dataset.gridAttachedVideoSourceCount = String(
        metrics.attached_video_source_count
      );
      metricsTarget.dataset.gridVisibleVideoKeyCount = String(metrics.visible_video_key_count);
      metricsTarget.dataset.gridAutoplayEnabledOutputCount = String(
        metrics.autoplay_enabled_output_count
      );
      metricsTarget.dataset.gridAllRefsVideoNodeCount = String(metrics.all_refs_video_node_count);
      metricsTarget.dataset.gridQuickSlotVideoNodeCount = String(
        metrics.quick_slot_video_node_count
      );
      metricsTarget.dataset.gridDuplicateVideoOutputCount = String(
        metrics.duplicate_video_output_count
      );
    }
    logMediaPerf("media.grid.memory.sample", {
      surface: "reference-grid",
      ...metrics,
    });
  }, [
    autoplayEnabledIdsRefStateRef,
    metricsTargetRefStateRef,
    videoNodeByKeyRef,
    videoOutputIdByKeyRef,
    videoVisibleKeySetRef,
  ]);

  const scheduleVideoLifecycleMetrics = useCallback(() => {
    if (typeof window === "undefined") {
      emitVideoLifecycleMetrics();
      return;
    }
    if (metricsRafIdRef.current != null) return;
    metricsRafIdRef.current = window.requestAnimationFrame(() => {
      metricsRafIdRef.current = null;
      emitVideoLifecycleMetrics();
    });
  }, [emitVideoLifecycleMetrics]);

  const releaseRegisteredVideoNode = useCallback(
    (nodeKey: string, expectedNode?: HTMLVideoElement | null) => {
      const currentNode = videoNodeByKeyRef.current.get(nodeKey);
      if (!currentNode || (expectedNode && currentNode !== expectedNode)) return false;
      const detachTimeout = videoDetachTimeoutByKeyRef.current.get(nodeKey);
      if (detachTimeout != null) {
        window.clearTimeout(detachTimeout);
        videoDetachTimeoutByKeyRef.current.delete(nodeKey);
      }
      videoIntersectionObserverBySurfaceRef.current.forEach((observer) => {
        observer.unobserve(currentNode);
      });
      detachVideoNodeMedia(currentNode);
      videoNodeByKeyRef.current.delete(nodeKey);
      videoOutputIdByKeyRef.current.delete(nodeKey);
      const visibilityChanged = videoVisibleKeySetRef.current.delete(nodeKey);
      if (visibilityChanged) scheduleAutoplayBudgetRecompute();
      scheduleVideoLifecycleMetrics();
      return true;
    },
    [
      detachVideoNodeMedia,
      scheduleAutoplayBudgetRecompute,
      scheduleVideoLifecycleMetrics,
      videoDetachTimeoutByKeyRef,
      videoIntersectionObserverBySurfaceRef,
      videoNodeByKeyRef,
      videoOutputIdByKeyRef,
      videoVisibleKeySetRef,
    ]
  );

  const registerVideoNode = useCallback(
    (nodeKey: string, outputId: string, node: HTMLVideoElement | null) => {
      const currentNode = videoNodeByKeyRef.current.get(nodeKey);
      if (currentNode && currentNode !== node) {
        releaseRegisteredVideoNode(nodeKey, currentNode);
      }
      if (!node) {
        releaseRegisteredVideoNode(nodeKey);
        return;
      }
      const surface = resolveVideoSurfaceFromNodeKey(nodeKey);
      node.dataset.outputId = outputId;
      node.dataset.outputKey = nodeKey;
      node.dataset.referenceSurface = surface;
      videoNodeByKeyRef.current.set(nodeKey, node);
      videoOutputIdByKeyRef.current.set(nodeKey, outputId);
      videoIntersectionObserverBySurfaceRef.current.get(surface)?.observe(node);
      scheduleVideoLifecycleMetrics();
    },
    [
      releaseRegisteredVideoNode,
      resolveVideoSurfaceFromNodeKey,
      videoIntersectionObserverBySurfaceRef,
      videoNodeByKeyRef,
      videoOutputIdByKeyRef,
      scheduleVideoLifecycleMetrics,
    ]
  );

  useEffect(() => {
    const validOutputIdSet = new Set(validOutputIds);
    let removedAny = false;
    videoOutputIdByKeyRef.current.forEach((outputId, nodeKey) => {
      if (validOutputIdSet.has(outputId)) return;
      if (videoVisibleKeySetRef.current.delete(nodeKey)) {
        removedAny = true;
      }
      releaseRegisteredVideoNode(nodeKey);
    });
    videoDetachTimeoutByKeyRef.current.forEach((timeoutId, nodeKey) => {
      if (videoOutputIdByKeyRef.current.has(nodeKey)) return;
      window.clearTimeout(timeoutId);
      videoDetachTimeoutByKeyRef.current.delete(nodeKey);
    });
    if (removedAny) {
      scheduleAutoplayBudgetRecompute();
    }
  }, [
    validOutputIds,
    releaseRegisteredVideoNode,
    scheduleAutoplayBudgetRecompute,
    videoDetachTimeoutByKeyRef,
    videoIntersectionObserverBySurfaceRef,
    videoNodeByKeyRef,
    videoOutputIdByKeyRef,
    videoVisibleKeySetRef,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const allRefsRoot = scrollContainerRef.current;
    if (!allRefsRoot) return;
    const observerBySurface = new Map<"all-refs" | "curated", IntersectionObserver>();
    const createObserver = (root: Element | null) =>
      new IntersectionObserver(
        (entries) => {
          let changed = false;
          entries.forEach((entry) => {
            const nodeKey = (entry.target as HTMLElement).dataset.outputKey;
            if (!nodeKey) return;
            if (videoNodeByKeyRef.current.get(nodeKey) !== entry.target) return;
            const isVisible =
              entry.isIntersecting && entry.intersectionRatio >= autoplayVisibilityThreshold;
            if (isVisible) {
              if (!videoVisibleKeySetRef.current.has(nodeKey)) {
                videoVisibleKeySetRef.current.add(nodeKey);
                changed = true;
              }
              return;
            }
            if (videoVisibleKeySetRef.current.delete(nodeKey)) {
              changed = true;
            }
          });
          if (changed) {
            scheduleAutoplayBudgetRecompute();
            scheduleVideoLifecycleMetrics();
          }
        },
        {
          root,
          threshold: [0, autoplayVisibilityThreshold, 1],
        }
      );
    const allRefsObserver = createObserver(allRefsRoot);
    observerBySurface.set("all-refs", allRefsObserver);
    if (isCuratedSplitEnabled && curatedScrollContainerRef.current) {
      observerBySurface.set("curated", createObserver(curatedScrollContainerRef.current));
    }
    videoIntersectionObserverBySurfaceRef.current = observerBySurface;
    videoNodeByKeyRef.current.forEach((node, nodeKey) => {
      const surface = resolveVideoSurfaceFromNodeKey(nodeKey);
      observerBySurface.get(surface)?.observe(node);
    });
    return () => {
      observerBySurface.forEach((observer) => observer.disconnect());
      videoIntersectionObserverBySurfaceRef.current.clear();
    };
  }, [
    autoplayVisibilityThreshold,
    curatedScrollContainerRef,
    isCuratedSplitEnabled,
    resolveVideoSurfaceFromNodeKey,
    scheduleAutoplayBudgetRecompute,
    scheduleVideoLifecycleMetrics,
    scrollContainerRef,
    videoIntersectionObserverBySurfaceRef,
    videoNodeByKeyRef,
    videoVisibleKeySetRef,
  ]);

  useEffect(() => {
    const validOutputIdSet = shouldVirtualize ? renderedOutputIdSet : new Set(validOutputIds);
    autoplayingIdsRef.current.forEach((id) => {
      if (!validOutputIdSet.has(id)) {
        autoplayingIdsRef.current.delete(id);
      }
    });
  }, [autoplayingIdsRef, renderedOutputIdSet, shouldVirtualize, validOutputIds]);

  useEffect(() => {
    const enabledSet = new Set(autoplayEnabledIds);
    videoNodeByKeyRef.current.forEach((node, nodeKey) => {
      const outputId = videoOutputIdByKeyRef.current.get(nodeKey);
      if (!outputId) return;
      if (enabledSet.has(outputId)) {
        const detachTimeout = videoDetachTimeoutByKeyRef.current.get(nodeKey);
        if (detachTimeout) {
          window.clearTimeout(detachTimeout);
          videoDetachTimeoutByKeyRef.current.delete(nodeKey);
        }
        return;
      }
      if (activeOutputId && outputId === activeOutputId) {
        const detachTimeout = videoDetachTimeoutByKeyRef.current.get(nodeKey);
        if (detachTimeout) {
          window.clearTimeout(detachTimeout);
          videoDetachTimeoutByKeyRef.current.delete(nodeKey);
        }
        return;
      }
      node.pause();
      if (videoDetachTimeoutByKeyRef.current.has(nodeKey)) return;
      const timeoutId = window.setTimeout(() => {
        const currentOutputId = videoOutputIdByKeyRef.current.get(nodeKey);
        if (currentOutputId && autoplayEnabledIdSet.has(currentOutputId)) return;
        node.pause();
        if (currentOutputId) {
          autoplayingIdsRef.current.delete(currentOutputId);
        }
        videoDetachTimeoutByKeyRef.current.delete(nodeKey);
      }, autoplayDetachDelayMs);
      videoDetachTimeoutByKeyRef.current.set(nodeKey, timeoutId);
    });
  }, [
    activeOutputId,
    autoplayDetachDelayMs,
    autoplayEnabledIdSet,
    autoplayEnabledIds,
    autoplayingIdsRef,
    videoDetachTimeoutByKeyRef,
    videoNodeByKeyRef,
    videoOutputIdByKeyRef,
  ]);

  useEffect(() => {
    scheduleVideoLifecycleMetrics();
  }, [autoplayEnabledIds, scheduleVideoLifecycleMetrics]);

  useEffect(() => {
    const detachTimeoutById = videoDetachTimeoutByKeyRef.current;
    const videoNodeByKey = videoNodeByKeyRef.current;
    return () => {
      detachTimeoutById.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      detachTimeoutById.clear();
      Array.from(videoNodeByKey.keys()).forEach((nodeKey) => {
        releaseRegisteredVideoNode(nodeKey);
      });
      logMediaPerf("media.grid.memory.sample", {
        surface: "reference-grid",
        tracked_video_node_count: 0,
        attached_video_source_count: 0,
        visible_video_key_count: 0,
        autoplay_enabled_output_count: 0,
        duplicate_video_output_count: 0,
      });
      if (recomputeAutoplayBudgetRafIdRef.current != null && typeof window !== "undefined") {
        window.cancelAnimationFrame(recomputeAutoplayBudgetRafIdRef.current);
        recomputeAutoplayBudgetRafIdRef.current = null;
      }
      if (metricsRafIdRef.current != null && typeof window !== "undefined") {
        window.cancelAnimationFrame(metricsRafIdRef.current);
        metricsRafIdRef.current = null;
      }
    };
  }, [releaseRegisteredVideoNode, videoDetachTimeoutByKeyRef, videoNodeByKeyRef]);

  return {
    registerVideoNode,
  };
};
