/**
 * Reference-grid horizontal split controller.
 * Owns pointer + keyboard resizing between curated (top) and all-refs (bottom) sections.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";

type UseReferenceGridHorizontalSplitArgs = {
  enabled: boolean;
  containerRef: MutableRefObject<HTMLElement | null>;
  defaultTopRatio?: number;
  minTopSectionHeightPx?: number;
  minBottomSectionHeightPx?: number;
  allRefsSnapTopHeightPx?: number;
  collapseTopHeightPx?: number;
  ariaLabel?: string;
};

type DragSession = {
  pointerId: number;
  containerHeight: number;
  lastClientY: number;
};

type RatioBounds = {
  min: number;
  max: number;
};

const DEFAULT_TOP_RATIO = 0.35;
const FALLBACK_MIN_RATIO = 0.01;
const FALLBACK_MAX_RATIO = 0.995;
const DEFAULT_MIN_TOP_SECTION_HEIGHT_PX = 120;
const DEFAULT_MIN_BOTTOM_SECTION_HEIGHT_PX = 120;
const DEFAULT_ALL_REFS_SNAP_TOP_HEIGHT_PX = 24;
const KEYBOARD_STEP = 0.03;
const KEYBOARD_FAST_STEP = 0.07;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const FALLBACK_RATIO_BOUNDS: RatioBounds = {
  min: FALLBACK_MIN_RATIO,
  max: FALLBACK_MAX_RATIO,
};

const resolveElementHeight = (node: HTMLElement | null): number => {
  if (!node) return 0;
  const directHeight = node.getBoundingClientRect().height;
  if (directHeight > 0) return directHeight;
  if (node.clientHeight > 0) return node.clientHeight;
  if (node.offsetHeight > 0) return node.offsetHeight;

  let parent = node.parentElement;
  while (parent) {
    const parentHeight = parent.getBoundingClientRect().height;
    if (parentHeight > 0) return parentHeight;
    if (parent.clientHeight > 0) return parent.clientHeight;
    if (parent.offsetHeight > 0) return parent.offsetHeight;
    parent = parent.parentElement;
  }
  return 0;
};

const resolveRatioBounds = (
  containerHeight: number,
  minTopSectionHeightPx: number,
  minBottomSectionHeightPx: number
): RatioBounds => {
  const safeHeight = Math.max(1, containerHeight);
  const min = clamp(minTopSectionHeightPx / safeHeight, 0.01, 0.98);
  const max = clamp(1 - minBottomSectionHeightPx / safeHeight, 0.02, 0.995);
  if (min <= max) return { min, max };

  // When the container is too small to satisfy both section minimums, pin the divider
  // to a single safe ratio that preserves the lower bound rather than allowing overflow.
  const pinned = clamp(max, FALLBACK_MIN_RATIO, FALLBACK_MAX_RATIO);
  return { min: pinned, max: pinned };
};

/**
 * Returns top/bottom styles and divider interaction props for the split grid layout.
 */
