/**
 * Video lifecycle controller for Reference Grid cards.
 * Encapsulates node registration, visibility observers, autoplay detachment, and cleanup.
 */
import { useCallback, useEffect, useRef, type MutableRefObject } from "react";

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

  const detachVideoNodeMedia = useCallback((node: HTMLVideoElement) => {
    node.pause();
    node.removeAttribute("src");
    node.load();
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

  const registerVideoNode = useCallback(
    (nodeKey: string, outputId: string, node: HTMLVideoElement | null) => {
      const currentNode = videoNodeByKeyRef.current.get(nodeKey);
      if (currentNode && currentNode !== node) {
        videoIntersectionObserverBySurfaceRef.current.forEach((observer) => {
          observer.unobserve(currentNode);
        });
        videoNodeByKeyRef.current.delete(nodeKey);
      }
      if (!node) {
        const detachTimeout = videoDetachTimeoutByKeyRef.current.get(nodeKey);
        if (detachTimeout) {
          window.clearTimeout(detachTimeout);
          videoDetachTimeoutByKeyRef.current.delete(nodeKey);
        }
        videoNodeByKeyRef.current.delete(nodeKey);
        videoOutputIdByKeyRef.current.delete(nodeKey);
        if (videoVisibleKeySetRef.current.delete(nodeKey)) {
          scheduleAutoplayBudgetRecompute();
        }
        return;
      }
      const surface = resolveVideoSurfaceFromNodeKey(nodeKey);
      node.dataset.outputId = outputId;
      node.dataset.outputKey = nodeKey;
      node.dataset.referenceSurface = surface;
      videoNodeByKeyRef.current.set(nodeKey, node);
      videoOutputIdByKeyRef.current.set(nodeKey, outputId);
      videoIntersectionObserverBySurfaceRef.current.get(surface)?.observe(node);
    },
    [
      resolveVideoSurfaceFromNodeKey,
      scheduleAutoplayBudgetRecompute,
      videoDetachTimeoutByKeyRef,
      videoIntersectionObserverBySurfaceRef,
      videoNodeByKeyRef,
      videoOutputIdByKeyRef,
      videoVisibleKeySetRef,
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
      const timeoutId = videoDetachTimeoutByKeyRef.current.get(nodeKey);
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
      videoDetachTimeoutByKeyRef.current.delete(nodeKey);
      const node = videoNodeByKeyRef.current.get(nodeKey);
      if (node) {
        videoIntersectionObserverBySurfaceRef.current.forEach((observer) =>
          observer.unobserve(node)
        );
        detachVideoNodeMedia(node);
      }
      videoNodeByKeyRef.current.delete(nodeKey);
      videoOutputIdByKeyRef.current.delete(nodeKey);
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
    detachVideoNodeMedia,
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
    const detachTimeoutById = videoDetachTimeoutByKeyRef.current;
    const videoNodeByKey = videoNodeByKeyRef.current;
    return () => {
      if (recomputeAutoplayBudgetRafIdRef.current != null && typeof window !== "undefined") {
        window.cancelAnimationFrame(recomputeAutoplayBudgetRafIdRef.current);
        recomputeAutoplayBudgetRafIdRef.current = null;
      }
      detachTimeoutById.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      detachTimeoutById.clear();
      videoNodeByKey.forEach((node) => {
        detachVideoNodeMedia(node);
      });
      videoNodeByKey.clear();
    };
  }, [detachVideoNodeMedia, videoDetachTimeoutByKeyRef, videoNodeByKeyRef]);

  return {
    registerVideoNode,
  };
};
