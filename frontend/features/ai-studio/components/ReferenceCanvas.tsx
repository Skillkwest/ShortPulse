/**
 * Reference grid for saved outputs and uploads.
 * Supports drag/drop into other surfaces and exposes a detail action on double click.
 */
import React, { useCallback, useState } from "react";
import { CloudArrowUp, UploadSimple } from "phosphor-react";
import { PromptLibraryButton } from "./PromptLibraryButton";
import { StudioOutput } from "../types";
import {
  clearDragState,
  prepareReferenceDrag,
  type ReferenceDragSourceSurface,
} from "../utils/dragDrop";
import type { ToolId } from "../types";
import { logMediaPerf, setMediaPerfSamplingPolicy } from "../../../lib/mediaPerfTelemetry";
import { useOutputSelector } from "../hooks/aiStudioOutputStore";
import {
  resolveReferenceCardUrls,
  type ReferenceGridPreviewQualityBand,
} from "../logic/referenceGridMedia";
import { isVideoUrl } from "../logic/stateParsers";
import {
  calculateReferenceGridWindow,
  resolveReferenceGridOverscanRows,
} from "../logic/referenceGridVirtualization";
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
  isRenderableAdaptiveUrl,
  resolveAdaptivePolicyDecision,
  resolveAdaptiveSourceKind,
  shouldTranscodeLocalAdaptiveImage,
  transcodeLocalImageToObjectUrl,
  logAdaptiveLocalTranscode,
  logAdaptiveRecoveryLevelChanged,
} from "../../../lib/adaptive-media";
import {
  dedupeMediaFiles,
  normalizeMediaFile,
  type PastedMediaReference,
} from "../reference-grid/controllers/referenceGridClipboard";
import { ReferenceCanvasCard } from "../reference-grid/components/ReferenceCanvasCard";
import { useReferenceGridClipboardController } from "../reference-grid/controllers/useReferenceGridClipboardController";
import {
  useReferenceGridCanvasDropController,
  type ReferenceCanvasDropMode,
} from "../reference-grid/controllers/useReferenceGridCanvasDropController";
import { useReferenceGridCuratedDndController } from "../reference-grid/controllers/useReferenceGridCuratedDndController";
import { useReferenceGridScrollController } from "../reference-grid/controllers/useReferenceGridScrollController";
import { useReferenceGridVirtualMetricsController } from "../reference-grid/controllers/useReferenceGridVirtualMetricsController";
import { useReferenceGridVideoLifecycleController } from "../reference-grid/controllers/useReferenceGridVideoLifecycleController";

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

type NavigatorWithConnection = Navigator & {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

// Temporary UI experiment: set false to revert selection outline theming to default create-blue.
const ENABLE_TOOL_THEMED_SELECTION_OUTLINE = true;

type ReferenceSelectionTheme = "create" | "edit" | "video";

const resolveReferenceSelectionTheme = (selectedTool: ToolId | null): ReferenceSelectionTheme => {
  if (!ENABLE_TOOL_THEMED_SELECTION_OUTLINE) return "create";
  if (selectedTool === "image" || selectedTool === "edit") return "edit";
  if (selectedTool === "video" || selectedTool === "kling") return "video";
  return "create";
};

const areIdListsEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const hasAdaptiveQueryParams = (url: string): boolean =>
  /[?&]width=\d+/i.test(url) && /[?&]quality=\d+/i.test(url);

const isNextOptimizerUrl = (url: string): boolean =>
  /^\/_next\/image\?/i.test(url) || /\/_next\/image\?/i.test(url);

const normalizeComparableUrl = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("/")) return trimmed;
  if (typeof window === "undefined") return trimmed;
  try {
    return new URL(trimmed, window.location.origin).toString();
  } catch {
    return trimmed;
  }
};

const resolveOptimizerSourceUrl = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !isNextOptimizerUrl(trimmed)) return null;
  try {
    const parsed = new URL(trimmed, "https://shortpulse.local");
    const source = parsed.searchParams.get("url");
    if (!source) return null;
    return normalizeComparableUrl(source);
  } catch {
    return null;
  }
};

const resolveFirstRenderableUrl = (
  ...candidates: Array<string | null | undefined>
): string | null => {
  for (const candidate of candidates) {
    if (!isRenderableAdaptiveUrl(candidate)) continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return null;
};

const isOutputVideoPreview = (
  output: Pick<StudioOutput, "mode"> | null | undefined,
  url: string | null | undefined
): boolean => {
  if (!url) return false;
  if (output?.mode === "video") return true;
  if (output?.mode === "image") return false;
  return isVideoUrl(url);
};
const EMPTY_OUTPUTS: StudioOutput[] = [];

const areOutputListsEqual = (left: StudioOutput[], right: StudioOutput[]) => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
};

