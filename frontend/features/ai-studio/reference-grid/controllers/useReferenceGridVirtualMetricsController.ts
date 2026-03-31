/**
 * Virtual metrics controller for Reference Grid surfaces.
 * Keeps resize/measurement orchestration and observer lifecycle out of ReferenceGrid rendering logic.
 */
import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { incrementFreezeInvestigationCounter } from "../../logic/freezeInvestigationTelemetry";

type VirtualMetricsState = {
  scrollTop: number;
  viewportHeight: number;
  columnCount: number;
  rowHeight: number;
};

type UseReferenceGridVirtualMetricsControllerArgs = {
  isCuratedSplitEnabled: boolean;
  isWideLayout: boolean;
  outputsLength: number;
  curatedOutputsLength: number;
  scrollContainerRef: MutableRefObject<HTMLDivElement | null>;
  gridRef: MutableRefObject<HTMLDivElement | null>;
  curatedScrollContainerRef: MutableRefObject<HTMLDivElement | null>;
  curatedGridRef: MutableRefObject<HTMLDivElement | null>;
  setVirtualMetrics: Dispatch<SetStateAction<VirtualMetricsState>>;
  setCuratedVirtualMetrics: Dispatch<SetStateAction<VirtualMetricsState>>;
  config: {
    referenceGridMinColumns: number;
    referenceGridMinCardPx: number;
    referenceGridMinCardPxWide: number;
    referenceGridMaxColumns: number;
    referenceGridMaxColumnsWide: number;
    quickSlotInventoryMaxColumns: number;
    fallbackReferenceRowHeight: number;
  };
};

/**
 * Installs metric synchronization and resize observation for all-refs/curated grid surfaces.
 */
export const useReferenceGridVirtualMetricsController = ({
  isCuratedSplitEnabled,
  isWideLayout,
  outputsLength,
  curatedOutputsLength,
  scrollContainerRef,
  gridRef,
  curatedScrollContainerRef,
  curatedGridRef,
  setVirtualMetrics,
  setCuratedVirtualMetrics,
  config,
}: UseReferenceGridVirtualMetricsControllerArgs): void => {
  const syncVirtualMetricsForSurface = useCallback(
    ({
      scrollNode,
      gridNode,
      surface,
      setMetrics,
    }: {
      scrollNode: HTMLDivElement | null;
      gridNode: HTMLDivElement | null;
      surface: "all-refs" | "curated";
      setMetrics: Dispatch<SetStateAction<VirtualMetricsState>>;
    }) => {
      if (!scrollNode || !gridNode) return;
      const defaultRequestedMaxColumns = isWideLayout
        ? config.referenceGridMaxColumnsWide
        : config.referenceGridMaxColumns;
      const requestedMaxColumns =
        surface === "curated"
          ? Math.min(config.quickSlotInventoryMaxColumns, config.referenceGridMaxColumnsWide)
          : defaultRequestedMaxColumns;
      const maxColumns = Math.max(config.referenceGridMinColumns, Math.floor(requestedMaxColumns));
      const minCardWidth = isWideLayout
        ? config.referenceGridMinCardPxWide
        : config.referenceGridMinCardPx;
      const style = window.getComputedStyle(gridNode);
      const rowGap = Number.parseFloat(style.rowGap || style.gap || "0");
      const gap = Number.isFinite(rowGap) ? rowGap : 3;
      const paddingLeft = Number.parseFloat(style.paddingLeft || "0") || 0;
      const paddingRight = Number.parseFloat(style.paddingRight || "0") || 0;
      const gridWidth = Math.max(0, gridNode.clientWidth - paddingLeft - paddingRight);
      const estimatedColumnCount =
        gridWidth > 0 ? Math.floor((gridWidth + gap) / (minCardWidth + gap)) : 1;
      const columnCount = Math.max(
        config.referenceGridMinColumns,
        Math.min(maxColumns, estimatedColumnCount || config.referenceGridMinColumns)
      );
      const cardWidth =
        columnCount > 0 ? Math.max(0, (gridWidth - gap * (columnCount - 1)) / columnCount) : 0;
      const cardHeight = cardWidth > 0 ? (cardWidth * 5) / 4 : config.fallbackReferenceRowHeight;
      const rowHeight = Math.max(1, cardHeight + gap);
      setMetrics((prev) => {
        const next = {
          scrollTop: scrollNode.scrollTop,
          viewportHeight: scrollNode.clientHeight,
          columnCount,
          rowHeight,
        };
        const stable =
          Math.abs(prev.scrollTop - next.scrollTop) < 1 &&
          Math.abs(prev.viewportHeight - next.viewportHeight) < 1 &&
          prev.columnCount === next.columnCount &&
          Math.abs(prev.rowHeight - next.rowHeight) < 1;
        if (stable) return prev;
        incrementFreezeInvestigationCounter(
          surface === "curated"
            ? "referenceGrid.curatedVirtualMetrics.measureCommit"
            : "referenceGrid.virtualMetrics.measureCommit"
        );
        return next;
      });
    },
    [
      config.fallbackReferenceRowHeight,
      config.quickSlotInventoryMaxColumns,
      config.referenceGridMaxColumns,
      config.referenceGridMaxColumnsWide,
      config.referenceGridMinCardPx,
      config.referenceGridMinCardPxWide,
      config.referenceGridMinColumns,
      isWideLayout,
    ]
  );

  const syncVirtualMetrics = useCallback(() => {
    syncVirtualMetricsForSurface({
      scrollNode: scrollContainerRef.current,
      gridNode: gridRef.current,
      surface: "all-refs",
      setMetrics: setVirtualMetrics,
    });
  }, [gridRef, scrollContainerRef, setVirtualMetrics, syncVirtualMetricsForSurface]);

  const syncCuratedVirtualMetrics = useCallback(() => {
    if (!isCuratedSplitEnabled) return;
    syncVirtualMetricsForSurface({
      scrollNode: curatedScrollContainerRef.current,
      gridNode: curatedGridRef.current,
      surface: "curated",
      setMetrics: setCuratedVirtualMetrics,
    });
  }, [
    curatedGridRef,
    curatedScrollContainerRef,
    isCuratedSplitEnabled,
    setCuratedVirtualMetrics,
    syncVirtualMetricsForSurface,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    syncVirtualMetrics();
    syncCuratedVirtualMetrics();
  }, [curatedOutputsLength, outputsLength, syncCuratedVirtualMetrics, syncVirtualMetrics]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Keep observer lifetime tied to surface/layout identity rather than output-count churn.
    const scrollNode = scrollContainerRef.current;
    const gridNode = gridRef.current;
    const curatedScrollNode = curatedScrollContainerRef.current;
    const curatedGridNode = curatedGridRef.current;
    if (!scrollNode || !gridNode) return;
    const handleResize = () => {
      syncVirtualMetrics();
      syncCuratedVirtualMetrics();
    };
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            syncVirtualMetrics();
            syncCuratedVirtualMetrics();
          })
        : null;
    observer?.observe(scrollNode);
    observer?.observe(gridNode);
    if (isCuratedSplitEnabled && curatedScrollNode && curatedGridNode) {
      observer?.observe(curatedScrollNode);
      observer?.observe(curatedGridNode);
    }
    window.addEventListener("resize", handleResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [
    curatedGridRef,
    curatedScrollContainerRef,
    gridRef,
    isCuratedSplitEnabled,
    scrollContainerRef,
    syncCuratedVirtualMetrics,
    syncVirtualMetrics,
  ]);
};
