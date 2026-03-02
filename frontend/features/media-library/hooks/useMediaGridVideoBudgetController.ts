import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { logMediaPerf } from "../../../lib/mediaPerfTelemetry";

type VideoBudgetSurface = "media-library-route" | "media-library-modal";

type VideoBudgetItem = {
  id: string;
  fileType?: string | null;
};

type UseMediaGridVideoBudgetControllerArgs<TItem extends VideoBudgetItem> = {
  items: TItem[];
  enabled: boolean;
  surface: VideoBudgetSurface;
  isVideoFile: (fileType?: string | null) => boolean;
  scrollContainerRef?: MutableRefObject<HTMLElement | null>;
  smallScreenQuery?: string;
  autoplayMaxDesktop?: number;
  autoplayMaxSmallScreen?: number;
  autoplayMaxConstrained?: number;
  detachDelayMs?: number;
  visibilityThreshold?: number;
};

type UseMediaGridVideoBudgetControllerResult = {
  getVideoNodeRef: (id: string) => (node: HTMLVideoElement | null) => void;
  isVideoAutoplayEnabled: (id: string) => boolean;
  resolveVideoSource: (id: string, sourceUrl?: string | null) => string | undefined;
};

type NavigatorWithConnection = Navigator & {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
    addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
    removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  };
};

/**
 * Shared route/modal video autoplay budget controller.
 * Bounds concurrent autoplay and detaches offscreen sources after a short idle delay.
 */
