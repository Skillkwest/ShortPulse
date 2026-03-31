/**
 * Scroll controller for Reference Grid virtualization surfaces.
 * Keeps RAF-throttled metric updates and telemetry sampling out of ReferenceGrid rendering logic.
 */
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { logMediaPerf } from "../../../../lib/mediaPerfTelemetry";
import { incrementFreezeInvestigationCounter } from "../../logic/freezeInvestigationTelemetry";

type VirtualMetricsState = {
  scrollTop: number;
  viewportHeight: number;
  columnCount: number;
  rowHeight: number;
};

type UseReferenceGridScrollControllerArgs = {
  setVirtualMetrics: Dispatch<SetStateAction<VirtualMetricsState>>;
  setCuratedVirtualMetrics: Dispatch<SetStateAction<VirtualMetricsState>>;
  outputsLength: number;
  renderedItemCount: number;
};

type UseReferenceGridScrollControllerResult = {
  handleAllRefsScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  handleCuratedScroll: (event: React.UIEvent<HTMLDivElement>) => void;
};

/**
 * Returns all-refs and curated scroll handlers with shared RAF throttling and telemetry policy.
 */
export const useReferenceGridScrollController = ({
  setVirtualMetrics,
  setCuratedVirtualMetrics,
  outputsLength,
  renderedItemCount,
}: UseReferenceGridScrollControllerArgs): UseReferenceGridScrollControllerResult => {
  const lastScrollSampleAtRef = useRef(0);
  const allRefsScrollRafIdRef = useRef<number | null>(null);
  const curatedScrollRafIdRef = useRef<number | null>(null);
  const queuedAllRefsScrollMetricsRef = useRef<{
    scrollTop: number;
    viewportHeight: number;
  } | null>(null);
  const queuedCuratedScrollMetricsRef = useRef<{
    scrollTop: number;
    viewportHeight: number;
  } | null>(null);

  const handleAllRefsScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const node = event.currentTarget;
      queuedAllRefsScrollMetricsRef.current = {
        scrollTop: node.scrollTop,
        viewportHeight: node.clientHeight,
      };
      if (allRefsScrollRafIdRef.current == null && typeof window !== "undefined") {
        allRefsScrollRafIdRef.current = window.requestAnimationFrame(() => {
          allRefsScrollRafIdRef.current = null;
          const queuedMetrics = queuedAllRefsScrollMetricsRef.current;
          if (!queuedMetrics) return;
          setVirtualMetrics((prev) => {
            const next = {
              ...prev,
              scrollTop: queuedMetrics.scrollTop,
              viewportHeight: queuedMetrics.viewportHeight,
            };
            const stable =
              Math.abs(prev.scrollTop - next.scrollTop) < 1 &&
              Math.abs(prev.viewportHeight - next.viewportHeight) < 1;
            if (stable) return prev;
            incrementFreezeInvestigationCounter("referenceGrid.virtualMetrics.scrollCommit");
            return next;
          });
        });
      }
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastScrollSampleAtRef.current < 1200) return;
      lastScrollSampleAtRef.current = now;
      logMediaPerf("media.grid.scroll.sample", {
        surface: "reference-grid",
        scroll_top: Math.round(node.scrollTop),
        scroll_height: node.scrollHeight,
        viewport_height: node.clientHeight,
        visible_item_count: renderedItemCount,
        total_item_count: outputsLength,
      });
      const memory = (
        performance as Performance & {
          memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number };
        }
      ).memory;
      if (memory?.usedJSHeapSize && memory?.totalJSHeapSize) {
        logMediaPerf("media.grid.memory.sample", {
          surface: "reference-grid",
          used_js_heap_mb: Math.round(memory.usedJSHeapSize / (1024 * 1024)),
          total_js_heap_mb: Math.round(memory.totalJSHeapSize / (1024 * 1024)),
          visible_item_count: renderedItemCount,
          total_item_count: outputsLength,
        });
      }
    },
    [outputsLength, renderedItemCount, setVirtualMetrics]
  );

  const handleCuratedScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const node = event.currentTarget;
      queuedCuratedScrollMetricsRef.current = {
        scrollTop: node.scrollTop,
        viewportHeight: node.clientHeight,
      };
      if (curatedScrollRafIdRef.current == null && typeof window !== "undefined") {
        curatedScrollRafIdRef.current = window.requestAnimationFrame(() => {
          curatedScrollRafIdRef.current = null;
          const queuedMetrics = queuedCuratedScrollMetricsRef.current;
          if (!queuedMetrics) return;
          setCuratedVirtualMetrics((prev) => {
            const next = {
              ...prev,
              scrollTop: queuedMetrics.scrollTop,
              viewportHeight: queuedMetrics.viewportHeight,
            };
            const stable =
              Math.abs(prev.scrollTop - next.scrollTop) < 1 &&
              Math.abs(prev.viewportHeight - next.viewportHeight) < 1;
            if (stable) return prev;
            incrementFreezeInvestigationCounter("referenceGrid.curatedVirtualMetrics.scrollCommit");
            return next;
          });
        });
      }
    },
    [setCuratedVirtualMetrics]
  );

  useEffect(
    () => () => {
      if (allRefsScrollRafIdRef.current != null) {
        window.cancelAnimationFrame(allRefsScrollRafIdRef.current);
        allRefsScrollRafIdRef.current = null;
      }
      if (curatedScrollRafIdRef.current != null) {
        window.cancelAnimationFrame(curatedScrollRafIdRef.current);
        curatedScrollRafIdRef.current = null;
      }
    },
    []
  );

  return {
    handleAllRefsScroll,
    handleCuratedScroll,
  };
};
