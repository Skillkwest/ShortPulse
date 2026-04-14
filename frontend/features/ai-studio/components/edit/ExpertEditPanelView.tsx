import React from "react";
import { modelLogos } from "../../constants";
import { stripEditLabel } from "../../utils/modelLabels";
import { setExpertEditPromptTokenDragData } from "../../logic/expertEditPromptReferences";
import {
  INPAINT_FLUX_FILL_MODEL_LABEL,
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_LABEL,
  isEditGenerationModeToggleEnabled,
  isMarkupCollapsedOpenModalEnabled,
  isMarkupModelLockEnabled,
} from "../../logic/inpaintSubmission";
import { useReferencePropertiesConstraintEffects } from "../useReferencePropertiesConstraintEffects";
import { useReferencePropertiesDerivedState } from "../useReferencePropertiesDerivedState";
import { useReferencePropertiesInteractions } from "../useReferencePropertiesInteractions";
import { useCreateCharacterModeController } from "../create/useCreateCharacterModeController";
import { useInpaintMaskController } from "./useInpaintMaskController";
import {
  createIdleMarkupDrawPointerSession,
  type MarkupDrawPointerSession,
  type MarkupStroke,
} from "./markupStrokeController";
import { useExpertEditInlineGenerate } from "./useExpertEditInlineGenerate";
import { useExpertEditDocumentState } from "./useExpertEditDocumentState";
import { useExpertEditLayerActions } from "./useExpertEditLayerActions";
import { useExpertEditPromptTokenController } from "./useExpertEditPromptTokenController";
import { useExpertEditGenerationPresetRuntime } from "./useExpertEditGenerationPresetRuntime";
import { useExpertEditSessionBridge } from "./useExpertEditSessionBridge";
import { useExpertEditMarkupControlsRuntime } from "./useExpertEditMarkupControlsRuntime";
import { useExpertEditPresetRuntime } from "./useExpertEditPresetRuntime";
import { useExpertEditStageChrome } from "./useExpertEditStageChrome";
import { useExpertEditStageHistory } from "./useExpertEditStageHistory";
import { useExpertEditStageInteractions } from "./useExpertEditStageInteractions";
import { useExpertEditStageLifecycle } from "./useExpertEditStageLifecycle";
import { useExpertEditStageControlPanels } from "./useExpertEditStageControlPanels";
import { useExpertEditStageTransformRuntime } from "./useExpertEditStageTransformRuntime";
import { useExpertEditStageViewport } from "./useExpertEditStageViewport";
import { ExpertEditPanelAuxiliary } from "./ExpertEditPanelAuxiliary";
import { ExpertEditStageSidebar } from "./ExpertEditStageSidebar";
import { ExpertEditStageWorkspace } from "./ExpertEditStageWorkspace";
import { useExpertEditMarkupDrawController } from "./useExpertEditMarkupDrawController";
import { useExpertEditMarkupViewportController } from "./useExpertEditMarkupViewportController";
import { ExpertEditInlinePostStageTools } from "./ExpertEditInlinePostStageTools";
import { ExpertEditLayersPanel } from "./ExpertEditLayersPanel";
import { ExpertEditStageScene } from "./ExpertEditStageScene";
import { ExpertEditSecondaryReferences } from "./ExpertEditReferenceControls";
import { ExpertEditPromptSelectorsColumn } from "./ExpertEditPromptSelectorsColumn";
import {
  COMPOSITE_REGENERATE_COHESION_PROMPT,
  INPAINT_STROKE_SIZE_DEFAULT,
  LOCKED_EDIT_TOOL_MODEL_LOGO_SRC,
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
import { buildInpaintBrushReticleCursor } from "./expertEditCursorUtils";
import {
  clearWindowTimeoutRef,
  lockDocumentCursor,
  runPointerStageTerminalAction,
  scheduleTransientObjectUrlRevoke as scheduleTransientObjectUrlRevokeTimer,
  unlockDocumentCursor,
} from "./expertEditInteractionUtils";
import { cloneMarkupStrokesSnapshot } from "./expertEditSessionState";
const EXPERT_EDIT_IMAGE_TRANSFORM_EDITING_ENABLED = true;

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
  isStylesPanelOpen = false,
  onStylesPanelToggle,
  selectedStyleId: controlledSelectedStyleId,
  stylesCatalog,
  sessionState,
  onSessionStateChange,
}: ExpertEditPanelViewProps) {
  const [initialSessionState] = React.useState(() =>
    resolveInitialExpertEditSessionState({
      referenceImageUrl,
      sessionState,
    })
  );
  const inpaintCollapseTimerRef = React.useRef<number | null>(null);
  const toastVisibleTimerRef = React.useRef<number | null>(null);
  const toastFadeTimerRef = React.useRef<number | null>(null);
  const transientRevokeTimersRef = React.useRef<Map<string, number>>(new Map());
  const globalCursorLockRef = React.useRef<{
    active: boolean;
    bodyCursor: string;
    htmlCursor: string;
  }>({
    active: false,
    bodyCursor: "",
    htmlCursor: "",
  });
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
  });
  const [statusToastMessage, setStatusToastMessage] = React.useState<string | null>(null);
  const [statusToastTone, setStatusToastTone] = React.useState<"info" | "warning">("info");
  const [isStatusToastFading, setIsStatusToastFading] = React.useState(false);
  const showStatusToast = React.useCallback(
    (message: string, tone: "info" | "warning" = "info") => {
      clearWindowTimeoutRef(toastVisibleTimerRef);
      clearWindowTimeoutRef(toastFadeTimerRef);
      setStatusToastMessage(message);
      setStatusToastTone(tone);
      setIsStatusToastFading(false);
      toastVisibleTimerRef.current = window.setTimeout(() => {
        setIsStatusToastFading(true);
        toastFadeTimerRef.current = window.setTimeout(() => {
          setStatusToastMessage(null);
          setIsStatusToastFading(false);
          toastFadeTimerRef.current = null;
        }, STATUS_TOAST_FADE_MS);
        toastVisibleTimerRef.current = null;
      }, STATUS_TOAST_VISIBLE_MS);
    },
    []
  );
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
    markupViewport,
    setMarkupViewport,
    setInlineStageViewportSize,
    markupModalStageSize,
    markupModalViewportSize,
    setMarkupModalViewportSize,
    moveStageZoomSliderValue,
    setMoveStageZoomSliderValue,
    primaryCompositionSurfaceAspectRatio,
    primaryCompositionSurfaceAspectRatioValue,
    inlineMarkupViewportStyle,
    inlineCompositionSurfaceViewportSize,
    modalMarkupViewportStyle,
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
  const isVideoToolSelected = selectedRailTool === "video";
  const isInpaintSubmitMode = effectiveEditSubmitIntent === "inpaint";
  const isMarkupSubmitMode = effectiveEditSubmitIntent === "markup";
  const shouldShowSecondaryReferenceAndStylesRow = !isMarkupSubmitMode;
  const shouldHideSelectedModeRailPanel =
    isGenerationModeToggleEnabled && effectiveEditSubmitIntent === "standard";
  const isInpaintLikeToolSelected = isInpaintToolSelected || isVideoToolSelected;
  const isMoveToolSelected = selectedRailTool === "move";
  const activeStageInteractionMode = isMoveToolSelected
    ? "move"
    : isInpaintToolSelected
      ? "inpaint"
      : "markup";
  const shouldLockMarkupModelPicker = isMarkupSubmitMode && isMarkupModelLockEnabled();
  const shouldOpenMarkupModalFromCollapsedTools = isMarkupCollapsedOpenModalEnabled();
  const isModelPickerLocked = isInpaintSubmitMode || shouldLockMarkupModelPicker;
  const effectiveModelPickerLabel = isInpaintSubmitMode
    ? INPAINT_FLUX_FILL_MODEL_LABEL
    : shouldLockMarkupModelPicker
      ? MARKUP_NANO_BANANA_PRO_EDIT_MODEL_LABEL
      : stripEditLabel(modelLabel);
  const effectiveModelPickerLogoSrc = isModelPickerLocked
    ? LOCKED_EDIT_TOOL_MODEL_LOGO_SRC
    : modelLogoSrc;
  const collapsedToolsThemeClass = isMoveToolSelected
    ? "is-active-move"
    : isVideoToolSelected
      ? "is-active-video"
      : "is-active-inpaint";
  const promptTextValue = referenceText ?? "";

  const {
    extraOneInputRef,
    extraTwoInputRef,
    extraThreeInputRef,
    extraDragActive,
    handleFileSelection,
    handleExtraDrop,
    handleExtraDragEnter,
    handleExtraDragOver,
    handleExtraDragLeave,
  } = useReferencePropertiesInteractions({
    referenceImageUrl: selectedLayerImageUrl,
    extraImageUrls,
    onPrimaryImageChange: () => {},
    onExtraImageChange,
    onPromptTextChange,
    resolvePreviewUrlById,
    klingMultiPrompts: [],
    klingElements: [],
  });

  const { imageResolutionValue, imageResolutionOptions, modelConfig, aspectOptionsForModel } =
    useReferencePropertiesDerivedState({
      variant: "image",
      modelId,
      aspectOptions,
      klingMultiPrompts: [],
      klingElements: [],
      klingVoiceIds: ["", ""],
      klingCfgScale: 0.5,
      klingNegativePrompt: "",
      imageResolution,
    });

  useReferencePropertiesConstraintEffects({
    modelConfig,
    videoDurationValue: 6,
    videoResolutionValue: "1080p",
    isVideoVariant: false,
    imageResolution,
    imageResolutionValue,
    onImageResolutionChange,
  });
  const { isCharacterPickerOpen, closeCharacterPicker } = useCreateCharacterModeController({
    beginnerMode: false,
    characterModeEnabled,
    characterOptions,
    selectedCharacterId,
    isCharacterOptionsLoading,
    onCharacterModeEnabledChange,
  });

  const inputRefs = [extraOneInputRef, extraTwoInputRef, extraThreeInputRef] as const;
  const shouldShowResolutionControl = imageResolutionOptions.length > 0;
  const hasPromptText = promptTextValue.trim().length > 0;
  const [isPromptComposerExpanded, setIsPromptComposerExpanded] = React.useState(false);
  const inlineGenerateDisabled = isGenerateDisabled || populatedLayerCount <= 0 || !hasPromptText;
  const suppressInlineReferenceGuardrail =
    guardrailReason === "Add a reference image before generating.";
  const inlineGuardrailReason = suppressInlineReferenceGuardrail ? null : guardrailReason;
  const inpaintLayerSources = React.useMemo(
    () => layers.map((layer) => ({ id: layer.id, imageUrl: layer.imageUrl })),
    [layers]
  );
  const {
    promptInputShellRef,
    promptHighlightRef,
    promptTextareaRef,
    promptHighlightSegments,
    promptTokenPickerState,
    promptTokenInlineError,
    populatedPromptTokenSlotIndexes,
    handlePromptTextChange,
    handleInvalidPromptReferenceToken,
    handlePromptKeyDown,
    handlePromptDropWithTokenInsert,
    handlePromptScroll,
    closePromptTokenPicker,
    insertPromptTokenFromPicker,
  } = useExpertEditPromptTokenController({
    promptTextValue,
    extraImageUrls,
    populatedLayerCount,
    isPromptComposerExpanded,
    onPromptTextChange,
    showStatusToast,
  });

  const handlePromptFocus = React.useCallback(() => {
    setIsPromptComposerExpanded(true);
  }, []);

  const handlePromptBlur = React.useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      closePromptTokenPicker();
      if (
        promptInputShellRef.current &&
        event.relatedTarget instanceof Node &&
        promptInputShellRef.current.contains(event.relatedTarget)
      ) {
        return;
      }
      setIsPromptComposerExpanded(false);
    },
    [closePromptTokenPicker, promptInputShellRef]
  );

  React.useEffect(() => {
    if (!onEditSubmitIntentChange) return;
    onEditSubmitIntentChange(effectiveEditSubmitIntent);
  }, [effectiveEditSubmitIntent, onEditSubmitIntentChange]);
  const handleCompositeRegeneratePromptInsert = React.useCallback(() => {
    handlePromptTextChange(COMPOSITE_REGENERATE_COHESION_PROMPT);
  }, [handlePromptTextChange]);
  const {
    isPresetPanelDropActive,
    isPresetsSurfaceDropActive,
    resetPresetDropState,
    handlePanelPresetApply,
    handleCustomPresetSave,
    handleSurfacePresetDragStart,
    handlePanelPresetDragStart,
    handlePresetDragEnd,
    handlePresetPanelDragOver,
    handlePresetPanelDragLeave,
    handlePresetPanelDrop,
    handlePresetsSurfaceDragOver,
    handlePresetsSurfaceDragLeave,
    handlePresetsSurfaceDrop,
  } = useExpertEditPresetRuntime({
    customPresetOverrides,
    updateSelectedPresetIds,
    updateCustomPresetOverrides,
    handlePromptTextChange,
    showStatusToast,
  });

  const {
    overlayCanvasRef,
    modalOverlayCanvasRef,
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
    sceneScale: markupViewport.scale,
    shouldApplyViewportTransform: hasPrimaryCompositePreview,
    viewportOffsetXRatio: markupViewport.offsetXRatio,
    viewportOffsetYRatio: markupViewport.offsetYRatio,
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
  const shouldShowMarkupBrushReticle = isVideoToolSelected && hasPrimaryCompositePreview;
  const morePresetsSurfaceId = React.useId();

  const resolveStageFlattenSnapshot = React.useCallback(() => {
    return {
      outputAspectRatio: primaryCompositionSurfaceAspectRatioValue,
    };
  }, [primaryCompositionSurfaceAspectRatioValue]);
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
  const isPrimaryStageBusy =
    isFlattenPending || isRemoveBackgroundPending || isPrimaryStageGenerating;

  const lockGlobalCursor = React.useCallback((cursor: string) => {
    lockDocumentCursor({
      cursor,
      lockState: globalCursorLockRef.current,
    });
  }, []);

  const unlockGlobalCursor = React.useCallback(() => {
    unlockDocumentCursor(globalCursorLockRef.current);
  }, []);

  const scheduleTransientObjectUrlRevoke = React.useCallback((url: string) => {
    scheduleTransientObjectUrlRevokeTimer({
      url,
      timersByUrl: transientRevokeTimersRef.current,
      revokeDelayMs: TRANSIENT_OBJECT_URL_REVOKE_MS,
      revokeObjectUrl: revokeObjectUrlSafe,
    });
  }, []);

  const reusablePrimarySourceUrl = React.useMemo(() => {
    if (populatedLayerCount !== 1) return null;
    const primaryLayer = layers.find((layer) => layerHasImage(layer)) ?? null;
    const primaryUrl = primaryLayer?.imageUrl?.trim() ?? "";
    if (!primaryLayer || !primaryUrl) return null;
    if (primaryLayer.ownsImageUrl || primaryUrl.startsWith("blob:")) return null;
    if (!primaryUrl.includes("/storage/v1/object/sign/")) return null;
    if (!areLayerTransformsEqual(primaryLayer.transform, defaultLayerTransform())) return null;
    const primaryAspectRatio = resolveLayerImageAspectRatio(primaryLayer);
    if (Math.abs(primaryCompositionSurfaceAspectRatioValue - primaryAspectRatio) > 0.01) {
      return null;
    }
    return primaryUrl;
  }, [
    layers,
    populatedLayerCount,
    primaryCompositionSurfaceAspectRatioValue,
    resolveLayerImageAspectRatio,
  ]);

  const { handleInlineGenerate } = useExpertEditInlineGenerate({
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
    scheduleTransientObjectUrlRevoke,
    revokeObjectUrlSafe,
    resolveBlobDimensions,
    showStatusToast,
    onInvalidPromptReferenceToken: handleInvalidPromptReferenceToken,
    resolveStageFlattenSnapshot,
  });

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

  const markupViewportCursor = React.useMemo(() => {
    if (isMarkupPanDragging) return "grabbing";
    if (isMarkupPanSpacePressed) return "grab";
    return undefined;
  }, [isMarkupPanDragging, isMarkupPanSpacePressed]);

  const noopStageWheel = React.useCallback(() => {}, []);

  const {
    handleMoveZoomSliderChange,
    resetMarkupViewport,
    beginMarkupPanGesture,
    continueMarkupPanGesture,
    endMarkupPanGesture,
    endMarkupPanGestureOnLeave,
    handleMarkupViewportWheel,
    handleNativeMarkupViewportWheel,
  } = useExpertEditMarkupViewportController({
    markupViewport,
    shouldApplyMarkupViewport: true,
    isMarkupPanSpacePressed,
    markupPanPointerSessionRef,
    setMoveStageZoomSliderValue,
    setMarkupViewport,
    setIsMarkupPanDragging,
    setInlineStageViewportSize,
    setMarkupModalViewportSize,
    resolveStageRect: (scope, currentTarget) => {
      if (scope === "inline") {
        return resolveInlineStageRect(currentTarget);
      }
      return currentTarget.getBoundingClientRect();
    },
  });

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
    hasPrimaryCompositePreview,
    isMoveToolSelected,
    isMorePresetsSurfaceOpen,
    isVideoToolSelected,
    markupViewport,
    markupViewportCursor,
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
    resetMarkupViewport,
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
    isMarkupViewportAtRest,
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
    markupViewport,
    resetMarkupViewport,
    captureInpaintMaskSnapshot,
    restoreInpaintMaskSnapshot,
    clearSelectedLayerMask,
    invertSelectedLayerMask,
    clearAllInpaintMasks,
    isInpaintToolSelected,
    isVideoToolSelected,
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
    handleStageContextMenuRecenter,
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
      isVideoToolSelected,
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
    isVideoToolSelected,
    hasPrimaryCompositePreview,
    selectedMarkupMode,
    resolvedMarkupStrokeSize,
    maxMarkupStrokeSize: MARKUP_STROKE_SIZE_MAX,
    renderScale: activeStageRenderScale,
    markupColor,
    markupViewport,
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

  const handleMarkupStageMiddleClickSuppress = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 1) return;
      event.preventDefault();
    },
    []
  );

  const handleInpaintStagePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (shouldShowInpaintBrushReticle) {
        lockGlobalCursor(buildInpaintBrushReticleCursor(inpaintStrokeSize, activeStageRenderScale));
      }
      beginInpaintGestureHistory();
      handleInpaintPointerDown(event);
    },
    [
      activeStageRenderScale,
      beginInpaintGestureHistory,
      handleInpaintPointerDown,
      inpaintStrokeSize,
      lockGlobalCursor,
      shouldShowInpaintBrushReticle,
    ]
  );

  const handleInpaintStagePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      handleInpaintPointerMove(event);
    },
    [handleInpaintPointerMove]
  );

  const handleInpaintStagePointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      runPointerStageTerminalAction({
        event,
        unlockCursor: unlockGlobalCursor,
        handlePointerEvent: handleInpaintPointerUp,
        finalizeGestureHistory: finalizeInpaintGestureHistory,
      });
    },
    [finalizeInpaintGestureHistory, handleInpaintPointerUp, unlockGlobalCursor]
  );

  const handleInpaintStagePointerCancel = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      runPointerStageTerminalAction({
        event,
        unlockCursor: unlockGlobalCursor,
        handlePointerEvent: handleInpaintPointerCancel,
        finalizeGestureHistory: finalizeInpaintGestureHistory,
      });
    },
    [finalizeInpaintGestureHistory, handleInpaintPointerCancel, unlockGlobalCursor]
  );

  const handleInpaintStagePointerLeave = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      runPointerStageTerminalAction({
        event,
        unlockCursor: unlockGlobalCursor,
        handlePointerEvent: handleInpaintPointerLeave,
        finalizeGestureHistory: finalizeInpaintGestureHistory,
      });
    },
    [finalizeInpaintGestureHistory, handleInpaintPointerLeave, unlockGlobalCursor]
  );

  const { inlineStageInteractionRouter, modalStageInteractionRouter } =
    useExpertEditStageInteractions({
      activeStageInteractionMode,
      isMorePresetsSurfaceOpen,
      transformEditingEnabled: EXPERT_EDIT_IMAGE_TRANSFORM_EDITING_ENABLED,
      beginMarkupPanGesture,
      continueMarkupPanGesture,
      endMarkupPanGesture,
      endMarkupPanGestureOnLeave,
      handleMarkupViewportWheel,
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
    isVideoToolSelected,
    clearMarkupDrawGestureSession,
    canUndoGeneralAction,
    canRedoGeneralAction,
    handleUndoGeneralAction,
    handleRedoGeneralAction,
    inlineStageWrapperRef,
    handleNativeMarkupViewportWheel,
    markupModalStageRef,
    markupModalStageSize,
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

  const {
    renderMarkupModalGeneralPanel,
    renderMarkupModalInpaintPanel,
    renderMoveControlsContent,
    renderPresetUtilityActionButtons,
  } = useExpertEditStageControlPanels({
    isMoveToolSelected,
    moveStageZoomSliderValue,
    isMoveTransformCentered,
    isMarkupViewportAtRest,
    canUndoGeneralAction,
    canRedoGeneralAction,
    setSelectedRailTool,
    handleRecenterMoveAction,
    openMarkupModal,
    handleMoveZoomSliderChange,
    handleUndoGeneralAction,
    handleRedoGeneralAction,
    aspect,
    aspectOptionsForModel,
    isGeneralResetDisabled,
    onAspectChange,
    handleResetGeneralAction,
    isGenerateDisabled,
    selectedLayerImageUrl,
    handleCompositeRegeneratePromptInsert,
    selectedInpaintMode,
    isInpaintToolSelected,
    inpaintStrokeSize,
    selectedInpaintSelectionTab,
    imageHasInteractiveMask,
    setSelectedInpaintMode,
    setInpaintStrokeSize,
    setSelectedInpaintSelectionTab,
    clearInpaintSelectionWithHistory,
    invertInpaintSelectionWithHistory,
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
      <ExpertEditStageWorkspace
        sidebar={
          <ExpertEditStageSidebar
            isGenerationModeToggleEnabled={isGenerationModeToggleEnabled}
            generationModeTabsStyle={generationModeTabsStyle}
            effectiveEditSubmitIntent={effectiveEditSubmitIntent}
            editGenerationModeOptions={visibleEditGenerationModeOptions}
            onGenerationModeChange={handleGenerationModeChange}
            shouldHideSelectedModeRailPanel={shouldHideSelectedModeRailPanel}
            selectedRailTool={selectedRailTool}
            renderMarkupModalInpaintPanel={renderMarkupModalInpaintPanel}
            renderMarkupControlsContent={renderMarkupControlsContent}
            renderMoveControlsContent={renderMoveControlsContent}
            hasSelectedPresetIds={hasSelectedPresetIds}
            selectedPanelPresets={selectedPanelPresets}
            isPresetPanelDropActive={isPresetPanelDropActive}
            isMorePresetsSurfaceOpen={isMorePresetsSurfaceOpen}
            morePresetsSurfaceId={morePresetsSurfaceId}
            setIsMorePresetsSurfaceOpen={setIsMorePresetsSurfaceOpen}
            handlePanelPresetApply={handlePanelPresetApply}
            handlePanelPresetDragStart={handlePanelPresetDragStart}
            handlePresetDragEnd={handlePresetDragEnd}
            handlePresetPanelDragOver={handlePresetPanelDragOver}
            handlePresetPanelDragLeave={handlePresetPanelDragLeave}
            handlePresetPanelDrop={handlePresetPanelDrop}
            toggleMorePresetsSurface={toggleMorePresetsSurface}
            layersPanel={
              <ExpertEditLayersPanel
                scope="main"
                placement="sidebar"
                layers={layers}
                editingLayerIndex={editingLayerIndex}
                editingLayerValue={editingLayerValue}
                draggingLayerIndex={draggingLayerIndex}
                dragOverLayerIndex={dragOverLayerIndex}
                resolvedSelectedLayerIndex={resolvedSelectedLayerIndex}
                isGenerateDisabled={isGenerateDisabled}
                selectedLayerImageUrl={selectedLayerImageUrl}
                isRemoveBackgroundPending={isRemoveBackgroundPending}
                populatedLayerCount={populatedLayerCount}
                isFlattenPending={isFlattenPending}
                setEditingLayerValue={setEditingLayerValue}
                onCommitLayerRename={handleCommitLayerRename}
                onClearLayerEditing={clearLayerEditing}
                onBeginLayerRename={beginLayerRename}
                onLayerDragStart={handleLayerDragStart}
                onLayerDragOver={handleLayerDragOver}
                onLayerDrop={handleLayerDrop}
                onLayerDragEnd={handleLayerDragEnd}
                onSelectLayer={handleSelectLayer}
                onDeleteLayer={handleDeleteLayer}
                onFlatten={() => void handleManualFlatten()}
                onRemoveBackground={handleRemoveBackground}
              />
            }
            renderPresetUtilityActionButtons={renderPresetUtilityActionButtons}
            isGenerateDisabled={isGenerateDisabled}
            selectedLayerImageUrl={selectedLayerImageUrl}
            isRemoveBackgroundPending={isRemoveBackgroundPending}
            populatedLayerCount={populatedLayerCount}
            isFlattenPending={isFlattenPending}
            handleManualFlatten={handleManualFlatten}
            handleRemoveBackground={handleRemoveBackground}
            availablePresets={availablePresets}
            closeMorePresetsSurface={closeMorePresetsSurface}
            handleSurfacePresetDragStart={handleSurfacePresetDragStart}
            handlePresetsSurfaceDragOver={handlePresetsSurfaceDragOver}
            handlePresetsSurfaceDragLeave={handlePresetsSurfaceDragLeave}
            handlePresetsSurfaceDrop={handlePresetsSurfaceDrop}
            handleCustomPresetSave={handleCustomPresetSave}
            isPresetsSurfaceDropActive={isPresetsSurfaceDropActive}
          />
        }
        hasPrimaryCompositePreview={hasPrimaryCompositePreview}
        selectedLayerName={selectedLayer?.name ?? null}
        onDeleteSelectedLayer={handleDeleteSelectedLayer}
        isPrimaryStageBusy={isPrimaryStageBusy}
        onInlineStagePointerDownCapture={handleInlineStagePointerDownCapture}
        onInlineStagePointerMoveCapture={handleInlineStagePointerMoveCapture}
        onInlineStagePointerUpCapture={handleInlineStagePointerUpCapture}
        onInlineStagePointerCancelCapture={handleInlineStagePointerCancelCapture}
        inlineViewportStyle={inlineMarkupViewportStyle}
        inlineStageRef={inlineStageWrapperRef}
        frameStackRef={handlePrimaryCanvasFrameStackRef}
        isPrimaryDragActive={primaryDragActive}
        frameStyle={primaryCanvasFrameBoundsStyle}
        onPrimaryDrop={handlePrimaryDrop}
        onPrimaryDragEnter={handlePrimaryDragEnter}
        onPrimaryDragOver={handlePrimaryDragOver}
        onPrimaryDragLeave={handlePrimaryDragLeave}
        primarySurfaceRef={primaryCompositionSurfaceRef}
        isMorePresetsSurfaceOpen={isMorePresetsSurfaceOpen}
        primarySurfaceStyle={primaryCompositionSurfaceStyle}
        emptyPrimarySurfaceStyle={emptyPrimaryCompositionSurfaceStyle}
        shouldRenderInlineInteractiveStage={shouldRenderInlineInteractiveStage}
        inlineInteractionHandlers={{
          onPointerDown: inlineStageInteractionRouter.onPointerDown,
          onPointerMove: inlineStageInteractionRouter.onPointerMove,
          onPointerUp: inlineStageInteractionRouter.onPointerUp,
          onPointerCancel: inlineStageInteractionRouter.onPointerCancel,
          onPointerLeave: inlineStageInteractionRouter.onPointerLeave,
        }}
        onStageMouseDown={handleMarkupStageMiddleClickSuppress}
        onStageAuxClick={handleMarkupStageMiddleClickSuppress}
        onStageContextMenu={handlePrimaryDropzoneContextMenu}
        onStageClick={handlePrimaryDropzoneClick}
        onStageDoubleClick={handlePrimaryDropzoneDoubleClick}
        inlineSceneContent={
          <ExpertEditStageScene
            scope="inline"
            layers={layers}
            markupStrokes={markupStrokes}
            overlayCanvasRef={overlayCanvasRef}
            stageSize={inlineCompositionSurfaceViewportSize}
            stageElement={primaryCanvasFrameStackElement}
            inlineFallbackStageSize={inlineCompositionSurfaceViewportSize}
            resolveLayerImageAspectRatio={resolveLayerImageAspectRatio}
            resolveRenderableLayerTransform={resolveRenderableLayerTransform}
            isFlattenPending={isFlattenPending}
            isRemoveBackgroundPending={isRemoveBackgroundPending}
            isPrimaryStageGenerating={isPrimaryStageGenerating}
          />
        }
        inlineTransformOverlay={renderSelectedLayerTransformOverlay(
          "inline",
          inlineCompositionSurfaceViewportSize,
          primaryCanvasFrameStackElement,
          {
            onPointerDown: inlineStageInteractionRouter.onPointerDown,
            onPointerMove: inlineStageInteractionRouter.onPointerMove,
            onPointerUp: inlineStageInteractionRouter.onPointerUp,
            onPointerCancel: inlineStageInteractionRouter.onPointerCancel,
            onPointerLeave: inlineStageInteractionRouter.onPointerLeave,
          }
        )}
        inlinePostStageTools={
          <ExpertEditInlinePostStageTools
            isInpaintCollapsed={isInpaintCollapsed}
            isInpaintCollapsing={isInpaintCollapsing}
            collapsedToolsThemeClass={collapsedToolsThemeClass}
            selectedRailTool={selectedRailTool}
            isInpaintToolSelected={isInpaintToolSelected}
            isVideoToolSelected={isVideoToolSelected}
            isMoveToolSelected={isMoveToolSelected}
            isInpaintLikeToolSelected={isInpaintLikeToolSelected}
            selectedInpaintMode={selectedInpaintMode}
            inpaintStrokeSize={inpaintStrokeSize}
            selectedInpaintSelectionTab={selectedInpaintSelectionTab}
            imageHasInteractiveMask={imageHasInteractiveMask}
            setSelectedRailTool={setSelectedRailTool}
            setSelectedInpaintMode={setSelectedInpaintMode}
            setInpaintStrokeSize={setInpaintStrokeSize}
            setSelectedInpaintSelectionTab={setSelectedInpaintSelectionTab}
            handleInpaintCollapseToggle={handleInpaintCollapseToggle}
            openMarkupModal={openMarkupModal}
            clearInpaintSelectionWithHistory={clearInpaintSelectionWithHistory}
            invertInpaintSelectionWithHistory={invertInpaintSelectionWithHistory}
            renderMarkupControlsContent={renderMarkupControlsContent}
            renderMoveControlsContent={renderMoveControlsContent}
            secondaryContent={
              shouldShowSecondaryReferenceAndStylesRow ? (
                <ExpertEditSecondaryReferences
                  extraImageUrls={extraImageUrls}
                  inputRefs={inputRefs}
                  extraDragActive={extraDragActive}
                  isPromptTokenPickerOpen={promptTokenPickerState.isOpen}
                  promptTokenPickerSelectedSlotIndex={promptTokenPickerState.selectedSlotIndex}
                  onSecondaryDragStart={handleSecondaryPromptTokenDragStart}
                  onSecondaryDrop={handleExtraDrop}
                  onSecondaryDragEnter={handleExtraDragEnter}
                  onSecondaryDragOver={handleExtraDragOver}
                  onSecondaryDragLeave={handleExtraDragLeave}
                  onExtraImageChange={onExtraImageChange}
                  isStylesPanelOpen={isStylesPanelOpen}
                  selectedStyleId={selectedStyleId}
                  stylesCatalog={stylesCatalog}
                  onStylesPanelToggle={handleStylesPanelToggle}
                />
              ) : null
            }
          />
        }
        promptAndSelectors={
          <ExpertEditPromptSelectorsColumn
            isPromptComposerExpanded={isPromptComposerExpanded}
            promptInputShellRef={promptInputShellRef}
            promptHighlightRef={promptHighlightRef}
            promptTextareaRef={promptTextareaRef}
            promptHighlightSegments={promptHighlightSegments}
            promptTextValue={promptTextValue}
            onPromptTextChange={handlePromptTextChange}
            onPromptFocus={handlePromptFocus}
            onPromptKeyDown={handlePromptKeyDown}
            onPromptDrop={handlePromptDropWithTokenInsert}
            onPromptScroll={handlePromptScroll}
            onPromptBlur={handlePromptBlur}
            promptTokenPickerState={promptTokenPickerState}
            hostPrimaryImageUrl={hostPrimaryImageUrl}
            populatedPromptTokenSlotIndexes={populatedPromptTokenSlotIndexes}
            extraImageUrls={extraImageUrls}
            onInsertPromptTokenFromPicker={insertPromptTokenFromPicker}
            promptTokenInlineError={promptTokenInlineError}
            onGenerate={handleInlineGenerate}
            inlineGenerateDisabled={inlineGenerateDisabled}
            isGenerateBusy={isGenerateBusy}
            costCredits={costCredits}
            inlineGuardrailReason={inlineGuardrailReason}
            modelId={modelId}
            isModelPickerLocked={isModelPickerLocked}
            isModelModalOpen={isModelModalOpen}
            modelModalAnchor={modelModalAnchor}
            effectiveModelPickerLogoSrc={effectiveModelPickerLogoSrc}
            effectiveModelPickerLabel={effectiveModelPickerLabel}
            onModelPickerOpen={onModelPickerOpen}
            aspect={aspect}
            onAspectChange={onAspectChange}
            aspectOptionsForModel={aspectOptionsForModel}
            shouldShowResolutionControl={shouldShowResolutionControl}
            imageResolutionValue={imageResolutionValue}
            imageResolutionOptions={imageResolutionOptions}
            onImageResolutionChange={onImageResolutionChange}
          />
        }
        statusToast={null}
        modalSurface={{
          isOpen: isMarkupExpandSelected,
          modalRef: handleMarkupModalRef,
          controlsColumnRef: handleMarkupModalControlsRef,
          stageRef: handleMarkupModalStageRef,
          stageStyle: markupModalStageStyle,
          generalPanel: renderMarkupModalGeneralPanel,
          movePanel: renderMoveControlsContent("modal"),
          inpaintPanel: renderMarkupModalInpaintPanel("modal"),
          markupPanel: renderMarkupControlsContent("modal"),
          viewportStyle: modalMarkupViewportStyle,
          sceneContent: (
            <ExpertEditStageScene
              scope="modal"
              layers={layers}
              markupStrokes={markupStrokes}
              overlayCanvasRef={modalOverlayCanvasRef}
              stageSize={markupModalViewportSize}
              stageElement={markupModalStageElement}
              inlineFallbackStageSize={inlineCompositionSurfaceViewportSize}
              resolveLayerImageAspectRatio={resolveLayerImageAspectRatio}
              resolveRenderableLayerTransform={resolveRenderableLayerTransform}
              isFlattenPending={isFlattenPending}
              isRemoveBackgroundPending={isRemoveBackgroundPending}
              isPrimaryStageGenerating={isPrimaryStageGenerating}
            />
          ),
          transformOverlay: renderSelectedLayerTransformOverlay(
            "modal",
            markupModalViewportSize,
            markupModalStageElement,
            {
              onPointerDown: modalStageInteractionRouter.onPointerDown,
              onPointerMove: modalStageInteractionRouter.onPointerMove,
              onPointerUp: modalStageInteractionRouter.onPointerUp,
              onPointerCancel: modalStageInteractionRouter.onPointerCancel,
              onPointerLeave: modalStageInteractionRouter.onPointerLeave,
            }
          ),
          layersPanel: (
            <ExpertEditLayersPanel
              scope="modal"
              layers={layers}
              editingLayerIndex={editingLayerIndex}
              editingLayerValue={editingLayerValue}
              draggingLayerIndex={draggingLayerIndex}
              dragOverLayerIndex={dragOverLayerIndex}
              resolvedSelectedLayerIndex={resolvedSelectedLayerIndex}
              isGenerateDisabled={isGenerateDisabled}
              selectedLayerImageUrl={selectedLayerImageUrl}
              isRemoveBackgroundPending={isRemoveBackgroundPending}
              populatedLayerCount={populatedLayerCount}
              isFlattenPending={isFlattenPending}
              setEditingLayerValue={setEditingLayerValue}
              onCommitLayerRename={handleCommitLayerRename}
              onClearLayerEditing={clearLayerEditing}
              onBeginLayerRename={beginLayerRename}
              onLayerDragStart={handleLayerDragStart}
              onLayerDragOver={handleLayerDragOver}
              onLayerDrop={handleLayerDrop}
              onLayerDragEnd={handleLayerDragEnd}
              onSelectLayer={handleSelectLayer}
              onDeleteLayer={handleDeleteLayer}
              onFlatten={() => void handleManualFlatten()}
              onRemoveBackground={handleRemoveBackground}
              onCloseModal={closeMarkupModal}
              modalLayersRef={handleMarkupModalLayersRef}
            />
          ),
          onClose: closeMarkupModal,
          onDragShield: handleMarkupModalDragShield,
          interactionHandlers: {
            onPointerDown: modalStageInteractionRouter.onPointerDown,
            onPointerMove: modalStageInteractionRouter.onPointerMove,
            onPointerUp: modalStageInteractionRouter.onPointerUp,
            onPointerCancel: modalStageInteractionRouter.onPointerCancel,
            onPointerLeave: modalStageInteractionRouter.onPointerLeave,
          },
          onStageWheel: noopStageWheel,
        }}
        contextMenu={{
          isOpen: stageContextMenuState.isOpen,
          menuRef: stageContextMenuRef,
          x: stageContextMenuState.x,
          y: stageContextMenuState.y,
          isMarkupExpandSelected,
          hasSelectedLayerImage: Boolean(selectedLayerImageUrl),
          onRecenter: handleStageContextMenuRecenter,
          onExpand: handleStageContextMenuExpand,
          onAddImage: handleStageContextMenuAddImage,
          onReset: handleStageContextMenuReset,
          onRemoveImage: handleStageContextMenuRemoveImage,
        }}
      />
      <ExpertEditPanelAuxiliary
        statusToastMessage={statusToastMessage}
        statusToastTone={statusToastTone}
        isStatusToastFading={isStatusToastFading}
        primaryInputRef={primaryInputRef}
        extraOneInputRef={extraOneInputRef}
        extraTwoInputRef={extraTwoInputRef}
        extraThreeInputRef={extraThreeInputRef}
        handlePrimaryFileSelection={handlePrimaryFileSelection}
        handleExtraFileSelection={(index) =>
          handleFileSelection((url) => onExtraImageChange(index, url))
        }
        characterPicker={{
          isOpen: isCharacterPickerOpen,
          characterModeEnabled,
          isCharacterOptionsLoading,
          onClose: closeCharacterPicker,
          characterOptions,
          selectedCharacterId,
          onSelectedCharacterIdChange,
          refreshCharacterOptions,
          resolveCharacterAvatarUrlById,
        }}
      />
    </div>
  );
}
