/**
 * Reference Grid runtime scaffold.
 *
 * Purpose: centralize the heavy derivation/layout/ref state used by the ReferenceGrid component so
 * the component file stays small (size-budget seam) while keeping behavior identical.
 */
import React, { useCallback, useState } from "react";
import type { ReferenceGridProps } from "../referenceGridTypes";
import { useAiStudioAnyModalOpen } from "../../components/modal-layer/AiStudioModalLayer";
import {
  PERF_FLAG_MODAL_STABILITY_V1,
  PERF_FLAG_REFERENCE_GRID_CURATED_SPLIT,
  PERF_FLAG_REFERENCE_GRID_DECODE_BUDGET,
  PERF_FLAG_REFERENCE_GRID_MEMORY_GUARD,
  PERF_FLAG_REFERENCE_GRID_PERF_WATCHDOG,
  PERF_FLAG_REFERENCE_GRID_TRANSITION_NONURGENT,
  PERF_FLAG_REFERENCE_GRID_GLOBAL_MEDIA_BUDGET,
  PERF_FLAG_REFERENCE_GRID_ADAPTIVE_PREVIEW,
  PERF_FLAG_REFERENCE_GRID_ADAPTIVE_PREVIEW_QUALITY,
  PERF_FLAG_REFERENCE_GRID_LOADING_PLACEHOLDER_TIMEOUT,
  PERF_FLAG_REFERENCE_GRID_DYNAMIC_VIRTUALIZATION,
  PERF_FLAG_REFERENCE_GRID_HARD_VIEWPORT_CAP,
  PERF_FLAG_REFERENCE_GRID_DENSE_VISUAL_SIMPLIFY,
} from "../../logic/perfProfileFlags";
import { useReferenceGridHydrationBudget } from "../../hooks/useReferenceGridHydrationBudget";
import { useReferenceGridPerfWatchdog } from "../../hooks/useReferenceGridPerfWatchdog";
import { useReferenceGridMediaWorkBudget } from "../../hooks/useReferenceGridMediaWorkBudget";
import { useReferenceGridHorizontalSplit } from "../../hooks/useReferenceGridHorizontalSplit";
import { isReferenceGridAdaptivePreviewRoutingEnabled } from "../logic/referenceGridAdaptivePreview";
import { useReferenceGridHeaderMeasurements } from "./useReferenceGridHeaderMeasurements";
import { useReferenceGridPreviewRuntime } from "./useReferenceGridPreviewRuntime";
import { useReferenceGridDropHelpersController } from "./useReferenceGridDropHelpersController";
import { useReferenceGridVirtualMetricsController } from "./useReferenceGridVirtualMetricsController";
import { useReferenceGridViewportProjectionController } from "./useReferenceGridViewportProjectionController";
import { useReferenceGridOutputViewModels } from "./useReferenceGridOutputViewModels";
import { useReferenceGridOutputCollections } from "./useReferenceGridOutputCollections";
import type { ReferenceGridDropMode } from "./useReferenceGridDropController";
import {
  CURATED_MIN_BOTTOM_STACK_HEIGHT_PX,
  DEFAULT_CURATED_SPLIT_TOP_RATIO,
  DEFAULT_PANEL_VISIBILITY,
  DEFAULT_STYLES_SPLIT_TOP_RATIO,
  FALLBACK_REFERENCE_ROW_HEIGHT,
  HORIZONTAL_DIVIDER_TRACK_MIN_HEIGHT_PX,
  QUICK_SLOT_INVENTORY_MAX_COLUMNS,
  REFERENCE_AUTOPLAY_MAX_DESKTOP,
  REFERENCE_GRID_MAX_COLUMNS,
  REFERENCE_GRID_MAX_COLUMNS_WIDE,
  REFERENCE_GRID_MIN_CARD_PX,
  REFERENCE_GRID_MIN_CARD_PX_WIDE,
  REFERENCE_GRID_MIN_COLUMNS,
  REFERENCE_HIGH_DENSITY_CARD_COUNT,
  REFERENCE_VIRTUALIZE_MIN_ITEMS,
  REFERENCE_VIRTUAL_OVERSCAN_ROWS,
  resolveReferenceSelectionTheme,
  STYLES_MIN_BOTTOM_HEADER_BUFFER_PX_QUICK_SLOT,
  STYLES_MIN_BOTTOM_HEADER_BUFFER_PX_REFERENCE_GRID,
  STYLES_MIN_BOTTOM_SECTION_HEIGHT_PX_QUICK_SLOT,
  STYLES_MIN_BOTTOM_SECTION_HEIGHT_PX_REFERENCE_GRID,
  STYLES_REFERENCE_GRID_COLLAPSE_TOP_HEIGHT_PX,
} from "../referenceGridConfig";

