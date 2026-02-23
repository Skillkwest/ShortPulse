/**
 * Virtual metrics controller for Reference Grid surfaces.
 * Keeps resize/measurement orchestration and observer lifecycle out of ReferenceCanvas rendering logic.
 */
import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { ToolId } from "../../types";

type VirtualMetricsState = {
  scrollTop: number;
  viewportHeight: number;
  columnCount: number;
  rowHeight: number;
};

type UseReferenceGridVirtualMetricsControllerArgs = {
  isCuratedSplitEnabled: boolean;
  selectedTool: ToolId | null;
  perfDegradeLevel: 0 | 1 | 2;
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
    referenceGridEmergencyMaxColumns: number;
    fallbackReferenceRowHeight: number;
    perfWatchdogEnabled: boolean;
  };
};

/**
 * Installs metric synchronization and resize observation for all-refs/curated grid surfaces.
 */
export const useReferenceGridVirtualMetricsController = ({
  isCuratedSplitEnabled,
  selectedTool,
  perfDegradeLevel,
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
      const defaultRequestedMaxColumns = selectedTool
        ? config.referenceGridMaxColumns
        : config.referenceGridMaxColumnsWide;
      const requestedMaxColumns =
        surface === "curated"
          ? Math.min(config.quickSlotInventoryMaxColumns, config.referenceGridMaxColumnsWide)
          : defaultRequestedMaxColumns;
      const emergencyMaxColumns =
        config.perfWatchdogEnabled && perfDegradeLevel >= 2
          ? config.referenceGridEmergencyMaxColumns
          : requestedMaxColumns;
      const maxColumns = Math.max(
        config.referenceGridMinColumns,
        Math.min(Math.floor(requestedMaxColumns), Math.floor(emergencyMaxColumns))
      );
      const minCardWidth = selectedTool
        ? config.referenceGridMinCardPx
        : config.referenceGridMinCardPxWide;
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
        return stable ? prev : next;
      });
    },
    [
      config.fallbackReferenceRowHeight,
      config.perfWatchdogEnabled,
      config.quickSlotInventoryMaxColumns,
      config.referenceGridEmergencyMaxColumns,
      config.referenceGridMaxColumns,
      config.referenceGridMaxColumnsWide,
      config.referenceGridMinCardPx,
      config.referenceGridMinCardPxWide,
      config.referenceGridMinColumns,
      perfDegradeLevel,
      selectedTool,
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
    curatedOutputsLength,
    curatedScrollContainerRef,
    gridRef,
    isCuratedSplitEnabled,
    outputsLength,
    scrollContainerRef,
    selectedTool,
    syncCuratedVirtualMetrics,
    syncVirtualMetrics,
  ]);
};
