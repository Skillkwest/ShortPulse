/**
 * Reference grid for saved outputs and uploads.
 * Supports drag/drop into other surfaces and exposes a detail action on double click.
 */
import React, { useCallback, useState } from "react";
import { StudioOutput } from "../types";
import { useOutputById, useOutputSelector, useOutputsByIds } from "../hooks/aiStudioOutputStore";
import {
  PERF_FLAG_REFERENCE_GRID_ADAPTIVE_PREVIEW,
  PERF_FLAG_REFERENCE_GRID_CURATED_SPLIT,
  PERF_FLAG_REFERENCE_GRID_ADAPTIVE_PREVIEW_QUALITY,
  PERF_FLAG_REFERENCE_GRID_CSS_CONTAINMENT,
  PERF_FLAG_REFERENCE_GRID_DECODE_BUDGET,
  PERF_FLAG_REFERENCE_GRID_DENSE_VISUAL_SIMPLIFY,
  PERF_FLAG_REFERENCE_GRID_DYNAMIC_VIRTUALIZATION,
  PERF_FLAG_REFERENCE_GRID_GLOBAL_MEDIA_BUDGET,
  PERF_FLAG_REFERENCE_GRID_HARD_VIEWPORT_CAP,
  PERF_FLAG_REFERENCE_GRID_LOADING_PLACEHOLDER_TIMEOUT,
  PERF_FLAG_REFERENCE_GRID_MEMORY_GUARD,
  PERF_FLAG_REFERENCE_GRID_PERF_WATCHDOG,
  PERF_FLAG_REFERENCE_GRID_RENDER_COMMIT_TELEMETRY,
  PERF_FLAG_REFERENCE_GRID_STRICT_PREVIEW_LADDER,
  PERF_FLAG_REFERENCE_GRID_TELEMETRY_BACKPRESSURE,
  PERF_FLAG_REFERENCE_GRID_TRANSITION_NONURGENT,
  PERF_FLAG_MODAL_STABILITY_V1,
} from "../logic/perfProfileFlags";
import { useReferenceGridHydrationBudget } from "../hooks/useReferenceGridHydrationBudget";
import { useReferenceGridPerfWatchdog } from "../hooks/useReferenceGridPerfWatchdog";
import { useReferenceGridMediaWorkBudget } from "../hooks/useReferenceGridMediaWorkBudget";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";
import {
  selectAllRefsProjectionWithLegacyFallback,
  selectQuickSlotProjection,
} from "../reference-projections";
import { isAdaptiveSurfaceEnabled } from "../../../lib/adaptive-media";
import { ReferenceGridSections } from "../reference-grid/components/ReferenceGridSections";
import { useReferenceGridClipboardController } from "../reference-grid/controllers/useReferenceGridClipboardController";
import {
  useReferenceGridDropController,
  type ReferenceGridDropMode,
} from "../reference-grid/controllers/useReferenceGridDropController";
import { useReferenceGridCuratedDndController } from "../reference-grid/controllers/useReferenceGridCuratedDndController";
import { useReferenceGridScrollController } from "../reference-grid/controllers/useReferenceGridScrollController";
import { useReferenceGridVirtualMetricsController } from "../reference-grid/controllers/useReferenceGridVirtualMetricsController";
import { useReferenceGridVideoLifecycleController } from "../reference-grid/controllers/useReferenceGridVideoLifecycleController";
import { useReferenceGridAutoplayBudgetController } from "../reference-grid/controllers/useReferenceGridAutoplayBudgetController";
import { useReferenceGridTelemetryController } from "../reference-grid/controllers/useReferenceGridTelemetryController";
import { useReferenceGridAutoplayEventController } from "../reference-grid/controllers/useReferenceGridAutoplayEventController";
import { useReferenceGridCardDragController } from "../reference-grid/controllers/useReferenceGridCardDragController";
import { useReferenceGridLoadedMediaController } from "../reference-grid/controllers/useReferenceGridLoadedMediaController";
import { useReferenceGridCardRenderController } from "../reference-grid/controllers/useReferenceGridCardRenderController";
import { useReferenceGridPreviewSwapTelemetryController } from "../reference-grid/controllers/useReferenceGridPreviewSwapTelemetryController";
import { useReferenceGridLoadingVisualController } from "../reference-grid/controllers/useReferenceGridLoadingVisualController";
import { useReferenceGridAutoplaySelectionController } from "../reference-grid/controllers/useReferenceGridAutoplaySelectionController";
import { useReferenceGridDropHelpersController } from "../reference-grid/controllers/useReferenceGridDropHelpersController";
import { useReferenceGridImageHydrationController } from "../reference-grid/controllers/useReferenceGridImageHydrationController";
import { useReferenceGridViewportProjectionController } from "../reference-grid/controllers/useReferenceGridViewportProjectionController";
import { useReferenceGridCardItemsController } from "../reference-grid/controllers/useReferenceGridCardItemsController";
import { useReferenceGridHydrationQueueController } from "../reference-grid/controllers/useReferenceGridHydrationQueueController";
import { useReferenceGridHeaderMeasurements } from "../reference-grid/controllers/useReferenceGridHeaderMeasurements";
import { useReferenceGridResolvedMediaController } from "../reference-grid/controllers/useReferenceGridResolvedMediaController";
import { useReferenceGridSurfaceOwnershipController } from "../reference-grid/controllers/useReferenceGridSurfaceOwnershipController";
import { isReferenceGridAdaptivePreviewRoutingEnabled } from "../reference-grid/logic/referenceGridAdaptivePreview";
import {
  areReferenceGridMediaOutputEntriesEqual,
  areReferenceGridMediaOutputsEqual,
  projectReferenceGridMediaOutput,
} from "../reference-grid/logic/referenceGridMediaOutput";
import { areReferenceGridPropsEqual } from "../reference-grid/logic/referenceGridPropsEquality";
import {
  areOutputListsEqual,
  CURATED_MIN_BOTTOM_STACK_HEIGHT_PX,
  DEFAULT_CANVAS_SECTION_TOP_RATIO,
  DEFAULT_CURATED_SPLIT_TOP_RATIO,
  DEFAULT_PANEL_VISIBILITY,
  DEFAULT_STYLES_SPLIT_TOP_RATIO,
  EMPTY_OUTPUTS,
  FALLBACK_REFERENCE_ROW_HEIGHT,
  HORIZONTAL_DIVIDER_TRACK_MIN_HEIGHT_PX,
  QUICK_SLOT_INVENTORY_MAX_COLUMNS,
  RAIL_CANVAS_MIN_BOTTOM_STACK_HEIGHT_PX,
  REFERENCE_AUTOPLAY_DETACH_DELAY_MS,
  REFERENCE_AUTOPLAY_MAX_CONSTRAINED,
  REFERENCE_AUTOPLAY_MAX_DESKTOP,
  REFERENCE_AUTOPLAY_MAX_SMALL_SCREEN,
  REFERENCE_AUTOPLAY_SMALL_SCREEN_QUERY,
  REFERENCE_AUTOPLAY_VISIBILITY_THRESHOLD,
  REFERENCE_GRID_MAX_COLUMNS,
  REFERENCE_GRID_MAX_COLUMNS_WIDE,
  REFERENCE_GRID_MIN_CARD_PX,
  REFERENCE_GRID_MIN_CARD_PX_WIDE,
  REFERENCE_GRID_MIN_COLUMNS,
  REFERENCE_HIGH_DENSITY_CARD_COUNT,
  REFERENCE_PRIORITY_HYDRATION_ROWS,
  REFERENCE_VIRTUALIZE_MIN_ITEMS,
  REFERENCE_VIRTUAL_OVERSCAN_ROWS,
  resolveReferenceSelectionTheme,
  STYLES_MIN_BOTTOM_HEADER_BUFFER_PX_QUICK_SLOT,
  STYLES_MIN_BOTTOM_HEADER_BUFFER_PX_REFERENCE_GRID,
  STYLES_MIN_BOTTOM_SECTION_HEIGHT_PX_QUICK_SLOT,
  STYLES_MIN_BOTTOM_SECTION_HEIGHT_PX_REFERENCE_GRID,
  STYLES_REFERENCE_GRID_COLLAPSE_TOP_HEIGHT_PX,
} from "../reference-grid/referenceGridConfig";
import type { ReferenceGridProps } from "../reference-grid/referenceGridTypes";
import { useAiStudioAnyModalOpen } from "./modal-layer/AiStudioModalLayer";
import {
  incrementFreezeInvestigationCounter,
  setFreezeInvestigationGauge,
} from "../logic/freezeInvestigationTelemetry";
const REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW = PERF_FLAG_REFERENCE_GRID_ADAPTIVE_PREVIEW;
const REFERENCE_GRID_FLAG_CURATED_SPLIT = PERF_FLAG_REFERENCE_GRID_CURATED_SPLIT;
const REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER = PERF_FLAG_REFERENCE_GRID_STRICT_PREVIEW_LADDER;
const REFERENCE_GRID_FLAG_DECODE_BUDGET = PERF_FLAG_REFERENCE_GRID_DECODE_BUDGET;
const REFERENCE_GRID_FLAG_DYNAMIC_VIRTUALIZATION = PERF_FLAG_REFERENCE_GRID_DYNAMIC_VIRTUALIZATION;
const REFERENCE_GRID_FLAG_DENSE_VISUAL_SIMPLIFY = PERF_FLAG_REFERENCE_GRID_DENSE_VISUAL_SIMPLIFY;
const REFERENCE_GRID_FLAG_MEMORY_GUARD = PERF_FLAG_REFERENCE_GRID_MEMORY_GUARD;
const REFERENCE_GRID_FLAG_PERF_WATCHDOG = PERF_FLAG_REFERENCE_GRID_PERF_WATCHDOG;
const REFERENCE_GRID_FLAG_HARD_VIEWPORT_CAP = PERF_FLAG_REFERENCE_GRID_HARD_VIEWPORT_CAP;
const REFERENCE_GRID_FLAG_CSS_CONTAINMENT = PERF_FLAG_REFERENCE_GRID_CSS_CONTAINMENT;
const REFERENCE_GRID_FLAG_LOADING_PLACEHOLDER_TIMEOUT =
  PERF_FLAG_REFERENCE_GRID_LOADING_PLACEHOLDER_TIMEOUT;