type UseReferenceGridRuntimeScaffoldArgs = Pick<
  ReferenceGridProps,
  | "outputs"
  | "archivedOutputs"
  | "activeOutputId"
  | "curatedReferenceIds"
  | "removedFromAllRefsIds"
  | "linkedPromptReferenceIds"
  | "selectedTool"
  | "onOutputMediaLoaded"
  | "panelVisibility"
  | "stylesPanel"
  | "onAddCuratedReference"
  | "onRemoveCuratedReference"
  | "onReorderCuratedReference"
>;

export const useReferenceGridRuntimeScaffold = ({
  outputs: outputsProp,
  archivedOutputs: archivedOutputsProp,
  activeOutputId,
  curatedReferenceIds = [],
  removedFromAllRefsIds = [],
  linkedPromptReferenceIds = [],
  selectedTool,
  onOutputMediaLoaded,
  panelVisibility,
  stylesPanel,
  onAddCuratedReference,
  onRemoveCuratedReference,
  onReorderCuratedReference,
}: UseReferenceGridRuntimeScaffoldArgs) => {
  const { allOutputIds, archivedOutputs, curatedOutputIds, curatedOutputs, outputById } =
    useReferenceGridOutputCollections({
      outputsProp,
      archivedOutputsProp,
      curatedReferenceIds,
      removedFromAllRefsIds,
    });

  const isAnyModalOpen = useAiStudioAnyModalOpen();
  const suspendBackgroundVisualWork = PERF_FLAG_MODAL_STABILITY_V1 && isAnyModalOpen;

  const panelVisibilityResolved = React.useMemo(
    () => ({
      quickSlot: panelVisibility?.quickSlot ?? DEFAULT_PANEL_VISIBILITY.quickSlot,
      referenceGrid: panelVisibility?.referenceGrid ?? DEFAULT_PANEL_VISIBILITY.referenceGrid,
      styles: panelVisibility?.styles ?? Boolean(stylesPanel?.isOpen),
    }),
    [
      panelVisibility?.quickSlot,
      panelVisibility?.referenceGrid,
      panelVisibility?.styles,
      stylesPanel?.isOpen,
    ]
  );

  const isCuratedSplitEnabled =
    PERF_FLAG_REFERENCE_GRID_CURATED_SPLIT &&
    Boolean(onAddCuratedReference && onRemoveCuratedReference && onReorderCuratedReference);
  const isStylesPanelOpen = Boolean(stylesPanel?.isOpen) && panelVisibilityResolved.styles;
  const showReferenceGridSection = panelVisibilityResolved.referenceGrid;
  const showQuickSlotSection = isCuratedSplitEnabled && panelVisibilityResolved.quickSlot;
  const isWideLayout = selectedTool == null;
  const isCuratedSplitActive = showQuickSlotSection;

  const perfWatchdog = useReferenceGridPerfWatchdog({
    enabled: PERF_FLAG_REFERENCE_GRID_PERF_WATCHDOG,
    memoryGuardEnabled: PERF_FLAG_REFERENCE_GRID_MEMORY_GUARD,
  });
  const previewQualityPressureLevel = perfWatchdog.previewQualityPressureLevel;
  const liveWatchdogDegradeLevelRef = React.useRef<0 | 1 | 2>(perfWatchdog.degradeLevel);
  const hydrationBudget = useReferenceGridHydrationBudget({
    enabled: PERF_FLAG_REFERENCE_GRID_DECODE_BUDGET,
    pressureLevel: perfWatchdog.degradeLevel,
  });

  const selectionTheme = resolveReferenceSelectionTheme(selectedTool);
  const autoplayingIdsRef = React.useRef<Set<string>>(new Set());
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const curatedScrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const curatedGridRef = React.useRef<HTMLDivElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const inventoryStackRef = React.useRef<HTMLDivElement | null>(null);
  const curatedSectionRef = React.useRef<HTMLDivElement | null>(null);
  const curatedHeaderRef = React.useRef<HTMLDivElement | null>(null);
  const allRefsHeaderRef = React.useRef<HTMLDivElement | null>(null);
  const stylesHeaderRef = React.useRef<HTMLDivElement | null>(null);
  const videoVisibleKeySetRef = React.useRef<Set<string>>(new Set());
  const videoOutputIdByKeyRef = React.useRef<Map<string, string>>(new Map());
  const videoNodeByKeyRef = React.useRef<Map<string, HTMLVideoElement>>(new Map());
  const videoDetachTimeoutByKeyRef = React.useRef<Map<string, number>>(new Map());
  const videoIntersectionObserverBySurfaceRef = React.useRef<
    Map<"all-refs" | "curated", IntersectionObserver>
  >(new Map());
  const isPointerOverPanelRef = React.useRef(false);
  const isPastePrimedRef = React.useRef(false);
  const lastPasteFingerprintRef = React.useRef<{ value: string; at: number } | null>(null);
  const canvasDragDepthRef = React.useRef(0);
  const curatedDragDepthRef = React.useRef(0);

  const [desiredVideoAttachBudget, setDesiredVideoAttachBudget] = useState<number>(
    REFERENCE_AUTOPLAY_MAX_DESKTOP
  );
  const [autoplayEnabledIds, setAutoplayEnabledIds] = useState<string[]>([]);
  const desiredVideoAttachBudgetRef = React.useRef<number>(REFERENCE_AUTOPLAY_MAX_DESKTOP);
  const autoplayEnabledIdsStateRef = React.useRef<string[]>([]);
  const recomputeAutoplayBudgetRef = React.useRef<() => void>(() => {});

  const [canvasDropMode, setCanvasDropMode] = useState<ReferenceGridDropMode>("none");
  const canvasDropModeRef = React.useRef<ReferenceGridDropMode>("none");
  const [isCuratedDropActive, setIsCuratedDropActive] = useState(false);
  const isCuratedDropActiveRef = React.useRef(false);
  const [isArchivePanelOpen, setIsArchivePanelOpen] = useState(false);

  const stylesSplitShowsReferenceGridTop = showReferenceGridSection;
  const stylesSplitShowsQuickSlotTop = showQuickSlotSection && !showReferenceGridSection;
  const stylesSplitEnabled =
    isStylesPanelOpen && (stylesSplitShowsReferenceGridTop || stylesSplitShowsQuickSlotTop);
  const { curatedHeaderHeightPx, allRefsHeaderHeightPx, stylesHeaderHeightPx } =
    useReferenceGridHeaderMeasurements({
      isCuratedSplitActive,
      stylesSplitEnabled,
      isStylesPanelOpen,
      curatedHeaderRef,
      allRefsHeaderRef,
      stylesHeaderRef,
    });
  const stylesSplitTopHeaderHeightPx = stylesSplitShowsQuickSlotTop
    ? curatedHeaderHeightPx
    : Math.max(STYLES_REFERENCE_GRID_COLLAPSE_TOP_HEIGHT_PX, allRefsHeaderHeightPx);
  const stylesSplitMinTopSectionHeightPx = stylesSplitTopHeaderHeightPx;
  const stylesSplitMinBottomBasePx = stylesSplitShowsQuickSlotTop
    ? STYLES_MIN_BOTTOM_SECTION_HEIGHT_PX_QUICK_SLOT
    : STYLES_MIN_BOTTOM_SECTION_HEIGHT_PX_REFERENCE_GRID;
  const stylesSplitMinBottomHeaderBufferPx = stylesSplitShowsQuickSlotTop
    ? STYLES_MIN_BOTTOM_HEADER_BUFFER_PX_QUICK_SLOT
    : STYLES_MIN_BOTTOM_HEADER_BUFFER_PX_REFERENCE_GRID;
  const stylesSplitMinBottomSectionHeightPx = Math.max(
    stylesSplitMinBottomBasePx,
    stylesHeaderHeightPx + stylesSplitMinBottomHeaderBufferPx
  );
  const stylesSplitUsesNestedContainer =
    isStylesPanelOpen && showQuickSlotSection && showReferenceGridSection;
  const horizontalSplitMinBottomSectionHeightPx = stylesSplitUsesNestedContainer
    ? stylesSplitMinTopSectionHeightPx +
      stylesSplitMinBottomSectionHeightPx +
      HORIZONTAL_DIVIDER_TRACK_MIN_HEIGHT_PX
    : CURATED_MIN_BOTTOM_STACK_HEIGHT_PX;
  const stylesSplitAriaLabel = stylesSplitShowsQuickSlotTop
    ? "Resize Quick Slot Inventory and Styles sections"
    : "Resize Reference Grid and Styles sections";

  const previousVisiblePreviewUrlByIdRef = React.useRef<Record<string, string | null>>({});
  const previewSwapTelemetryRef = React.useRef<{
    windowStartedAtMs: number;
    totalSwapCount: number;
    repaintSpikeCount: number;
  }>({
    windowStartedAtMs: 0,
    totalSwapCount: 0,
    repaintSpikeCount: 0,
  });
  const [previewSwapMetrics, setPreviewSwapMetrics] = useState<{
    swapRatePerMinute: number;
    repaintSpikeCount: number;
    lastSwapBurstCount: number;
  }>({
    swapRatePerMinute: 0,
    repaintSpikeCount: 0,
    lastSwapBurstCount: 0,
  });

  const setCuratedDropActiveSafe = useCallback((next: boolean) => {
    if (isCuratedDropActiveRef.current === next) return;
    isCuratedDropActiveRef.current = next;
    setIsCuratedDropActive(next);
  }, []);
  const setCanvasDropModeSafe = useCallback((next: ReferenceGridDropMode) => {
    if (canvasDropModeRef.current === next) return;
    canvasDropModeRef.current = next;
    setCanvasDropMode(next);
  }, []);

  const [virtualMetrics, setVirtualMetrics] = useState({
    scrollTop: 0,
    viewportHeight: 0,
    columnCount: 5,
    rowHeight: FALLBACK_REFERENCE_ROW_HEIGHT,
  });
  const [curatedVirtualMetrics, setCuratedVirtualMetrics] = useState({
    scrollTop: 0,
    viewportHeight: 0,
    columnCount: 5,
    rowHeight: FALLBACK_REFERENCE_ROW_HEIGHT,
  });

  const referenceGridStylesStackRef = React.useRef<HTMLDivElement | null>(null);
  const horizontalSplit = useReferenceGridHorizontalSplit({
    enabled: isCuratedSplitActive,
    containerRef: inventoryStackRef,
    defaultTopRatio: DEFAULT_CURATED_SPLIT_TOP_RATIO,
    minTopSectionHeightPx: curatedHeaderHeightPx,
    minBottomSectionHeightPx: horizontalSplitMinBottomSectionHeightPx,
    allRefsSnapTopHeightPx: curatedHeaderHeightPx,
    collapseTopHeightPx: curatedHeaderHeightPx,
  });
  const stylesSplitContainerRef = stylesSplitUsesNestedContainer
    ? referenceGridStylesStackRef
    : inventoryStackRef;
  const stylesSplit = useReferenceGridHorizontalSplit({
    enabled: stylesSplitEnabled,
    containerRef: stylesSplitContainerRef,
    defaultTopRatio: DEFAULT_STYLES_SPLIT_TOP_RATIO,
    minTopSectionHeightPx: stylesSplitMinTopSectionHeightPx,
    minBottomSectionHeightPx: stylesSplitMinBottomSectionHeightPx,
    allRefsSnapTopHeightPx: stylesSplitTopHeaderHeightPx,
    collapseTopHeightPx: stylesSplitTopHeaderHeightPx,
    ariaLabel: stylesSplitAriaLabel,
  });

  const lastRenderCommitAtRef = React.useRef<number>(0);
  const autoplayEnabledIdSet = React.useMemo(
    () => new Set(autoplayEnabledIds),
    [autoplayEnabledIds]
  );
  const linkedPromptReferenceIdSet = React.useMemo(
    () => new Set(linkedPromptReferenceIds),
    [linkedPromptReferenceIds]
  );

  const runNonUrgentUpdate = useCallback((updater: () => void) => {
    if (
      PERF_FLAG_REFERENCE_GRID_TRANSITION_NONURGENT &&
      typeof React.startTransition === "function"
    ) {
      React.startTransition(updater);
      return;
    }
    updater();
  }, []);

  React.useEffect(() => {
    liveWatchdogDegradeLevelRef.current = perfWatchdog.degradeLevel;
  }, [perfWatchdog.degradeLevel]);

  const mediaWorkBudget = useReferenceGridMediaWorkBudget({
    enabled: PERF_FLAG_REFERENCE_GRID_GLOBAL_MEDIA_BUDGET,
    pressureLevel: perfWatchdog.degradeLevel,
    constrainedProfile: hydrationBudget.constrainedProfile,
    desiredImageDecodeInflight: hydrationBudget.maxInflightHydrations,
    desiredVideoAttachSlots: desiredVideoAttachBudget,
  });

  const adaptivePreviewRoutingEnabled = isReferenceGridAdaptivePreviewRoutingEnabled({
    adaptivePreviewEnabled: PERF_FLAG_REFERENCE_GRID_ADAPTIVE_PREVIEW,
    adaptivePreviewQualityEnabled: PERF_FLAG_REFERENCE_GRID_ADAPTIVE_PREVIEW_QUALITY,
  });

  const {
    imageHydrationState,
    loadedMap,
    markLoaded,
    enqueueImageHydration,
    pruneHydrationQueueToCandidateIds,
  } = useReferenceGridPreviewRuntime({
    decodeBudgetEnabled: PERF_FLAG_REFERENCE_GRID_DECODE_BUDGET,
    suspendPreviewRuntime: suspendBackgroundVisualWork,
    adaptivePreviewRoutingEnabled,
    imageDecodeBudget: mediaWorkBudget.imageDecodeBudget,
    activeOutputId,
    validOutputIds: allOutputIds,
    runNonUrgentUpdate,
    liveWatchdogDegradeLevelRef,
    onOutputMediaLoaded,
    stabilizeLoadingVisual: PERF_FLAG_REFERENCE_GRID_LOADING_PLACEHOLDER_TIMEOUT,
  });

  const { normalizeMediaFiles, resolveCanvasDropMode, canAcceptCanvasDrag, buildFileList } =
    useReferenceGridDropHelpersController();

  const gridStyle = React.useMemo(
    () =>
      ({
        "--reference-grid-columns": String(
          Math.max(REFERENCE_GRID_MIN_COLUMNS, virtualMetrics.columnCount)
        ),
      }) as React.CSSProperties,
    [virtualMetrics.columnCount]
  );
  const curatedGridStyle = React.useMemo(
    () =>
      ({
        "--reference-grid-columns": String(
          Math.max(REFERENCE_GRID_MIN_COLUMNS, curatedVirtualMetrics.columnCount)
        ),
      }) as React.CSSProperties,
    [curatedVirtualMetrics.columnCount]
  );

  useReferenceGridVirtualMetricsController({
    isCuratedSplitEnabled: isCuratedSplitActive,
    isWideLayout,
    outputsLength: allOutputIds.length,
    curatedOutputsLength: curatedOutputIds.length,
    outputIds: allOutputIds,
    curatedOutputIds,
    scrollContainerRef,
    gridRef,
    curatedScrollContainerRef,
    curatedGridRef,
    setVirtualMetrics,
    setCuratedVirtualMetrics,
    config: {
      referenceGridMinColumns: REFERENCE_GRID_MIN_COLUMNS,
      referenceGridMinCardPx: REFERENCE_GRID_MIN_CARD_PX,
      referenceGridMinCardPxWide: REFERENCE_GRID_MIN_CARD_PX_WIDE,
      referenceGridMaxColumns: REFERENCE_GRID_MAX_COLUMNS,
      referenceGridMaxColumnsWide: REFERENCE_GRID_MAX_COLUMNS_WIDE,
      quickSlotInventoryMaxColumns: QUICK_SLOT_INVENTORY_MAX_COLUMNS,
      fallbackReferenceRowHeight: FALLBACK_REFERENCE_ROW_HEIGHT,
    },
  });

  const {
    shouldVirtualize,
    isHighDensity,
    denseVisualModeEnabled,
    startIndex,
    endIndex,
    visibleOutputIds,
    visibleCuratedOutputIds,
    topSpacerHeight,
    bottomSpacerHeight,
    curatedTopSpacerHeight,
    curatedBottomSpacerHeight,
    renderedItemCount,
    renderedOutputIdSet,
    nearViewportOutputIds,
    nearViewportCuratedOutputIds,
  } = useReferenceGridViewportProjectionController({
    outputIds: allOutputIds,
    curatedOutputIds,
    activeOutputId,
    isCuratedSplitEnabled: isCuratedSplitActive,
    perfDegradeLevel: perfWatchdog.degradeLevel,
    virtualMetrics,
    curatedVirtualMetrics,
    config: {
      dynamicVirtualizationEnabled: PERF_FLAG_REFERENCE_GRID_DYNAMIC_VIRTUALIZATION,
      hardViewportCapEnabled: PERF_FLAG_REFERENCE_GRID_HARD_VIEWPORT_CAP,
      denseVisualSimplifyEnabled: PERF_FLAG_REFERENCE_GRID_DENSE_VISUAL_SIMPLIFY,
      virtualOverscanRows: REFERENCE_VIRTUAL_OVERSCAN_ROWS,
      virtualizeMinItems: REFERENCE_VIRTUALIZE_MIN_ITEMS,
      fallbackReferenceRowHeight: FALLBACK_REFERENCE_ROW_HEIGHT,
      referenceGridMinColumns: REFERENCE_GRID_MIN_COLUMNS,
      highDensityCardCount: REFERENCE_HIGH_DENSITY_CARD_COUNT,
    },
  });

  const {
    activeOutput,
    visibleOutputs,
    visibleCuratedOutputs,
    nearViewportOutputs,
    nearViewportCuratedOutputs,
    visibleMediaOutputs,
    visibleCuratedMediaOutputs,
    nearViewportMediaOutputs,
    nearViewportCuratedMediaOutputs,
    activeMediaOutput,
    visibleOutputById,
  } = useReferenceGridOutputViewModels({
    outputsProp,
    outputById,
    activeOutputId,
    visibleOutputIds,
    visibleCuratedOutputIds,
    nearViewportOutputIds,
    nearViewportCuratedOutputIds,
  });

  return {
    allOutputIds,
    archivedOutputs,
    curatedOutputIds,
    curatedOutputs,
    outputById,
    suspendBackgroundVisualWork,
    panelVisibilityResolved,
    isCuratedSplitEnabled,
    isStylesPanelOpen,
    showReferenceGridSection,
    showQuickSlotSection,
    isWideLayout,
    isCuratedSplitActive,
    perfWatchdog,
    previewQualityPressureLevel,
    liveWatchdogDegradeLevelRef,
    hydrationBudget,
    selectionTheme,
    autoplayingIdsRef,
    scrollContainerRef,
    gridRef,
    curatedScrollContainerRef,
    curatedGridRef,
    panelRef,
    inventoryStackRef,
    curatedSectionRef,
    curatedHeaderRef,
    allRefsHeaderRef,
    stylesHeaderRef,
    videoVisibleKeySetRef,
    videoOutputIdByKeyRef,
    videoNodeByKeyRef,
    videoDetachTimeoutByKeyRef,
    videoIntersectionObserverBySurfaceRef,
    isPointerOverPanelRef,
    isPastePrimedRef,
    lastPasteFingerprintRef,
    canvasDragDepthRef,
    curatedDragDepthRef,
    desiredVideoAttachBudget,
    setDesiredVideoAttachBudget,
    autoplayEnabledIds,
    setAutoplayEnabledIds,
    desiredVideoAttachBudgetRef,
    autoplayEnabledIdsStateRef,
    recomputeAutoplayBudgetRef,
    canvasDropMode,
    canvasDropModeRef,
    setCanvasDropMode,
    isCuratedDropActive,
    isCuratedDropActiveRef,
    setCuratedDropActiveSafe,
    setCanvasDropModeSafe,
    isArchivePanelOpen,
    setIsArchivePanelOpen,
    previousVisiblePreviewUrlByIdRef,
    previewSwapTelemetryRef,
    previewSwapMetrics,
    setPreviewSwapMetrics,
    virtualMetrics,
    setVirtualMetrics,
    curatedVirtualMetrics,
    setCuratedVirtualMetrics,
    horizontalSplit,
    stylesSplit,
    referenceGridStylesStackRef,
    lastRenderCommitAtRef,
    autoplayEnabledIdSet,
    linkedPromptReferenceIdSet,
    runNonUrgentUpdate,
    mediaWorkBudget,
    adaptivePreviewRoutingEnabled,
    imageHydrationState,
    loadedMap,
    markLoaded,
    enqueueImageHydration,
    pruneHydrationQueueToCandidateIds,
    normalizeMediaFiles,
    resolveCanvasDropMode,
    canAcceptCanvasDrag,
    buildFileList,
    gridStyle,
    curatedGridStyle,
    shouldVirtualize,
    isHighDensity,
    denseVisualModeEnabled,
    startIndex,
    endIndex,
    visibleOutputIds,
    visibleCuratedOutputIds,
    topSpacerHeight,
    bottomSpacerHeight,
    curatedTopSpacerHeight,
    curatedBottomSpacerHeight,
    renderedItemCount,
    renderedOutputIdSet,
    nearViewportOutputIds,
    nearViewportCuratedOutputIds,
    activeOutput,
    visibleOutputs,
    visibleCuratedOutputs,
    nearViewportOutputs,
    nearViewportCuratedOutputs,
    visibleMediaOutputs,
    visibleCuratedMediaOutputs,
    nearViewportMediaOutputs,
    nearViewportCuratedMediaOutputs,
    activeMediaOutput,
    visibleOutputById,
    archiveCount: archivedOutputs.length,
  };
};
