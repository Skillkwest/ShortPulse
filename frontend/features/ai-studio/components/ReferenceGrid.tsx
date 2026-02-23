/**
 * Reference grid for saved outputs and uploads.
 * Supports drag/drop into other surfaces and exposes a detail action on double click.
 */
import React, { useCallback, useState } from "react";
import { StudioOutput } from "../types";
import type { ToolId } from "../types";
import { useOutputSelector } from "../hooks/aiStudioOutputStore";
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
  PERF_FLAG_REFERENCE_GRID_MEMORY_GUARD,
  PERF_FLAG_REFERENCE_GRID_PERF_WATCHDOG,
  PERF_FLAG_REFERENCE_GRID_RENDER_COMMIT_TELEMETRY,
  PERF_FLAG_REFERENCE_GRID_STRICT_PREVIEW_LADDER,
  PERF_FLAG_REFERENCE_GRID_TELEMETRY_BACKPRESSURE,
  PERF_FLAG_REFERENCE_GRID_TRANSITION_NONURGENT,
} from "../logic/perfProfileFlags";
import { useReferenceGridHydrationBudget } from "../hooks/useReferenceGridHydrationBudget";
import { useReferenceGridPerfWatchdog } from "../hooks/useReferenceGridPerfWatchdog";
import { useReferenceGridMediaWorkBudget } from "../hooks/useReferenceGridMediaWorkBudget";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";
import { selectAllRefsProjectionWithLegacyFallback } from "../reference-projections";
import {
  isAdaptiveSurfaceEnabled,
  logAdaptiveRecoveryLevelChanged,
} from "../../../lib/adaptive-media";
import { type PastedMediaReference } from "../reference-grid/controllers/referenceGridClipboard";
import { ReferenceGridSections } from "../reference-grid/components/ReferenceCanvasSections";
import { useReferenceGridClipboardController } from "../reference-grid/controllers/useReferenceGridClipboardController";
import {
  useReferenceGridCanvasDropController,
  type ReferenceGridDropMode,
} from "../reference-grid/controllers/useReferenceGridCanvasDropController";
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

const REFERENCE_VIRTUAL_OVERSCAN_ROWS = 4;
const REFERENCE_VIRTUALIZE_MIN_ITEMS = 12;
const FALLBACK_REFERENCE_ROW_HEIGHT = 220;
const REFERENCE_GRID_MIN_CARD_PX = 124;
const REFERENCE_GRID_MIN_CARD_PX_WIDE = 124;
const REFERENCE_GRID_MIN_COLUMNS = 2;
const REFERENCE_GRID_MAX_COLUMNS = 5;
const REFERENCE_GRID_MAX_COLUMNS_WIDE = 5;
const QUICK_SLOT_INVENTORY_MAX_COLUMNS = 5;
const REFERENCE_GRID_EMERGENCY_MAX_COLUMNS = 5;
const REFERENCE_AUTOPLAY_VISIBILITY_THRESHOLD = 0.6;
const REFERENCE_AUTOPLAY_MAX_DESKTOP = 3;
const REFERENCE_AUTOPLAY_MAX_SMALL_SCREEN = 2;
const REFERENCE_AUTOPLAY_MAX_CONSTRAINED = 1;
const REFERENCE_AUTOPLAY_SMALL_SCREEN_QUERY = "(max-width: 900px)";
const REFERENCE_AUTOPLAY_DETACH_DELAY_MS = 1400;
const REFERENCE_HIGH_DENSITY_CARD_COUNT = 180;
const REFERENCE_PRIORITY_HYDRATION_ROWS = 3;
const REFERENCE_MAX_ANIMATED_SPINNERS_LEVEL_0 = 6;
const REFERENCE_MAX_ANIMATED_SPINNERS_LEVEL_1 = 6;
const REFERENCE_MAX_ANIMATED_SPINNERS_LEVEL_2 = 3;
const REFERENCE_PREVIEW_QUALITY_RECOVERY_STABLE_MS = 15_000;
const REFERENCE_PREVIEW_QUALITY_MIN_CHANGE_INTERVAL_MS = 4_000;
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
const REFERENCE_GRID_FLAG_GLOBAL_MEDIA_BUDGET = PERF_FLAG_REFERENCE_GRID_GLOBAL_MEDIA_BUDGET;
const REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY =
  PERF_FLAG_REFERENCE_GRID_ADAPTIVE_PREVIEW_QUALITY;
