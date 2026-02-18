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
  minSectionHeightPx?: number;
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
const DEFAULT_MIN_SECTION_HEIGHT_PX = 120;
const KEYBOARD_STEP = 0.03;
const KEYBOARD_FAST_STEP = 0.07;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const resolveRatioBounds = (containerHeight: number, minSectionHeightPx: number): RatioBounds => {
  const safeHeight = Math.max(1, containerHeight);
  const min = clamp(minSectionHeightPx / safeHeight, 0.1, 0.49);
  const max = clamp(1 - minSectionHeightPx / safeHeight, 0.51, 0.9);
  return min <= max ? { min, max } : { min: 0.3, max: 0.7 };
};

/**
 * Returns top/bottom styles and divider interaction props for the split grid layout.
 */
export const useReferenceGridHorizontalSplit = ({
  enabled,
  containerRef,
  defaultTopRatio = DEFAULT_TOP_RATIO,
  minSectionHeightPx = DEFAULT_MIN_SECTION_HEIGHT_PX,
}: UseReferenceGridHorizontalSplitArgs) => {
  const dragSessionRef = useRef<DragSession | null>(null);
  const detachPointerListenersRef = useRef<(() => void) | null>(null);
  const [topRatio, setTopRatio] = useState(() => clamp(defaultTopRatio, 0.1, 0.9));
  const [containerHeightPx, setContainerHeightPx] = useState(0);

  const stopResizing = useCallback(() => {
    if (detachPointerListenersRef.current) {
      detachPointerListenersRef.current();
      detachPointerListenersRef.current = null;
    }
    dragSessionRef.current = null;
  }, []);

  useEffect(() => stopResizing, [stopResizing]);

  const resolveContainerHeight = useCallback((): number => {
    const node = containerRef.current;
    if (!node) return 0;
    return node.getBoundingClientRect().height;
  }, [containerRef]);

  const clampTopRatio = useCallback(
    (ratio: number, containerHeight: number) => {
      const bounds = resolveRatioBounds(containerHeight, minSectionHeightPx);
      return clamp(ratio, bounds.min, bounds.max);
    },
    [minSectionHeightPx]
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
        return;
      }
      const clampedRatio = clampTopRatio(nextRatio, height);
      setTopRatio((prev) => (Math.abs(prev - clampedRatio) < 0.001 ? prev : clampedRatio));
    },
    [clampTopRatio, resolveContainerHeight]
  );

  const handleWindowPointerMove = useCallback(
    (event: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      const deltaY = event.clientY - session.startClientY;
      const nextRatio = session.startRatio + deltaY / Math.max(1, session.containerHeight);
      setTopRatio((prev) => {
        const clampedRatio = clampTopRatio(nextRatio, session.containerHeight);
        return Math.abs(prev - clampedRatio) < 0.001 ? prev : clampedRatio;
      });
    },
    [clampTopRatio]
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
      const bounds = resolveRatioBounds(height || 1, minSectionHeightPx);
      const step = event.shiftKey ? KEYBOARD_FAST_STEP : KEYBOARD_STEP;

      if (event.key === "Home") {
        event.preventDefault();
        setTopRatio((prev) => (Math.abs(prev - bounds.min) < 0.001 ? prev : bounds.min));
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        setTopRatio((prev) => (Math.abs(prev - bounds.max) < 0.001 ? prev : bounds.max));
        return;
      }
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      const delta = event.key === "ArrowUp" ? -step : step;
      setClampedTopRatio(topRatio + delta);
    },
    [enabled, minSectionHeightPx, resolveContainerHeight, setClampedTopRatio, topRatio]
  );

  useEffect(() => {
    if (!enabled) return;
    const height = resolveContainerHeight();
    if (!height) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContainerHeightPx((prev) => (prev === height ? prev : height));
    setTopRatio((prev) => {
      const clampedRatio = clampTopRatio(prev, height);
      return Math.abs(prev - clampedRatio) < 0.001 ? prev : clampedRatio;
    });
  }, [clampTopRatio, enabled, resolveContainerHeight]);

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
        return Math.abs(prev - clampedRatio) < 0.001 ? prev : clampedRatio;
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [clampTopRatio, containerRef, enabled, resolveContainerHeight]);

  const ratioBounds = resolveRatioBounds(containerHeightPx || 1, minSectionHeightPx);
  const ariaValueNow = Math.round(topRatio * 100);
  const ariaValueMin = Math.round(ratioBounds.min * 100);
  const ariaValueMax = Math.round(ratioBounds.max * 100);

  const topSectionStyle = useMemo<CSSProperties>(
    () => ({
      flexBasis: `${Math.round(topRatio * 1000) / 10}%`,
    }),
    [topRatio]
  );

  const bottomSectionStyle = useMemo<CSSProperties>(
    () => ({
      flexBasis: `${Math.round((1 - topRatio) * 1000) / 10}%`,
    }),
    [topRatio]
  );

  return {
    topRatio,
    topSectionStyle,
    bottomSectionStyle,
    dividerProps: {
      role: "separator" as const,
      "aria-orientation": "horizontal" as const,
      "aria-label": "Resize curated and all references sections",
      "aria-valuemin": ariaValueMin,
      "aria-valuemax": ariaValueMax,
      "aria-valuenow": ariaValueNow,
      tabIndex: enabled ? 0 : -1,
      onPointerDown: handleDividerPointerDown,
      onKeyDown: handleDividerKeyDown,
    },
  };
};
