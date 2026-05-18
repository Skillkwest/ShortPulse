import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import {
  computeMediaVirtualLayoutFrame,
  resolveVisibleMediaVirtualItems,
  type MediaVirtualItem,
} from "../logic/mediaGridVirtualization";

type UseMediaMasonryVirtualizationArgs<TItem> = {
  items: TItem[];
  getItemId: (item: TItem) => string;
  getAspectRatio: (item: TItem) => number;
  enabled: boolean;
  scrollContainerRef?: MutableRefObject<HTMLElement | null>;
  targetColumnWidth: number;
  maxColumnCount?: number;
  gap: number;
  overscanPx: number;
  minItemsToVirtualize?: number;
};

export type VirtualizedRenderItem<TItem> = {
  id: string;
  item: TItem;
  index: number;
  style?: CSSProperties;
};

type UseMediaMasonryVirtualizationResult<TItem> = {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  isVirtualized: boolean;
  totalHeight: number;
  columnCount: number;
  columnWidth: number;
  renderItems: VirtualizedRenderItem<TItem>[];
};

/**
 * Shared modal/panel hook for virtualized masonry rendering.
 */
export const useMediaMasonryVirtualization = <TItem>({
  items,
  getItemId,
  getAspectRatio,
  enabled,
  scrollContainerRef,
  targetColumnWidth,
  maxColumnCount,
  gap,
  overscanPx,
  minItemsToVirtualize = 24,
}: UseMediaMasonryVirtualizationArgs<TItem>): UseMediaMasonryVirtualizationResult<TItem> => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(
    typeof window !== "undefined" ? Math.max(0, window.innerWidth) : 0
  );
  const [viewportTop, setViewportTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const sourceItems = useMemo<MediaVirtualItem[]>(
    () =>
      items.map((item) => ({
        id: getItemId(item),
        aspectRatio: getAspectRatio(item),
      })),
    [getAspectRatio, getItemId, items]
  );

  const shouldVirtualize = enabled && items.length >= minItemsToVirtualize && containerWidth > 0;

  const measureViewport = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (scrollContainerRef?.current) {
      const root = scrollContainerRef.current;
      const containerRect = container.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      const relativeTop = containerRect.top - rootRect.top + root.scrollTop;
      setViewportTop(Math.max(0, root.scrollTop - relativeTop));
      setViewportHeight(Math.max(0, root.clientHeight));
      return;
    }
    if (typeof window === "undefined") return;
    const containerRect = container.getBoundingClientRect();
    const containerTop = window.scrollY + containerRect.top;
    setViewportTop(Math.max(0, window.scrollY - containerTop));
    setViewportHeight(Math.max(0, window.innerHeight));
  }, [scrollContainerRef]);

  const scheduleMeasureViewport = useCallback(() => {
    if (rafIdRef.current != null || typeof window === "undefined") return;
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      measureViewport();
    });
  }, [measureViewport]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const resizeObserver = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(Math.max(0, Math.round(nextWidth)));
      scheduleMeasureViewport();
    });
    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
    };
  }, [scheduleMeasureViewport]);

  useEffect(() => {
    measureViewport();
  }, [items.length, measureViewport, shouldVirtualize]);

  useEffect(() => {
    const root = scrollContainerRef?.current;
    if (root) {
      root.addEventListener("scroll", scheduleMeasureViewport, { passive: true });
      return () => {
        root.removeEventListener("scroll", scheduleMeasureViewport);
      };
    }
    if (typeof window === "undefined") return;
    window.addEventListener("scroll", scheduleMeasureViewport, { passive: true });
    window.addEventListener("resize", scheduleMeasureViewport);
    return () => {
      window.removeEventListener("scroll", scheduleMeasureViewport);
      window.removeEventListener("resize", scheduleMeasureViewport);
    };
  }, [scheduleMeasureViewport, scrollContainerRef]);

  useEffect(
    () => () => {
      if (rafIdRef.current != null && typeof window !== "undefined") {
        window.cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = null;
    },
    []
  );

  const layoutFrame = useMemo(() => {
    if (!shouldVirtualize) return null;
    return computeMediaVirtualLayoutFrame({
      items: sourceItems,
      containerWidth,
      targetColumnWidth,
      maxColumnCount,
      gap,
    });
  }, [containerWidth, gap, maxColumnCount, shouldVirtualize, sourceItems, targetColumnWidth]);

  const layout = useMemo(() => {
    if (!shouldVirtualize || !layoutFrame) return null;
    return {
      columnCount: layoutFrame.columnCount,
      columnWidth: layoutFrame.columnWidth,
      totalHeight: layoutFrame.totalHeight,
      visibleItems: resolveVisibleMediaVirtualItems({
        layout: layoutFrame,
        viewportTop,
        viewportHeight,
        overscanPx,
      }),
    };
  }, [layoutFrame, overscanPx, shouldVirtualize, viewportHeight, viewportTop]);

  const renderItems = useMemo<VirtualizedRenderItem<TItem>[]>(() => {
    if (!shouldVirtualize || !layout) {
      return items.map((item, index) => ({
        id: getItemId(item),
        item,
        index,
      }));
    }
    return layout.visibleItems
      .map((entry) => {
        const item = items[entry.index];
        if (!item) return null;
        return {
          id: entry.id,
          item,
          index: entry.index,
          style: {
            position: "absolute",
            top: `${entry.top}px`,
            left: `${entry.left}px`,
            width: `${entry.width}px`,
            height: `${entry.height}px`,
          },
        };
      })
      .filter(Boolean) as VirtualizedRenderItem<TItem>[];
  }, [getItemId, items, layout, shouldVirtualize]);

  return {
    containerRef,
    isVirtualized: shouldVirtualize && Boolean(layout),
    totalHeight: layout?.totalHeight ?? 0,
    columnCount: layout?.columnCount ?? 1,
    columnWidth: layout?.columnWidth ?? targetColumnWidth,
    renderItems,
  };
};
