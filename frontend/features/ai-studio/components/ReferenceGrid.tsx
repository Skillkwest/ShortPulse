/**
 * Reference grid for saved outputs and uploads.
 * Supports drag/drop into other surfaces and exposes a detail action on double click.
 */
import React from "react";
import {
  PERF_FLAG_REFERENCE_GRID_CSS_CONTAINMENT,
  PERF_FLAG_REFERENCE_GRID_DECODE_BUDGET,
  PERF_FLAG_REFERENCE_GRID_LOADING_PLACEHOLDER_TIMEOUT,
  PERF_FLAG_REFERENCE_GRID_RENDER_COMMIT_TELEMETRY,
  PERF_FLAG_REFERENCE_GRID_STRICT_PREVIEW_LADDER,
  PERF_FLAG_REFERENCE_GRID_TELEMETRY_BACKPRESSURE,
} from "../logic/perfProfileFlags";
import { isAdaptiveSurfaceEnabled } from "../../../lib/adaptive-media";
import { ReferenceGridSections } from "../reference-grid/components/ReferenceGridSections";
import { useReferenceGridClipboardController } from "../reference-grid/controllers/useReferenceGridClipboardController";
import { useReferenceGridDropController } from "../reference-grid/controllers/useReferenceGridDropController";
import { useReferenceGridCuratedDndController } from "../reference-grid/controllers/useReferenceGridCuratedDndController";
import { useReferenceGridScrollController } from "../reference-grid/controllers/useReferenceGridScrollController";
import { useReferenceGridVideoLifecycleController } from "../reference-grid/controllers/useReferenceGridVideoLifecycleController";
import { useReferenceGridAutoplayBudgetController } from "../reference-grid/controllers/useReferenceGridAutoplayBudgetController";
import { useReferenceGridTelemetryController } from "../reference-grid/controllers/useReferenceGridTelemetryController";
import { useReferenceGridAutoplayEventController } from "../reference-grid/controllers/useReferenceGridAutoplayEventController";
import { useReferenceGridCardDragController } from "../reference-grid/controllers/useReferenceGridCardDragController";
import { useReferenceGridCardRenderController } from "../reference-grid/controllers/useReferenceGridCardRenderController";
import { useReferenceGridPreviewSwapTelemetryController } from "../reference-grid/controllers/useReferenceGridPreviewSwapTelemetryController";
import { useReferenceGridAutoplaySelectionController } from "../reference-grid/controllers/useReferenceGridAutoplaySelectionController";
import { useReferenceGridCardItemsController } from "../reference-grid/controllers/useReferenceGridCardItemsController";
import { useReferenceGridResolvedMediaController } from "../reference-grid/controllers/useReferenceGridResolvedMediaController";
import { useReferenceGridSignedStorageUrlController } from "../reference-grid/controllers/useReferenceGridSignedStorageUrlController";
import { useReferenceGridSurfaceOwnershipController } from "../reference-grid/controllers/useReferenceGridSurfaceOwnershipController";
import { useReferenceGridRuntimeScaffold } from "../reference-grid/controllers/useReferenceGridRuntimeScaffold";
import { useReferenceGridSingleAudioPlaybackController } from "../reference-grid/controllers/useReferenceGridSingleAudioPlaybackController";
import { useReferenceGridPreviewRuntimeScheduling } from "../reference-grid/controllers/useReferenceGridPreviewRuntime";
import { areReferenceGridPropsEqual } from "../reference-grid/logic/referenceGridPropsEquality";
import {
  REFERENCE_AUTOPLAY_DETACH_DELAY_MS,
  REFERENCE_AUTOPLAY_MAX_CONSTRAINED,
  REFERENCE_AUTOPLAY_MAX_DESKTOP,
  REFERENCE_AUTOPLAY_MAX_SMALL_SCREEN,
  REFERENCE_AUTOPLAY_SMALL_SCREEN_QUERY,
  REFERENCE_AUTOPLAY_VISIBILITY_THRESHOLD,
  REFERENCE_GRID_MIN_COLUMNS,
  REFERENCE_PRIORITY_HYDRATION_ROWS,
} from "../reference-grid/referenceGridConfig";
import type { ReferenceGridProps } from "../reference-grid/referenceGridTypes";
import {
  incrementFreezeInvestigationCounter,
  setFreezeInvestigationGauge,
} from "../logic/freezeInvestigationTelemetry";
const REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER = PERF_FLAG_REFERENCE_GRID_STRICT_PREVIEW_LADDER;
const REFERENCE_GRID_FLAG_DECODE_BUDGET = PERF_FLAG_REFERENCE_GRID_DECODE_BUDGET;
const REFERENCE_GRID_FLAG_CSS_CONTAINMENT = PERF_FLAG_REFERENCE_GRID_CSS_CONTAINMENT;
const REFERENCE_GRID_FLAG_LOADING_PLACEHOLDER_TIMEOUT =
  PERF_FLAG_REFERENCE_GRID_LOADING_PLACEHOLDER_TIMEOUT;
