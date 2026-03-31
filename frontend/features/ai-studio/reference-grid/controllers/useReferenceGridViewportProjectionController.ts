/**
 * Viewport projection controller for Reference Grid.
 * Derives virtual windows, visible slices, viewport caps, and near-viewport sets.
 */
import { useMemo } from "react";
import {
  calculateReferenceGridWindow,
  resolveReferenceGridOverscanRows,
} from "../../logic/referenceGridVirtualization";
import type { StudioOutput } from "../../types";
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
  outputs: StudioOutput[];
  curatedOutputs: StudioOutput[];
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
  visibleOutputs: StudioOutput[];
  visibleCuratedOutputs: StudioOutput[];
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  curatedTopSpacerHeight: number;
  curatedBottomSpacerHeight: number;
  renderedItemCount: number;
  renderedOutputIdSet: Set<string>;
  nearViewportOutputs: StudioOutput[];
  nearViewportCuratedOutputs: StudioOutput[];
};

/**
 * Computes all viewport-related projections shared by rendering, hydration, and autoplay policies.
 */
export const useReferenceGridViewportProjectionController = ({
  outputs,
  curatedOutputs,
  activeOutputId,
  isCuratedSplitEnabled,
  perfDegradeLevel,
  virtualMetrics,
  curatedVirtualMetrics,
  config,
}: UseReferenceGridViewportProjectionControllerArgs): UseReferenceGridViewportProjectionControllerResult => {
  incrementFreezeInvestigationCounter("referenceGrid.viewportProjection.recompute");
  setFreezeInvestigationGauge("referenceGrid.viewportProjection.outputsCount", outputs.length);
  setFreezeInvestigationGauge(
    "referenceGrid.viewportProjection.curatedOutputsCount",
    curatedOutputs.length
  );
  const dynamicOverscanRows = config.dynamicVirtualizationEnabled
    ? resolveReferenceGridOverscanRows(outputs.length, {
        pressureLevel: perfDegradeLevel,
      })
    : config.virtualOverscanRows;

  const curatedOverscanRows = config.dynamicVirtualizationEnabled
    ? resolveReferenceGridOverscanRows(curatedOutputs.length, {
        pressureLevel: perfDegradeLevel,
      })
    : config.virtualOverscanRows;

  const virtualWindow = calculateReferenceGridWindow({
    itemCount: outputs.length,
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
        itemCount: curatedOutputs.length,
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
        endIndex: curatedOutputs.length,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      };

  const shouldVirtualize = virtualWindow.shouldVirtualize;
  const curatedShouldVirtualize = curatedVirtualWindow.shouldVirtualize;
  const startIndex = virtualWindow.startIndex;
  const endIndex = virtualWindow.endIndex;
  const curatedStartIndex = curatedVirtualWindow.startIndex;
  const curatedEndIndex = curatedVirtualWindow.endIndex;

  const baseVisibleOutputs = shouldVirtualize ? outputs.slice(startIndex, endIndex) : outputs;
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

  const visibleOutputs = useMemo(() => {
    if (!config.hardViewportCapEnabled) {
      return baseVisibleOutputs;
    }
    if (baseVisibleOutputs.length <= hardViewportVisibleLimit) {
      return baseVisibleOutputs;
    }
    const capped = baseVisibleOutputs.slice(0, Math.max(1, hardViewportVisibleLimit));
    if (!activeOutputId) return capped;
    if (capped.some((item) => item.id === activeOutputId)) return capped;
    const activeOutput = outputs.find((item) => item.id === activeOutputId);
    if (!activeOutput) return capped;
    if (capped.length === 0) return [activeOutput];
    return [...capped.slice(0, capped.length - 1), activeOutput];
  }, [
    activeOutputId,
    baseVisibleOutputs,
    hardViewportVisibleLimit,
    outputs,
    config.hardViewportCapEnabled,
  ]);

  const visibleCuratedOutputs = curatedShouldVirtualize
    ? curatedOutputs.slice(curatedStartIndex, curatedEndIndex)
    : curatedOutputs;

  const renderedOutputIdSet = useMemo(() => {
    const ids = new Set(visibleOutputs.map((output) => output.id));
    if (isCuratedSplitEnabled) {
      visibleCuratedOutputs.forEach((output) => ids.add(output.id));
    }
    return ids;
  }, [isCuratedSplitEnabled, visibleCuratedOutputs, visibleOutputs]);

  const nearViewportOutputs = useMemo(() => {
    if (!shouldVirtualize) return [];
    const nearSpan = Math.max(1, virtualMetrics.columnCount);
    const start = Math.max(0, startIndex - nearSpan);
    const end = Math.min(outputs.length, endIndex + nearSpan);
    return outputs.slice(start, end);
  }, [endIndex, outputs, shouldVirtualize, startIndex, virtualMetrics.columnCount]);

  const nearViewportCuratedOutputs = useMemo(() => {
    if (!isCuratedSplitEnabled || !curatedShouldVirtualize) return [];
    const nearSpan = Math.max(1, curatedVirtualMetrics.columnCount);
    const start = Math.max(0, curatedStartIndex - nearSpan);
    const end = Math.min(curatedOutputs.length, curatedEndIndex + nearSpan);
    return curatedOutputs.slice(start, end);
  }, [
    curatedEndIndex,
    curatedOutputs,
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
    isHighDensity: outputs.length >= config.highDensityCardCount,
    denseVisualModeEnabled: config.denseVisualSimplifyEnabled && outputs.length >= 40,
    startIndex,
    endIndex,
    curatedStartIndex,
    curatedEndIndex,
    visibleOutputs,
    visibleCuratedOutputs,
    topSpacerHeight: virtualWindow.topSpacerHeight,
    bottomSpacerHeight: virtualWindow.bottomSpacerHeight,
    curatedTopSpacerHeight: curatedVirtualWindow.topSpacerHeight,
    curatedBottomSpacerHeight: curatedVirtualWindow.bottomSpacerHeight,
    renderedItemCount: visibleOutputs.length,
    renderedOutputIdSet,
    nearViewportOutputs,
    nearViewportCuratedOutputs,
  };
};
