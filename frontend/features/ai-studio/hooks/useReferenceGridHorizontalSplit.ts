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
};

type DragSession = {
  pointerId: number;
  containerHeight: number;
  startClientY: number;
  startRatio: number;
};

type RatioBounds = {
  min: number;
  max: number;
};

const DEFAULT_TOP_RATIO = 0.35;
const DEFAULT_MIN_TOP_SECTION_HEIGHT_PX = 120;
const DEFAULT_MIN_BOTTOM_SECTION_HEIGHT_PX = 120;
const DEFAULT_ALL_REFS_SNAP_TOP_HEIGHT_PX = 24;
const KEYBOARD_STEP = 0.03;
const KEYBOARD_FAST_STEP = 0.07;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const resolveRatioBounds = (
  containerHeight: number,
  minTopSectionHeightPx: number,
  minBottomSectionHeightPx: number
): RatioBounds => {
  const safeHeight = Math.max(1, containerHeight);
  const min = clamp(minTopSectionHeightPx / safeHeight, 0.01, 0.98);
  const max = clamp(1 - minBottomSectionHeightPx / safeHeight, 0.02, 0.995);
  return min <= max ? { min, max } : { min: 0.3, max: 0.7 };
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
}: UseReferenceGridHorizontalSplitArgs) => {
  const dragSessionRef = useRef<DragSession | null>(null);
  const detachPointerListenersRef = useRef<(() => void) | null>(null);
  const [topRatio, setTopRatio] = useState(() => clamp(defaultTopRatio, 0.1, 0.9));
  const [containerHeightPx, setContainerHeightPx] = useState(0);
  const [isAllRefsExpanded, setIsAllRefsExpanded] = useState(false);
  const [isInventoryExpanded, setIsInventoryExpanded] = useState(false);

  const stopResizing = useCallback(() => {
    if (detachPointerListenersRef.current) {
      detachPointerListenersRef.current();
      detachPointerListenersRef.current = null;
    }
    dragSessionRef.current = null;
  }, []);

  useEffect(() => stopResizing, [stopResizing]);

  useEffect(() => {
    if (enabled) return;
    setIsAllRefsExpanded(false);
    setIsInventoryExpanded(false);
  }, [enabled]);

  const resolveContainerHeight = useCallback((): number => {
    const node = containerRef.current;
    if (!node) return 0;
    return node.getBoundingClientRect().height;
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

  const syncIsAllRefsExpanded = useCallback(
    (ratio: number, containerHeight: number) => {
      const collapsed = ratio <= resolveCollapseRatio(containerHeight) + 0.0005;
      setIsAllRefsExpanded((prev) => (prev === collapsed ? prev : collapsed));
    },
    [resolveCollapseRatio]
  );

  const syncIsInventoryExpanded = useCallback(
    (ratio: number, containerHeight: number) => {
      const bounds = resolveRatioBounds(
        containerHeight,
        minTopSectionHeightPx,
        minBottomSectionHeightPx
      );
      const collapsed = ratio >= bounds.max - 0.0005;
      setIsInventoryExpanded((prev) => (prev === collapsed ? prev : collapsed));
    },
    [minBottomSectionHeightPx, minTopSectionHeightPx]
  );

  const syncSplitCollapseStates = useCallback(
    (ratio: number, containerHeight: number) => {
      syncIsAllRefsExpanded(ratio, containerHeight);
      syncIsInventoryExpanded(ratio, containerHeight);
    },
    [syncIsAllRefsExpanded, syncIsInventoryExpanded]
  );

  const setClampedTopRatio = useCallback(
    (nextRatio: number) => {
      const height = resolveContainerHeight();
      setContainerHeightPx((prev) => (prev === height ? prev : height));
      if (height <= 0) {
        setTopRatio((prev) => {
          const safeNext = clamp(nextRatio, 0.1, 0.9);
          return Math.abs(prev - safeNext) < 0.001 ? prev : safeNext;
        });
        setIsAllRefsExpanded(false);
        setIsInventoryExpanded(false);
        return;
      }
      const clampedRatio = clampTopRatio(nextRatio, height);
      setTopRatio((prev) => (Math.abs(prev - clampedRatio) < 0.001 ? prev : clampedRatio));
      syncSplitCollapseStates(clampedRatio, height);
    },
    [clampTopRatio, resolveContainerHeight, syncSplitCollapseStates]
  );

  const handleWindowPointerMove = useCallback(
    (event: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      const deltaY = event.clientY - session.startClientY;
      const nextRatio = session.startRatio + deltaY / Math.max(1, session.containerHeight);
      const clampedRatio = clampTopRatio(nextRatio, session.containerHeight);
      setTopRatio((prev) => {
        return Math.abs(prev - clampedRatio) < 0.001 ? prev : clampedRatio;
      });
      syncSplitCollapseStates(clampedRatio, session.containerHeight);
    },
    [clampTopRatio, syncSplitCollapseStates]
  );

  const handleDividerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || event.button !== 0) return;
      const height = resolveContainerHeight();
      if (!height) return;
      setContainerHeightPx((prev) => (prev === height ? prev : height));
      const clampedStartRatio = clampTopRatio(topRatio, height);
      dragSessionRef.current = {
        pointerId: event.pointerId,
        containerHeight: height,
        startClientY: event.clientY,
        startRatio: clampedStartRatio,
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
      topRatio,
    ]
  );

  const handleDividerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!enabled) return;
      const height = resolveContainerHeight();
      const bounds = resolveRatioBounds(
        height || 1,
        minTopSectionHeightPx,
        minBottomSectionHeightPx
      );
      const step = event.shiftKey ? KEYBOARD_FAST_STEP : KEYBOARD_STEP;

      if (event.key === "Home") {
        event.preventDefault();
        if (!height) {
          setIsAllRefsExpanded(false);
          setIsInventoryExpanded(false);
          setTopRatio((prev) => (Math.abs(prev - bounds.min) < 0.001 ? prev : bounds.min));
          return;
        }
        setTopRatio((prev) => (Math.abs(prev - bounds.min) < 0.001 ? prev : bounds.min));
        syncSplitCollapseStates(bounds.min, height);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        if (!height) {
          setIsAllRefsExpanded(false);
          setIsInventoryExpanded(false);
          setTopRatio((prev) => (Math.abs(prev - bounds.max) < 0.001 ? prev : bounds.max));
          return;
        }
        setTopRatio((prev) => (Math.abs(prev - bounds.max) < 0.001 ? prev : bounds.max));
        syncSplitCollapseStates(bounds.max, height);
        return;
      }
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      const delta = event.key === "ArrowUp" ? -step : step;
      setClampedTopRatio(topRatio + delta);
    },
    [
      enabled,
      minBottomSectionHeightPx,
      minTopSectionHeightPx,
      resolveContainerHeight,
      setIsAllRefsExpanded,
      setIsInventoryExpanded,
      setClampedTopRatio,
      syncSplitCollapseStates,
      topRatio,
    ]
  );

  useEffect(() => {
    if (!enabled) return;
    const height = resolveContainerHeight();
    if (!height) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContainerHeightPx((prev) => (prev === height ? prev : height));
    setTopRatio((prev) => {
      const clampedRatio = clampTopRatio(prev, height);
      syncSplitCollapseStates(clampedRatio, height);
      return Math.abs(prev - clampedRatio) < 0.001 ? prev : clampedRatio;
    });
  }, [clampTopRatio, enabled, resolveContainerHeight, syncSplitCollapseStates]);

  useEffect(() => {
    if (!enabled || typeof ResizeObserver === "undefined") return;
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      const nextHeight = resolveContainerHeight();
      if (!nextHeight) return;
      setContainerHeightPx((prev) => (prev === nextHeight ? prev : nextHeight));
      setTopRatio((prev) => {
        const clampedRatio = clampTopRatio(prev, nextHeight);
        syncSplitCollapseStates(clampedRatio, nextHeight);
        return Math.abs(prev - clampedRatio) < 0.001 ? prev : clampedRatio;
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [clampTopRatio, containerRef, enabled, resolveContainerHeight, syncSplitCollapseStates]);

  const ratioBounds = resolveRatioBounds(
    containerHeightPx || 1,
    minTopSectionHeightPx,
    minBottomSectionHeightPx
  );
  const ariaValueNow = Math.round(topRatio * 100);
  const ariaValueMin = Math.round(ratioBounds.min * 100);
  const ariaValueMax = Math.round(ratioBounds.max * 100);

  const snapToInventoryExpanded = useCallback(() => {
    setIsAllRefsExpanded(false);
    setIsInventoryExpanded(true);
    const height = resolveContainerHeight();
    if (!height) {
      setTopRatio((prev) => (Math.abs(prev - 0.995) < 0.001 ? prev : 0.995));
      return;
    }
    const bounds = resolveRatioBounds(height, minTopSectionHeightPx, minBottomSectionHeightPx);
    setTopRatio((prev) => (Math.abs(prev - bounds.max) < 0.001 ? prev : bounds.max));
  }, [minBottomSectionHeightPx, minTopSectionHeightPx, resolveContainerHeight]);

  const snapToAllRefsExpanded = useCallback(
    (topHeightPx?: number) => {
      setIsAllRefsExpanded(true);
      setIsInventoryExpanded(false);
      const resolvedTopHeightPx =
        typeof topHeightPx === "number" && Number.isFinite(topHeightPx)
          ? Math.max(0, topHeightPx)
          : allRefsSnapTopHeightPx;
      const height = resolveContainerHeight();
      if (!height) {
        const fallbackRatio = clamp(resolvedTopHeightPx / 600, 0.01, 0.99);
        setTopRatio((prev) => (Math.abs(prev - fallbackRatio) < 0.001 ? prev : fallbackRatio));
        return;
      }
      const targetRatio = clampTopRatio(resolvedTopHeightPx / Math.max(1, height), height);
      setTopRatio((prev) => (Math.abs(prev - targetRatio) < 0.001 ? prev : targetRatio));
    },
    [allRefsSnapTopHeightPx, clampTopRatio, resolveContainerHeight]
  );

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
    topSectionStyle,
    bottomSectionStyle,
    isAllRefsExpanded,
    isInventoryExpanded,
    snapToInventoryExpanded,
    snapToAllRefsExpanded,
    dividerProps: {
      role: "separator" as const,
      "aria-orientation": "horizontal" as const,
      "aria-label": "Resize Quick Slot Inventory and Reference Grid sections",
      "aria-valuemin": ariaValueMin,
      "aria-valuemax": ariaValueMax,
      "aria-valuenow": ariaValueNow,
      tabIndex: enabled ? 0 : -1,
      onPointerDown: handleDividerPointerDown,
      onKeyDown: handleDividerKeyDown,
    },
  };
};
