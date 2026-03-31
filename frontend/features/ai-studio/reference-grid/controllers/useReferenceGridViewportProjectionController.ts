/**
 * Viewport projection controller for Reference Grid.
 * Derives virtual windows, visible id slices, viewport caps, and near-viewport sets.
 */
import { useMemo } from "react";
import {
  calculateReferenceGridWindow,
  resolveReferenceGridOverscanRows,
} from "../../logic/referenceGridVirtualization";
import {
  incrementFreezeInvestigationCounter,
  setFreezeInvestigationGauge,
} from "../../logic/freezeInvestigationTelemetry";

type VirtualMetrics = {
  scrollTop: number;
  viewportHeight: number;
  columnCount: number;
  rowHeight: number;
};

type UseReferenceGridViewportProjectionControllerArgs = {
  outputIds: string[];
  curatedOutputIds: string[];
  activeOutputId: string | null;
  isCuratedSplitEnabled: boolean;
  perfDegradeLevel: 0 | 1 | 2;
  virtualMetrics: VirtualMetrics;
  curatedVirtualMetrics: VirtualMetrics;
  config: {
    dynamicVirtualizationEnabled: boolean;
    hardViewportCapEnabled: boolean;
    denseVisualSimplifyEnabled: boolean;
    virtualOverscanRows: number;
    virtualizeMinItems: number;
    fallbackReferenceRowHeight: number;
    referenceGridMinColumns: number;
    highDensityCardCount: number;
  };
};

type UseReferenceGridViewportProjectionControllerResult = {
  dynamicOverscanRows: number;
  curatedOverscanRows: number;
  shouldVirtualize: boolean;
  curatedShouldVirtualize: boolean;
  isHighDensity: boolean;
  denseVisualModeEnabled: boolean;
  startIndex: number;
  endIndex: number;
  curatedStartIndex: number;
  curatedEndIndex: number;
  visibleOutputIds: string[];
  visibleCuratedOutputIds: string[];
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  curatedTopSpacerHeight: number;
  curatedBottomSpacerHeight: number;
  renderedItemCount: number;
  renderedOutputIdSet: Set<string>;
  nearViewportOutputIds: string[];
  nearViewportCuratedOutputIds: string[];
};

/**
 * Computes all viewport-related projections shared by rendering, hydration, and autoplay policies.
 */