const REFERENCE_GRID_FLAG_TELEMETRY_BACKPRESSURE = PERF_FLAG_REFERENCE_GRID_TELEMETRY_BACKPRESSURE;
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
  isMediaStorageFull = false,
  showHeader = true,
  onOutputMediaLoaded,
  linkedPromptReferenceIds = [],
  onSelectOutput,
  onOpenDetails,
  selectedTool,
  onDropFiles,
  onPasteTextReference,
  onPasteMediaReference,
  onAddLibraryMediaReference,
  onAddLibraryPromptReference,
  onTriggerFileSelect,
  onSaveToLibrary,
  onDownload,
  onRetryStatus,
  onRerollOutput,
  onReloadWorkflowOutput,
  onDeleteOutput,
  onClearGenerationOutput,
  onAddCuratedReference,
  onRemoveCuratedReference,
  onReorderCuratedReference,
  onAddDroppedFilesToQuickSlot,
  onAddLibraryMediaReferenceToQuickSlot,
  onAddLibraryPromptReferenceToQuickSlot,
  onAddPastedMediaReferenceToQuickSlot,
  onRestoreArchivedOutput,
  onRestoreAllArchivedOutputs,
  railCanvasProps,
  isShellResizeActive,
  panelVisibility,
  stylesPanel,
}: ReferenceGridProps) {
  incrementFreezeInvestigationCounter("referenceGrid.render");
  const [isRailCanvasInteractionActive, setIsRailCanvasInteractionActive] = React.useState(false);
  const [isReferenceCardDragActive, setIsReferenceCardDragActive] = React.useState(false);
  const handleRailCanvasInteractionActiveChange = React.useCallback(
    (active: boolean) => {
      setIsRailCanvasInteractionActive(active);
      railCanvasProps?.onInteractionActiveChange?.(active);
    },
    [railCanvasProps]
  );
  const effectiveRailCanvasProps = React.useMemo(
    () =>
      railCanvasProps
        ? {
            ...railCanvasProps,
            onInteractionActiveChange: handleRailCanvasInteractionActiveChange,
          }
        : undefined,
    [handleRailCanvasInteractionActiveChange, railCanvasProps]
  );
  const {
    allOutputIds,
    archivedOutputs,
    curatedOutputs,
    suspendBackgroundVisualWork,
    isStylesPanelOpen,
    showReferenceGridSection,
    showQuickSlotSection,
    isWideLayout,
    isCuratedSplitActive,
    perfWatchdog,
    densityPressureLevel,
    effectivePerfDegradeLevel,
    previewQualityPressureLevel,
    hydrationBudget,
    selectionTheme,
    autoplayingIdsRef,
    scrollContainerRef,
    gridRef,
    curatedScrollContainerRef,
    curatedGridRef,
    panelRef,
    railCanvasSectionRef,
    railCanvasHeaderRef,
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
    isCuratedDropActive,
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
    railCanvasSplit,
    showRailCanvasSection,
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
    visibleCuratedOutputIds,
    nearViewportCuratedOutputIds,
    topSpacerHeight,
    bottomSpacerHeight,
    curatedTopSpacerHeight,
    curatedBottomSpacerHeight,
    renderedItemCount,
    renderedOutputIdSet,
    visibleMediaOutputs,
    visibleCuratedMediaOutputs,
    nearViewportMediaOutputs,
    nearViewportCuratedMediaOutputs,
    activeMediaOutput,
    visibleOutputById,
    archiveCount,
  } = useReferenceGridRuntimeScaffold({
    outputs: outputsProp,
    archivedOutputs: archivedOutputsProp,
    activeOutputId,
    curatedReferenceIds,
    removedFromAllRefsIds,
    linkedPromptReferenceIds,
    selectedTool,
    onOutputMediaLoaded,
    panelVisibility,
    stylesPanel,
    onAddCuratedReference,
    onRemoveCuratedReference,
    onReorderCuratedReference,
    railCanvasProps: effectiveRailCanvasProps,
    isShellResizeActive,
    isRailCanvasInteractionActive,
    isReferenceCardDragActive,
  });
  setFreezeInvestigationGauge("referenceGrid.allOutputsCount", allOutputIds.length);
  setFreezeInvestigationGauge("referenceGrid.archivedOutputsCount", archivedOutputs.length);
  setFreezeInvestigationGauge("referenceGrid.projectedOutputsCount", allOutputIds.length);
  setFreezeInvestigationGauge("referenceGrid.curatedOutputsCount", curatedOutputs.length);
  const { recomputeAutoplayBudget } = useReferenceGridAutoplaySelectionController({
    activeOutputId,
    suspendAutoplaySelection: suspendBackgroundVisualWork,
    videoAttachBudget: mediaWorkBudget.videoAttachBudget,
    perfDegradeLevel: effectivePerfDegradeLevel,
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
  const storageSigningMediaOutputs = React.useMemo(
    () => [
      ...visibleMediaOutputs,
      ...visibleCuratedMediaOutputs,
      ...nearViewportMediaOutputs,
      ...nearViewportCuratedMediaOutputs,
      activeMediaOutput,
    ],
    [
      activeMediaOutput,
      nearViewportCuratedMediaOutputs,
      nearViewportMediaOutputs,
      visibleCuratedMediaOutputs,
      visibleMediaOutputs,
    ]
  );
  const { signedStorageUrlByPath, signedMediaAuthorityByMediaId, signingPendingStoragePathSet } =
    useReferenceGridSignedStorageUrlController({
      outputs: storageSigningMediaOutputs,
      suspendSigningRequests: suspendBackgroundVisualWork,
    });
  const { resolveCardMedia } = useReferenceGridResolvedMediaController({
    previewQualityPressureLevel,
    strictPreviewLadder: REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER,
    adaptivePreviewRoutingEnabled,
    signedStorageUrlByPath,
    signedMediaAuthorityByMediaId,
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
    loadingCardIdSet,
    generationLoadingCardIdSet,
    hydrationLoadingCardIdSet,
    loadingIdsLength,
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
    visibleOutputById,
    loadedMap,
    hydratedById: imageHydrationState.hydratedById,
    signingPendingStoragePathSet,
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
  useReferenceGridPreviewRuntimeScheduling({
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
    perfDegradeLevel: effectivePerfDegradeLevel,
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
      onPasteMediaReference,
      onPasteTextReference,
      onAddLibraryMediaReference,
      onAddLibraryPromptReference,
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

  const { handleCardDragStart, handleCardDragEnd } = useReferenceGridCardDragController({
    onReferenceCardDragActiveChange: setIsReferenceCardDragActive,
  });

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
    onAddDroppedFilesToQuickSlot,
    onAddLibraryMediaReferenceToQuickSlot,
    onAddLibraryPromptReferenceToQuickSlot,
    onAddPastedMediaReferenceToQuickSlot,
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
  const audioPlaybackController = useReferenceGridSingleAudioPlaybackController();
  const { curatedCardNodes, allRefsCardNodes } = useReferenceGridCardRenderController({
    activeOutputId,
    visibleOutputById,
    autoplayEnabledIdSet,
    linkedPromptReferenceIdSet,
    loadingCardIdSet,
    generationLoadingCardIdSet,
    hydrationLoadingCardIdSet,
    perfDegradeLevel: effectivePerfDegradeLevel,
    suspendBackgroundVisualWork,
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
    audioPlaybackController,
    onRetryStatus,
    onRerollOutput,
    onReloadWorkflowOutput,
    onDeleteOutput,
    onClearGenerationOutput,
    onRemoveCuratedReference,
    isMediaStorageFull,
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
      className={`panel ai-panel ai-preview-panel reference-canvas-panel${canvasDropMode !== "none" ? " is-drop-active" : ""}${canvasDropMode === "text" ? " is-drop-active-text" : ""}${canvasDropMode === "files" ? " is-drop-active-files" : ""}${isHighDensity ? " is-high-density" : ""}${denseVisualModeEnabled ? " is-dense-visual-mode" : ""}${REFERENCE_GRID_FLAG_CSS_CONTAINMENT ? " is-css-containment-mode" : ""}${REFERENCE_GRID_FLAG_LOADING_PLACEHOLDER_TIMEOUT ? " is-loading-placeholder-timeout-mode" : ""}${effectivePerfDegradeLevel >= 1 ? " is-grid-pressure-mode" : ""}${isCuratedSplitActive ? " is-curated-split-mode" : ""}`}
      data-selection-theme={selectionTheme}
      data-grid-surface="reference-grid"
      data-rendered-item-count={renderedItemCount}
      data-image-hydration-queue-size={imageHydrationState.queueSize}
      data-image-decode-inflight-count={imageHydrationState.decodeInflight}
      data-grid-perf-degrade-level={effectivePerfDegradeLevel}
      data-grid-density-pressure-level={densityPressureLevel}
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
      data-grid-background-visual-work-suspended={suspendBackgroundVisualWork ? "true" : "false"}
      data-rail-canvas-interaction-active={isRailCanvasInteractionActive ? "true" : "false"}
      data-reference-card-drag-active={isReferenceCardDragActive ? "true" : "false"}
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
        railCanvasProps={effectiveRailCanvasProps}
        showRailCanvasSection={showRailCanvasSection}
        railCanvasSplit={railCanvasSplit}
        showQuickSlotSection={showQuickSlotSection}
        showReferenceGridSection={showReferenceGridSection}
        showStylesSection={isStylesPanelOpen}
        showHeader={showHeader}
        archiveCount={archiveCount}
        visibleItemCount={allOutputIds.length}
        topNotice={topNotice}
        isArchivePanelOpen={isArchivePanelOpen}
        archivedOutputs={archivedOutputs}
        onToggleArchivePanel={() => setIsArchivePanelOpen((prev) => !prev)}
        onTriggerFileSelect={onTriggerFileSelect}
        onRestoreArchivedOutput={onRestoreArchivedOutput}
        onRestoreAllArchivedOutputs={onRestoreAllArchivedOutputs}
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
export type { ReferenceGridProps } from "../reference-grid/referenceGridTypes";
