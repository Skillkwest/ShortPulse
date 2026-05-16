import React from "react";
import { modelLogos } from "../../constants";
import { needsImageUpload } from "../../utils/imageUpload";
import { setExpertEditPromptTokenDragData } from "../../logic/expertEditPromptReferences";
import {
  isEditGenerationModeToggleEnabled,
  isMarkupCollapsedOpenModalEnabled,
  isMarkupModelLockEnabled,
} from "../../logic/inpaintSubmission";
import { useInpaintMaskController } from "./useInpaintMaskController";
import {
  createIdleMarkupDrawPointerSession,
  type MarkupDrawPointerSession,
  type MarkupStroke,
} from "./markupStrokeController";
import { useExpertEditInlineGenerate } from "./useExpertEditInlineGenerate";
import { useExpertEditDocumentState } from "./useExpertEditDocumentState";
import { useExpertEditLayerActions } from "./useExpertEditLayerActions";
import { useExpertEditGenerationPresetRuntime } from "./useExpertEditGenerationPresetRuntime";
import { useExpertEditPromptComposerRuntime } from "./useExpertEditPromptComposerRuntime";
import { useExpertEditSessionBridge } from "./useExpertEditSessionBridge";
import { useExpertEditMarkupControlsRuntime } from "./useExpertEditMarkupControlsRuntime";
import { useExpertEditStageChrome } from "./useExpertEditStageChrome";
import { useExpertEditStageHistory } from "./useExpertEditStageHistory";
import { useExpertEditPanelStageInteractions } from "./useExpertEditPanelStageInteractions";
import { useExpertEditStageLifecycle } from "./useExpertEditStageLifecycle";
import { useExpertEditStageTransformRuntime } from "./useExpertEditStageTransformRuntime";
import { useExpertEditStageViewport } from "./useExpertEditStageViewport";
import { useExpertEditInpaintStageRuntime } from "./useExpertEditInpaintStageRuntime";
import { useExpertEditPanelTransientRuntime } from "./useExpertEditPanelTransientRuntime";
import { useExpertEditPanelControlsRuntime } from "./useExpertEditPanelControlsRuntime";
import { useExpertEditStageWorkspaceRuntime } from "./useExpertEditStageWorkspaceRuntime";
import { useExpertEditPanelComposerRuntime } from "./useExpertEditPanelComposerRuntime";
import { useExpertEditPanelShellRuntime } from "./useExpertEditPanelShellRuntime";
import { useExpertEditStageWorkspacePropsRuntime } from "./useExpertEditStageWorkspacePropsRuntime";
import { ExpertEditStageWorkspace } from "./ExpertEditStageWorkspace";
import { useExpertEditMarkupDrawController } from "./useExpertEditMarkupDrawController";
import { useExpertEditStageViewportController } from "./useExpertEditStageViewportController";
import {
  INPAINT_STROKE_SIZE_DEFAULT,
  MARKUP_STROKE_SIZE_DEFAULT,
  MARKUP_STROKE_SIZE_MAX,
  STATUS_TOAST_FADE_MS,
  STATUS_TOAST_VISIBLE_MS,
  TRANSIENT_OBJECT_URL_REVOKE_MS,
  TRANSFORM_HISTORY_LIMIT,
  clampNumber,
  type ExpertEditPanelViewProps,
  type InpaintMode,
  type InpaintSelectionTab,
  type RailTool,
} from "./expertEditPanelViewContract";
export type { ExpertEditPanelViewProps } from "./expertEditPanelViewContract";
export { COMPOSITE_REGENERATE_COHESION_PROMPT } from "./expertEditPanelViewContract";
import { resolveBlobDimensions, revokeObjectUrlSafe } from "./expertEditPanelUtilities";
import {
  createIdleMarkupPanPointerSession,
  type MarkupPanPointerSession,
  isResolvedStageViewportSize,
} from "./expertEditViewportUtils";
import {
  areLayerTransformsEqual,
  buildTransformHistoryEntry,
  defaultLayerTransform,
  type TransformHistoryState,
} from "./expertEditLayerTransformUtils";
import {
  layerHasImage,
  resolveInitialExpertEditSessionState,
  resolveMarkupStrokeIdCounterFromStrokes,
} from "./expertEditLayerSessionUtils";
import { cloneMarkupStrokesSnapshot } from "./expertEditSessionState";
import { isClientPointInsideElementBounds } from "./expertEditInteractionUtils";
const EXPERT_EDIT_IMAGE_TRANSFORM_EDITING_ENABLED = true;
const EXPERT_EDIT_SUBMIT_VIEWPORT_EPSILON = 0.001;