export const useReferenceGridViewportProjectionController = ({
  outputIds,
  curatedOutputIds,
  activeOutputId,
  isCuratedSplitEnabled,
  perfDegradeLevel,
  virtualMetrics,
  curatedVirtualMetrics,
  config,
}: UseReferenceGridViewportProjectionControllerArgs): UseReferenceGridViewportProjectionControllerResult => {
  incrementFreezeInvestigationCounter("referenceGrid.viewportProjection.recompute");
  setFreezeInvestigationGauge("referenceGrid.viewportProjection.outputsCount", outputIds.length);
  setFreezeInvestigationGauge(
    "referenceGrid.viewportProjection.curatedOutputsCount",
    curatedOutputIds.length
  );

  const dynamicOverscanRows = config.dynamicVirtualizationEnabled
    ? resolveReferenceGridOverscanRows(outputIds.length, {
        pressureLevel: perfDegradeLevel,
      })
    : config.virtualOverscanRows;

  const curatedOverscanRows = config.dynamicVirtualizationEnabled
    ? resolveReferenceGridOverscanRows(curatedOutputIds.length, {
        pressureLevel: perfDegradeLevel,
      })
    : config.virtualOverscanRows;

  const virtualWindow = calculateReferenceGridWindow({
    itemCount: outputIds.length,
    columnCount: virtualMetrics.columnCount,
    rowHeight: virtualMetrics.rowHeight,
    scrollTop: virtualMetrics.scrollTop,
    viewportHeight:
      virtualMetrics.viewportHeight > 0
        ? virtualMetrics.viewportHeight
        : config.fallbackReferenceRowHeight * 5,
    overscanRows: dynamicOverscanRows,
    virtualizeMinItems: config.dynamicVirtualizationEnabled ? config.virtualizeMinItems : 24,
  });

  const curatedVirtualWindow = isCuratedSplitEnabled
    ? calculateReferenceGridWindow({
        itemCount: curatedOutputIds.length,
        columnCount: curatedVirtualMetrics.columnCount,
        rowHeight: curatedVirtualMetrics.rowHeight,
        scrollTop: curatedVirtualMetrics.scrollTop,
        viewportHeight:
          curatedVirtualMetrics.viewportHeight > 0
            ? curatedVirtualMetrics.viewportHeight
            : config.fallbackReferenceRowHeight * 3,
        overscanRows: curatedOverscanRows,
        virtualizeMinItems: config.dynamicVirtualizationEnabled ? config.virtualizeMinItems : 24,
      })
    : {
        shouldVirtualize: false,
        totalRows: 1,
        startRow: 0,
        endRow: 0,
        startIndex: 0,
        endIndex: curatedOutputIds.length,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      };

  const shouldVirtualize = virtualWindow.shouldVirtualize;
  const curatedShouldVirtualize = curatedVirtualWindow.shouldVirtualize;
  const startIndex = virtualWindow.startIndex;
  const endIndex = virtualWindow.endIndex;
  const curatedStartIndex = curatedVirtualWindow.startIndex;
  const curatedEndIndex = curatedVirtualWindow.endIndex;

  const baseVisibleOutputIds = shouldVirtualize ? outputIds.slice(startIndex, endIndex) : outputIds;
  const visibleRows = Math.max(
    1,
    Math.ceil(
      (virtualMetrics.viewportHeight > 0
        ? virtualMetrics.viewportHeight
        : config.fallbackReferenceRowHeight * 5) / Math.max(1, virtualMetrics.rowHeight)
    )
  );
  const hardViewportVisibleLimit =
    (visibleRows + Math.max(0, dynamicOverscanRows) * 2) *
    Math.max(config.referenceGridMinColumns, virtualMetrics.columnCount);

  const visibleOutputIds = useMemo(() => {
    if (!config.hardViewportCapEnabled) {
      return baseVisibleOutputIds;
    }
    if (baseVisibleOutputIds.length <= hardViewportVisibleLimit) {
      return baseVisibleOutputIds;
    }
    const capped = baseVisibleOutputIds.slice(0, Math.max(1, hardViewportVisibleLimit));
    if (!activeOutputId) return capped;
    if (capped.includes(activeOutputId)) return capped;
    if (!outputIds.includes(activeOutputId)) return capped;
    if (capped.length === 0) return [activeOutputId];
    return [...capped.slice(0, capped.length - 1), activeOutputId];
  }, [
    activeOutputId,
    baseVisibleOutputIds,
    config.hardViewportCapEnabled,
    hardViewportVisibleLimit,
    outputIds,
  ]);

  const visibleCuratedOutputIds = curatedShouldVirtualize
    ? curatedOutputIds.slice(curatedStartIndex, curatedEndIndex)
    : curatedOutputIds;

  const renderedOutputIdSet = useMemo(() => {
    const ids = new Set(visibleOutputIds);
    if (isCuratedSplitEnabled) {
      visibleCuratedOutputIds.forEach((id) => ids.add(id));
    }
    return ids;
  }, [isCuratedSplitEnabled, visibleCuratedOutputIds, visibleOutputIds]);

  const nearViewportOutputIds = useMemo(() => {
    if (!shouldVirtualize) return [];
    const nearSpan = Math.max(1, virtualMetrics.columnCount);
    const start = Math.max(0, startIndex - nearSpan);
    const end = Math.min(outputIds.length, endIndex + nearSpan);
    return outputIds.slice(start, end);
  }, [endIndex, outputIds, shouldVirtualize, startIndex, virtualMetrics.columnCount]);

  const nearViewportCuratedOutputIds = useMemo(() => {
    if (!isCuratedSplitEnabled || !curatedShouldVirtualize) return [];
    const nearSpan = Math.max(1, curatedVirtualMetrics.columnCount);
    const start = Math.max(0, curatedStartIndex - nearSpan);
    const end = Math.min(curatedOutputIds.length, curatedEndIndex + nearSpan);
    return curatedOutputIds.slice(start, end);
  }, [
    curatedEndIndex,
    curatedOutputIds,
    curatedShouldVirtualize,
    curatedStartIndex,
    curatedVirtualMetrics.columnCount,
    isCuratedSplitEnabled,
  ]);

  return {
    dynamicOverscanRows,
    curatedOverscanRows,
    shouldVirtualize,
    curatedShouldVirtualize,
    isHighDensity: outputIds.length >= config.highDensityCardCount,
    denseVisualModeEnabled: config.denseVisualSimplifyEnabled && outputIds.length >= 40,
    startIndex,
    endIndex,
    curatedStartIndex,
    curatedEndIndex,
    visibleOutputIds,
    visibleCuratedOutputIds,
    topSpacerHeight: virtualWindow.topSpacerHeight,
    bottomSpacerHeight: virtualWindow.bottomSpacerHeight,
    curatedTopSpacerHeight: curatedVirtualWindow.topSpacerHeight,
    curatedBottomSpacerHeight: curatedVirtualWindow.bottomSpacerHeight,
    renderedItemCount: visibleOutputIds.length,
    renderedOutputIdSet,
    nearViewportOutputIds,
    nearViewportCuratedOutputIds,
  };
};