export const useReferenceGridHorizontalSplit = ({
  enabled,
  containerRef,
  defaultTopRatio = DEFAULT_TOP_RATIO,
  minTopSectionHeightPx = DEFAULT_MIN_TOP_SECTION_HEIGHT_PX,
  minBottomSectionHeightPx = DEFAULT_MIN_BOTTOM_SECTION_HEIGHT_PX,
  allRefsSnapTopHeightPx = DEFAULT_ALL_REFS_SNAP_TOP_HEIGHT_PX,
  collapseTopHeightPx,
  ariaLabel = "Resize Quick Slot Inventory and Reference Grid sections",
}: UseReferenceGridHorizontalSplitArgs) => {
  const dragSessionRef = useRef<DragSession | null>(null);
  const detachPointerListenersRef = useRef<(() => void) | null>(null);
  const [allRefsExpandedThresholdRatio, setAllRefsExpandedThresholdRatio] = useState<number | null>(
    null
  );
  const [topRatio, setTopRatio] = useState(() =>
    clamp(defaultTopRatio, FALLBACK_MIN_RATIO, FALLBACK_MAX_RATIO)
  );
  const topRatioRef = useRef(topRatio);
  const [containerHeightPx, setContainerHeightPx] = useState(0);
  const containerHeightRef = useRef(containerHeightPx);

  const stopResizing = useCallback(() => {
    if (detachPointerListenersRef.current) {
      detachPointerListenersRef.current();
      detachPointerListenersRef.current = null;
    }
    dragSessionRef.current = null;
  }, []);

  useEffect(() => stopResizing, [stopResizing]);
  useEffect(() => {
    topRatioRef.current = topRatio;
  }, [topRatio]);
  useEffect(() => {
    containerHeightRef.current = containerHeightPx;
  }, [containerHeightPx]);

  const resolveContainerHeight = useCallback((): number => {
    return resolveElementHeight(containerRef.current);
  }, [containerRef]);

  const clampTopRatio = useCallback(
    (ratio: number, containerHeight: number) => {
      const bounds = resolveRatioBounds(
        containerHeight,
        minTopSectionHeightPx,
        minBottomSectionHeightPx
      );
      return clamp(ratio, bounds.min, bounds.max);
    },
    [minBottomSectionHeightPx, minTopSectionHeightPx]
  );

  const resolveCollapseRatio = useCallback(
    (containerHeight: number) => {
      const resolvedCollapseTopHeightPx =
        typeof collapseTopHeightPx === "number" && Number.isFinite(collapseTopHeightPx)
          ? Math.max(0, collapseTopHeightPx)
          : allRefsSnapTopHeightPx;
      return clampTopRatio(
        resolvedCollapseTopHeightPx / Math.max(1, containerHeight),
        containerHeight
      );
    },
    [allRefsSnapTopHeightPx, clampTopRatio, collapseTopHeightPx]
  );

  const commitTopRatio = useCallback((nextRatio: number) => {
    topRatioRef.current = nextRatio;
    setTopRatio((prev) => (Math.abs(prev - nextRatio) < 0.001 ? prev : nextRatio));
  }, []);

  const reconcileTopRatioForContainerHeight = useCallback(
    (nextHeight: number) => {
      if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
      const previousHeight =
        containerHeightRef.current > 0 ? containerHeightRef.current : nextHeight;
      const preservedTopHeightPx = topRatioRef.current * Math.max(1, previousHeight);
      containerHeightRef.current = nextHeight;
      setContainerHeightPx((prev) => (prev === nextHeight ? prev : nextHeight));
      const clampedRatio = clampTopRatio(
        preservedTopHeightPx / Math.max(1, nextHeight),
        nextHeight
      );
      if (Math.abs(topRatioRef.current - clampedRatio) < 0.001) return;
      commitTopRatio(clampedRatio);
    },
    [clampTopRatio, commitTopRatio]
  );

  const applyDeltaPx = useCallback(
    (deltaPx: number, resolvedHeight?: number): number => {
      if (!Number.isFinite(deltaPx) || Math.abs(deltaPx) < 0.0001) return 0;
      const containerHeight = Math.max(1, resolvedHeight ?? (resolveContainerHeight() || 600));
      const bounds = resolveRatioBounds(
        containerHeight,
        minTopSectionHeightPx,
        minBottomSectionHeightPx
      );
      const currentRatio = clamp(topRatioRef.current, bounds.min, bounds.max);
      if (Math.abs(currentRatio - topRatioRef.current) >= 0.001) {
        commitTopRatio(currentRatio);
      }
      const nextRatio = clamp(currentRatio + deltaPx / containerHeight, bounds.min, bounds.max);
      const consumedPx = (nextRatio - currentRatio) * containerHeight;
      const residualPx = deltaPx - consumedPx;
      if (Math.abs(nextRatio - currentRatio) >= 0.001) {
        commitTopRatio(nextRatio);
      }
      return Math.abs(residualPx) < 0.01 ? 0 : residualPx;
    },
    [commitTopRatio, minBottomSectionHeightPx, minTopSectionHeightPx, resolveContainerHeight]
  );

  const handleWindowPointerMove = useCallback(
    (event: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      const deltaY = event.clientY - session.lastClientY;
      if (Math.abs(deltaY) < 0.0001) return;
      session.lastClientY = event.clientY;
      const liveContainerHeight = resolveContainerHeight();
      if (liveContainerHeight > 0 && liveContainerHeight !== session.containerHeight) {
        session.containerHeight = liveContainerHeight;
        setContainerHeightPx((prev) => (prev === liveContainerHeight ? prev : liveContainerHeight));
      }
      setAllRefsExpandedThresholdRatio((prev) => (prev == null ? prev : null));
      applyDeltaPx(deltaY, session.containerHeight);
    },
    [applyDeltaPx, resolveContainerHeight]
  );

  const handleDividerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || event.button !== 0) return;
      const height = resolveContainerHeight();
      if (!height) return;
      setAllRefsExpandedThresholdRatio((prev) => (prev == null ? prev : null));
      setContainerHeightPx((prev) => (prev === height ? prev : height));
      const clampedStartRatio = clampTopRatio(topRatioRef.current, height);
      if (Math.abs(clampedStartRatio - topRatioRef.current) >= 0.001) {
        commitTopRatio(clampedStartRatio);
      }
      dragSessionRef.current = {
        pointerId: event.pointerId,
        containerHeight: height,
        lastClientY: event.clientY,
      };

      const handlePointerStop = (nativeEvent: PointerEvent) => {
        const session = dragSessionRef.current;
        if (!session || nativeEvent.pointerId !== session.pointerId) return;
        stopResizing();
      };

      window.addEventListener("pointermove", handleWindowPointerMove);
      window.addEventListener("pointerup", handlePointerStop);
      window.addEventListener("pointercancel", handlePointerStop);
      detachPointerListenersRef.current = () => {
        window.removeEventListener("pointermove", handleWindowPointerMove);
        window.removeEventListener("pointerup", handlePointerStop);
        window.removeEventListener("pointercancel", handlePointerStop);
      };
      event.preventDefault();
    },
    [
      clampTopRatio,
      enabled,
      handleWindowPointerMove,
      resolveContainerHeight,
      stopResizing,
      topRatioRef,
      commitTopRatio,
    ]
  );

  const handleDividerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!enabled) return;
      const height = resolveContainerHeight();
      const bounds =
        height > 0
          ? resolveRatioBounds(height, minTopSectionHeightPx, minBottomSectionHeightPx)
          : FALLBACK_RATIO_BOUNDS;
      const step = event.shiftKey ? KEYBOARD_FAST_STEP : KEYBOARD_STEP;
      setAllRefsExpandedThresholdRatio((prev) => (prev == null ? prev : null));

      if (event.key === "Home") {
        event.preventDefault();
        if (!height) {
          commitTopRatio(bounds.min);
          return;
        }
        setContainerHeightPx((prev) => (prev === height ? prev : height));
        commitTopRatio(bounds.min);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        if (!height) {
          commitTopRatio(bounds.max);
          return;
        }
        setContainerHeightPx((prev) => (prev === height ? prev : height));
        commitTopRatio(bounds.max);
        return;
      }
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      if (!height) {
        const deltaRatio = event.key === "ArrowUp" ? -step : step;
        const nextRatio = clamp(topRatioRef.current + deltaRatio, bounds.min, bounds.max);
        commitTopRatio(nextRatio);
        return;
      }
      setContainerHeightPx((prev) => (prev === height ? prev : height));
      const deltaPx = (event.key === "ArrowUp" ? -step : step) * height;
      applyDeltaPx(deltaPx, height);
    },
    [
      applyDeltaPx,
      commitTopRatio,
      enabled,
      minBottomSectionHeightPx,
      minTopSectionHeightPx,
      resolveContainerHeight,
      topRatioRef,
    ]
  );

  useEffect(() => {
    if (!enabled) return;
    const height = resolveContainerHeight();
    if (!height) return;
    // Keep this synchronous so ratio/height state is settled before first paint and resize tests.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reconcileTopRatioForContainerHeight(height);
  }, [enabled, reconcileTopRatioForContainerHeight, resolveContainerHeight]);

  useEffect(() => {
    if (!enabled || typeof ResizeObserver === "undefined") return;
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      const nextHeight = resolveContainerHeight();
      if (!nextHeight) return;
      reconcileTopRatioForContainerHeight(nextHeight);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef, enabled, reconcileTopRatioForContainerHeight, resolveContainerHeight]);

  const ratioBounds =
    containerHeightPx > 0
      ? resolveRatioBounds(containerHeightPx, minTopSectionHeightPx, minBottomSectionHeightPx)
      : FALLBACK_RATIO_BOUNDS;
  const ariaValueNow = Math.round(topRatio * 100);
  const ariaValueMin = Math.round(ratioBounds.min * 100);
  const ariaValueMax = Math.round(ratioBounds.max * 100);
  const collapseRatio =
    containerHeightPx > 0 ? resolveCollapseRatio(containerHeightPx) : FALLBACK_MIN_RATIO;
  const effectiveAllRefsExpandedThreshold = Math.max(
    collapseRatio,
    allRefsExpandedThresholdRatio ?? collapseRatio
  );
  const isAllRefsExpanded = topRatio <= effectiveAllRefsExpandedThreshold + 0.0005;
  const isInventoryExpanded = topRatio >= ratioBounds.max - 0.0005;

  const snapToInventoryExpanded = useCallback(() => {
    setAllRefsExpandedThresholdRatio((prev) => (prev == null ? prev : null));
    const height = resolveContainerHeight();
    if (!height) {
      commitTopRatio(0.995);
      return;
    }
    setContainerHeightPx((prev) => (prev === height ? prev : height));
    const bounds = resolveRatioBounds(height, minTopSectionHeightPx, minBottomSectionHeightPx);
    commitTopRatio(bounds.max);
  }, [commitTopRatio, minBottomSectionHeightPx, minTopSectionHeightPx, resolveContainerHeight]);

  const snapToAllRefsExpanded = useCallback(
    (topHeightPx?: number) => {
      const resolvedTopHeightPx =
        typeof topHeightPx === "number" && Number.isFinite(topHeightPx)
          ? Math.max(0, topHeightPx)
          : allRefsSnapTopHeightPx;
      const height = resolveContainerHeight();
      if (!height) {
        const fallbackRatio = clamp(resolvedTopHeightPx / 600, 0.01, 0.99);
        setAllRefsExpandedThresholdRatio((prev) => (prev === fallbackRatio ? prev : fallbackRatio));
        commitTopRatio(fallbackRatio);
        return;
      }
      setContainerHeightPx((prev) => (prev === height ? prev : height));
      const targetRatio = clampTopRatio(resolvedTopHeightPx / Math.max(1, height), height);
      setAllRefsExpandedThresholdRatio((prev) => (prev === targetRatio ? prev : targetRatio));
      commitTopRatio(targetRatio);
    },
    [allRefsSnapTopHeightPx, clampTopRatio, commitTopRatio, resolveContainerHeight]
  );

  const nudgeTopSectionHeightByPx = useCallback(
    (deltaPx: number): number => {
      if (!Number.isFinite(deltaPx)) return 0;
      if (!enabled || Math.abs(deltaPx) < 0.0001) return deltaPx;
      setAllRefsExpandedThresholdRatio((prev) => (prev == null ? prev : null));
      const height = resolveContainerHeight();
      if (height) {
        setContainerHeightPx((prev) => (prev === height ? prev : height));
      }
      return applyDeltaPx(deltaPx, height || 600);
    },
    [applyDeltaPx, enabled, resolveContainerHeight]
  );

  const clampToContainerBounds = useCallback(() => {
    if (!enabled) return;
    const height = resolveContainerHeight();
    if (!height) return;
    setContainerHeightPx((prev) => (prev === height ? prev : height));
    const clampedRatio = clampTopRatio(topRatioRef.current, height);
    if (Math.abs(topRatioRef.current - clampedRatio) < 0.001) return;
    commitTopRatio(clampedRatio);
  }, [clampTopRatio, commitTopRatio, enabled, resolveContainerHeight]);

  const topSectionStyle = useMemo<CSSProperties>(
    () => ({
      flex: `0 0 ${Math.round(topRatio * 1000) / 10}%`,
    }),
    [topRatio]
  );

  const bottomSectionStyle = useMemo<CSSProperties>(
    () => ({
      flex: `1 1 ${Math.round((1 - topRatio) * 1000) / 10}%`,
    }),
    [topRatio]
  );

  return {
    topRatio,
    bottomRatio: 1 - topRatio,
    topSectionHeightPx: containerHeightPx > 0 ? topRatio * containerHeightPx : 0,
    bottomSectionHeightPx: containerHeightPx > 0 ? (1 - topRatio) * containerHeightPx : 0,
    topSectionStyle,
    bottomSectionStyle,
    isAllRefsExpanded,
    isInventoryExpanded,
    snapToInventoryExpanded,
    snapToAllRefsExpanded,
    nudgeTopSectionHeightByPx,
    clampToContainerBounds,
    dividerProps: {
      role: "separator" as const,
      "aria-orientation": "horizontal" as const,
      "aria-label": ariaLabel,
      "aria-valuemin": ariaValueMin,
      "aria-valuemax": ariaValueMax,
      "aria-valuenow": ariaValueNow,
      tabIndex: enabled ? 0 : -1,
      onPointerDown: handleDividerPointerDown,
      onKeyDown: handleDividerKeyDown,
    },
  };
};