export function ExpertEditPanelView({
  aspect,
  modelId,
  modelLabel,
  referenceImageUrl,
  extraImageUrls,
  referenceText,
  imageResolution,
  aspectOptions,
  isModelModalOpen,
  modelModalAnchor,
  onAspectChange,
  onModelPickerOpen,
  onPrimaryImageChange,
  onExtraImageChange,
  onPromptTextChange,
  onEditSubmitIntentChange,
  onRegenerate,
  onRegenerateWithReferenceInputs,
  resolveVariantCostCredits,
  insertOptimisticGenerationPlaceholder,
  removeOptimisticGenerationPlaceholder,
  notifyGenerationFailure,
  onAddSessionMediaReference,
  resolvePreviewUrlById,
  costCredits,
  isGenerateDisabled = false,
  isGenerateBusy = false,
  guardrailReason = null,
  isPrimaryStageGenerating = false,
  onImageResolutionChange,
  characterOptions = [],
  selectedCharacterId = "",
  onSelectedCharacterIdChange,
  isCharacterOptionsLoading = false,
  characterModeEnabled = false,
  onCharacterModeEnabledChange,
  refreshCharacterOptions,
  resolveCharacterAvatarUrlById,
  selectedPresetIds: controlledPresetIds,
  onSelectedPresetIdsChange,
  customPresetOverrides: controlledCustomPresetOverrides,
  onCustomPresetOverridesChange,
  systemPresetDefinitions,
  isStylesPanelOpen = false,
  onStylesPanelToggle,
  selectedStyleId: controlledSelectedStyleId,
  stylesCatalog,
  sessionState,
  onSessionStateChange,
  onOpenPresetsLibrary,
}: ExpertEditPanelViewProps) {
  const [initialSessionState] = React.useState(() =>
    resolveInitialExpertEditSessionState({
      referenceImageUrl,
      sessionState,
    })
  );
  const inpaintCollapseTimerRef = React.useRef<number | null>(null);
  const primaryInputRef = React.useRef<HTMLInputElement | null>(null);
  const stageContextMenuRef = React.useRef<HTMLDivElement | null>(null);
  const markupPanPointerSessionRef = React.useRef<MarkupPanPointerSession>(
    createIdleMarkupPanPointerSession()
  );
  const markupDrawPointerSessionRef = React.useRef<MarkupDrawPointerSession>(
    createIdleMarkupDrawPointerSession()
  );
  const markupStrokeIdCounterRef = React.useRef(
    resolveMarkupStrokeIdCounterFromStrokes(initialSessionState.markupStrokes)
  );
  const [selectedInpaintMode, setSelectedInpaintMode] = React.useState<InpaintMode>("brush");
  const isGenerationModeToggleEnabled = isEditGenerationModeToggleEnabled();
  const [selectedRailTool, setSelectedRailTool] = React.useState<RailTool>("move");
  const [inpaintStrokeSize, setInpaintStrokeSize] = React.useState(INPAINT_STROKE_SIZE_DEFAULT);
  const [markupStrokeSize, setMarkupStrokeSize] = React.useState(MARKUP_STROKE_SIZE_DEFAULT);
  const resolvedMarkupStrokeSize = React.useMemo(
    () => clampNumber(markupStrokeSize, 1, MARKUP_STROKE_SIZE_MAX),
    [markupStrokeSize]
  );
  const [selectedInpaintSelectionTab, setSelectedInpaintSelectionTab] =
    React.useState<InpaintSelectionTab>("select");
  const [isMarkupExpandSelected, setIsMarkupExpandSelected] = React.useState(false);
  const [isMarkupPanDragging, setIsMarkupPanDragging] = React.useState(false);
  const [isMarkupPanSpacePressed, setIsMarkupPanSpacePressed] = React.useState(false);
  const [markupStrokes, setMarkupStrokes] = React.useState<MarkupStroke[]>(() =>
    cloneMarkupStrokesSnapshot(initialSessionState.markupStrokes)
  );
  const [isInpaintCollapsed, setIsInpaintCollapsed] = React.useState(true);
  const [isInpaintCollapsing, setIsInpaintCollapsing] = React.useState(false);
  const {
    availablePresets,
    customPresetOverrides,
    effectiveEditSubmitIntent,
    visibleEditGenerationModeOptions,
    generationModeTabsStyle,
    handleGenerationModeChange,
    hasSelectedPresetIds,
    isMorePresetsSurfaceOpen,
    selectedPanelPresets,
    setIsMorePresetsSurfaceOpen,
    toggleMorePresetsSurface,
    updateCustomPresetOverrides,
    updateSelectedPresetIds,
  } = useExpertEditGenerationPresetRuntime({
    isGenerationModeToggleEnabled,
    selectedRailTool,
    setSelectedRailTool,
    controlledPresetIds,
    onSelectedPresetIdsChange,
    controlledCustomPresetOverrides,
    onCustomPresetOverridesChange,
    systemPresetDefinitions,
  });
  const {
    toastVisibleTimerRef,
    toastFadeTimerRef,
    transientRevokeTimersRef,
    statusToastMessage,
    statusToastTone,
    isStatusToastFading,
    showStatusToast,
    lockGlobalCursor,
    unlockGlobalCursor,
    scheduleTransientObjectUrlRevoke,
  } = useExpertEditPanelTransientRuntime({
    statusToastFadeMs: STATUS_TOAST_FADE_MS,
    statusToastVisibleMs: STATUS_TOAST_VISIBLE_MS,
    transientObjectUrlRevokeMs: TRANSIENT_OBJECT_URL_REVOKE_MS,
    revokeObjectUrlSafe,
  });
  const {
    beginLayerRename,
    clearLayerEditing,
    clearPrimaryDragActive,
    createLayer,
    dragOverLayerIndex,
    draggingLayerIndex,
    editingLayerIndex,
    editingLayerValue,
    foundationLayerId,
    handleCommitLayerRename,
    handleDeleteLayer,
    handleDeleteSelectedLayer,
    handleLayerDragEnd,
    handleLayerDragOver,
    handleLayerDragStart,
    handleLayerDrop,
    handlePrimaryDragEnter,
    handlePrimaryDragLeave,
    handlePrimaryDragOver,
    handlePrimaryDrop,
    handlePrimaryFileSelection,
    handleRemoveSelectedLayerImage,
    handleSelectLayer,
    hasPrimaryCompositePreview,
    hostPrimaryImageUrl,
    layerIdCounterRef,
    layers,
    populatedLayerCount,
    primaryDragActive,
    selectedLayerHasRenderableImage,
    resolveLayerImageAspectRatio,
    resolvedSelectedLayerIndex,
    selectedLayer,
    selectedLayerImageUrl,
    selectedLayerIndex,
    setEditingLayerValue,
    setLayers,
    setSelectedLayerIndex,
  } = useExpertEditDocumentState({
    initialLayerState: initialSessionState.layerState,
    isMorePresetsSurfaceOpen,
    revokeObjectUrlSafe,
    resolvePreviewUrlById,
  });
  const [transformHistoryState, setTransformHistoryState] = React.useState<TransformHistoryState>(
    () => ({
      past: [],
      present: buildTransformHistoryEntry(layers),
      future: [],
    })
  );
  React.useEffect(() => {
    if (markupStrokeSize === resolvedMarkupStrokeSize) return;
    setMarkupStrokeSize(resolvedMarkupStrokeSize);
  }, [markupStrokeSize, resolvedMarkupStrokeSize]);
  const selectedStyleId = controlledSelectedStyleId ?? null;
  const {
    inlineStageWrapperRef,
    primaryCanvasFrameStackElement,
    primaryCompositionSurfaceRef,
    markupModalRef,
    markupModalStageRef,
    markupModalStageElement,
    handleMarkupModalRef,
    handlePrimaryCanvasFrameStackRef,
    handleMarkupModalControlsRef,
    handleMarkupModalStageRef,
    handleMarkupModalLayersRef,
    stageViewport,
    setStageViewport,
    setInlineStageViewportSize,
    markupModalStageSize,
    markupModalViewportSize,
    setMarkupModalViewportSize,
    moveStageZoomSliderValue,
    setMoveStageZoomSliderValue,
    primaryCompositionSurfaceAspectRatio,
    primaryCompositionSurfaceAspectRatioValue,
    inlineStageViewportStyle,
    inlineCompositionSurfaceViewportSize,
    modalStageViewportStyle,
    primaryCanvasFrameBoundsStyle,
    resolveInlineStageRect,
    resolveInteractionViewportOffsetPixels,
    resolveInlineCompositionSurfacePoint,
    resolveInlineCompositionScenePoint,
  } = useExpertEditStageViewport({
    aspect,
    hasPrimaryCompositePreview,
    isMarkupExpandSelected,
  });
  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;
  const isInpaintToolSelected = selectedRailTool === "inpaint";
  const isMarkupToolSelected = selectedRailTool === "markup";
  const shouldShowSecondaryReferenceAndStylesRow = true;
  const isInpaintSubmitMode = effectiveEditSubmitIntent === "inpaint";
  const isMarkupSubmitMode = effectiveEditSubmitIntent === "markup";
  const isMoveToolSelected = selectedRailTool === "move";
  const activeStageInteractionMode = isMoveToolSelected
    ? "move"
    : isInpaintToolSelected
      ? "inpaint"
      : "markup";
  const shouldLockMarkupModelPicker = isMarkupSubmitMode && isMarkupModelLockEnabled();
  const shouldOpenMarkupModalFromCollapsedTools = isMarkupCollapsedOpenModalEnabled();
  const isModelPickerLocked = isInpaintSubmitMode || shouldLockMarkupModelPicker;
  const promptTextValue = referenceText ?? "";
  const {
    aspectOptionsForModel,
    closeCharacterPicker,
    effectiveModelPickerLabel,
    effectiveModelPickerLogoSrc,
    effectiveSelectorModelId,
    extraDragActive,
    handleCompositeRegeneratePromptInsert,
    handleCustomPresetSave,
    handleExtraDragEnter,
    handleExtraDragLeave,
    handleExtraDragOver,
    handleExtraDrop,
    handleFileSelection,
    handleInvalidPromptReferenceToken,
    handlePanelPresetApply,
    handlePanelPresetDragStart,
    handlePresetDragEnd,
    handlePresetPanelDragLeave,
    handlePresetPanelDragOver,
    handlePresetPanelDrop,
    handlePresetsSurfaceDragLeave,
    handlePresetsSurfaceDragOver,
    handlePresetsSurfaceDrop,
    handlePromptBlur,
    handlePromptFocus,
    handlePromptKeyDown,
    handlePromptDropWithTokenInsert,
    handlePromptScroll,
    handlePromptTextChange,
    handleSurfacePresetDragStart,
    hasPromptText,
    imageResolutionValue,
    imageResolutionOptions,
    inlineGuardrailReason,
    inputRefs,
    inpaintLayerSources,
    inpaintPromptReferencePolicy,
    insertPromptTokenFromPicker,
    isCharacterPickerOpen,
    isPromptComposerExpanded,
    isPresetPanelDropActive,
    isPresetsSurfaceDropActive,
    populatedPromptTokenSlotIndexes,
    promptHighlightRef,
    promptHighlightSegments,
    promptInputShellRef,
    promptTextareaRef,
    promptTokenInlineError,
    promptTokenPickerState,
    resetPresetDropState,
    shouldBlurPromptUnderlay,
    shouldShowResolutionControl,
  } = useExpertEditPromptComposerRuntime({
    promptTextValue,
    extraImageUrls,
    selectedLayerImageUrl,
    onExtraImageChange,
    onPromptTextChange,
    resolvePreviewUrlById,
    modelId,
    modelLabel,
    modelLogoSrc,
    shouldLockMarkupModelPicker,
    isInpaintSubmitMode,
    isModelPickerLocked,
    imageResolution,
    onImageResolutionChange,
    aspectOptions,
    characterModeEnabled,
    characterOptions,
    selectedCharacterId,
    isCharacterOptionsLoading,
    onCharacterModeEnabledChange,
    populatedLayerCount,
    effectiveEditSubmitIntent,
    onEditSubmitIntentChange,
    guardrailReason,
    layers,
    customPresetOverrides,
    systemPresetDefinitions,
    updateSelectedPresetIds,
    updateCustomPresetOverrides,
    showStatusToast,
  });
  const [extraOneInputRef, extraTwoInputRef, extraThreeInputRef] = inputRefs;

  const {
    overlayCanvasRef,
    modalOverlayCanvasRef,
    previewCanvasRef,
    modalPreviewCanvasRef,
    hasSelectedLayerMask,
    imageHasInteractiveMask,
    captureMaskSnapshot: captureInpaintMaskSnapshot,
    restoreMaskSnapshot: restoreInpaintMaskSnapshot,
    clearAllMasks: clearAllInpaintMasks,
    clearSelectedLayerMask,
    invertSelectedLayerMask,
    exportSelectedLayerMaskBlob,
    onPointerDown: handleInpaintPointerDown,
    onPointerMove: handleInpaintPointerMove,
    onPointerUp: handleInpaintPointerUp,
    onPointerCancel: handleInpaintPointerCancel,
    onPointerLeave: handleInpaintPointerLeave,
  } = useInpaintMaskController({
    surfaceRef: primaryCompositionSurfaceRef,
    selectedLayerId: selectedLayer?.id ?? null,
    selectedLayerImageUrl,
    layerSources: inpaintLayerSources,
    enabled: isInpaintToolSelected,
    sceneScale: stageViewport.scale,
    shouldApplyViewportTransform: hasPrimaryCompositePreview,
    viewportOffsetXRatio: stageViewport.offsetXRatio,
    viewportOffsetYRatio: stageViewport.offsetYRatio,
    resolveViewportOffsetPixels: resolveInteractionViewportOffsetPixels,
    resolveClientPointToSurfacePoint: ({ clientX, clientY, currentTarget, clampToBounds }) =>
      currentTarget === markupModalStageRef.current
        ? null
        : resolveInlineCompositionSurfacePoint({
            clientX,
            clientY,
            clampToBounds,
          }),
    paintMode: selectedInpaintMode,
    selectionMode: selectedInpaintSelectionTab,
    strokeSize: inpaintStrokeSize,
    onAutoToolAttempt: () => showStatusToast("Auto select is coming soon."),
    onPaintAttemptWithoutImage: () => showStatusToast("Select a layer image before drawing."),
  });

  const shouldShowInpaintBrushReticle =
    isInpaintToolSelected &&
    selectedInpaintMode === "brush" &&
    Boolean(selectedLayerImageUrl) &&
    imageHasInteractiveMask;
  const shouldShowInpaintLassoCursor =
    isInpaintToolSelected &&
    selectedInpaintMode === "lasso" &&
    Boolean(selectedLayerImageUrl) &&
    imageHasInteractiveMask;
  const shouldShowMarkupBrushReticle = isMarkupToolSelected && hasPrimaryCompositePreview;
  const morePresetsSurfaceId = React.useId();
  const activeStageViewportSize = React.useMemo(() => {
    if (isMarkupExpandSelected && isResolvedStageViewportSize(markupModalViewportSize)) {
      return markupModalViewportSize;
    }
    return inlineCompositionSurfaceViewportSize;
  }, [inlineCompositionSurfaceViewportSize, isMarkupExpandSelected, markupModalViewportSize]);
  const isStageViewportAtDefaultForSubmit = React.useMemo(
    () =>
      Math.abs(stageViewport.scale - 1) <= EXPERT_EDIT_SUBMIT_VIEWPORT_EPSILON &&
      Math.abs(stageViewport.offsetXRatio) <= EXPERT_EDIT_SUBMIT_VIEWPORT_EPSILON &&
      Math.abs(stageViewport.offsetYRatio) <= EXPERT_EDIT_SUBMIT_VIEWPORT_EPSILON,
    [stageViewport]
  );

  const resolveStageFlattenSnapshot = React.useCallback(() => {
    const cameraViewportWidth = Math.max(1, activeStageViewportSize.width);
    const cameraViewportHeight = Math.max(1, activeStageViewportSize.height);
    return {
      outputAspectRatio: primaryCompositionSurfaceAspectRatioValue,
      camera: {
        scale: stageViewport.scale,
        offsetX: stageViewport.offsetXRatio * cameraViewportWidth,
        offsetY: stageViewport.offsetYRatio * cameraViewportHeight,
        viewportWidth: cameraViewportWidth,
        viewportHeight: cameraViewportHeight,
      },
      canReusePrimarySourceUrl: isStageViewportAtDefaultForSubmit,
    };
  }, [
    activeStageViewportSize.height,
    activeStageViewportSize.width,
    isStageViewportAtDefaultForSubmit,
    primaryCompositionSurfaceAspectRatioValue,
    stageViewport.offsetXRatio,
    stageViewport.offsetYRatio,
    stageViewport.scale,
  ]);
  const {
    isFlattenPending,
    removeBackgroundPendingLayerId,
    removeBackgroundPendingSourceUrlRef,
    clearRemoveBackgroundPending,
    handleManualFlatten,
    handleRemoveBackground,
  } = useExpertEditLayerActions({
    layers,
    foundationLayerId,
    selectedLayer,
    selectedLayerImageUrl,
    populatedLayerCount,
    createLayer,
    layerIdCounterRef,
    setLayers,
    setSelectedLayerIndex,
    clearLayerEditing,
    onAddSessionMediaReference,
    onRegenerateWithReferenceInputs,
    showStatusToast,
    resolveStageFlattenSnapshot,
  });
  const isRemoveBackgroundPending = removeBackgroundPendingLayerId != null;

  const reusablePrimarySourceUrl = React.useMemo(() => {
    if (populatedLayerCount !== 1) return null;
    if (!isStageViewportAtDefaultForSubmit) return null;
    const primaryLayer = layers.find((layer) => layerHasImage(layer)) ?? null;
    const primaryUrl = primaryLayer?.imageUrl?.trim() ?? "";
    if (!primaryLayer || !primaryUrl) return null;
    if (primaryLayer.ownsImageUrl || needsImageUpload(primaryUrl)) return null;
    if (!areLayerTransformsEqual(primaryLayer.transform, defaultLayerTransform())) return null;
    const primaryAspectRatio = resolveLayerImageAspectRatio(primaryLayer);
    if (Math.abs(primaryCompositionSurfaceAspectRatioValue - primaryAspectRatio) > 0.01) {
      return null;
    }
    return primaryUrl;
  }, [
    isStageViewportAtDefaultForSubmit,
    layers,
    populatedLayerCount,
    primaryCompositionSurfaceAspectRatioValue,
    resolveLayerImageAspectRatio,
  ]);

  const { handleInlineGenerate, isInlineGeneratePending } = useExpertEditInlineGenerate({
    layers,
    promptText: promptTextValue,
    extraImageUrls,
    reusablePrimarySourceUrl,
    markupStrokes,
    populatedLayerCount,
    editSubmitIntent: effectiveEditSubmitIntent,
    hasSelectedLayerMask,
    exportSelectedLayerMaskBlob,
    onRegenerate,
    onRegenerateWithReferenceInputs,
    resolveVariantCostCredits,
    scheduleTransientObjectUrlRevoke,
    revokeObjectUrlSafe,
    resolveBlobDimensions,
    showStatusToast,
    onInvalidPromptReferenceToken: handleInvalidPromptReferenceToken,
    resolveStageFlattenSnapshot,
    insertOptimisticGenerationPlaceholder,
    removeOptimisticGenerationPlaceholder,
    notifyGenerationFailure,
  });
  const resolvedInlineGenerateBusy = isGenerateBusy || isInlineGeneratePending;
  const inlineGenerateDisabled = isGenerateDisabled || populatedLayerCount <= 0 || !hasPromptText;
  const isPrimaryStageBusy =
    isFlattenPending ||
    isRemoveBackgroundPending ||
    isPrimaryStageGenerating ||
    isInlineGeneratePending;

  const handleSecondaryPromptTokenDragStart = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      if (!extraImageUrls[index]) {
        event.preventDefault();
        return;
      }
      const token = setExpertEditPromptTokenDragData(event.dataTransfer, index);
      if (!token) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "copy";
    },
    [extraImageUrls]
  );

  const stageViewportCursor = React.useMemo(() => {
    if (isMarkupPanDragging) return "grabbing";
    if (isMarkupPanSpacePressed) return "grab";
    return undefined;
  }, [isMarkupPanDragging, isMarkupPanSpacePressed]);

  const {
    handleMoveZoomSliderChange,
    resetStageViewport,
    beginMarkupPanGesture,
    continueMarkupPanGesture,
    endMarkupPanGesture,
    endMarkupPanGestureOnLeave,
    handleStageViewportWheel,
  } = useExpertEditStageViewportController({
    markupViewport: stageViewport,
    shouldApplyMarkupViewport: true,
    isMarkupPanSpacePressed,
    markupPanPointerSessionRef,
    setMoveStageZoomSliderValue,
    setMarkupViewport: setStageViewport,
    setIsMarkupPanDragging,
    setInlineStageViewportSize,
    setMarkupModalViewportSize,
    resolveStageRect: (scope, currentTarget) => {
      if (scope === "inline") {
        return resolveInlineStageRect(currentTarget);
      }
      return currentTarget.getBoundingClientRect();
    },
    resolveContentFrameSize: (scope, _currentTarget, viewportSize) => {
      if (scope === "inline") {
        return inlineCompositionSurfaceViewportSize;
      }
      return viewportSize;
    },
    resolvePreferredViewportClampOptions: () => {
      if (isMarkupExpandSelected) {
        return {
          viewportSize: markupModalViewportSize,
          contentFrameSize: markupModalViewportSize,
        };
      }
      const inlineStageRect = resolveInlineStageRect();
      return {
        viewportSize: inlineStageRect
          ? {
              width: Math.max(1, inlineStageRect.width),
              height: Math.max(1, inlineStageRect.height),
            }
          : inlineCompositionSurfaceViewportSize,
        contentFrameSize: inlineCompositionSurfaceViewportSize,
      };
    },
  });

  const inlineBackdropPanHandlers = React.useMemo(
    () => ({
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
        if (
          isClientPointInsideElementBounds({
            element: primaryCanvasFrameStackElement,
            clientX: event.clientX,
            clientY: event.clientY,
          })
        ) {
          return;
        }
        beginMarkupPanGesture(event, "inline", {
          allowPrimaryPanWithoutModifier: true,
        });
      },
      onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
        continueMarkupPanGesture(event);
      },
      onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
        endMarkupPanGesture(event);
      },
      onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => {
        endMarkupPanGesture(event);
      },
      onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => {
        endMarkupPanGestureOnLeave(event);
      },
    }),
    [
      beginMarkupPanGesture,
      continueMarkupPanGesture,
      endMarkupPanGesture,
      endMarkupPanGestureOnLeave,
      primaryCanvasFrameStackElement,
    ]
  );

  const {
    activeStageRenderScale,
    clearTransformPointerSession,
    commitTransformHistoryTransition,
    endTransformPointerSession,
    handleMovePointerDown,
    handleMovePointerMove,
    handleMovePointerLeave,
    handleRecenterMoveAction,
    markupModalStageStyle,
    primaryCompositionSurfaceStyle,
    emptyPrimaryCompositionSurfaceStyle,
    queuePendingHistoryApplyEntry,
    renderSelectedLayerTransformOverlay,
    resolveRenderableLayerTransform,
  } = useExpertEditStageTransformRuntime({
    layers,
    setLayers,
    selectedLayer,
    selectedLayerImageUrl,
    selectedLayerHasRenderableImage,
    hasPrimaryCompositePreview,
    isMoveToolSelected,
    isMorePresetsSurfaceOpen,
    isMarkupToolSelected,
    stageViewport,
    stageViewportCursor,
    markupModalStageSize,
    primaryCompositionSurfaceAspectRatio,
    shouldShowInpaintBrushReticle,
    shouldShowInpaintLassoCursor,
    shouldShowMarkupBrushReticle,
    inpaintStrokeSize,
    resolvedMarkupStrokeSize,
    maxMarkupStrokeSize: MARKUP_STROKE_SIZE_MAX,
    transformHistoryLimit: TRANSFORM_HISTORY_LIMIT,
    resolveLayerImageAspectRatio,
    resolveViewportOffsetPixels: resolveInteractionViewportOffsetPixels,
    showStatusToast,
    transformHistoryState,
    setTransformHistoryState,
    resetStageViewport,
  });

  const {
    inpaintHistoryState,
    beginInpaintGestureHistory,
    finalizeInpaintGestureHistory,
    clearInpaintSelectionWithHistory,
    invertInpaintSelectionWithHistory,
    beginMarkupGestureHistory,
    finalizeMarkupGestureHistory,
    clearMarkupStrokesWithHistory,
    canUndoGeneralAction,
    canRedoGeneralAction,
    handleUndoGeneralAction,
    handleRedoGeneralAction,
    handleResetGeneralAction,
    isMoveTransformCentered,
    isStageViewportAtRest,
    isGeneralResetDisabled,
    clearHistoryEphemera,
  } = useExpertEditStageHistory({
    initialMarkupHistoryState: initialSessionState.markupHistory,
    initialInpaintHistoryState: initialSessionState.inpaintHistory,
    initialInpaintPresentSnapshot: initialSessionState.inpaintHistory.present,
    layers,
    selectedLayer,
    setLayers,
    markupStrokes,
    setMarkupStrokes,
    hasPrimaryCompositePreview,
    inpaintLayerSources,
    stageViewport,
    resetStageViewport,
    captureInpaintMaskSnapshot,
    restoreInpaintMaskSnapshot,
    clearSelectedLayerMask,
    invertSelectedLayerMask,
    clearAllInpaintMasks,
    isInpaintToolSelected,
    isMarkupToolSelected,
    queuePendingHistoryApplyEntry,
    transformHistoryState,
    setTransformHistoryState,
    commitTransformHistoryTransition,
  });

  const {
    stageContextMenuState,
    shouldRenderInlineInteractiveStage,
    openMarkupModal,
    closeMarkupModal,
    handleInlineStagePointerDownCapture,
    handleInlineStagePointerMoveCapture,
    handleInlineStagePointerUpCapture,
    handleInlineStagePointerCancelCapture,
    handlePrimaryDropzoneContextMenu,
    handlePrimaryDropzoneClick,
    handlePrimaryDropzoneDoubleClick,
    handleStageContextMenuResetView,
    handleStageContextMenuExpand,
    handleStageContextMenuAddImage,
    handleStageContextMenuReset,
    handleStageContextMenuRemoveImage,
    handleMarkupModalDragShield,
    handleMarkupModalRootDragCapture,
  } = useExpertEditStageChrome({
    hasPrimaryCompositePreview,
    isMarkupExpandSelected,
    isMorePresetsSurfaceOpen,
    isMoveToolSelected,
    selectedRailTool,
    shouldOpenMarkupModalFromCollapsedTools,
    beginMarkupPanGesture,
    continueMarkupPanGesture,
    endMarkupPanGesture,
    handleRecenterMoveAction,
    handleResetGeneralAction,
    handleRemoveSelectedLayerImage,
    setSelectedRailTool,
    setIsMarkupExpandSelected,
    setIsInpaintCollapsed,
    setIsInpaintCollapsing,
    primaryInputRef,
    stageContextMenuRef,
    markupModalRef,
    inpaintCollapseTimerRef,
  });

  const { markupColor, renderMarkupControlsContent, selectedMarkupMode } =
    useExpertEditMarkupControlsRuntime({
      isMarkupToolSelected,
      isMarkupExpandSelected,
      resolvedMarkupStrokeSize,
      clearMarkupStrokesWithHistory,
      closeMarkupModal,
      openMarkupModal,
      setSelectedRailTool,
      setMarkupStrokeSize,
    });

  const {
    beginMarkupDrawGesture,
    continueMarkupDrawGesture,
    endMarkupDrawGesture,
    endMarkupDrawGestureOnLeave,
    clearMarkupDrawGestureSession,
  } = useExpertEditMarkupDrawController({
    isMarkupToolSelected,
    hasPrimaryCompositePreview,
    selectedMarkupMode,
    resolvedMarkupStrokeSize,
    maxMarkupStrokeSize: MARKUP_STROKE_SIZE_MAX,
    renderScale: activeStageRenderScale,
    markupColor,
    markupViewport: stageViewport,
    shouldApplyMarkupViewport: true,
    resolveClientPointToSurfacePoint: ({ clientX, clientY, currentTarget, clampToBounds }) =>
      currentTarget === markupModalStageRef.current
        ? null
        : resolveInlineCompositionScenePoint({
            clientX,
            clientY,
            clampToBounds,
          }),
    markupStrokeIdCounterRef,
    markupDrawPointerSessionRef,
    setMarkupStrokes,
    beginMarkupGestureHistory,
    finalizeMarkupGestureHistory,
    lockGlobalCursor,
    unlockGlobalCursor,
    showStatusToast,
  });

  const {
    handleInpaintStagePointerDown,
    handleInpaintStagePointerMove,
    handleInpaintStagePointerUp,
    handleInpaintStagePointerCancel,
    handleInpaintStagePointerLeave,
  } = useExpertEditInpaintStageRuntime({
    shouldShowInpaintBrushReticle,
    inpaintStrokeSize,
    activeStageRenderScale,
    lockGlobalCursor,
    unlockGlobalCursor,
    beginInpaintGestureHistory,
    finalizeInpaintGestureHistory,
    handleInpaintPointerDown,
    handleInpaintPointerMove,
    handleInpaintPointerUp,
    handleInpaintPointerCancel,
    handleInpaintPointerLeave,
  });

  const {
    inlineStageInteractionRouter,
    modalStageInteractionRouter,
    handleMarkupStageMiddleClickSuppress,
  } = useExpertEditPanelStageInteractions({
    activeStageInteractionMode,
    isMorePresetsSurfaceOpen,
    transformEditingEnabled: EXPERT_EDIT_IMAGE_TRANSFORM_EDITING_ENABLED,
    beginMarkupPanGesture,
    continueMarkupPanGesture,
    endMarkupPanGesture,
    endMarkupPanGestureOnLeave,
    handleStageViewportWheel,
    handleMovePointerDown,
    handleMovePointerMove,
    handleMovePointerLeave,
    endTransformPointerSession,
    beginMarkupDrawGesture,
    continueMarkupDrawGesture,
    endMarkupDrawGesture,
    endMarkupDrawGestureOnLeave,
    handleInpaintStagePointerDown,
    handleInpaintStagePointerMove,
    handleInpaintStagePointerUp,
    handleInpaintStagePointerCancel,
    handleInpaintStagePointerLeave,
  });
  const closeMorePresetsSurface = React.useCallback(() => {
    setIsMorePresetsSurfaceOpen(false);
    clearPrimaryDragActive();
    resetPresetDropState();
  }, [clearPrimaryDragActive, resetPresetDropState, setIsMorePresetsSurfaceOpen]);
  const handleStylesPanelToggle = React.useCallback(() => {
    onStylesPanelToggle?.();
  }, [onStylesPanelToggle]);

  const { handleInpaintCollapseToggle } = useExpertEditStageLifecycle({
    isMoveToolSelected,
    clearTransformPointerSession,
    isMarkupExpandSelected,
    isMorePresetsSurfaceOpen,
    setIsMarkupPanSpacePressed,
    isMarkupToolSelected,
    clearMarkupDrawGestureSession,
    canUndoGeneralAction,
    canRedoGeneralAction,
    handleUndoGeneralAction,
    handleRedoGeneralAction,
    shouldShowInpaintBrushReticle,
    unlockGlobalCursor,
    queuePendingHistoryApplyEntry,
    clearHistoryEphemera,
    inpaintCollapseTimerRef,
    toastVisibleTimerRef,
    toastFadeTimerRef,
    transientRevokeTimersRef,
    revokeObjectUrlSafe,
    isInpaintCollapsed,
    shouldOpenMarkupModalFromCollapsedTools,
    openMarkupModal,
    setIsInpaintCollapsed,
    setIsInpaintCollapsing,
  });

  const {
    isInpaintLikeToolSelected,
    shouldHideSelectedModeRailPanel,
    collapsedToolsThemeClass,
    renderMoveControlsContent,
    renderMarkupModalGeneralPanel,
    renderPresetUtilityActionButtons,
    renderInpaintControlsContent,
  } = useExpertEditPanelControlsRuntime({
    selectedRailTool,
    isGenerationModeToggleEnabled,
    effectiveEditSubmitIntent,
    moveStageZoomSliderValue,
    isMoveTransformCentered,
    isStageViewportAtRest,
    canUndoGeneralAction,
    canRedoGeneralAction,
    isGeneralResetDisabled,
    aspect,
    aspectOptionsForModel,
    onAspectChange,
    setSelectedRailTool,
    handleRecenterMoveAction,
    openMarkupModal,
    handleMoveZoomSliderChange,
    handleUndoGeneralAction,
    handleRedoGeneralAction,
    handleResetGeneralAction,
    selectedInpaintMode,
    inpaintStrokeSize,
    selectedInpaintSelectionTab,
    imageHasInteractiveMask,
    setSelectedInpaintMode,
    setInpaintStrokeSize,
    setSelectedInpaintSelectionTab,
    clearInpaintSelectionWithHistory,
    invertInpaintSelectionWithHistory,
    isGenerateDisabled,
    selectedLayerImageUrl,
    handleCompositeRegeneratePromptInsert,
  });

  const {
    inlineBackdropPanHandlers: inlineStageBackdropPanHandlers,
    inlineStageWheelHandler,
    inlineInteractionHandlers,
    inlineSceneContent,
    inlineTransformOverlay,
    inlinePostStageTools,
    modalSurface,
  } = useExpertEditStageWorkspaceRuntime({
    layers,
    markupStrokes,
    overlayCanvasRef,
    previewCanvasRef,
    modalOverlayCanvasRef,
    modalPreviewCanvasRef,
    inlineCompositionSurfaceViewportSize,
    primaryCanvasFrameStackElement,
    resolveLayerImageAspectRatio,
    resolveRenderableLayerTransform,
    isFlattenPending,
    isRemoveBackgroundPending,
    isPrimaryStageGenerating,
    renderSelectedLayerTransformOverlay,
    inlineStageInteractionRouter,
    inlineBackdropPanHandlers,
    modalStageInteractionRouter,
    isInpaintCollapsed,
    isInpaintCollapsing,
    collapsedToolsThemeClass,
    selectedRailTool,
    isInpaintToolSelected,
    isMarkupToolSelected,
    isMoveToolSelected,
    isInpaintLikeToolSelected,
    setSelectedRailTool,
    handleInpaintCollapseToggle,
    renderInpaintControlsContent,
    renderMarkupControlsContent,
    renderMoveControlsContent,
    shouldShowSecondaryReferenceAndStylesRow,
    extraImageUrls,
    inputRefs,
    extraDragActive,
    promptTokenPickerIsOpen: promptTokenPickerState.isOpen,
    highlightPromptPickerSecondaryTargets:
      !isInpaintSubmitMode || inpaintPromptReferencePolicy.allowSecondaryReferenceTokens,
    promptTokenPickerSelectedSlotIndex: promptTokenPickerState.selectedSlotIndex,
    allowPromptTokenSecondaryDrag:
      !isInpaintSubmitMode || inpaintPromptReferencePolicy.allowSecondaryReferenceTokens,
    handleSecondaryPromptTokenDragStart,
    handleExtraDrop,
    handleExtraDragEnter,
    handleExtraDragOver,
    handleExtraDragLeave,
    onExtraImageChange,
    isStylesPanelOpen,
    selectedStyleId,
    stylesCatalog,
    handleStylesPanelToggle,
    isMarkupExpandSelected,
    handleMarkupModalRef,
    handleMarkupModalControlsRef,
    handleMarkupModalStageRef,
    markupModalStageStyle,
    renderMarkupModalGeneralPanel,
    modalStageViewportStyle,
    markupModalViewportSize,
    markupModalStageElement,
    editingLayerIndex,
    editingLayerValue,
    draggingLayerIndex,
    dragOverLayerIndex,
    resolvedSelectedLayerIndex,
    isGenerateDisabled,
    selectedLayerImageUrl,
    populatedLayerCount,
    setEditingLayerValue,
    handleCommitLayerRename,
    clearLayerEditing,
    beginLayerRename,
    handleLayerDragStart,
    handleLayerDragOver,
    handleLayerDrop,
    handleLayerDragEnd,
    handleSelectLayer,
    handleDeleteLayer,
    handleManualFlatten,
    handleRemoveBackground,
    closeMarkupModal,
    handleMarkupModalLayersRef,
    handleMarkupModalDragShield,
  });

  const { promptAndSelectors, auxiliary } = useExpertEditPanelComposerRuntime({
    isPromptComposerExpanded,
    promptInputShellRef,
    promptHighlightRef,
    promptTextareaRef,
    promptHighlightSegments,
    promptTextValue,
    handlePromptTextChange,
    handlePromptFocus,
    handlePromptKeyDown,
    handlePromptDropWithTokenInsert,
    handlePromptScroll,
    handlePromptBlur,
    promptTokenPickerState,
    hostPrimaryImageUrl,
    populatedPromptTokenSlotIndexes,
    extraImageUrls,
    insertPromptTokenFromPicker,
    promptTokenInlineError,
    handleInlineGenerate,
    inlineGenerateDisabled,
    resolvedInlineGenerateBusy,
    costCredits,
    inlineGuardrailReason,
    effectiveSelectorModelId,
    isModelPickerLocked,
    isModelModalOpen,
    modelModalAnchor,
    effectiveModelPickerLogoSrc,
    effectiveModelPickerLabel,
    onModelPickerOpen,
    aspect,
    onAspectChange,
    aspectOptionsForModel,
    shouldShowResolutionControl,
    imageResolutionValue,
    imageResolutionOptions,
    onImageResolutionChange,
    statusToastMessage,
    statusToastTone,
    isStatusToastFading,
    primaryInputRef,
    extraOneInputRef,
    extraTwoInputRef,
    extraThreeInputRef,
    handlePrimaryFileSelection,
    handleFileSelection,
    onExtraImageChange,
    isCharacterPickerOpen,
    characterModeEnabled,
    isCharacterOptionsLoading,
    closeCharacterPicker,
    characterOptions,
    selectedCharacterId,
    onSelectedCharacterIdChange,
    refreshCharacterOptions,
    resolveCharacterAvatarUrlById,
  });

  const { sidebar, contextMenu } = useExpertEditPanelShellRuntime({
    isGenerationModeToggleEnabled,
    generationModeTabsStyle,
    effectiveEditSubmitIntent,
    visibleEditGenerationModeOptions,
    handleGenerationModeChange,
    shouldHideSelectedModeRailPanel,
    selectedRailTool,
    renderInpaintControlsContent,
    renderMarkupControlsContent,
    renderMoveControlsContent,
    hasSelectedPresetIds,
    selectedPanelPresets,
    isPresetPanelDropActive,
    isMorePresetsSurfaceOpen,
    morePresetsSurfaceId,
    setIsMorePresetsSurfaceOpen,
    handlePanelPresetApply,
    handlePanelPresetDragStart,
    handlePresetDragEnd,
    handlePresetPanelDragOver,
    handlePresetPanelDragLeave,
    handlePresetPanelDrop,
    toggleMorePresetsSurface,
    layers,
    editingLayerIndex,
    editingLayerValue,
    draggingLayerIndex,
    dragOverLayerIndex,
    resolvedSelectedLayerIndex,
    isGenerateDisabled,
    selectedLayerImageUrl,
    isRemoveBackgroundPending,
    populatedLayerCount,
    isFlattenPending,
    setEditingLayerValue,
    handleCommitLayerRename,
    clearLayerEditing,
    beginLayerRename,
    handleLayerDragStart,
    handleLayerDragOver,
    handleLayerDrop,
    handleLayerDragEnd,
    handleSelectLayer,
    handleDeleteLayer,
    handleManualFlatten,
    handleRemoveBackground,
    renderPresetUtilityActionButtons,
    availablePresets,
    closeMorePresetsSurface,
    handleSurfacePresetDragStart,
    handlePresetsSurfaceDragOver,
    handlePresetsSurfaceDragLeave,
    handlePresetsSurfaceDrop,
    handleCustomPresetSave,
    isPresetsSurfaceDropActive,
    onOpenPresetsLibrary,
    stageContextMenuState,
    stageContextMenuRef,
    isMarkupExpandSelected,
    handleStageContextMenuResetView,
    handleStageContextMenuExpand,
    handleStageContextMenuAddImage,
    handleStageContextMenuReset,
    handleStageContextMenuRemoveImage,
  });

  const stageWorkspaceProps = useExpertEditStageWorkspacePropsRuntime({
    sidebar,
    hasPrimaryCompositePreview,
    selectedLayerName: selectedLayer?.name ?? null,
    onDeleteSelectedLayer: handleDeleteSelectedLayer,
    isPrimaryStageBusy,
    onInlineStagePointerDownCapture: handleInlineStagePointerDownCapture,
    onInlineStagePointerMoveCapture: handleInlineStagePointerMoveCapture,
    onInlineStagePointerUpCapture: handleInlineStagePointerUpCapture,
    onInlineStagePointerCancelCapture: handleInlineStagePointerCancelCapture,
    inlineViewportStyle: inlineStageViewportStyle,
    inlineStageRef: inlineStageWrapperRef,
    frameStackRef: handlePrimaryCanvasFrameStackRef,
    isPrimaryDragActive: primaryDragActive,
    frameStyle: primaryCanvasFrameBoundsStyle,
    onPrimaryDrop: handlePrimaryDrop,
    onPrimaryDragEnter: handlePrimaryDragEnter,
    onPrimaryDragOver: handlePrimaryDragOver,
    onPrimaryDragLeave: handlePrimaryDragLeave,
    primarySurfaceRef: primaryCompositionSurfaceRef,
    isMorePresetsSurfaceOpen,
    primarySurfaceStyle: primaryCompositionSurfaceStyle,
    emptyPrimarySurfaceStyle: emptyPrimaryCompositionSurfaceStyle,
    shouldRenderInlineInteractiveStage,
    inlineBackdropPanHandlers: inlineStageBackdropPanHandlers,
    inlineInteractionHandlers,
    onInlineStageWheel: inlineStageWheelHandler,
    onStageMouseDown: handleMarkupStageMiddleClickSuppress,
    onStageAuxClick: handleMarkupStageMiddleClickSuppress,
    onStageContextMenu: handlePrimaryDropzoneContextMenu,
    onStageClick: handlePrimaryDropzoneClick,
    onStageDoubleClick: handlePrimaryDropzoneDoubleClick,
    inlineSceneContent,
    inlineTransformOverlay,
    inlinePostStageTools,
    promptAndSelectors,
    shouldBlurPromptUnderlay,
    statusToast: null,
    modalSurface,
    contextMenu,
  });

  useExpertEditSessionBridge({
    initialReferenceImageUrl: referenceImageUrl,
    foundationLayerId,
    selectedLayerIndex,
    layers,
    markupStrokes,
    inpaintSnapshot: inpaintHistoryState.present,
    referenceImageUrl,
    hostPrimaryImageUrl,
    removeBackgroundPendingLayerId,
    layerIdCounterRef,
    removeBackgroundPendingSourceUrlRef,
    setLayers,
    clearRemoveBackgroundPending,
    onPrimaryImageChange,
    onSessionStateChange,
    revokeObjectUrlSafe,
  });

  return (
    <div
      className={`tool-properties edit-expert-panel ${
        isMarkupExpandSelected ? "is-markup-modal-open" : ""
      }`.trim()}
      role="group"
      aria-label="Expert edit composer"
      onDragEnterCapture={handleMarkupModalRootDragCapture}
      onDragOverCapture={handleMarkupModalRootDragCapture}
      onDropCapture={handleMarkupModalRootDragCapture}
    >
      <ExpertEditStageWorkspace {...stageWorkspaceProps} />
      {auxiliary}
    </div>
  );
}