export type ReferenceCanvasProps = {
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
 * Displays the reference grid and handles drag/drop + selection behavior.
 */
export function ReferenceCanvas({
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
}: ReferenceCanvasProps) {
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
  const [canvasDropMode, setCanvasDropMode] = useState<ReferenceCanvasDropMode>("none");
  const canvasDropModeRef = React.useRef<ReferenceCanvasDropMode>("none");
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
  const setCanvasDropModeSafe = useCallback((next: ReferenceCanvasDropMode) => {
    if (canvasDropModeRef.current === next) return;
    canvasDropModeRef.current = next;
    setCanvasDropMode(next);
  }, []);
  const [imageHydrationState, setImageHydrationState] = useState<{
    hydratedById: Record<
      string,
      {
        sourceUrl: string;
        renderUrl: string;
      }
    >;
    queueSize: number;
    decodeInflight: number;
  }>({
    hydratedById: {},
    queueSize: 0,
    decodeInflight: 0,
  });
  const hydrationQueueRef = React.useRef<string[]>([]);
  const hydrationQueuedIdSetRef = React.useRef<Set<string>>(new Set());
  const hydrationInflightIdSetRef = React.useRef<Set<string>>(new Set());
  const hydrationUrlByIdRef = React.useRef<Record<string, string>>({});
  const hydrationFallbackUrlByIdRef = React.useRef<Record<string, string>>({});
  const hydrationFailedOptimizedUrlByIdRef = React.useRef<Record<string, string>>({});
  const hydrationPreviewMetaByIdRef = React.useRef<
    Record<
      string,
      {
        targetLongEdgePx: number;
        previewQualityBand: ReferenceGridPreviewQualityBand;
      }
    >
  >({});
  const hydrationGeneratedObjectUrlByIdRef = React.useRef<Record<string, string>>({});
  const hydrationHydratedByIdRef = React.useRef<
    Record<
      string,
      {
        sourceUrl: string;
        renderUrl: string;
      }
    >
  >({});
  const hydrationQueueSizeRef = React.useRef(0);
  const hydrationDecodeInflightRef = React.useRef(0);
  const hydrationRafFlushRef = React.useRef<number | null>(null);
  const hydrationPendingLoadedRef = React.useRef<
    Record<
      string,
      {
        sourceUrl: string;
        renderUrl: string;
      }
    >
  >({});
  const processHydrationQueueRef = React.useRef<() => void>(() => {});
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

  const revokeGeneratedHydrationUrl = useCallback((id: string) => {
    const existing = hydrationGeneratedObjectUrlByIdRef.current[id];
    if (!existing) return;
    URL.revokeObjectURL(existing);
    delete hydrationGeneratedObjectUrlByIdRef.current[id];
  }, []);

  const maybeCreateLocalAdaptivePreviewUrl = useCallback(
    async (id: string, sourceUrl: string, image: HTMLImageElement): Promise<string> => {
      if (!REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY) return sourceUrl;
      if (hasAdaptiveQueryParams(sourceUrl) || isNextOptimizerUrl(sourceUrl)) return sourceUrl;
      if (isVideoUrl(sourceUrl)) return sourceUrl;
      const previewMeta = hydrationPreviewMetaByIdRef.current[id];
      if (!previewMeta) return sourceUrl;
      const naturalWidth = image.naturalWidth;
      const naturalHeight = image.naturalHeight;
      if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight)) {
        return sourceUrl;
      }
      if (naturalWidth <= 0 || naturalHeight <= 0) return sourceUrl;
      const decision = resolveAdaptivePolicyDecision({
        surface: "reference-grid",
        mediaKind: "image",
        source: resolveAdaptiveSourceKind(sourceUrl),
        urls: {
          previewUrl: sourceUrl,
        },
        storage: {},
        pressureLevel: liveWatchdogDegradeLevelRef.current,
        cardLongEdgePx: previewMeta.targetLongEdgePx,
        devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        adaptivePreviewQuality: true,
      });
      if (
        !shouldTranscodeLocalAdaptiveImage({
          sourceUrl,
          naturalWidth,
          naturalHeight,
          decision,
        })
      ) {
        return sourceUrl;
      }
      const objectUrl = await transcodeLocalImageToObjectUrl({
        image,
        decision,
      });
      if (!objectUrl) return sourceUrl;
      const previousUrl = hydrationGeneratedObjectUrlByIdRef.current[id];
      if (previousUrl && previousUrl !== objectUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      hydrationGeneratedObjectUrlByIdRef.current[id] = objectUrl;
      logAdaptiveLocalTranscode({
        surface: "reference-grid",
        pressureLevel: liveWatchdogDegradeLevelRef.current,
        qualityBand: decision.qualityBand,
        targetLongEdgePx: decision.targetLongEdgePx,
      });
      return objectUrl;
    },
    []
  );

  const syncImageHydrationState = useCallback(() => {
    const nextQueueSize = hydrationQueueRef.current.length;
    const nextInflight = hydrationInflightIdSetRef.current.size;
    if (
      hydrationQueueSizeRef.current === nextQueueSize &&
      hydrationDecodeInflightRef.current === nextInflight
    ) {
      return;
    }
    hydrationQueueSizeRef.current = nextQueueSize;
    hydrationDecodeInflightRef.current = nextInflight;
    runNonUrgentUpdate(() => {
      setImageHydrationState((prev) => {
        if (prev.queueSize === nextQueueSize && prev.decodeInflight === nextInflight) return prev;
        return {
          ...prev,
          queueSize: nextQueueSize,
          decodeInflight: nextInflight,
        };
      });
    });
  }, [runNonUrgentUpdate]);

  React.useEffect(() => {
    hydrationHydratedByIdRef.current = imageHydrationState.hydratedById;
    hydrationQueueSizeRef.current = imageHydrationState.queueSize;
    hydrationDecodeInflightRef.current = imageHydrationState.decodeInflight;
  }, [
    imageHydrationState.decodeInflight,
    imageHydrationState.hydratedById,
    imageHydrationState.queueSize,
  ]);

  const flushHydratedImages = useCallback(() => {
    hydrationRafFlushRef.current = null;
    const pending = hydrationPendingLoadedRef.current;
    hydrationPendingLoadedRef.current = {};
    if (!Object.keys(pending).length) {
      syncImageHydrationState();
      return;
    }
    runNonUrgentUpdate(() => {
      const nextQueueSize = hydrationQueueRef.current.length;
      const nextInflight = hydrationInflightIdSetRef.current.size;
      hydrationQueueSizeRef.current = nextQueueSize;
      hydrationDecodeInflightRef.current = nextInflight;
      setImageHydrationState((prev) => {
        let hydratedChanged = false;
        const nextHydratedById = { ...prev.hydratedById };
        Object.entries(pending).forEach(([id, hydrated]) => {
          const existing = prev.hydratedById[id];
          if (
            existing?.sourceUrl === hydrated.sourceUrl &&
            existing?.renderUrl === hydrated.renderUrl
          ) {
            return;
          }
          hydratedChanged = true;
          nextHydratedById[id] = hydrated;
        });
        if (
          !hydratedChanged &&
          prev.queueSize === nextQueueSize &&
          prev.decodeInflight === nextInflight
        ) {
          return prev;
        }
        return {
          hydratedById: hydratedChanged ? nextHydratedById : prev.hydratedById,
          queueSize: nextQueueSize,
          decodeInflight: nextInflight,
        };
      });
    });
  }, [runNonUrgentUpdate, syncImageHydrationState]);

  const scheduleHydrationFlush = useCallback(() => {
    if (hydrationRafFlushRef.current != null) return;
    if (typeof window === "undefined") return;
    hydrationRafFlushRef.current = window.requestAnimationFrame(() => {
      flushHydratedImages();
    });
  }, [flushHydratedImages]);

  const processHydrationQueue = useCallback(() => {
    if (!REFERENCE_GRID_FLAG_DECODE_BUDGET || typeof window === "undefined") return;
    const maxInflight = mediaWorkBudget.imageDecodeBudget;
    while (
      hydrationInflightIdSetRef.current.size < maxInflight &&
      hydrationQueueRef.current.length > 0
    ) {
      const nextId = hydrationQueueRef.current.shift();
      if (!nextId) continue;
      hydrationQueuedIdSetRef.current.delete(nextId);
      const nextUrl = hydrationUrlByIdRef.current[nextId];
      if (!nextUrl) continue;
      const fallbackUrl = hydrationFallbackUrlByIdRef.current[nextId];

      hydrationInflightIdSetRef.current.add(nextId);
      const image = new Image();
      image.decoding = "async";
      const shouldPrioritize = nextId === activeOutputId;
      try {
        (image as HTMLImageElement & { fetchPriority?: "high" | "low" | "auto" }).fetchPriority =
          shouldPrioritize ? "high" : "low";
      } catch {
        // Keep compatibility with runtimes that do not expose fetchPriority.
      }
      const finalize = (sourceUrl: string, renderUrl: string) => {
        hydrationInflightIdSetRef.current.delete(nextId);
        hydrationPendingLoadedRef.current[nextId] = {
          sourceUrl,
          renderUrl,
        };
        scheduleHydrationFlush();
        processHydrationQueueRef.current();
      };
      image.onload = () => {
        if (hydrationFailedOptimizedUrlByIdRef.current[nextId] === nextUrl) {
          delete hydrationFailedOptimizedUrlByIdRef.current[nextId];
        }
        void (async () => {
          const renderUrl = await maybeCreateLocalAdaptivePreviewUrl(nextId, nextUrl, image).catch(
            () => nextUrl
          );
          finalize(nextUrl, renderUrl);
        })();
      };
      image.onerror = () => {
        const resolvedFallback = fallbackUrl && fallbackUrl !== nextUrl ? fallbackUrl : nextUrl;
        if (isNextOptimizerUrl(nextUrl)) {
          hydrationFailedOptimizedUrlByIdRef.current[nextId] = nextUrl;
          if (resolvedFallback !== nextUrl) {
            hydrationUrlByIdRef.current[nextId] = resolvedFallback;
          }
        }
        finalize(resolvedFallback, resolvedFallback);
      };
      image.src = nextUrl;
    }
    syncImageHydrationState();
  }, [
    activeOutputId,
    mediaWorkBudget.imageDecodeBudget,
    maybeCreateLocalAdaptivePreviewUrl,
    scheduleHydrationFlush,
    syncImageHydrationState,
  ]);

  const enqueueImageHydration = useCallback(
    (
      id: string,
      url: string,
      options?: {
        priority?: "high" | "normal" | "low";
        targetLongEdgePx?: number;
        previewQualityBand?: ReferenceGridPreviewQualityBand;
        fallbackUrl?: string;
      }
    ) => {
      if (!REFERENCE_GRID_FLAG_DECODE_BUDGET) return;
      const previousUrl = hydrationUrlByIdRef.current[id];
      if (typeof options?.targetLongEdgePx === "number" && options.previewQualityBand) {
        hydrationPreviewMetaByIdRef.current[id] = {
          targetLongEdgePx: options.targetLongEdgePx,
          previewQualityBand: options.previewQualityBand,
        };
      }
      if (typeof options?.fallbackUrl === "string" && options.fallbackUrl.length > 0) {
        hydrationFallbackUrlByIdRef.current[id] = options.fallbackUrl;
      }
      const fallbackUrl = hydrationFallbackUrlByIdRef.current[id];
      const shouldBypassOptimizedUrl =
        isNextOptimizerUrl(url) &&
        hydrationFailedOptimizedUrlByIdRef.current[id] === url &&
        typeof fallbackUrl === "string" &&
        fallbackUrl.length > 0;
      const nextHydrationUrl = shouldBypassOptimizedUrl ? fallbackUrl : url;
      hydrationUrlByIdRef.current[id] = nextHydrationUrl;
      if (
        hydrationFailedOptimizedUrlByIdRef.current[id] &&
        hydrationFailedOptimizedUrlByIdRef.current[id] !== url
      ) {
        delete hydrationFailedOptimizedUrlByIdRef.current[id];
      }
      if (previousUrl && previousUrl !== nextHydrationUrl) {
        revokeGeneratedHydrationUrl(id);
      }
      const pendingHydratedEntry = hydrationPendingLoadedRef.current[id];
      if (pendingHydratedEntry?.sourceUrl === nextHydrationUrl) return;
      const hydratedEntry = hydrationHydratedByIdRef.current[id];
      if (hydratedEntry?.sourceUrl === nextHydrationUrl) return;
      if (hydrationInflightIdSetRef.current.has(id)) return;
      const priority = options?.priority ?? "normal";
      if (hydrationQueuedIdSetRef.current.has(id)) {
        if (priority === "high") {
          const currentIndex = hydrationQueueRef.current.indexOf(id);
          if (currentIndex > 0) {
            hydrationQueueRef.current.splice(currentIndex, 1);
            hydrationQueueRef.current.unshift(id);
            syncImageHydrationState();
            processHydrationQueue();
          }
        }
        return;
      }
      hydrationQueuedIdSetRef.current.add(id);
      if (priority === "high") {
        hydrationQueueRef.current.unshift(id);
      } else {
        hydrationQueueRef.current.push(id);
      }
      syncImageHydrationState();
      processHydrationQueue();
    },
    [processHydrationQueue, revokeGeneratedHydrationUrl, syncImageHydrationState]
  );

  React.useEffect(() => {
    processHydrationQueueRef.current = processHydrationQueue;
  }, [processHydrationQueue]);
  const normalizeMediaFiles = useCallback((files: File[]): File[] => {
    return dedupeMediaFiles(
      files
        .map((file, index) => normalizeMediaFile(file, null, index))
        .filter((file): file is File => Boolean(file))
    );
  }, []);

  const resolveCanvasDropMode = useCallback(
    (transfer: DataTransfer | null | undefined): ReferenceCanvasDropMode => {
      if (!transfer) return "none";
      const normalizedTypes = Array.from(transfer.types || []).map((type) => type.toLowerCase());
      if (normalizedTypes.includes("text/reference-id")) return "none";
      if (transfer.files && transfer.files.length > 0) return "files";
      if (normalizedTypes.includes("files")) return "files";
      if (
        normalizedTypes.some(
          (type) =>
            type.includes("text") ||
            type.includes("plain") ||
            type.includes("prompt") ||
            type.includes("utf8")
        )
      ) {
        return "text";
      }
      return "none";
    },
    []
  );

  const canAcceptCanvasDrag = useCallback(
    (transfer: DataTransfer | null | undefined) => {
      return resolveCanvasDropMode(transfer) !== "none";
    },
    [resolveCanvasDropMode]
  );

  const buildFileList = useCallback((files: File[]): FileList | null => {
    if (files.length === 0) return null;
    if (typeof DataTransfer !== "undefined") {
      const transfer = new DataTransfer();
      files.forEach((file) => transfer.items.add(file));
      return transfer.files;
    }
    const fallback = files.reduce<Record<number, File>>((acc, file, index) => {
      acc[index] = file;
      return acc;
    }, {});
    return {
      ...fallback,
      length: files.length,
      item: (index: number) => files[index] ?? null,
    } as unknown as FileList;
  }, []);

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

  const dynamicOverscanRows = REFERENCE_GRID_FLAG_DYNAMIC_VIRTUALIZATION
    ? resolveReferenceGridOverscanRows(outputs.length, {
        pressureLevel: perfWatchdog.degradeLevel,
      })
    : REFERENCE_VIRTUAL_OVERSCAN_ROWS;
  const curatedOverscanRows = REFERENCE_GRID_FLAG_DYNAMIC_VIRTUALIZATION
    ? resolveReferenceGridOverscanRows(curatedOutputs.length, {
        pressureLevel: perfWatchdog.degradeLevel,
      })
    : REFERENCE_VIRTUAL_OVERSCAN_ROWS;
  const virtualWindow = calculateReferenceGridWindow({
    itemCount: outputs.length,
    columnCount: virtualMetrics.columnCount,
    rowHeight: virtualMetrics.rowHeight,
    scrollTop: virtualMetrics.scrollTop,
    viewportHeight:
      virtualMetrics.viewportHeight > 0
        ? virtualMetrics.viewportHeight
        : FALLBACK_REFERENCE_ROW_HEIGHT * 5,
    overscanRows: dynamicOverscanRows,
    virtualizeMinItems: REFERENCE_GRID_FLAG_DYNAMIC_VIRTUALIZATION
      ? REFERENCE_VIRTUALIZE_MIN_ITEMS
      : 24,
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
            : FALLBACK_REFERENCE_ROW_HEIGHT * 3,
        overscanRows: curatedOverscanRows,
        virtualizeMinItems: REFERENCE_GRID_FLAG_DYNAMIC_VIRTUALIZATION
          ? REFERENCE_VIRTUALIZE_MIN_ITEMS
          : 24,
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
  const isHighDensity = outputs.length >= REFERENCE_HIGH_DENSITY_CARD_COUNT;
  const denseVisualModeEnabled = REFERENCE_GRID_FLAG_DENSE_VISUAL_SIMPLIFY && outputs.length >= 40;
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
        : FALLBACK_REFERENCE_ROW_HEIGHT * 5) / Math.max(1, virtualMetrics.rowHeight)
    )
  );
  const hardViewportVisibleLimit =
    (visibleRows + Math.max(0, dynamicOverscanRows) * 2) *
    Math.max(REFERENCE_GRID_MIN_COLUMNS, virtualMetrics.columnCount);
  const visibleOutputs = React.useMemo(() => {
    if (!REFERENCE_GRID_FLAG_HARD_VIEWPORT_CAP) {
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
  }, [activeOutputId, baseVisibleOutputs, hardViewportVisibleLimit, outputs]);
  const visibleCuratedOutputs = curatedShouldVirtualize
    ? curatedOutputs.slice(curatedStartIndex, curatedEndIndex)
    : curatedOutputs;
  const topSpacerHeight = virtualWindow.topSpacerHeight;
  const bottomSpacerHeight = virtualWindow.bottomSpacerHeight;
  const curatedTopSpacerHeight = curatedVirtualWindow.topSpacerHeight;
  const curatedBottomSpacerHeight = curatedVirtualWindow.bottomSpacerHeight;
  const renderedItemCount = visibleOutputs.length;
  const renderedOutputIdSet = React.useMemo(() => {
    const ids = new Set(visibleOutputs.map((output) => output.id));
    if (isCuratedSplitEnabled) {
      visibleCuratedOutputs.forEach((output) => ids.add(output.id));
    }
    return ids;
  }, [isCuratedSplitEnabled, visibleCuratedOutputs, visibleOutputs]);
  const archiveCount = archivedOutputs.length;
  const nearViewportOutputs = React.useMemo(() => {
    if (!shouldVirtualize) return [];
    const nearSpan = Math.max(1, virtualMetrics.columnCount);
    const start = Math.max(0, startIndex - nearSpan);
    const end = Math.min(outputs.length, endIndex + nearSpan);
    return outputs.slice(start, end);
  }, [endIndex, outputs, shouldVirtualize, startIndex, virtualMetrics.columnCount]);
  const nearViewportCuratedOutputs = React.useMemo(() => {
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
  const recomputeAutoplayBudget = useCallback(() => {
    const visibleOutputIdSet = new Set<string>();
    videoVisibleKeySetRef.current.forEach((key) => {
      const outputId = videoOutputIdByKeyRef.current.get(key);
      if (outputId) {
        visibleOutputIdSet.add(outputId);
      }
    });
    const visibleVideoIds = outputs
      .filter((output) => {
        const resolvedPreview = resolveReferenceCardUrls(output, {
          strictPreviewLadder: REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER,
          surface: "reference-grid",
          cardLongEdgePx: Math.max(240, Math.round(Math.max(1, virtualMetrics.rowHeight - 3))),
          devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        }).previewUrl;
        if (!resolvedPreview || !isOutputVideoPreview(output, resolvedPreview)) return false;
        return visibleOutputIdSet.has(output.id);
      })
      .map((output) => output.id);
    const prioritizedVideoIds =
      activeOutputId && visibleVideoIds.includes(activeOutputId)
        ? [activeOutputId, ...visibleVideoIds.filter((id) => id !== activeOutputId)]
        : visibleVideoIds;
    if (perfWatchdog.degradeLevel >= 2) {
      runNonUrgentUpdate(() => {
        setAutoplayEnabledIds((prev) => (prev.length === 0 ? prev : []));
      });
      return;
    }
    const nextEnabled = prioritizedVideoIds.slice(
      0,
      Math.max(0, mediaWorkBudget.videoAttachBudget)
    );
    runNonUrgentUpdate(() => {
      setAutoplayEnabledIds((prev) => (areIdListsEqual(prev, nextEnabled) ? prev : nextEnabled));
    });
  }, [
    activeOutputId,
    mediaWorkBudget.videoAttachBudget,
    outputs,
    perfWatchdog.degradeLevel,
    runNonUrgentUpdate,
    virtualMetrics.rowHeight,
  ]);

  React.useEffect(() => {
    recomputeAutoplayBudgetRef.current = recomputeAutoplayBudget;
  }, [recomputeAutoplayBudget]);

  React.useEffect(() => {
    desiredVideoAttachBudgetRef.current = desiredVideoAttachBudget;
  }, [desiredVideoAttachBudget]);

  React.useEffect(() => {
    autoplayEnabledIdsStateRef.current = autoplayEnabledIds;
  }, [autoplayEnabledIds]);

  const baseHydrationPriorityRows = REFERENCE_GRID_FLAG_DECODE_BUDGET
    ? hydrationBudget.priorityRows
    : REFERENCE_PRIORITY_HYDRATION_ROWS;
  const hydrationPriorityCount =
    Math.max(REFERENCE_GRID_MIN_COLUMNS, virtualMetrics.columnCount) * baseHydrationPriorityRows;
  const curatedHydrationPriorityCount =
    Math.max(REFERENCE_GRID_MIN_COLUMNS, curatedVirtualMetrics.columnCount) *
    baseHydrationPriorityRows;
  const buildVisibleCardItems = useCallback(
    (
      rows: StudioOutput[],
      priorityCount: number,
      options: { surface: "reference-grid" | "quick-slot"; cardLongEdgePx: number }
    ) =>
      rows.map((item, visibleIndex) => {
        const resolvedCardUrls = resolveReferenceCardUrls(item, {
          strictPreviewLadder: REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER,
          adaptivePreviewQuality:
            REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY || REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW,
          pressureLevel: previewQualityPressureLevel,
          surface: options.surface,
          cardLongEdgePx: options.cardLongEdgePx,
          devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        });
        const cardPreviewUrl = resolvedCardUrls.previewUrl ?? resolvedCardUrls.fullUrl;
        const isVideoPreview = isOutputVideoPreview(item, cardPreviewUrl);
        const isImagePreview = cardPreviewUrl ? !isVideoPreview : false;
        const isPriorityHydration = visibleIndex < priorityCount || activeOutputId === item.id;
        const hydratedEntry = imageHydrationState.hydratedById[item.id];
        const fallbackSourceForCard = resolveFirstRenderableUrl(
          resolvedCardUrls.fullUrl ?? null,
          item.previewUrl ?? null,
          item.fullStoragePath ?? null,
          item.previewStoragePath ?? null,
          item.resultUrls?.[0] ?? null
        );
        const normalizedCardPreviewUrl = normalizeComparableUrl(cardPreviewUrl);
        const normalizedHydratedSourceUrl = normalizeComparableUrl(hydratedEntry?.sourceUrl);
        const normalizedFallbackSourceUrl = normalizeComparableUrl(fallbackSourceForCard);
        const cardOptimizerSourceUrl = resolveOptimizerSourceUrl(cardPreviewUrl);
        const hydratedOptimizerSourceUrl = resolveOptimizerSourceUrl(hydratedEntry?.sourceUrl);
        const hasHydratedSourceForCard =
          Boolean(hydratedEntry) &&
          (normalizedHydratedSourceUrl === normalizedCardPreviewUrl ||
            (cardOptimizerSourceUrl != null &&
              hydratedOptimizerSourceUrl != null &&
              cardOptimizerSourceUrl === hydratedOptimizerSourceUrl) ||
            (cardOptimizerSourceUrl != null &&
              normalizedHydratedSourceUrl != null &&
              cardOptimizerSourceUrl === normalizedHydratedSourceUrl) ||
            (hydratedOptimizerSourceUrl != null &&
              normalizedCardPreviewUrl != null &&
              hydratedOptimizerSourceUrl === normalizedCardPreviewUrl) ||
            (normalizedFallbackSourceUrl != null &&
              (normalizedHydratedSourceUrl === normalizedFallbackSourceUrl ||
                cardOptimizerSourceUrl === normalizedFallbackSourceUrl ||
                hydratedOptimizerSourceUrl === normalizedFallbackSourceUrl)));
        const imageSrc =
          isImagePreview && REFERENCE_GRID_FLAG_DECODE_BUDGET
            ? hasHydratedSourceForCard
              ? (hydratedEntry.renderUrl ?? undefined)
              : undefined
            : (cardPreviewUrl ?? undefined);
        return {
          item,
          cardPreviewUrl,
          previewQualityBand: resolvedCardUrls.previewQualityBand ?? "high",
          targetLongEdgePx: resolvedCardUrls.targetLongEdgePx ?? 960,
          isVideoPreview,
          isImagePreview,
          isPriorityHydration,
          imageSrc,
        };
      }),
    [activeOutputId, imageHydrationState.hydratedById, previewQualityPressureLevel]
  );
  const visibleCardItems = React.useMemo(
    () =>
      buildVisibleCardItems(visibleOutputs, hydrationPriorityCount, {
        surface: "reference-grid",
        cardLongEdgePx: Math.max(240, Math.round(Math.max(1, virtualMetrics.rowHeight - 3))),
      }),
    [buildVisibleCardItems, hydrationPriorityCount, virtualMetrics.rowHeight, visibleOutputs]
  );
  const curatedVisibleCardItems = React.useMemo(
    () =>
      buildVisibleCardItems(visibleCuratedOutputs, curatedHydrationPriorityCount, {
        surface: isAdaptiveSurfaceEnabled("quick-slot") ? "quick-slot" : "reference-grid",
        cardLongEdgePx: Math.max(200, Math.round(Math.max(1, curatedVirtualMetrics.rowHeight - 3))),
      }),
    [
      buildVisibleCardItems,
      curatedHydrationPriorityCount,
      curatedVirtualMetrics.rowHeight,
      visibleCuratedOutputs,
    ]
  );
  const allVisibleCardItems = React.useMemo(
    () => [...curatedVisibleCardItems, ...visibleCardItems],
    [curatedVisibleCardItems, visibleCardItems]
  );
  React.useEffect(() => {
    if (typeof performance === "undefined") return;
    const nextVisibleUrlById: Record<string, string | null> = {};
    const previousVisibleUrlById = previousVisiblePreviewUrlByIdRef.current;
    let swappedCount = 0;
    visibleCardItems.forEach((card) => {
      const nextUrl = card.cardPreviewUrl ?? null;
      nextVisibleUrlById[card.item.id] = nextUrl;
      const previousUrl = previousVisibleUrlById[card.item.id];
      if (typeof previousUrl !== "string") return;
      if (previousUrl === nextUrl) return;
      swappedCount += 1;
    });
    previousVisiblePreviewUrlByIdRef.current = nextVisibleUrlById;
    if (swappedCount === 0) return;

    const nowMs = performance.now();
    if (previewSwapTelemetryRef.current.windowStartedAtMs <= 0) {
      previewSwapTelemetryRef.current.windowStartedAtMs = nowMs;
    }
    previewSwapTelemetryRef.current.totalSwapCount += swappedCount;
    const repaintSpikeThreshold = Math.max(6, Math.floor(renderedItemCount * 0.75));
    if (swappedCount >= repaintSpikeThreshold) {
      previewSwapTelemetryRef.current.repaintSpikeCount += 1;
    }

    const elapsedMs = Math.max(1, nowMs - previewSwapTelemetryRef.current.windowStartedAtMs);
    const swapRatePerMinute = Math.round(
      (previewSwapTelemetryRef.current.totalSwapCount * 60_000) / elapsedMs
    );
    const repaintSpikeCount = previewSwapTelemetryRef.current.repaintSpikeCount;
    setPreviewSwapMetrics((prev) => {
      if (
        prev.swapRatePerMinute === swapRatePerMinute &&
        prev.repaintSpikeCount === repaintSpikeCount &&
        prev.lastSwapBurstCount === swappedCount
      ) {
        return prev;
      }
      return {
        swapRatePerMinute,
        repaintSpikeCount,
        lastSwapBurstCount: swappedCount,
      };
    });
  }, [renderedItemCount, visibleCardItems]);
  React.useEffect(() => {
    if (outputs.length > 0) return;
    previousVisiblePreviewUrlByIdRef.current = {};
    previewSwapTelemetryRef.current = {
      windowStartedAtMs: 0,
      totalSwapCount: 0,
      repaintSpikeCount: 0,
    };
    setPreviewSwapMetrics((prev) => {
      if (
        prev.swapRatePerMinute === 0 &&
        prev.repaintSpikeCount === 0 &&
        prev.lastSwapBurstCount === 0
      ) {
        return prev;
      }
      return {
        swapRatePerMinute: 0,
        repaintSpikeCount: 0,
        lastSwapBurstCount: 0,
      };
    });
  }, [outputs.length]);
  const loadingCardState = React.useMemo(() => {
    const nextLoadingIds: string[] = [];
    const nextSpinnerCandidateIds: string[] = [];
    allVisibleCardItems.forEach((card) => {
      const isFailing = card.item.taskState === "fail";
      const isLoading =
        !isFailing &&
        (card.item.taskState === "running" ||
          card.item.taskState === "pending" ||
          (card.item.taskState === "success" && !card.cardPreviewUrl && !card.item.previewText));
      if (isLoading) {
        nextSpinnerCandidateIds.push(card.item.id);
      }
      const isLoaded = loadedMap[card.item.id];
      const shouldShowLoading =
        !isFailing &&
        (isLoading ||
          (!isLoaded && !card.item.previewText) ||
          (card.isImagePreview &&
            REFERENCE_GRID_FLAG_DECODE_BUDGET &&
            !card.imageSrc &&
            card.isPriorityHydration));
      if (shouldShowLoading) {
        nextLoadingIds.push(card.item.id);
      }
    });
    return {
      loadingIds: nextLoadingIds,
      spinnerCandidateIds: nextSpinnerCandidateIds,
    };
  }, [allVisibleCardItems, loadedMap]);
  const pendingCardIdSet = React.useMemo(
    () => new Set(loadingCardState.loadingIds),
    [loadingCardState.loadingIds]
  );
  const spinnerCandidateIdSet = React.useMemo(
    () => new Set(loadingCardState.spinnerCandidateIds),
    [loadingCardState.spinnerCandidateIds]
  );
  const maxAnimatedSpinners = React.useMemo(() => {
    if (perfWatchdog.degradeLevel >= 2) return REFERENCE_MAX_ANIMATED_SPINNERS_LEVEL_2;
    if (perfWatchdog.degradeLevel >= 1) return REFERENCE_MAX_ANIMATED_SPINNERS_LEVEL_1;
    return REFERENCE_MAX_ANIMATED_SPINNERS_LEVEL_0;
  }, [perfWatchdog.degradeLevel]);
  // Pending outputs are inserted at index 0; reverse yields FIFO by generation age.
  const pendingSpinnerQueueIds = React.useMemo(
    () => [...loadingCardState.spinnerCandidateIds].reverse(),
    [loadingCardState.spinnerCandidateIds]
  );
  const spinnerSlotIds = React.useMemo(
    () => pendingSpinnerQueueIds.slice(0, Math.max(1, maxAnimatedSpinners)),
    [maxAnimatedSpinners, pendingSpinnerQueueIds]
  );
  const spinnerSlotIdSet = React.useMemo(() => new Set(spinnerSlotIds), [spinnerSlotIds]);
  const transformedAdaptivePreviewCount = React.useMemo(() => {
    let count = 0;
    visibleCardItems.forEach((card) => {
      const url = card.cardPreviewUrl;
      if (!url) return;
      if (hasAdaptiveQueryParams(url) || isNextOptimizerUrl(url)) {
        count += 1;
        return;
      }
      const hydratedEntry = imageHydrationState.hydratedById[card.item.id];
      if (!hydratedEntry) return;
      if (hydratedEntry.sourceUrl !== url) return;
      if (hydratedEntry.renderUrl === hydratedEntry.sourceUrl) return;
      if (!hydratedEntry.renderUrl.startsWith("blob:")) return;
      count += 1;
    });
    return count;
  }, [imageHydrationState.hydratedById, visibleCardItems]);

  React.useEffect(() => {
    if (!REFERENCE_GRID_FLAG_DECODE_BUDGET) return;
    const candidateIdSet = new Set<string>();
    if (activeOutputId) {
      const activeOutput = outputs.find((item) => item.id === activeOutputId);
      if (activeOutput) {
        const resolved = resolveReferenceCardUrls(activeOutput, {
          strictPreviewLadder: REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER,
          adaptivePreviewQuality: REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY,
          pressureLevel: previewQualityPressureLevel,
          surface: "reference-grid",
          cardLongEdgePx: Math.max(240, Math.round(Math.max(1, virtualMetrics.rowHeight - 3))),
          devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        });
        const activeUrl = resolved.previewUrl ?? resolved.fullUrl;
        if (activeUrl && !isOutputVideoPreview(activeOutput, activeUrl)) {
          candidateIdSet.add(activeOutputId);
          enqueueImageHydration(activeOutputId, activeUrl, {
            priority: "high",
            targetLongEdgePx: resolved.targetLongEdgePx,
            previewQualityBand: resolved.previewQualityBand,
            fallbackUrl:
              resolveFirstRenderableUrl(
                resolved.fullUrl,
                activeOutput.previewUrl,
                activeOutput.fullStoragePath,
                activeOutput.previewStoragePath,
                activeOutput.resultUrls?.[0]
              ) ?? undefined,
          });
        }
      }
    }
    visibleCardItems.forEach((card) => {
      if (!card.isImagePreview || !card.cardPreviewUrl) return;
      candidateIdSet.add(card.item.id);
      enqueueImageHydration(card.item.id, card.cardPreviewUrl, {
        priority: card.isPriorityHydration ? "high" : "normal",
        targetLongEdgePx: card.targetLongEdgePx,
        previewQualityBand: card.previewQualityBand,
        fallbackUrl:
          resolveFirstRenderableUrl(
            card.item.previewUrl,
            card.item.fullStoragePath,
            card.item.previewStoragePath,
            card.item.resultUrls?.[0]
          ) ?? undefined,
      });
    });
    curatedVisibleCardItems.forEach((card) => {
      if (!card.isImagePreview || !card.cardPreviewUrl) return;
      if (candidateIdSet.has(card.item.id)) return;
      candidateIdSet.add(card.item.id);
      enqueueImageHydration(card.item.id, card.cardPreviewUrl, {
        priority: card.isPriorityHydration ? "high" : "normal",
        targetLongEdgePx: card.targetLongEdgePx,
        previewQualityBand: card.previewQualityBand,
        fallbackUrl:
          resolveFirstRenderableUrl(
            card.item.previewUrl,
            card.item.fullStoragePath,
            card.item.previewStoragePath,
            card.item.resultUrls?.[0]
          ) ?? undefined,
      });
    });
    nearViewportOutputs.forEach((item) => {
      if (candidateIdSet.has(item.id)) return;
      const resolved = resolveReferenceCardUrls(item, {
        strictPreviewLadder: REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER,
        adaptivePreviewQuality: REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY,
        pressureLevel: previewQualityPressureLevel,
        surface: "reference-grid",
        cardLongEdgePx: Math.max(240, Math.round(Math.max(1, virtualMetrics.rowHeight - 3))),
        devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      });
      const previewUrl = resolved.previewUrl ?? resolved.fullUrl;
      if (!previewUrl || isOutputVideoPreview(item, previewUrl)) return;
      candidateIdSet.add(item.id);
      enqueueImageHydration(item.id, previewUrl, {
        priority: "low",
        targetLongEdgePx: resolved.targetLongEdgePx,
        previewQualityBand: resolved.previewQualityBand,
        fallbackUrl:
          resolveFirstRenderableUrl(
            resolved.fullUrl,
            item.previewUrl,
            item.fullStoragePath,
            item.previewStoragePath,
            item.resultUrls?.[0]
          ) ?? undefined,
      });
    });
    nearViewportCuratedOutputs.forEach((item) => {
      if (candidateIdSet.has(item.id)) return;
      const resolved = resolveReferenceCardUrls(item, {
        strictPreviewLadder: REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER,
        adaptivePreviewQuality: REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY,
        pressureLevel: previewQualityPressureLevel,
        surface: isAdaptiveSurfaceEnabled("quick-slot") ? "quick-slot" : "reference-grid",
        cardLongEdgePx: Math.max(200, Math.round(Math.max(1, curatedVirtualMetrics.rowHeight - 3))),
        devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      });
      const previewUrl = resolved.previewUrl ?? resolved.fullUrl;
      if (!previewUrl || isOutputVideoPreview(item, previewUrl)) return;
      candidateIdSet.add(item.id);
      enqueueImageHydration(item.id, previewUrl, {
        priority: "low",
        targetLongEdgePx: resolved.targetLongEdgePx,
        previewQualityBand: resolved.previewQualityBand,
        fallbackUrl:
          resolveFirstRenderableUrl(
            resolved.fullUrl,
            item.previewUrl,
            item.fullStoragePath,
            item.previewStoragePath,
            item.resultUrls?.[0]
          ) ?? undefined,
      });
    });
    const currentQueue = hydrationQueueRef.current;
    const nextQueue = currentQueue.filter((id) => candidateIdSet.has(id));
    const queueChanged =
      nextQueue.length !== currentQueue.length ||
      nextQueue.some((id, index) => currentQueue[index] !== id);
    if (queueChanged) {
      hydrationQueueRef.current = nextQueue;
      hydrationQueuedIdSetRef.current = new Set(nextQueue);
      syncImageHydrationState();
      processHydrationQueue();
    }
  }, [
    activeOutputId,
    curatedVirtualMetrics.rowHeight,
    curatedVisibleCardItems,
    enqueueImageHydration,
    nearViewportCuratedOutputs,
    nearViewportOutputs,
    outputs,
    previewQualityPressureLevel,
    processHydrationQueue,
    syncImageHydrationState,
    virtualMetrics.rowHeight,
    visibleCardItems,
  ]);

  React.useEffect(() => {
    if (!REFERENCE_GRID_FLAG_DECODE_BUDGET) return;
    const validOutputIds = new Set(outputs.map((output) => output.id));
    Object.keys(hydrationGeneratedObjectUrlByIdRef.current).forEach((id) => {
      if (validOutputIds.has(id)) return;
      revokeGeneratedHydrationUrl(id);
    });
    Object.keys(hydrationPreviewMetaByIdRef.current).forEach((id) => {
      if (validOutputIds.has(id)) return;
      delete hydrationPreviewMetaByIdRef.current[id];
    });
    Object.keys(hydrationUrlByIdRef.current).forEach((id) => {
      if (validOutputIds.has(id)) return;
      delete hydrationUrlByIdRef.current[id];
    });
    Object.keys(hydrationFallbackUrlByIdRef.current).forEach((id) => {
      if (validOutputIds.has(id)) return;
      delete hydrationFallbackUrlByIdRef.current[id];
    });
    Object.keys(hydrationFailedOptimizedUrlByIdRef.current).forEach((id) => {
      if (validOutputIds.has(id)) return;
      delete hydrationFailedOptimizedUrlByIdRef.current[id];
    });

    // Avoid dispatching a no-op state update on every render; only prune when stale hydrated ids exist.
    const hasStaleHydratedIds = Object.keys(hydrationHydratedByIdRef.current).some(
      (id) => !validOutputIds.has(id)
    );
    if (!hasStaleHydratedIds) return;

    runNonUrgentUpdate(() => {
      setImageHydrationState((prev) => {
        let changed = false;
        const nextHydratedById = Object.fromEntries(
          Object.entries(prev.hydratedById).filter(([id]) => {
            const keep = validOutputIds.has(id);
            if (!keep) changed = true;
            return keep;
          })
        );
        if (!changed) return prev;
        return {
          ...prev,
          hydratedById: nextHydratedById,
        };
      });
    });
  }, [outputs, revokeGeneratedHydrationUrl, runNonUrgentUpdate]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection as
      | {
          addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
          removeEventListener?: (
            type: string,
            listener: EventListenerOrEventListenerObject
          ) => void;
        }
      | undefined;
    const refreshBudget = () => {
      const isSmallScreen = window.matchMedia(REFERENCE_AUTOPLAY_SMALL_SCREEN_QUERY).matches;
      const saveData = nav.connection?.saveData === true;
      const effectiveType = (nav.connection?.effectiveType ?? "").toLowerCase();
      const isSlowNetwork = effectiveType.includes("2g");
      const isLowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
      const isConstrained = saveData || isSlowNetwork || isLowMemory;
      const nextBudget = isConstrained
        ? REFERENCE_AUTOPLAY_MAX_CONSTRAINED
        : isSmallScreen
          ? REFERENCE_AUTOPLAY_MAX_SMALL_SCREEN
          : REFERENCE_AUTOPLAY_MAX_DESKTOP;
      if (desiredVideoAttachBudgetRef.current !== nextBudget) {
        desiredVideoAttachBudgetRef.current = nextBudget;
        setDesiredVideoAttachBudget(nextBudget);
      }
      if (
        isConstrained &&
        autoplayEnabledIdsStateRef.current.length > REFERENCE_AUTOPLAY_MAX_CONSTRAINED
      ) {
        runNonUrgentUpdate(() => {
          setAutoplayEnabledIds((prev) =>
            prev.length <= REFERENCE_AUTOPLAY_MAX_CONSTRAINED
              ? prev
              : prev.slice(0, REFERENCE_AUTOPLAY_MAX_CONSTRAINED)
          );
        });
      }
      recomputeAutoplayBudgetRef.current();
    };
    refreshBudget();
    window.addEventListener("resize", refreshBudget);
    connection?.addEventListener?.("change", refreshBudget);
    return () => {
      window.removeEventListener("resize", refreshBudget);
      connection?.removeEventListener?.("change", refreshBudget);
    };
  }, [runNonUrgentUpdate]);

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

  React.useEffect(
    () => () => {
      if (hydrationRafFlushRef.current != null) {
        window.cancelAnimationFrame(hydrationRafFlushRef.current);
        hydrationRafFlushRef.current = null;
      }
      Object.keys(hydrationGeneratedObjectUrlByIdRef.current).forEach((id) => {
        revokeGeneratedHydrationUrl(id);
      });
    },
    [revokeGeneratedHydrationUrl]
  );

  React.useEffect(() => {
    if (!REFERENCE_GRID_FLAG_RENDER_COMMIT_TELEMETRY) return;
    if (typeof performance === "undefined") return;
    const now = performance.now();
    const durationMs =
      lastRenderCommitAtRef.current > 0
        ? Math.max(0, Math.round(now - lastRenderCommitAtRef.current))
        : 0;
    lastRenderCommitAtRef.current = now;
    logMediaPerf("media.grid.render.commit", {
      surface: "reference-grid",
      rendered_item_count: renderedItemCount,
      total_item_count: outputs.length,
      virtualized: shouldVirtualize,
      high_density: isHighDensity,
      image_hydration_queue: imageHydrationState.queueSize,
      image_decode_inflight: imageHydrationState.decodeInflight,
      perf_degrade_level: perfWatchdog.degradeLevel,
      preview_src_swap_rate_per_minute: previewSwapMetrics.swapRatePerMinute,
      preview_repaint_spike_count: previewSwapMetrics.repaintSpikeCount,
      preview_last_swap_burst_count: previewSwapMetrics.lastSwapBurstCount,
      duration_ms: durationMs,
    });
  }, [
    endIndex,
    imageHydrationState.decodeInflight,
    imageHydrationState.queueSize,
    isHighDensity,
    outputs.length,
    perfWatchdog.degradeLevel,
    previewSwapMetrics.lastSwapBurstCount,
    previewSwapMetrics.repaintSpikeCount,
    previewSwapMetrics.swapRatePerMinute,
    renderedItemCount,
    shouldVirtualize,
    startIndex,
  ]);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;
    const observer = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        logMediaPerf("media.grid.longtask.sample", {
          surface: "reference-grid",
          duration_ms: Math.round(entry.duration),
          name: entry.name,
        });
      });
    });
    try {
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      observer.disconnect();
      return;
    }
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!REFERENCE_GRID_FLAG_TELEMETRY_BACKPRESSURE) return;
    const shouldDefer =
      perfWatchdog.degradeLevel >= 1 ||
      canvasDropMode !== "none" ||
      isCuratedDropActive ||
      loadingCardState.loadingIds.length > 8;
    setMediaPerfSamplingPolicy(shouldDefer ? "defer_non_critical" : "normal");
    return () => {
      setMediaPerfSamplingPolicy("normal");
    };
  }, [
    canvasDropMode,
    isCuratedDropActive,
    loadingCardState.loadingIds.length,
    perfWatchdog.degradeLevel,
  ]);

  const markLoaded = useCallback(
    (id: string, options?: { notifyAutoSave?: boolean }) => {
      const shouldNotify = options?.notifyAutoSave ?? true;
      if (loadedIdsRef.current.has(id)) return;
      loadedIdsRef.current.add(id);
      runNonUrgentUpdate(() => {
        setLoadedMap((prev) => {
          if (prev[id]) return prev;
          return { ...prev, [id]: true };
        });
      });
      if (shouldNotify) {
        onOutputMediaLoaded?.(id);
      }
    },
    [onOutputMediaLoaded, runNonUrgentUpdate]
  );

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

  const handleCardDragStart = useCallback(
    (
      event: React.DragEvent<HTMLElement>,
      item: StudioOutput,
      sourceSurface: ReferenceDragSourceSurface
    ) => {
      prepareReferenceDrag(event, item, {
        dragImage: event.currentTarget as HTMLElement,
        sourceSurface,
      });
    },
    []
  );

  const handleCardDragEnd = useCallback((event: React.DragEvent<HTMLElement>) => {
    clearDragState(event);
  }, []);

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

  const handleAutoplayStarted = useCallback(
    (id: string) => {
      if (autoplayingIdsRef.current.has(id)) return;
      autoplayingIdsRef.current.add(id);
      logMediaPerf("media.grid.autoplay.started", {
        surface: "reference-grid",
        output_id: id,
        active_autoplay_count: autoplayingIdsRef.current.size,
        visible_item_count: renderedItemCount,
        total_item_count: outputs.length,
      });
    },
    [outputs.length, renderedItemCount]
  );

  const handleAutoplayStopped = useCallback(
    (id: string) => {
      if (!autoplayingIdsRef.current.has(id)) return;
      autoplayingIdsRef.current.delete(id);
      logMediaPerf("media.grid.autoplay.stopped", {
        surface: "reference-grid",
        output_id: id,
        active_autoplay_count: autoplayingIdsRef.current.size,
        visible_item_count: renderedItemCount,
        total_item_count: outputs.length,
      });
    },
    [outputs.length, renderedItemCount]
  );

  const renderReferenceCard = useCallback(
    (
      card: (typeof visibleCardItems)[number],
      options: {
        surface: ReferenceDragSourceSurface;
        isCuratedSurface: boolean;
      }
    ) => {
      const isFailing = card.item.taskState === "fail";
      const isLoading =
        !isFailing &&
        (card.item.taskState === "running" ||
          card.item.taskState === "pending" ||
          (card.item.taskState === "success" && !card.cardPreviewUrl && !card.item.previewText));
      const isPending = pendingCardIdSet.has(card.item.id);
      const isSpinnerCandidate = spinnerCandidateIdSet.has(card.item.id);
      const loadingVisual: "none" | "spinner" | "placeholder" | "pending" = isPending
        ? spinnerSlotIdSet.has(card.item.id)
          ? "spinner"
          : isSpinnerCandidate
            ? "pending"
            : "placeholder"
        : "none";
      const canAutoplayVideo =
        card.isVideoPreview &&
        autoplayEnabledIdSet.has(card.item.id) &&
        perfWatchdog.degradeLevel < 2;
      const isPromptOnly = !card.cardPreviewUrl && !!card.item.previewText;
      const isLinkedPromptReference = isPromptOnly && linkedPromptReferenceIdSet.has(card.item.id);
      const canRetryStatus = Boolean(onRetryStatus && card.item.taskId) && (isFailing || isLoading);
      const videoNodeKey = `${options.surface}:${card.item.id}`;
      return (
        <ReferenceCanvasCard
          key={options.isCuratedSurface ? `curated-${card.item.id}` : card.item.id}
          item={card.item}
          dragSourceSurface={options.surface}
          videoNodeKey={videoNodeKey}
          activeOutputId={activeOutputId}
          loadingVisual={loadingVisual}
          cardPreviewUrl={card.cardPreviewUrl}
          isVideoPreview={card.isVideoPreview}
          isImagePreview={card.isImagePreview}
          canAutoplayVideo={canAutoplayVideo}
          isPromptOnly={isPromptOnly}
          isLinkedPromptReference={isLinkedPromptReference}
          canRetryStatus={canRetryStatus}
          showPromptGenerate={showPromptGenerate}
          disablePromptGenerate={disablePromptGenerate}
          generateCostCredits={generateCostCredits}
          imageSrc={card.imageSrc}
          imageLoading={card.isPriorityHydration ? "eager" : "lazy"}
          imageFetchPriority={card.isPriorityHydration ? "high" : "low"}
          onSelectOutput={onSelectOutput}
          onOpenDetails={onOpenDetails}
          onCardDragStart={handleCardDragStart}
          onCardDragEnd={handleCardDragEnd}
          onCardDragOver={
            options.isCuratedSurface
              ? (event) => {
                  handleCuratedSectionDragOver(event);
                }
              : undefined
          }
          onCardDrop={options.isCuratedSurface ? handleCuratedCardDrop : undefined}
          onCardDragEnter={
            options.isCuratedSurface
              ? (event) => {
                  handleCuratedSectionDragEnter(event);
                }
              : undefined
          }
          onCardDragLeave={
            options.isCuratedSurface
              ? (event) => {
                  handleCuratedSectionDragLeave(event);
                }
              : undefined
          }
          onKeyboardReorderCurated={
            options.isCuratedSurface ? handleCuratedCardKeyboardReorder : undefined
          }
          registerVideoNode={registerVideoNode}
          markLoaded={markLoaded}
          onAutoplayStarted={handleAutoplayStarted}
          onAutoplayStopped={handleAutoplayStopped}
          onRetryStatus={onRetryStatus}
          onDeleteOutput={options.isCuratedSurface ? undefined : onDeleteOutput}
          onRemoveCuratedReference={options.isCuratedSurface ? onRemoveCuratedReference : undefined}
          showCuratedRemoveAction={options.isCuratedSurface}
          onSaveToLibrary={onSaveToLibrary}
          onDownload={onDownload}
          onDescribeImage={onDescribeImage}
          onGeneratePrompt={onGeneratePrompt}
          hideReferenceActions={options.isCuratedSurface}
        />
      );
    },
    [
      activeOutputId,
      autoplayEnabledIdSet,
      disablePromptGenerate,
      generateCostCredits,
      handleAutoplayStarted,
      handleAutoplayStopped,
      handleCardDragStart,
      handleCardDragEnd,
      handleCuratedCardDrop,
      handleCuratedCardKeyboardReorder,
      handleCuratedSectionDragEnter,
      handleCuratedSectionDragLeave,
      handleCuratedSectionDragOver,
      linkedPromptReferenceIdSet,
      markLoaded,
      onDeleteOutput,
      onDescribeImage,
      onDownload,
      onGeneratePrompt,
      onOpenDetails,
      onRemoveCuratedReference,
      onRetryStatus,
      onSaveToLibrary,
      onSelectOutput,
      pendingCardIdSet,
      perfWatchdog.degradeLevel,
      registerVideoNode,
      showPromptGenerate,
      spinnerCandidateIdSet,
      spinnerSlotIdSet,
    ]
  );

  const referenceGridHeader = (
    <div className="panel-header preview-header reference-all-refs-header">
      <div>
        <p className="eyebrow">Reference Grid</p>
      </div>
      <div className="preview-header-actions">
        <button
          type="button"
          className="ghost-btn mini preview-media-btn reference-grid-add-files-btn"
          onClick={onTriggerFileSelect}
        >
          <UploadSimple size={14} weight="regular" />
          <span>Add files</span>
        </button>
        <PromptLibraryButton
          onClick={(event) => {
            event.preventDefault();
            onOpenMediaLibrary?.();
          }}
          className="prompt-media-btn preview-media-btn reference-grid-media-library-btn"
          aria-label="Open media library"
          label="Media Library"
          icon={<CloudArrowUp size={16} weight="regular" aria-hidden />}
          tone="library"
        />
        {archiveCount > 0 ? (
          <button
            type="button"
            className="ghost-btn mini preview-media-btn reference-archive-btn"
            onClick={() => setIsArchivePanelOpen((prev) => !prev)}
            aria-expanded={isArchivePanelOpen}
          >
            Archived ({archiveCount})
          </button>
        ) : null}
      </div>
    </div>
  );

  const referenceArchiveInline =
    !showHeader && archiveCount > 0 ? (
      <div className="reference-archive-inline">
        <button
          type="button"
          className="ghost-btn mini preview-media-btn reference-archive-btn"
          onClick={() => setIsArchivePanelOpen((prev) => !prev)}
          aria-expanded={isArchivePanelOpen}
        >
          Archived ({archiveCount})
        </button>
        {onRestoreAllArchivedOutputs ? (
          <button
            type="button"
            className="ghost-btn mini preview-media-btn reference-archive-restore-all-btn"
            onClick={() => onRestoreAllArchivedOutputs()}
          >
            Restore all
          </button>
        ) : null}
      </div>
    ) : null;

  const referenceArchivePanel =
    isArchivePanelOpen && archiveCount > 0 ? (
      <div className="reference-archive-panel" aria-label="Archived references">
        <div className="reference-archive-header">
          <p className="tiny subdued">Older references are archived to keep the grid responsive.</p>
          <button
            type="button"
            className="ghost-btn mini preview-media-btn reference-archive-restore-all-btn"
            onClick={() => onRestoreAllArchivedOutputs?.()}
          >
            Restore all
          </button>
        </div>
        <div className="reference-archive-list">
          {archivedOutputs.slice(0, 24).map((item) => (
            <div key={item.id} className="reference-archive-item">
              <span className="reference-archive-item-label">
                {item.previewText ? item.previewText : item.prompt}
              </span>
              <button
                type="button"
                className="ghost-btn mini reference-archive-item-restore"
                onClick={() => onRestoreArchivedOutput?.(item.id)}
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      </div>
    ) : null;

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
      {!isCuratedSplitEnabled && showHeader ? referenceGridHeader : null}
      {!isCuratedSplitEnabled ? referenceArchiveInline : null}
      {!isCuratedSplitEnabled ? referenceArchivePanel : null}
      <div className={`reference-grid-sections${isCuratedSplitEnabled ? " is-curated-split" : ""}`}>
        {isCuratedSplitEnabled ? (
          <>
            <div
              ref={curatedSectionRef}
              className={`reference-curated-section${isCuratedDropActive ? " is-drop-active" : ""}${horizontalSplit.isAllRefsExpanded ? " is-all-refs-expanded" : ""}`}
              style={horizontalSplit.topSectionStyle}
              onDrop={handleCuratedSectionDrop}
              onDragOver={handleCuratedSectionDragOver}
              onDragEnter={handleCuratedSectionDragEnter}
              onDragLeave={handleCuratedSectionDragLeave}
            >
              <div ref={curatedHeaderRef} className="reference-curated-header">
                <p className="eyebrow">Quick Slot Inventory</p>
              </div>
              <div
                className="reference-curated-scroll"
                onScroll={handleCuratedScroll}
                ref={curatedScrollContainerRef}
              >
                <div
                  className={`reference-canvas-grid${!selectedTool ? " reference-canvas-grid--wide" : ""}`}
                  ref={curatedGridRef}
                  style={curatedGridStyle}
                >
                  {curatedOutputs.length === 0 ? (
                    <div className="reference-curated-empty">
                      <p className="preview-title">
                        Drag &amp; drop references here from the Reference Grid.
                      </p>
                    </div>
                  ) : (
                    <>
                      {curatedTopSpacerHeight > 0 ? (
                        <div
                          className="reference-virtual-spacer"
                          style={{ height: curatedTopSpacerHeight }}
                        />
                      ) : null}
                      {curatedVisibleCardItems.map((card) =>
                        renderReferenceCard(card, {
                          surface: "curated",
                          isCuratedSurface: true,
                        })
                      )}
                      {curatedBottomSpacerHeight > 0 ? (
                        <div
                          className="reference-virtual-spacer"
                          style={{ height: curatedBottomSpacerHeight }}
                        />
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div
              className="reference-grid-horizontal-divider-wrap"
              {...horizontalSplit.dividerProps}
            >
              <button
                type="button"
                className="reference-grid-horizontal-divider-pill"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  horizontalSplit.snapToInventoryExpanded();
                }}
              >
                Inventory ↓
              </button>
              <div className="reference-grid-horizontal-divider" />
              <button
                type="button"
                className="reference-grid-horizontal-divider-pill"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  const curatedHeaderNode = curatedSectionRef.current?.querySelector(
                    ".reference-curated-header"
                  );
                  const targetTopHeightPx =
                    curatedHeaderNode instanceof HTMLElement
                      ? curatedHeaderNode.offsetHeight
                      : undefined;
                  horizontalSplit.snapToAllRefsExpanded(targetTopHeightPx);
                }}
              >
                All Refs ↑
              </button>
            </div>
          </>
        ) : null}
        <div
          className={`reference-all-refs-section${horizontalSplit.isInventoryExpanded ? " is-inventory-expanded" : ""}`}
          style={isCuratedSplitEnabled ? horizontalSplit.bottomSectionStyle : undefined}
        >
          {isCuratedSplitEnabled && showHeader ? referenceGridHeader : null}
          {isCuratedSplitEnabled ? referenceArchiveInline : null}
          {isCuratedSplitEnabled ? referenceArchivePanel : null}
          <div
            className="reference-canvas-scroll"
            onScroll={handleAllRefsScroll}
            ref={scrollContainerRef}
          >
            <div
              className={`reference-canvas-grid${!selectedTool ? " reference-canvas-grid--wide" : ""}`}
              ref={gridRef}
              style={gridStyle}
            >
              {outputs.length === 0 ? (
                <div className="reference-empty">
                  <p className="preview-title">Upload or generate to see your references here.</p>
                  <p className="subdued tiny helper-text">
                    New text prompts, images, and videos will appear in this grid.
                  </p>
                </div>
              ) : (
                <>
                  {topSpacerHeight > 0 ? (
                    <div className="reference-virtual-spacer" style={{ height: topSpacerHeight }} />
                  ) : null}
                  {visibleCardItems.map((card) =>
                    renderReferenceCard(card, {
                      surface: "all-refs",
                      isCuratedSurface: false,
                    })
                  )}
                  {bottomSpacerHeight > 0 ? (
                    <div
                      className="reference-virtual-spacer"
                      style={{ height: bottomSpacerHeight }}
                    />
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