const REFERENCE_GRID_FLAG_TELEMETRY_BACKPRESSURE = PERF_FLAG_REFERENCE_GRID_TELEMETRY_BACKPRESSURE;
const REFERENCE_GRID_FLAG_TRANSITION_NONURGENT = PERF_FLAG_REFERENCE_GRID_TRANSITION_NONURGENT;
const REFERENCE_GRID_FLAG_RENDER_COMMIT_TELEMETRY =
  PERF_FLAG_REFERENCE_GRID_RENDER_COMMIT_TELEMETRY;

// Temporary UI experiment: set false to revert selection outline theming to default create-blue.
const ENABLE_TOOL_THEMED_SELECTION_OUTLINE = true;

type ReferenceSelectionTheme = "create" | "edit" | "video";

const resolveReferenceSelectionTheme = (selectedTool: ToolId | null): ReferenceSelectionTheme => {
  if (!ENABLE_TOOL_THEMED_SELECTION_OUTLINE) return "create";
  if (selectedTool === "image" || selectedTool === "edit") return "edit";
  if (selectedTool === "video" || selectedTool === "kling") return "video";
  return "create";
};

const EMPTY_OUTPUTS: StudioOutput[] = [];

const areOutputListsEqual = (left: StudioOutput[], right: StudioOutput[]) => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
};

export type ReferenceGridProps = {
  outputs?: StudioOutput[];
  archivedOutputs?: StudioOutput[];
  activeOutputId: string | null;
  curatedReferenceIds?: string[];
  removedFromAllRefsIds?: string[];
  showHeader?: boolean;
  onOutputMediaLoaded?: (id: string) => void;
  linkedPromptReferenceIds?: string[];
  onSelectOutput: (id: string) => void;
  onOpenDetails: (id: string) => void;
  selectedTool: ToolId | null;
  showPromptGenerate?: boolean;
  disablePromptGenerate?: boolean;
  onDropFiles?: (files: FileList) => void;
  onPasteTextReference?: (text: string) => void;
  onPasteMediaReference?: (reference: PastedMediaReference) => void;
  onTriggerFileSelect?: () => void;
  onOpenMediaLibrary?: () => void;
  onDescribeImage?: (output: StudioOutput) => void;
  onSaveToLibrary?: (output: StudioOutput) => void;
  onDownload?: (output: StudioOutput) => void;
  onGeneratePrompt?: (output: StudioOutput) => void;
  onRetryStatus?: (output: StudioOutput) => void;
  onDeleteOutput?: (id: string) => void;
  onAddCuratedReference?: (id: string) => void;
  onRemoveCuratedReference?: (id: string) => void;
  onReorderCuratedReference?: (
    id: string,
    targetId: string | null,
    placement: "before" | "after" | "end"
  ) => void;
  onRestoreArchivedOutput?: (id: string) => void;
  onRestoreAllArchivedOutputs?: () => void;
  generateCostCredits?: number | null;
};

/**
 * @deprecated Use `ReferenceGridProps`.
 */
export type ReferenceCanvasProps = ReferenceGridProps;

/**
 * Displays the reference grid and handles drag/drop + selection behavior.
 */