const REFERENCE_GRID_FLAG_GLOBAL_MEDIA_BUDGET = PERF_FLAG_REFERENCE_GRID_GLOBAL_MEDIA_BUDGET;
const REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY =
  PERF_FLAG_REFERENCE_GRID_ADAPTIVE_PREVIEW_QUALITY;
const REFERENCE_GRID_FLAG_TELEMETRY_BACKPRESSURE = PERF_FLAG_REFERENCE_GRID_TELEMETRY_BACKPRESSURE;
const REFERENCE_GRID_FLAG_TRANSITION_NONURGENT = PERF_FLAG_REFERENCE_GRID_TRANSITION_NONURGENT;
const REFERENCE_GRID_FLAG_RENDER_COMMIT_TELEMETRY =
  PERF_FLAG_REFERENCE_GRID_RENDER_COMMIT_TELEMETRY;

/**
 * Displays the reference grid and handles drag/drop + selection behavior.
 */
function ReferenceGridComponent({
  outputs: outputsProp,
  archivedOutputs: archivedOutputsProp,
  activeOutputId,
  topNotice = null,
  curatedReferenceIds = [],
  removedFromAllRefsIds = [],
  showHeader = true,
  onOutputMediaLoaded,
  linkedPromptReferenceIds = [],
  onSelectOutput,
  onOpenDetails,
  selectedTool,
  onDropFiles,
  onPasteTextReference,
  onPasteMediaReference,
  onTriggerFileSelect,
  onOpenMediaLibrary,
  onSaveToLibrary,
  onDownload,
  onRetryStatus,
  onRerollOutput,
  onDeleteOutput,
  onAddCuratedReference,
  onRemoveCuratedReference,
  onReorderCuratedReference,
  onAddLibraryMediaReferenceToQuickSlot,
  onAddLibraryPromptReferenceToQuickSlot,
  onRestoreArchivedOutput,
  onRestoreAllArchivedOutputs,
  panelVisibility,
  railCanvasProps,
  stylesPanel,
}: ReferenceGridProps) {
  incrementFreezeInvestigationCounter("referenceGrid.render");
  const selectorOutputIds = useOutputSelector(
    React.useCallback(
      (snapshot) => {
        if (outputsProp) return [];
        if (!removedFromAllRefsIds.length) {
          return snapshot.outputOrder.filter(
            (id) => snapshot.outputById[id]?.hiddenInReferenceGrid !== true
          );
        }
        const removedIdSet = new Set(removedFromAllRefsIds);
        return snapshot.outputOrder.filter((id) => {
          const item = snapshot.outputById[id];
          if (!item) return false;
          if (removedIdSet.has(id)) return false;
          return item.hiddenInReferenceGrid !== true;
        });
      },
      [outputsProp, removedFromAllRefsIds]
    ),
    (left, right) =>
      left.length === right.length && left.every((item, index) => item === right[index])
  );
  const selectorArchivedOutputs = useOutputSelector((snapshot) => {
    if (archivedOutputsProp) return EMPTY_OUTPUTS;
    return snapshot.archivedOutputOrder
      .map((id) => snapshot.archivedOutputById[id])
      .filter((item): item is StudioOutput => Boolean(item));
  }, areOutputListsEqual);
  const allOutputIds = outputsProp
    ? selectAllRefsProjectionWithLegacyFallback(outputsProp, {
        quickSlotIds: curatedReferenceIds,
        removedFromAllRefsIds,
      }).map((item) => item.id)
    : selectorOutputIds;
  const archivedOutputs = archivedOutputsProp ?? selectorArchivedOutputs;
  setFreezeInvestigationGauge("referenceGrid.allOutputsCount", allOutputIds.length);
  setFreezeInvestigationGauge("referenceGrid.archivedOutputsCount", archivedOutputs.length);
  const isAnyModalOpen = useAiStudioAnyModalOpen();
  const suspendBackgroundVisualWork = PERF_FLAG_MODAL_STABILITY_V1 && isAnyModalOpen;
  const panelVisibilityResolved = React.useMemo(
    () => ({
      canvas: panelVisibility?.canvas ?? DEFAULT_PANEL_VISIBILITY.canvas,
      quickSlot: panelVisibility?.quickSlot ?? DEFAULT_PANEL_VISIBILITY.quickSlot,
      referenceGrid: panelVisibility?.referenceGrid ?? DEFAULT_PANEL_VISIBILITY.referenceGrid,
      styles: panelVisibility?.styles ?? Boolean(stylesPanel?.isOpen),
    }),
    [
      panelVisibility?.canvas,
      panelVisibility?.quickSlot,
      panelVisibility?.referenceGrid,
      panelVisibility?.styles,
      stylesPanel?.isOpen,
    ]
  );
  const isCuratedSplitEnabled =
    REFERENCE_GRID_FLAG_CURATED_SPLIT &&
    Boolean(onAddCuratedReference && onRemoveCuratedReference && onReorderCuratedReference);
  const isStylesPanelOpen = Boolean(stylesPanel?.isOpen) && panelVisibilityResolved.styles;
  const showReferenceGridSection = panelVisibilityResolved.referenceGrid;
  const showQuickSlotSection = isCuratedSplitEnabled && panelVisibilityResolved.quickSlot;
  const isWideLayout = selectedTool == null;
  const showRailCanvasSection =
    Boolean(railCanvasProps) && selectedTool !== "canvas" && panelVisibilityResolved.canvas;
  const isCuratedSplitActive = showQuickSlotSection;
  const outputById = React.useMemo(() => {
    const map: Record<string, StudioOutput> = {};
    [...(outputsProp ?? EMPTY_OUTPUTS), ...archivedOutputs].forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [archivedOutputs, outputsProp]);
  const allOutputIdSet = React.useMemo(() => new Set(allOutputIds), [allOutputIds]);
  const directCuratedOutputs = React.useMemo(
    () =>
      outputsProp
        ? selectQuickSlotProjection(outputsProp, {
            quickSlotIds: curatedReferenceIds,
            removedFromAllRefsIds,
          })
        : EMPTY_OUTPUTS,
    [curatedReferenceIds, outputsProp, removedFromAllRefsIds]
  );
  const curatedOutputIds = React.useMemo(
    () =>
      outputsProp
        ? directCuratedOutputs.map((item) => item.id)
        : curatedReferenceIds.filter((id) => allOutputIdSet.has(id)),
    [allOutputIdSet, curatedReferenceIds, directCuratedOutputs, outputsProp]
  );
  const selectorCuratedOutputs = useOutputsByIds(curatedOutputIds);
  const curatedOutputs = outputsProp ? directCuratedOutputs : selectorCuratedOutputs;
  setFreezeInvestigationGauge("referenceGrid.projectedOutputsCount", allOutputIds.length);
  setFreezeInvestigationGauge("referenceGrid.curatedOutputsCount", curatedOutputs.length);
  const perfWatchdog = useReferenceGridPerfWatchdog({
    enabled: REFERENCE_GRID_FLAG_PERF_WATCHDOG,
    memoryGuardEnabled: REFERENCE_GRID_FLAG_MEMORY_GUARD,
  });
  const previewQualityPressureLevel = perfWatchdog.previewQualityPressureLevel;
  const liveWatchdogDegradeLevelRef = React.useRef<0 | 1 | 2>(perfWatchdog.degradeLevel);
  const hydrationBudget = useReferenceGridHydrationBudget({
    enabled: REFERENCE_GRID_FLAG_DECODE_BUDGET,
    pressureLevel: perfWatchdog.degradeLevel,
  });
  const selectionTheme = resolveReferenceSelectionTheme(selectedTool);
  const [loadedMap, setLoadedMap] = useState<Record<string, boolean>>({});
  const loadedIdsRef = React.useRef<Set<string>>(new Set());
  const autoplayingIdsRef = React.useRef<Set<string>>(new Set());
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const curatedScrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const curatedGridRef = React.useRef<HTMLDivElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const inventoryStackRef = React.useRef<HTMLDivElement | null>(null);
  const railCanvasSectionRef = React.useRef<HTMLDivElement | null>(null);
  const railCanvasHeaderRef = React.useRef<HTMLDivElement | null>(null);
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
  const {
    curatedHeaderHeightPx,
    railCanvasHeaderHeightPx,
    allRefsHeaderHeightPx,
    stylesHeaderHeightPx,
  } = useReferenceGridHeaderMeasurements({
    isCuratedSplitActive,
    showRailCanvasSection,
    stylesSplitEnabled,
    isStylesPanelOpen,
    curatedHeaderRef,
    railCanvasHeaderRef,
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
  const allRefsSectionMinHeaderHeightPx = Math.max(
    STYLES_REFERENCE_GRID_COLLAPSE_TOP_HEIGHT_PX,
    allRefsHeaderHeightPx
  );
  const stylesSplitUsesNestedContainer =
    isStylesPanelOpen && showQuickSlotSection && showReferenceGridSection;
  const horizontalSplitMinBottomSectionHeightPx = stylesSplitUsesNestedContainer
    ? stylesSplitMinTopSectionHeightPx +
      stylesSplitMinBottomSectionHeightPx +
      HORIZONTAL_DIVIDER_TRACK_MIN_HEIGHT_PX
    : CURATED_MIN_BOTTOM_STACK_HEIGHT_PX;
  const railCanvasMinBottomSectionHeightPx = (() => {
    if (showQuickSlotSection && showReferenceGridSection && isStylesPanelOpen) {
      return (
        curatedHeaderHeightPx +
        HORIZONTAL_DIVIDER_TRACK_MIN_HEIGHT_PX +
        horizontalSplitMinBottomSectionHeightPx
      );
    }
    if (showQuickSlotSection && showReferenceGridSection) {
      return (
        curatedHeaderHeightPx +
        HORIZONTAL_DIVIDER_TRACK_MIN_HEIGHT_PX +
        allRefsSectionMinHeaderHeightPx
      );
    }
    if (showQuickSlotSection && isStylesPanelOpen) {
      return (
        curatedHeaderHeightPx +
        HORIZONTAL_DIVIDER_TRACK_MIN_HEIGHT_PX +
        stylesSplitMinBottomSectionHeightPx
      );
    }
    if (showReferenceGridSection && isStylesPanelOpen) {
      return (
        stylesSplitMinTopSectionHeightPx +
        HORIZONTAL_DIVIDER_TRACK_MIN_HEIGHT_PX +
        stylesSplitMinBottomSectionHeightPx
      );
    }
    if (showQuickSlotSection) return curatedHeaderHeightPx;
    if (showReferenceGridSection) return allRefsSectionMinHeaderHeightPx;
    if (isStylesPanelOpen) return Math.max(24, stylesHeaderHeightPx);
    return RAIL_CANVAS_MIN_BOTTOM_STACK_HEIGHT_PX;
  })();
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
  const railCanvasSplit = useReferenceGridHorizontalSplit({
    enabled: showRailCanvasSection,
    containerRef: panelRef,
    defaultTopRatio: DEFAULT_CANVAS_SECTION_TOP_RATIO,
    minTopSectionHeightPx: railCanvasHeaderHeightPx,
    minBottomSectionHeightPx: Math.max(
      RAIL_CANVAS_MIN_BOTTOM_STACK_HEIGHT_PX,
      railCanvasMinBottomSectionHeightPx
    ),
    allRefsSnapTopHeightPx: railCanvasHeaderHeightPx,
    collapseTopHeightPx: railCanvasHeaderHeightPx,
    ariaLabel: "Resize Canvas and Quick Slot Inventory sections",
  });
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
    if (REFERENCE_GRID_FLAG_TRANSITION_NONURGENT && typeof React.startTransition === "function") {
      React.startTransition(updater);
      return;
    }
    updater();
  }, []);
  React.useEffect(() => {
    liveWatchdogDegradeLevelRef.current = perfWatchdog.degradeLevel;
  }, [perfWatchdog.degradeLevel]);
  const mediaWorkBudget = useReferenceGridMediaWorkBudget({
    enabled: REFERENCE_GRID_FLAG_GLOBAL_MEDIA_BUDGET,
    pressureLevel: perfWatchdog.degradeLevel,
    constrainedProfile: hydrationBudget.constrainedProfile,
    desiredImageDecodeInflight: hydrationBudget.maxInflightHydrations,
    desiredVideoAttachSlots: desiredVideoAttachBudget,
  });
  const adaptivePreviewRoutingEnabled = isReferenceGridAdaptivePreviewRoutingEnabled({
    adaptivePreviewEnabled: REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW,
    adaptivePreviewQualityEnabled: REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY,
  });

  const { imageHydrationState, enqueueImageHydration, pruneHydrationQueueToCandidateIds } =
    useReferenceGridImageHydrationController({
      decodeBudgetEnabled: REFERENCE_GRID_FLAG_DECODE_BUDGET,
      suspendHydrationProcessing: suspendBackgroundVisualWork,
      adaptivePreviewRoutingEnabled,
      imageDecodeBudget: mediaWorkBudget.imageDecodeBudget,
      activeOutputId,
      validOutputIds: allOutputIds,
      runNonUrgentUpdate,
      liveWatchdogDegradeLevelRef,
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
      dynamicVirtualizationEnabled: REFERENCE_GRID_FLAG_DYNAMIC_VIRTUALIZATION,
      hardViewportCapEnabled: REFERENCE_GRID_FLAG_HARD_VIEWPORT_CAP,
      denseVisualSimplifyEnabled: REFERENCE_GRID_FLAG_DENSE_VISUAL_SIMPLIFY,
      virtualOverscanRows: REFERENCE_VIRTUAL_OVERSCAN_ROWS,
      virtualizeMinItems: REFERENCE_VIRTUALIZE_MIN_ITEMS,
      fallbackReferenceRowHeight: FALLBACK_REFERENCE_ROW_HEIGHT,
      referenceGridMinColumns: REFERENCE_GRID_MIN_COLUMNS,
      highDensityCardCount: REFERENCE_HIGH_DENSITY_CARD_COUNT,
    },
  });
  const selectorVisibleOutputs = useOutputsByIds(visibleOutputIds);
  const selectorVisibleCuratedOutputs = useOutputsByIds(visibleCuratedOutputIds);
  const selectorNearViewportOutputs = useOutputsByIds(nearViewportOutputIds);
  const selectorNearViewportCuratedOutputs = useOutputsByIds(nearViewportCuratedOutputIds);
  const selectorVisibleMediaOutputs = useOutputSelector(
    React.useCallback(
      (snapshot) =>
        visibleOutputIds
          .map((id) => snapshot.outputById[id])
          .filter((item): item is StudioOutput => Boolean(item))
          .map(projectReferenceGridMediaOutput),
      [visibleOutputIds]
    ),
    areReferenceGridMediaOutputsEqual
  );
  const selectorVisibleCuratedMediaOutputs = useOutputSelector(
    React.useCallback(
      (snapshot) =>
        visibleCuratedOutputIds
          .map((id) => snapshot.outputById[id])
          .filter((item): item is StudioOutput => Boolean(item))
          .map(projectReferenceGridMediaOutput),
      [visibleCuratedOutputIds]
    ),
    areReferenceGridMediaOutputsEqual
  );
  const selectorNearViewportMediaOutputs = useOutputSelector(
    React.useCallback(
      (snapshot) =>
        nearViewportOutputIds
          .map((id) => snapshot.outputById[id])
          .filter((item): item is StudioOutput => Boolean(item))
          .map(projectReferenceGridMediaOutput),
      [nearViewportOutputIds]
    ),
    areReferenceGridMediaOutputsEqual
  );
  const selectorNearViewportCuratedMediaOutputs = useOutputSelector(
    React.useCallback(
      (snapshot) =>
        nearViewportCuratedOutputIds
          .map((id) => snapshot.outputById[id])
          .filter((item): item is StudioOutput => Boolean(item))
          .map(projectReferenceGridMediaOutput),
      [nearViewportCuratedOutputIds]
    ),
    areReferenceGridMediaOutputsEqual
  );
  const selectorActiveMediaOutput = useOutputSelector(
    React.useCallback(
      (snapshot) => {
        if (!activeOutputId) return null;
        const item =
          snapshot.outputById[activeOutputId] ?? snapshot.archivedOutputById[activeOutputId];
        return item ? projectReferenceGridMediaOutput(item) : null;
      },
      [activeOutputId]
    ),
    areReferenceGridMediaOutputEntriesEqual
  );
  const selectorActiveOutput = useOutputById(activeOutputId);
  const activeOutput =
    outputsProp != null && activeOutputId
      ? (outputById[activeOutputId] ?? null)
      : selectorActiveOutput;
  const visibleOutputs =
    outputsProp != null
      ? visibleOutputIds
          .map((id) => outputById[id])
          .filter((item): item is StudioOutput => Boolean(item))
      : selectorVisibleOutputs;
  const visibleCuratedOutputs =
    outputsProp != null
      ? visibleCuratedOutputIds
          .map((id) => outputById[id])
          .filter((item): item is StudioOutput => Boolean(item))
      : selectorVisibleCuratedOutputs;
  const nearViewportOutputs =
    outputsProp != null
      ? nearViewportOutputIds
          .map((id) => outputById[id])
          .filter((item): item is StudioOutput => Boolean(item))
      : selectorNearViewportOutputs;
  const nearViewportCuratedOutputs =
    outputsProp != null
      ? nearViewportCuratedOutputIds
          .map((id) => outputById[id])
          .filter((item): item is StudioOutput => Boolean(item))
      : selectorNearViewportCuratedOutputs;
  const visibleMediaOutputs =
    outputsProp != null
      ? visibleOutputs.map(projectReferenceGridMediaOutput)
      : selectorVisibleMediaOutputs;
  const visibleCuratedMediaOutputs =
    outputsProp != null
      ? visibleCuratedOutputs.map(projectReferenceGridMediaOutput)
      : selectorVisibleCuratedMediaOutputs;
  const nearViewportMediaOutputs =
    outputsProp != null
      ? nearViewportOutputs.map(projectReferenceGridMediaOutput)
      : selectorNearViewportMediaOutputs;
  const nearViewportCuratedMediaOutputs =
    outputsProp != null
      ? nearViewportCuratedOutputs.map(projectReferenceGridMediaOutput)
      : selectorNearViewportCuratedMediaOutputs;
  const activeMediaOutput =
    outputsProp != null && activeOutput
      ? projectReferenceGridMediaOutput(activeOutput)
      : selectorActiveMediaOutput;
  const visibleOutputById = React.useMemo(() => {
    const map: Record<string, StudioOutput> = {};
    [...visibleCuratedOutputs, ...visibleOutputs].forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [visibleCuratedOutputs, visibleOutputs]);
  const archiveCount = archivedOutputs.length;
  const { recomputeAutoplayBudget } = useReferenceGridAutoplaySelectionController({
    activeOutputId,
    suspendAutoplaySelection: suspendBackgroundVisualWork,
    videoAttachBudget: mediaWorkBudget.videoAttachBudget,
    perfDegradeLevel: perfWatchdog.degradeLevel,
    runNonUrgentUpdate,
    setAutoplayEnabledIds,
    videoVisibleKeySetRef,
    videoOutputIdByKeyRef,
    recomputeAutoplayBudgetRef,
    desiredVideoAttachBudgetRef,
    desiredVideoAttachBudget,
    autoplayEnabledIdsStateRef,
    autoplayEnabledIds,
  });

  const baseHydrationPriorityRows = REFERENCE_GRID_FLAG_DECODE_BUDGET
    ? hydrationBudget.priorityRows
    : REFERENCE_PRIORITY_HYDRATION_ROWS;
  const hydrationPriorityCount =
    Math.max(REFERENCE_GRID_MIN_COLUMNS, virtualMetrics.columnCount) * baseHydrationPriorityRows;
  const curatedHydrationPriorityCount =
    Math.max(REFERENCE_GRID_MIN_COLUMNS, curatedVirtualMetrics.columnCount) *
    baseHydrationPriorityRows;
  const quickSlotAdaptiveSurfaceEnabled = isAdaptiveSurfaceEnabled("quick-slot");
  const { resolveCardMedia } = useReferenceGridResolvedMediaController({
    previewQualityPressureLevel,
    strictPreviewLadder: REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER,
    adaptivePreviewRoutingEnabled,
  });
  const { visibleQuickSlotIdSet, hydrationQuickSlotPreferredIdSet } =
    useReferenceGridSurfaceOwnershipController({
      visibleCuratedOutputIds,
      nearViewportCuratedOutputIds,
      quickSlotAdaptiveSurfaceEnabled,
    });
  const {
    visibleCardItems,
    curatedVisibleCardItems,
    allVisibleCardItems,
    transformedAdaptivePreviewCount,
  } = useReferenceGridCardItemsController({
    activeOutputId,
    decodeBudgetEnabled: REFERENCE_GRID_FLAG_DECODE_BUDGET,
    visibleOutputs: visibleMediaOutputs,
    visibleCuratedOutputs: visibleCuratedMediaOutputs,
    visibleQuickSlotIdSet,
    hydrationPriorityCount,
    curatedHydrationPriorityCount,
    virtualRowHeight: virtualMetrics.rowHeight,
    curatedVirtualRowHeight: curatedVirtualMetrics.rowHeight,
    quickSlotAdaptiveSurfaceEnabled,
    resolveCardMedia,
    hydratedById: imageHydrationState.hydratedById,
  });
  useReferenceGridPreviewSwapTelemetryController({
    visibleCardItems,
    renderedItemCount,
    outputsLength: allOutputIds.length,
    suspendVisualTelemetry: suspendBackgroundVisualWork,
    previousVisiblePreviewUrlByIdRef,
    previewSwapTelemetryRef,
    setPreviewSwapMetrics,
  });
  const {
    loadingCardIdSet,
    generationLoadingCardIdSet,
    hydrationLoadingCardIdSet,
    loadingIdsLength,
  } = useReferenceGridLoadingVisualController({
    allVisibleCardItems,
    visibleOutputById,
    visibleQuickSlotIdSet,
    loadedMap,
    decodeBudgetEnabled: REFERENCE_GRID_FLAG_DECODE_BUDGET,
  });

  useReferenceGridHydrationQueueController({
    decodeBudgetEnabled: REFERENCE_GRID_FLAG_DECODE_BUDGET,
    suspendHydrationQueue: suspendBackgroundVisualWork,
    activeOutput: activeMediaOutput,
    visibleCardItems,
    curatedVisibleCardItems,
    hydrationQuickSlotPreferredIdSet,
    nearViewportOutputs: nearViewportMediaOutputs,
    nearViewportCuratedOutputs: nearViewportCuratedMediaOutputs,
    virtualRowHeight: virtualMetrics.rowHeight,
    curatedVirtualRowHeight: curatedVirtualMetrics.rowHeight,
    quickSlotAdaptiveSurfaceEnabled,
    resolveCardMedia,
    enqueueImageHydration,
    pruneHydrationQueueToCandidateIds,
  });

  useReferenceGridAutoplayBudgetController({
    smallScreenQuery: REFERENCE_AUTOPLAY_SMALL_SCREEN_QUERY,
    suspendAutoplayBudget: suspendBackgroundVisualWork,
    autoplayMaxDesktop: REFERENCE_AUTOPLAY_MAX_DESKTOP,
    autoplayMaxSmallScreen: REFERENCE_AUTOPLAY_MAX_SMALL_SCREEN,
    autoplayMaxConstrained: REFERENCE_AUTOPLAY_MAX_CONSTRAINED,
    desiredVideoAttachBudgetRef,
    autoplayEnabledIdsStateRef,
    recomputeAutoplayBudgetRef,
    setDesiredVideoAttachBudget,
    setAutoplayEnabledIds,
    runNonUrgentUpdate,
  });

  const { registerVideoNode } = useReferenceGridVideoLifecycleController({
    activeOutputId,
    validOutputIds: allOutputIds,
    shouldVirtualize,
    renderedOutputIdSet,
    autoplayEnabledIds,
    autoplayEnabledIdSet,
    isCuratedSplitEnabled: isCuratedSplitActive,
    scrollContainerRef,
    curatedScrollContainerRef,
    autoplayingIdsRef,
    videoVisibleKeySetRef,
    videoOutputIdByKeyRef,
    videoNodeByKeyRef,
    videoDetachTimeoutByKeyRef,
    videoIntersectionObserverBySurfaceRef,
    autoplayDetachDelayMs: REFERENCE_AUTOPLAY_DETACH_DELAY_MS,
    autoplayVisibilityThreshold: REFERENCE_AUTOPLAY_VISIBILITY_THRESHOLD,
    recomputeAutoplayBudget,
  });

  useReferenceGridTelemetryController({
    renderCommitTelemetryEnabled: REFERENCE_GRID_FLAG_RENDER_COMMIT_TELEMETRY,
    telemetryBackpressureEnabled: REFERENCE_GRID_FLAG_TELEMETRY_BACKPRESSURE,
    lastRenderCommitAtRef,
    renderedItemCount,
    outputsLength: allOutputIds.length,
    shouldVirtualize,
    isHighDensity,
    imageHydrationQueueSize: imageHydrationState.queueSize,
    imageDecodeInflight: imageHydrationState.decodeInflight,
    perfDegradeLevel: perfWatchdog.degradeLevel,
    previewSwapRatePerMinute: previewSwapMetrics.swapRatePerMinute,
    previewRepaintSpikeCount: previewSwapMetrics.repaintSpikeCount,
    previewLastSwapBurstCount: previewSwapMetrics.lastSwapBurstCount,
    optimizerFailoverBypassCount: imageHydrationState.optimizerFailoverBypassCount,
    optimizerFailoverErrorCount: imageHydrationState.optimizerFailoverErrorCount,
    startIndex,
    endIndex,
    canvasDropMode,
    isCuratedDropActive,
    loadingCardCount: loadingIdsLength,
  });

  const { markLoaded } = useReferenceGridLoadedMediaController({
    loadedIdsRef,
    setLoadedMap,
    runNonUrgentUpdate,
    onOutputMediaLoaded,
    stabilizeLoadingVisual: REFERENCE_GRID_FLAG_LOADING_PLACEHOLDER_TIMEOUT,
  });

  const { handleCanvasDrop, handleCanvasDragOver, handleCanvasDragEnter, handleCanvasDragLeave } =
    useReferenceGridDropController({
      canvasDragDepthRef,
      curatedDragDepthRef,
      setCanvasDropModeSafe,
      setCuratedDropActiveSafe,
      resolveCanvasDropMode,
      canAcceptCanvasDrag,
      normalizeMediaFiles,
      buildFileList,
      onDropFiles,
      onPasteTextReference,
    });

  const { handlePanelPointerEnter, handlePanelPointerLeave, handlePanelPointerDown } =
    useReferenceGridClipboardController({
      panelRef,
      curatedSectionRef,
      isPointerOverPanelRef,
      isPastePrimedRef,
      lastPasteFingerprintRef,
      buildFileList,
      onDropFiles,
      onPasteMediaReference,
      onPasteTextReference,
    });

  const { handleCardDragStart, handleCardDragEnd } = useReferenceGridCardDragController();

  const {
    handleCuratedSectionDrop,
    handleCuratedSectionDragOver,
    handleCuratedSectionDragEnter,
    handleCuratedSectionDragLeave,
    handleCuratedCardDrop,
    handleCuratedCardKeyboardReorder,
  } = useReferenceGridCuratedDndController({
    isCuratedSplitEnabled: isCuratedSplitActive,
    curatedReferenceIds,
    curatedDragDepthRef,
    setCuratedDropActiveSafe,
    onAddCuratedReference,
    onReorderCuratedReference,
    onSelectOutput,
    onAddLibraryMediaReferenceToQuickSlot,
    onAddLibraryPromptReferenceToQuickSlot,
  });

  const { handleAllRefsScroll, handleCuratedScroll } = useReferenceGridScrollController({
    setVirtualMetrics,
    setCuratedVirtualMetrics,
    outputsLength: allOutputIds.length,
    renderedItemCount,
  });

  const { handleAutoplayStarted, handleAutoplayStopped } = useReferenceGridAutoplayEventController({
    autoplayingIdsRef,
    renderedItemCount,
    outputsLength: allOutputIds.length,
  });
  const { curatedCardNodes, allRefsCardNodes } = useReferenceGridCardRenderController({
    activeOutputId,
    visibleOutputById,
    autoplayEnabledIdSet,
    linkedPromptReferenceIdSet,
    loadingCardIdSet,
    generationLoadingCardIdSet,
    hydrationLoadingCardIdSet,
    perfDegradeLevel: perfWatchdog.degradeLevel,
    visibleCardItems,
    curatedVisibleCardItems,
    visibleQuickSlotIdSet,
    onSelectOutput,
    onOpenDetails,
    onCardDragStart: handleCardDragStart,
    onCardDragEnd: handleCardDragEnd,
    onCuratedSectionDragOver: handleCuratedSectionDragOver,
    onCuratedCardDrop: handleCuratedCardDrop,
    onCuratedSectionDragEnter: handleCuratedSectionDragEnter,
    onCuratedSectionDragLeave: handleCuratedSectionDragLeave,
    onCuratedCardKeyboardReorder: handleCuratedCardKeyboardReorder,
    registerVideoNode,
    markLoaded,
    onAutoplayStarted: handleAutoplayStarted,
    onAutoplayStopped: handleAutoplayStopped,
    onRetryStatus,
    onRerollOutput,
    onDeleteOutput,
    onRemoveCuratedReference,
    onSaveToLibrary,
    onDownload,
  });

  const wasBackgroundWorkSuspendedRef = React.useRef(suspendBackgroundVisualWork);
  React.useEffect(() => {
    if (wasBackgroundWorkSuspendedRef.current && !suspendBackgroundVisualWork) {
      recomputeAutoplayBudget();
    }
    wasBackgroundWorkSuspendedRef.current = suspendBackgroundVisualWork;
  }, [recomputeAutoplayBudget, suspendBackgroundVisualWork]);

  return (
    <div
      ref={panelRef}
      className={`panel ai-panel ai-preview-panel reference-canvas-panel${canvasDropMode !== "none" ? " is-drop-active" : ""}${canvasDropMode === "text" ? " is-drop-active-text" : ""}${canvasDropMode === "files" ? " is-drop-active-files" : ""}${isHighDensity ? " is-high-density" : ""}${denseVisualModeEnabled ? " is-dense-visual-mode" : ""}${REFERENCE_GRID_FLAG_CSS_CONTAINMENT ? " is-css-containment-mode" : ""}${REFERENCE_GRID_FLAG_LOADING_PLACEHOLDER_TIMEOUT ? " is-loading-placeholder-timeout-mode" : ""}${perfWatchdog.degradeLevel >= 1 ? " is-grid-pressure-mode" : ""}${isCuratedSplitActive ? " is-curated-split-mode" : ""}`}
      data-selection-theme={selectionTheme}
      data-grid-surface="reference-grid"
      data-rendered-item-count={renderedItemCount}
      data-image-hydration-queue-size={imageHydrationState.queueSize}
      data-image-decode-inflight-count={imageHydrationState.decodeInflight}
      data-grid-perf-degrade-level={perfWatchdog.degradeLevel}
      data-grid-media-work-tokens={mediaWorkBudget.totalTokens}
      data-grid-video-attach-budget={mediaWorkBudget.videoAttachBudget}
      data-grid-watchdog-longtask-p95={perfWatchdog.longTaskP95Ms ?? ""}
      data-grid-watchdog-input-stall-ms={perfWatchdog.maxInputStallMs}
      data-grid-adaptive-preview-enabled={adaptivePreviewRoutingEnabled}
      data-grid-adaptive-preview-transformed-count={transformedAdaptivePreviewCount}
      data-grid-optimizer-failover-bypass-count={imageHydrationState.optimizerFailoverBypassCount}
      data-grid-optimizer-failover-error-count={imageHydrationState.optimizerFailoverErrorCount}
      data-grid-src-swap-rate-per-minute={previewSwapMetrics.swapRatePerMinute}
      data-grid-repaint-spike-count={previewSwapMetrics.repaintSpikeCount}
      data-grid-last-swap-burst-count={previewSwapMetrics.lastSwapBurstCount}
      onDrop={handleCanvasDrop}
      onDragOver={handleCanvasDragOver}
      onDragEnter={handleCanvasDragEnter}
      onDragLeave={handleCanvasDragLeave}
      onPointerEnter={handlePanelPointerEnter}
      onPointerLeave={handlePanelPointerLeave}
      onPointerDown={handlePanelPointerDown}
      tabIndex={0}
    >
      <ReferenceGridSections
        isCuratedSplitEnabled={isCuratedSplitActive}
        isCuratedDropActive={isCuratedDropActive}
        showQuickSlotSection={showQuickSlotSection}
        showReferenceGridSection={showReferenceGridSection}
        showStylesSection={isStylesPanelOpen}
        showHeader={showHeader}
        archiveCount={archiveCount}
        topNotice={topNotice}
        isArchivePanelOpen={isArchivePanelOpen}
        archivedOutputs={archivedOutputs}
        onToggleArchivePanel={() => setIsArchivePanelOpen((prev) => !prev)}
        onTriggerFileSelect={onTriggerFileSelect}
        onOpenMediaLibrary={onOpenMediaLibrary}
        onRestoreArchivedOutput={onRestoreArchivedOutput}
        onRestoreAllArchivedOutputs={onRestoreAllArchivedOutputs}
        railCanvasProps={railCanvasProps}
        showRailCanvasSection={showRailCanvasSection}
        railCanvasSplit={railCanvasSplit}
        railCanvasSectionRef={railCanvasSectionRef}
        railCanvasHeaderRef={railCanvasHeaderRef}
        horizontalSplit={horizontalSplit}
        stylesSplit={stylesSplit}
        referenceGridStylesStackRef={referenceGridStylesStackRef}
        stylesPanel={stylesPanel}
        inventoryStackRef={inventoryStackRef}
        curatedSectionRef={curatedSectionRef}
        curatedHeaderRef={curatedHeaderRef}
        allRefsHeaderRef={allRefsHeaderRef}
        stylesHeaderRef={stylesHeaderRef}
        curatedScrollContainerRef={curatedScrollContainerRef}
        curatedGridRef={curatedGridRef}
        scrollContainerRef={scrollContainerRef}
        gridRef={gridRef}
        handleCuratedSectionDrop={handleCuratedSectionDrop}
        handleCuratedSectionDragOver={handleCuratedSectionDragOver}
        handleCuratedSectionDragEnter={handleCuratedSectionDragEnter}
        handleCuratedSectionDragLeave={handleCuratedSectionDragLeave}
        handleCuratedScroll={handleCuratedScroll}
        handleAllRefsScroll={handleAllRefsScroll}
        isWideLayout={isWideLayout}
        curatedGridStyle={curatedGridStyle}
        gridStyle={gridStyle}
        curatedOutputsLength={curatedOutputs.length}
        outputsLength={allOutputIds.length}
        curatedTopSpacerHeight={curatedTopSpacerHeight}
        curatedBottomSpacerHeight={curatedBottomSpacerHeight}
        topSpacerHeight={topSpacerHeight}
        bottomSpacerHeight={bottomSpacerHeight}
        curatedCardNodes={curatedCardNodes}
        allRefsCardNodes={allRefsCardNodes}
      />
    </div>
  );
}

export const ReferenceGrid = React.memo(ReferenceGridComponent, areReferenceGridPropsEqual);

/**
 * @deprecated Use `ReferenceGrid`.
 */
export const ReferenceCanvas = ReferenceGrid;
export type {
  ReferenceGridProps,
  ReferenceGridProps as ReferenceCanvasProps,
} from "../reference-grid/referenceGridTypes";