export const useMediaGridVideoBudgetController = <TItem extends VideoBudgetItem>({
  items,
  enabled,
  surface,
  isVideoFile,
  scrollContainerRef,
  smallScreenQuery = "(max-width: 900px)",
  autoplayMaxDesktop = 3,
  autoplayMaxSmallScreen = 2,
  autoplayMaxConstrained = 1,
  detachDelayMs = 850,
  visibilityThreshold = 0.5,
}: UseMediaGridVideoBudgetControllerArgs<TItem>): UseMediaGridVideoBudgetControllerResult => {
  const nodeByIdRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const refCallbackByIdRef = useRef<Record<string, (node: HTMLVideoElement | null) => void>>({});
  const visibleVideoIdsRef = useRef<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const detachTimeoutByIdRef = useRef<Map<string, number>>(new Map());
  const previousEnabledIdsRef = useRef<Set<string>>(new Set());
  const [videoAttachBudget, setVideoAttachBudget] = useState(autoplayMaxDesktop);
  const [enabledVideoIds, setEnabledVideoIds] = useState<string[]>([]);
  const [attachedVideoIds, setAttachedVideoIds] = useState<Set<string>>(() => new Set());

  const videoIdsInOrder = useMemo(
    () => items.filter((item) => isVideoFile(item.fileType)).map((item) => item.id),
    [isVideoFile, items]
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof navigator === "undefined") return;
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection;
    const refreshBudget = () => {
      const isSmallScreen = window.matchMedia(smallScreenQuery).matches;
      const saveData = nav.connection?.saveData === true;
      const effectiveType = (nav.connection?.effectiveType ?? "").toLowerCase();
      const isSlowNetwork = effectiveType.includes("2g");
      const isLowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
      const isConstrained = saveData || isSlowNetwork || isLowMemory;
      const nextBudget = isConstrained
        ? autoplayMaxConstrained
        : isSmallScreen
          ? autoplayMaxSmallScreen
          : autoplayMaxDesktop;
      setVideoAttachBudget((prev) => (prev === nextBudget ? prev : nextBudget));
    };
    refreshBudget();
    window.addEventListener("resize", refreshBudget);
    connection?.addEventListener?.("change", refreshBudget);
    return () => {
      window.removeEventListener("resize", refreshBudget);
      connection?.removeEventListener?.("change", refreshBudget);
    };
  }, [
    autoplayMaxConstrained,
    autoplayMaxDesktop,
    autoplayMaxSmallScreen,
    enabled,
    smallScreenQuery,
  ]);

  const recomputeEnabledVideos = useCallback(() => {
    if (!enabled) return;
    const visibleInOrder = videoIdsInOrder.filter((id) => visibleVideoIdsRef.current.has(id));
    const nextEnabled = visibleInOrder.slice(0, Math.max(0, videoAttachBudget));
    setEnabledVideoIds((prev) =>
      prev.length === nextEnabled.length &&
      prev.every((value, index) => value === nextEnabled[index])
        ? prev
        : nextEnabled
    );
  }, [enabled, videoAttachBudget, videoIdsInOrder]);

  useEffect(() => {
    if (!enabled) return;
    recomputeEnabledVideos();
  }, [enabled, recomputeEnabledVideos, videoIdsInOrder]);

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    const visibleVideoIds = visibleVideoIdsRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        let changed = false;
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.mediaId;
          if (!id) continue;
          const isVisible = entry.isIntersecting && entry.intersectionRatio >= visibilityThreshold;
          if (isVisible) {
            if (!visibleVideoIds.has(id)) {
              visibleVideoIds.add(id);
              changed = true;
            }
            continue;
          }
          if (visibleVideoIds.delete(id)) {
            changed = true;
          }
        }
        if (changed) {
          recomputeEnabledVideos();
        }
      },
      {
        root: scrollContainerRef?.current ?? null,
        threshold: [0, visibilityThreshold, 1],
      }
    );
    observerRef.current = observer;
    for (const [id, node] of nodeByIdRef.current.entries()) {
      node.dataset.mediaId = id;
      observer.observe(node);
    }
    return () => {
      observer.disconnect();
      observerRef.current = null;
      visibleVideoIds.clear();
    };
  }, [enabled, recomputeEnabledVideos, scrollContainerRef, visibilityThreshold]);

  useEffect(() => {
    if (!enabled) {
      for (const timeoutId of detachTimeoutByIdRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      detachTimeoutByIdRef.current.clear();
      previousEnabledIdsRef.current = new Set();
      return;
    }

    const nextEnabledSet = new Set(enabledVideoIds);
    const previousEnabledSet = previousEnabledIdsRef.current;
    for (const id of nextEnabledSet) {
      if (previousEnabledSet.has(id)) continue;
      logMediaPerf("media.grid.autoplay.started", {
        surface,
        media_id: id,
        active_autoplay_count: nextEnabledSet.size,
      });
    }
    for (const id of previousEnabledSet) {
      if (nextEnabledSet.has(id)) continue;
      logMediaPerf("media.grid.autoplay.stopped", {
        surface,
        media_id: id,
        active_autoplay_count: nextEnabledSet.size,
      });
    }
    previousEnabledIdsRef.current = nextEnabledSet;

    setAttachedVideoIds((prev) => {
      const next = new Set(prev);
      for (const id of enabledVideoIds) {
        next.add(id);
      }
      return next;
    });

    for (const id of enabledVideoIds) {
      const timeoutId = detachTimeoutByIdRef.current.get(id);
      if (timeoutId == null) continue;
      window.clearTimeout(timeoutId);
      detachTimeoutByIdRef.current.delete(id);
    }

    for (const id of videoIdsInOrder) {
      if (nextEnabledSet.has(id)) continue;
      const node = nodeByIdRef.current.get(id);
      node?.pause();
      if (detachTimeoutByIdRef.current.has(id)) continue;
      const timeoutId = window.setTimeout(() => {
        setAttachedVideoIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        detachTimeoutByIdRef.current.delete(id);
      }, detachDelayMs);
      detachTimeoutByIdRef.current.set(id, timeoutId);
    }
  }, [detachDelayMs, enabled, enabledVideoIds, surface, videoIdsInOrder]);

  useEffect(
    () => () => {
      for (const timeoutId of detachTimeoutByIdRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      detachTimeoutByIdRef.current.clear();
    },
    []
  );

  const getVideoNodeRef = useCallback(
    (id: string) => {
      const existing = refCallbackByIdRef.current[id];
      if (existing) return existing;
      const callback = (node: HTMLVideoElement | null) => {
        const previousNode = nodeByIdRef.current.get(id);
        if (previousNode && previousNode !== node) {
          observerRef.current?.unobserve(previousNode);
          nodeByIdRef.current.delete(id);
        }
        if (!node) {
          nodeByIdRef.current.delete(id);
          visibleVideoIdsRef.current.delete(id);
          recomputeEnabledVideos();
          return;
        }
        node.dataset.mediaId = id;
        nodeByIdRef.current.set(id, node);
        observerRef.current?.observe(node);
      };
      refCallbackByIdRef.current[id] = callback;
      return callback;
    },
    [recomputeEnabledVideos]
  );

  const enabledVideoIdSet = useMemo(() => new Set(enabledVideoIds), [enabledVideoIds]);

  const isVideoAutoplayEnabled = useCallback(
    (id: string) => {
      if (!enabled) return true;
      return enabledVideoIdSet.has(id);
    },
    [enabled, enabledVideoIdSet]
  );

  const resolveVideoSource = useCallback(
    (id: string, sourceUrl?: string | null): string | undefined => {
      const normalizedSource = sourceUrl?.trim() ?? "";
      if (!normalizedSource) return undefined;
      if (!enabled) return normalizedSource;
      return attachedVideoIds.has(id) ? normalizedSource : undefined;
    },
    [attachedVideoIds, enabled]
  );

  return {
    getVideoNodeRef,
    isVideoAutoplayEnabled,
    resolveVideoSource,
  };
};