export function ReferenceGrid({
  outputs: outputsProp,
  archivedOutputs: archivedOutputsProp,
  activeOutputId,
  curatedReferenceIds = [],
  removedFromAllRefsIds = [],
  showHeader = true,
  onOutputMediaLoaded,
  linkedPromptReferenceIds = [],
  onSelectOutput,
  onOpenDetails,
  selectedTool,
  showPromptGenerate = true,
  disablePromptGenerate = false,
  onDropFiles,
  onPasteTextReference,
  onPasteMediaReference,
  onTriggerFileSelect,
  onOpenMediaLibrary,
  onDescribeImage,
  onSaveToLibrary,
  onDownload,
  onGeneratePrompt,
  onRetryStatus,
  onDeleteOutput,
  onAddCuratedReference,
  onRemoveCuratedReference,
  onReorderCuratedReference,
  onRestoreArchivedOutput,
  onRestoreAllArchivedOutputs,
  generateCostCredits,
}: ReferenceGridProps) {
  const selectorOutputs = useOutputSelector((snapshot) => {
    if (outputsProp) return EMPTY_OUTPUTS;
    return snapshot.outputOrder
      .map((id) => snapshot.outputById[id])
      .filter((item): item is StudioOutput => Boolean(item));
  }, areOutputListsEqual);
  const selectorArchivedOutputs = useOutputSelector((snapshot) => {
    if (archivedOutputsProp) return EMPTY_OUTPUTS;
    return snapshot.archivedOutputOrder
      .map((id) => snapshot.archivedOutputById[id])
      .filter((item): item is StudioOutput => Boolean(item));
  }, areOutputListsEqual);
  const allOutputs = outputsProp ?? selectorOutputs;
  const archivedOutputs = archivedOutputsProp ?? selectorArchivedOutputs;
  const outputs = React.useMemo(
    () =>
      selectAllRefsProjectionWithLegacyFallback(allOutputs, {
        quickSlotIds: curatedReferenceIds,
        removedFromAllRefsIds,
      }),
    [allOutputs, curatedReferenceIds, removedFromAllRefsIds]
  );
  const isCuratedSplitEnabled =
    REFERENCE_GRID_FLAG_CURATED_SPLIT &&
    Boolean(onAddCuratedReference && onRemoveCuratedReference && onReorderCuratedReference);
  const outputById = React.useMemo(() => {
    const map: Record<string, StudioOutput> = {};
    [...allOutputs, ...archivedOutputs].forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [allOutputs, archivedOutputs]);
  const curatedOutputs = React.useMemo(
    () =>
      curatedReferenceIds
        .map((id) => outputById[id])
        .filter((item): item is StudioOutput => Boolean(item)),
    [curatedReferenceIds, outputById]
  );
  const perfWatchdog = useReferenceGridPerfWatchdog({
    enabled: REFERENCE_GRID_FLAG_PERF_WATCHDOG,
    memoryGuardEnabled: REFERENCE_GRID_FLAG_MEMORY_GUARD,
  });
  const [previewQualityPressureLevel, setPreviewQualityPressureLevel] = useState<0 | 1 | 2>(
    perfWatchdog.degradeLevel
  );
  const previewQualityPressureLevelRef = React.useRef<0 | 1 | 2>(perfWatchdog.degradeLevel);
  const previewQualityLastChangeAtMsRef = React.useRef<number>(0);
  const previewQualityRecoveryCandidateRef = React.useRef<{
    level: 0 | 1 | 2;
    sinceMs: number;
  } | null>(null);
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
  const curatedSectionRef = React.useRef<HTMLDivElement | null>(null);
  const curatedHeaderRef = React.useRef<HTMLDivElement | null>(null);
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
  const [curatedHeaderHeightPx, setCuratedHeaderHeightPx] = useState(24);
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
  const horizontalSplit = useReferenceGridHorizontalSplit({
    enabled: isCuratedSplitEnabled,
    containerRef: panelRef,
    defaultTopRatio: 0,
    minTopSectionHeightPx: curatedHeaderHeightPx,
    minBottomSectionHeightPx: 72,
    allRefsSnapTopHeightPx: curatedHeaderHeightPx,
    collapseTopHeightPx: curatedHeaderHeightPx,
  });

  React.useEffect(() => {
    if (!isCuratedSplitEnabled) return;
    const updateHeaderHeight = () => {
      const node = curatedHeaderRef.current;
      if (!node) return;
      const nextHeight = Math.max(24, Math.round(node.offsetHeight));
      setCuratedHeaderHeightPx((prev) => (prev === nextHeight ? prev : nextHeight));
    };
    updateHeaderHeight();
    if (typeof ResizeObserver === "undefined") return;
    const node = curatedHeaderRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      updateHeaderHeight();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [isCuratedSplitEnabled]);
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
  React.useEffect(() => {
    previewQualityPressureLevelRef.current = previewQualityPressureLevel;
  }, [previewQualityPressureLevel]);
  React.useEffect(() => {
    const currentLevel = previewQualityPressureLevelRef.current;
    const nextLevel = perfWatchdog.degradeLevel;
    if (nextLevel === currentLevel) return;
    const now =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();

    // Increase pressure quickly to protect responsiveness under real load.
    if (nextLevel > currentLevel) {
      previewQualityRecoveryCandidateRef.current = null;
      previewQualityPressureLevelRef.current = nextLevel;
      previewQualityLastChangeAtMsRef.current = now;
      setPreviewQualityPressureLevel((prev) => (prev === nextLevel ? prev : nextLevel));
      logAdaptiveRecoveryLevelChanged({
        surface: "reference-grid",
        prevLevel: currentLevel,
        nextLevel,
      });
      return;
    }

    // Recover quality slowly to avoid periodic URL churn that causes visible flicker.
    const candidate = previewQualityRecoveryCandidateRef.current;
    if (!candidate || candidate.level !== nextLevel) {
      previewQualityRecoveryCandidateRef.current = {
        level: nextLevel,
        sinceMs: now,
      };
      return;
    }
    const recoveryStableMs = now - candidate.sinceMs;
    const sinceLastChangeMs = now - previewQualityLastChangeAtMsRef.current;
    if (recoveryStableMs < REFERENCE_PREVIEW_QUALITY_RECOVERY_STABLE_MS) return;
    if (sinceLastChangeMs < REFERENCE_PREVIEW_QUALITY_MIN_CHANGE_INTERVAL_MS) return;

    previewQualityRecoveryCandidateRef.current = null;
    previewQualityPressureLevelRef.current = nextLevel;
    previewQualityLastChangeAtMsRef.current = now;
    setPreviewQualityPressureLevel((prev) => (prev === nextLevel ? prev : nextLevel));
    logAdaptiveRecoveryLevelChanged({
      surface: "reference-grid",
      prevLevel: currentLevel,
      nextLevel,
    });
  }, [perfWatchdog.degradeLevel]);
  const mediaWorkBudget = useReferenceGridMediaWorkBudget({
    enabled: REFERENCE_GRID_FLAG_GLOBAL_MEDIA_BUDGET,
    pressureLevel: perfWatchdog.degradeLevel,
    constrainedProfile: hydrationBudget.constrainedProfile,
    desiredImageDecodeInflight: hydrationBudget.maxInflightHydrations,
    desiredVideoAttachSlots: desiredVideoAttachBudget,
  });

  const { imageHydrationState, enqueueImageHydration, pruneHydrationQueueToCandidateIds } =
    useReferenceGridImageHydrationController({
      decodeBudgetEnabled: REFERENCE_GRID_FLAG_DECODE_BUDGET,
      adaptivePreviewQualityEnabled: REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY,
      imageDecodeBudget: mediaWorkBudget.imageDecodeBudget,
      activeOutputId,
      outputs,
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
    isCuratedSplitEnabled,
    selectedTool,
    perfDegradeLevel: perfWatchdog.degradeLevel,
    outputsLength: outputs.length,
    curatedOutputsLength: curatedOutputs.length,
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
      referenceGridEmergencyMaxColumns: REFERENCE_GRID_EMERGENCY_MAX_COLUMNS,
      fallbackReferenceRowHeight: FALLBACK_REFERENCE_ROW_HEIGHT,
      perfWatchdogEnabled: REFERENCE_GRID_FLAG_PERF_WATCHDOG,
    },
  });

  const {
    shouldVirtualize,
    isHighDensity,
    denseVisualModeEnabled,
    startIndex,
    endIndex,
    visibleOutputs,
    visibleCuratedOutputs,
    topSpacerHeight,
    bottomSpacerHeight,
    curatedTopSpacerHeight,
    curatedBottomSpacerHeight,
    renderedItemCount,
    renderedOutputIdSet,
    nearViewportOutputs,
    nearViewportCuratedOutputs,
  } = useReferenceGridViewportProjectionController({
    outputs,
    curatedOutputs,
    activeOutputId,
    isCuratedSplitEnabled,
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
  const archiveCount = archivedOutputs.length;
  const { recomputeAutoplayBudget } = useReferenceGridAutoplaySelectionController({
    activeOutputId,
    outputs,
    virtualRowHeight: virtualMetrics.rowHeight,
    strictPreviewLadder: REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER,
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
  const {
    visibleCardItems,
    curatedVisibleCardItems,
    allVisibleCardItems,
    transformedAdaptivePreviewCount,
  } = useReferenceGridCardItemsController({
    activeOutputId,
    previewQualityPressureLevel,
    strictPreviewLadder: REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER,
    adaptivePreviewEnabled: REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW,
    adaptivePreviewQualityEnabled: REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY,
    decodeBudgetEnabled: REFERENCE_GRID_FLAG_DECODE_BUDGET,
    visibleOutputs,
    visibleCuratedOutputs,
    hydrationPriorityCount,
    curatedHydrationPriorityCount,
    virtualRowHeight: virtualMetrics.rowHeight,
    curatedVirtualRowHeight: curatedVirtualMetrics.rowHeight,
    quickSlotAdaptiveSurfaceEnabled,
    hydratedById: imageHydrationState.hydratedById,
  });
  useReferenceGridPreviewSwapTelemetryController({
    visibleCardItems,
    renderedItemCount,
    outputsLength: outputs.length,
    previousVisiblePreviewUrlByIdRef,
    previewSwapTelemetryRef,
    setPreviewSwapMetrics,
  });
  const { pendingCardIdSet, spinnerCandidateIdSet, spinnerSlotIdSet, loadingIdsLength } =
    useReferenceGridLoadingVisualController({
      allVisibleCardItems,
      loadedMap,
      decodeBudgetEnabled: REFERENCE_GRID_FLAG_DECODE_BUDGET,
      perfDegradeLevel: perfWatchdog.degradeLevel,
      maxAnimatedSpinnersLevel0: REFERENCE_MAX_ANIMATED_SPINNERS_LEVEL_0,
      maxAnimatedSpinnersLevel1: REFERENCE_MAX_ANIMATED_SPINNERS_LEVEL_1,
      maxAnimatedSpinnersLevel2: REFERENCE_MAX_ANIMATED_SPINNERS_LEVEL_2,
    });

  useReferenceGridHydrationQueueController({
    decodeBudgetEnabled: REFERENCE_GRID_FLAG_DECODE_BUDGET,
    activeOutputId,
    outputs,
    visibleCardItems,
    curatedVisibleCardItems,
    nearViewportOutputs,
    nearViewportCuratedOutputs,
    previewQualityPressureLevel,
    strictPreviewLadder: REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER,
    adaptivePreviewQualityEnabled: REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY,
    virtualRowHeight: virtualMetrics.rowHeight,
    curatedVirtualRowHeight: curatedVirtualMetrics.rowHeight,
    quickSlotAdaptiveSurfaceEnabled,
    enqueueImageHydration,
    pruneHydrationQueueToCandidateIds,
  });

  useReferenceGridAutoplayBudgetController({
    smallScreenQuery: REFERENCE_AUTOPLAY_SMALL_SCREEN_QUERY,
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
    outputs,
    shouldVirtualize,
    renderedOutputIdSet,
    autoplayEnabledIds,
    autoplayEnabledIdSet,
    isCuratedSplitEnabled,
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
    outputsLength: outputs.length,
    shouldVirtualize,
    isHighDensity,
    imageHydrationQueueSize: imageHydrationState.queueSize,
    imageDecodeInflight: imageHydrationState.decodeInflight,
    perfDegradeLevel: perfWatchdog.degradeLevel,
    previewSwapRatePerMinute: previewSwapMetrics.swapRatePerMinute,
    previewRepaintSpikeCount: previewSwapMetrics.repaintSpikeCount,
    previewLastSwapBurstCount: previewSwapMetrics.lastSwapBurstCount,
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
  });

  const { handleCanvasDrop, handleCanvasDragOver, handleCanvasDragEnter, handleCanvasDragLeave } =
    useReferenceGridCanvasDropController({
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
    isCuratedSplitEnabled,
    curatedReferenceIds,
    curatedDragDepthRef,
    setCuratedDropActiveSafe,
    onAddCuratedReference,
    onReorderCuratedReference,
    onSelectOutput,
  });

  const { handleAllRefsScroll, handleCuratedScroll } = useReferenceGridScrollController({
    setVirtualMetrics,
    setCuratedVirtualMetrics,
    outputsLength: outputs.length,
    renderedItemCount,
  });

  const { handleAutoplayStarted, handleAutoplayStopped } = useReferenceGridAutoplayEventController({
    autoplayingIdsRef,
    renderedItemCount,
    outputsLength: outputs.length,
  });
  const { curatedCardNodes, allRefsCardNodes } = useReferenceGridCardRenderController({
    activeOutputId,
    showPromptGenerate,
    disablePromptGenerate,
    generateCostCredits,
    autoplayEnabledIdSet,
    linkedPromptReferenceIdSet,
    pendingCardIdSet,
    spinnerCandidateIdSet,
    spinnerSlotIdSet,
    perfDegradeLevel: perfWatchdog.degradeLevel,
    visibleCardItems,
    curatedVisibleCardItems,
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
    onDeleteOutput,
    onRemoveCuratedReference,
    onSaveToLibrary,
    onDownload,
    onDescribeImage,
    onGeneratePrompt,
  });

  return (
    <div
      ref={panelRef}
      className={`panel ai-panel ai-preview-panel reference-canvas-panel${canvasDropMode !== "none" ? " is-drop-active" : ""}${canvasDropMode === "text" ? " is-drop-active-text" : ""}${canvasDropMode === "files" ? " is-drop-active-files" : ""}${isHighDensity ? " is-high-density" : ""}${denseVisualModeEnabled ? " is-dense-visual-mode" : ""}${REFERENCE_GRID_FLAG_CSS_CONTAINMENT ? " is-css-containment-mode" : ""}${perfWatchdog.degradeLevel >= 1 ? " is-grid-pressure-mode" : ""}${isCuratedSplitEnabled ? " is-curated-split-mode" : ""}`}
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
      data-grid-adaptive-preview-enabled={REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY}
      data-grid-adaptive-preview-transformed-count={transformedAdaptivePreviewCount}
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
        isCuratedSplitEnabled={isCuratedSplitEnabled}
        isCuratedDropActive={isCuratedDropActive}
        showHeader={showHeader}
        archiveCount={archiveCount}
        isArchivePanelOpen={isArchivePanelOpen}
        archivedOutputs={archivedOutputs}
        onToggleArchivePanel={() => setIsArchivePanelOpen((prev) => !prev)}
        onTriggerFileSelect={onTriggerFileSelect}
        onOpenMediaLibrary={onOpenMediaLibrary}
        onRestoreArchivedOutput={onRestoreArchivedOutput}
        onRestoreAllArchivedOutputs={onRestoreAllArchivedOutputs}
        horizontalSplit={horizontalSplit}
        curatedSectionRef={curatedSectionRef}
        curatedHeaderRef={curatedHeaderRef}
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
        selectedTool={selectedTool}
        curatedGridStyle={curatedGridStyle}
        gridStyle={gridStyle}
        curatedOutputsLength={curatedOutputs.length}
        outputsLength={outputs.length}
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

/**
 * @deprecated Use `ReferenceGrid`.
 */
export const ReferenceCanvas = ReferenceGrid;
