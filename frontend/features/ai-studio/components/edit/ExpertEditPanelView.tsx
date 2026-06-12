import React from "react";
import { modelLogos } from "../../constants";
import { needsImageUpload } from "../../utils/imageUpload";
import { setExpertEditPromptTokenDragData } from "../../logic/expertEditPromptReferences";
import { normalizeExpertEditSecondaryImageUrls } from "../../logic/expertEditReferenceSlots";
import type { AgentComposerDirectDropPayload } from "../../logic/agentComposerDirectDropPayload";
import { insertDroppedPromptTextAtSelection } from "../promptStep/agentComposerDrop";
import {
  isEditGenerationModeToggleEnabled,
  isMarkupCollapsedOpenModalEnabled,
  isMarkupModelLockEnabled,
} from "../../logic/inpaintSubmission";
import { resolveImageResolutionLongestEdgePx } from "../../logic/imageResolution";
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
import { useExpertEditPanelHistory } from "./useExpertEditPanelHistory";
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
  DEFAULT_EXPERT_EDIT_SECONDARY_SLOT_COUNT,
  MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT,
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
  type ExpertEditLayer,
} from "./expertEditLayerSessionUtils";
import { cloneMarkupStrokesSnapshot } from "./expertEditSessionState";
import { isClientPointInsideElementBounds } from "./expertEditInteractionUtils";
const EXPERT_EDIT_IMAGE_TRANSFORM_EDITING_ENABLED = true;
const EXPERT_EDIT_SUBMIT_VIEWPORT_EPSILON = 0.001;

const resolveDefaultVisibleSecondarySlotIndexes = (
  values: readonly (string | null)[]
): number[] => {
  const indexes = new Set<number>();
  Array.from({ length: DEFAULT_EXPERT_EDIT_SECONDARY_SLOT_COUNT }, (_, index) => index).forEach(
    (index) => indexes.add(index)
  );
  values.forEach((value, index) => {
    if (index >= MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT) return;
    if ((value?.trim() ?? "").length > 0) {
      indexes.add(index);
    }
  });
  return Array.from(indexes).sort((left, right) => left - right);
};

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
  onAddFlattenedReferenceImage,
  onExtraImageChange,
  onPromptTextChange,
  onPinPromptReference,
  onEditSubmitIntentChange,
  onRegenerate,
  onRegenerateWithReferenceInputs,
  resolveVariantCostCredits,
  insertOptimisticGenerationPlaceholder,
  removeOptimisticGenerationPlaceholder,
  notifyGenerationFailure,
  resolvePreviewUrlById,
  resolveInternalReferenceImageDropSource,
  canvasTearOutTargetRegistry,
  costCredits,
  removeBackgroundCostCredits = null,
  isGenerateDisabled = false,
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
  deletedSystemPresetIds,
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
  const panelRootRef = React.useRef<HTMLDivElement | null>(null);
  const suppressNextPrimaryPublishUrlRef = React.useRef<string | null>(null);
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
  const [selectedRailToolState, setSelectedRailToolState] = React.useState<RailTool>("move");
  const setSelectedRailTool = React.useCallback<React.Dispatch<React.SetStateAction<RailTool>>>(
    (nextValue) => {
      setSelectedRailToolState((previousValue) => {
        const resolvedValue =
          typeof nextValue === "function" ? nextValue(previousValue) : nextValue;
        return isGenerationModeToggleEnabled ? resolvedValue : "move";
      });
    },
    [isGenerationModeToggleEnabled]
  );
  const selectedRailTool = isGenerationModeToggleEnabled ? selectedRailToolState : "move";
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
  React.useEffect(() => {
    if (isGenerationModeToggleEnabled) return;
    setSelectedRailToolState("move");
    setIsMarkupExpandSelected(false);
    setIsInpaintCollapsed(true);
    setIsInpaintCollapsing(false);
  }, [isGenerationModeToggleEnabled]);
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
    setSelectedRailTool,
    controlledPresetIds,
    onSelectedPresetIdsChange,
    controlledCustomPresetOverrides,
    onCustomPresetOverridesChange,
    deletedSystemPresetIds,
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
  const queuePanelHistoryBaselineFromCurrentRef = React.useRef<() => void>(() => {});
  const beginPanelHistoryGestureRef = React.useRef<() => void>(() => {});
  const beginPanelHistoryGestureForLayersRef = React.useRef<
    (nextLayers: ExpertEditLayer[]) => void
  >(() => {});
  const finalizePanelHistoryGestureRef = React.useRef<() => void>(() => {});
  const queuePanelHistoryBaselineFromCurrent = React.useCallback(() => {
    queuePanelHistoryBaselineFromCurrentRef.current();
  }, []);
  const beginPanelHistoryGesture = React.useCallback(() => {
    beginPanelHistoryGestureRef.current();
  }, []);
  const beginPanelHistoryGestureForLayers = React.useCallback((nextLayers: ExpertEditLayer[]) => {
    beginPanelHistoryGestureForLayersRef.current(nextLayers);
  }, []);
  const finalizePanelHistoryGesture = React.useCallback(() => {
    finalizePanelHistoryGestureRef.current();
  }, []);
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
    setFoundationLayerId,
    handleCommitLayerRename,
    handleClearAllLayers,
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
    acceptPrimaryCanvasTearOutPayload,
    handlePrimaryFileSelection,
    handleRemoveSelectedLayerImage,
    handleSelectLayer,
    hasPrimaryCompositePreview,
    hostPrimaryImageUrl,
    layerIdCounterRef,
    layerIdCounter,
    setLayerIdCounter,
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
    resolveInternalReferenceImageDropSource,
    queuePanelHistoryBaselineFromCurrent,
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
  const promptTextValue = referenceText ?? "";
  const normalizedExtraImageUrls = React.useMemo(
    () => normalizeExpertEditSecondaryImageUrls(extraImageUrls),
    [extraImageUrls]
  );
  const [visibleSecondarySlotIndexes, setVisibleSecondarySlotIndexes] = React.useState<number[]>(
    () => resolveDefaultVisibleSecondarySlotIndexes(normalizedExtraImageUrls)
  );
  React.useEffect(() => {
    setVisibleSecondarySlotIndexes((previous) => {
      const nextIndexes = new Set(previous);
      normalizedExtraImageUrls.forEach((value, index) => {
        if ((value?.trim() ?? "").length > 0) {
          nextIndexes.add(index);
        }
      });
      return Array.from(nextIndexes)
        .filter((index) => index >= 0 && index < MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT)
        .sort((left, right) => left - right);
    });
  }, [normalizedExtraImageUrls]);
  const visibleSecondaryGridItemCount =
    visibleSecondarySlotIndexes.length +
    (visibleSecondarySlotIndexes.length < normalizedExtraImageUrls.length ? 1 : 0);
  const isSecondaryReferenceTrayWrapped = visibleSecondaryGridItemCount > 5;
  const handleAddSecondaryReferenceSlot = React.useCallback(() => {
    setVisibleSecondarySlotIndexes((previous) => {
      if (previous.length >= MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT) return previous;
      const visibleSet = new Set(previous);
      const nextIndex = Array.from(
        { length: MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT },
        (_, index) => index
      ).find((index) => !visibleSet.has(index));
      if (nextIndex == null) return previous;
      return [...previous, nextIndex].sort((left, right) => left - right);
    });
  }, []);
  const handleRemoveSecondaryReferenceSlot = React.useCallback(
    (index: number) => {
      onExtraImageChange(index, null);
      if (index === 0) return;
      setVisibleSecondarySlotIndexes((previous) =>
        previous.filter((slotIndex) => slotIndex !== index)
      );
    },
    [onExtraImageChange]
  );
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
    isSecondaryReferenceTrayWrapped,
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
    acceptExtraCanvasTearOutPayload,
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
    extraImageUrls: normalizedExtraImageUrls,
    selectedLayerImageUrl,
    onExtraImageChange,
    onPromptTextChange,
    resolvePreviewUrlById,
    resolveInternalReferenceImageDropSource,
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
  const {
    canUndoPanelHistoryAction,
    canRedoPanelHistoryAction,
    buildPanelHistorySnapshot,
    beginPanelHistoryGesture: beginPanelHistorySnapshotGesture,
    clearPanelHistoryEphemera,
    finalizePanelHistoryGesture: finalizePanelHistorySnapshotGesture,
    queuePanelHistoryBaselineFromCurrent: queuePanelHistoryBaselineSnapshotFromCurrent,
    rebasePanelHistoryLayerImage,
    handleUndoPanelHistoryAction,
    handleRedoPanelHistoryAction,
  } = useExpertEditPanelHistory({
    historyLimit: TRANSFORM_HISTORY_LIMIT,
    foundationLayerId,
    selectedLayerIndex,
    layerIdCounter,
    layerIdCounterRef,
    layers,
    markupStrokes,
    inpaintSnapshot: captureInpaintMaskSnapshot(),
    setFoundationLayerId,
    setLayerIdCounter,
    setSelectedLayerIndex,
    setLayers,
    setMarkupStrokes,
    restoreInpaintMaskSnapshot,
    clearLayerEditing,
  });
  React.useLayoutEffect(() => {
    queuePanelHistoryBaselineFromCurrentRef.current = queuePanelHistoryBaselineSnapshotFromCurrent;
    beginPanelHistoryGestureRef.current = beginPanelHistorySnapshotGesture;
    beginPanelHistoryGestureForLayersRef.current = (nextLayers) => {
      beginPanelHistorySnapshotGesture(
        buildPanelHistorySnapshot({
          layersOverride: nextLayers,
        })
      );
    };
    finalizePanelHistoryGestureRef.current = finalizePanelHistorySnapshotGesture;
  }, [
    beginPanelHistorySnapshotGesture,
    buildPanelHistorySnapshot,
    finalizePanelHistorySnapshotGesture,
    queuePanelHistoryBaselineSnapshotFromCurrent,
  ]);

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
  const [isPrimaryCanvasTearOutActive, setIsPrimaryCanvasTearOutActive] = React.useState(false);
  const [isPromptCanvasTearOutActive, setIsPromptCanvasTearOutActive] = React.useState(false);
  const canAcceptEditCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) => payload.kind === "image",
    []
  );
  const canAcceptEditPromptCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) =>
      payload.kind === "text" && payload.text.trim().length > 0,
    []
  );
  const acceptPromptCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) => {
      if (payload.kind !== "text") return;
      const droppedText = payload.text.trim();
      if (!droppedText) return;
      const textarea = promptTextareaRef.current;
      const shouldUseTextareaSelection =
        typeof document !== "undefined" && textarea ? document.activeElement === textarea : false;
      const selectionStart = shouldUseTextareaSelection
        ? (textarea?.selectionStart ?? promptTextValue.length)
        : promptTextValue.length;
      const selectionEnd = shouldUseTextareaSelection
        ? (textarea?.selectionEnd ?? promptTextValue.length)
        : promptTextValue.length;
      const inserted = insertDroppedPromptTextAtSelection({
        composerText: promptTextValue,
        droppedPromptText: droppedText,
        selectionStart,
        selectionEnd,
      });
      handlePromptTextChange(inserted.prompt);
      const restoreCaret = () => {
        const activeTextarea = promptTextareaRef.current;
        activeTextarea?.focus();
        activeTextarea?.setSelectionRange(inserted.caret, inserted.caret);
      };
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(restoreCaret);
      } else {
        restoreCaret();
      }
    },
    [handlePromptTextChange, promptTextareaRef, promptTextValue]
  );
  React.useEffect(() => {
    if (!canvasTearOutTargetRegistry || !primaryCanvasFrameStackElement) return;
    return canvasTearOutTargetRegistry.registerTarget({
      id: "expert-edit-primary-stage",
      element: primaryCanvasFrameStackElement,
      canAccept: canAcceptEditCanvasTearOutPayload,
      accept: acceptPrimaryCanvasTearOutPayload,
      setActive: setIsPrimaryCanvasTearOutActive,
    });
  }, [
    acceptPrimaryCanvasTearOutPayload,
    canAcceptEditCanvasTearOutPayload,
    canvasTearOutTargetRegistry,
    primaryCanvasFrameStackElement,
  ]);
  React.useEffect(() => {
    if (!canvasTearOutTargetRegistry || !promptInputShellRef.current) return;
    return canvasTearOutTargetRegistry.registerTarget({
      id: "expert-edit-prompt-composer",
      element: promptInputShellRef.current,
      canAccept: canAcceptEditPromptCanvasTearOutPayload,
      accept: acceptPromptCanvasTearOutPayload,
      setActive: setIsPromptCanvasTearOutActive,
    });
  }, [
    acceptPromptCanvasTearOutPayload,
    canAcceptEditPromptCanvasTearOutPayload,
    canvasTearOutTargetRegistry,
    promptInputShellRef,
  ]);
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
    queuePanelHistoryBaselineFromCurrent,
    onAddFlattenedReferenceImage,
    onRegenerateWithReferenceInputs,
    showStatusToast,
    suppressNextPrimaryPublishUrlRef,
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
  const flattenTargetLongestEdgePx = React.useMemo(
    () => resolveImageResolutionLongestEdgePx(imageResolutionValue),
    [imageResolutionValue]
  );

  const { handleInlineGenerate, isInlineGeneratePending } = useExpertEditInlineGenerate({
    layers,
    promptText: promptTextValue,
    extraImageUrls: normalizedExtraImageUrls,
    reusablePrimarySourceUrl,
    flattenTargetLongestEdgePx,
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
  const inlineGenerateDisabled = isGenerateDisabled || populatedLayerCount <= 0 || !hasPromptText;
  const isPrimaryStageBusy =
    isFlattenPending ||
    isRemoveBackgroundPending ||
    isPrimaryStageGenerating ||
    isInlineGeneratePending;

  const handleSecondaryPromptTokenDragStart = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      if (!normalizedExtraImageUrls[index]) {
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
    [normalizedExtraImageUrls]
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

  const modalStagePanCaptureHandlers = React.useMemo(
    () => ({
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
        if (!beginMarkupPanGesture(event, "modal")) return;
        event.currentTarget.focus({ preventScroll: true });
        event.stopPropagation();
      },
      onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
        if (!continueMarkupPanGesture(event)) return;
        event.stopPropagation();
      },
      onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
        if (!endMarkupPanGesture(event)) return;
        event.stopPropagation();
      },
      onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => {
        if (!endMarkupPanGesture(event)) return;
        event.stopPropagation();
      },
    }),
    [beginMarkupPanGesture, continueMarkupPanGesture, endMarkupPanGesture]
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
    handleFlipLayerHorizontalAction,
    handleFlipLayerVerticalAction,
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
    beginPanelHistoryGestureForLayers,
    finalizePanelHistoryGesture,
    queuePanelHistoryBaselineFromCurrent,
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
    canUndoGeneralAction: canUndoStageGeneralAction,
    canRedoGeneralAction: canRedoStageGeneralAction,
    handleUndoGeneralAction: handleUndoStageGeneralAction,
    handleRedoGeneralAction: handleRedoStageGeneralAction,
    handleResetGeneralAction,
    isGeneralResetDisabled,
    clearHistoryEphemera: clearStageHistoryEphemera,
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
    beginPanelHistoryGesture,
    finalizePanelHistoryGesture,
    queuePanelHistoryBaselineFromCurrent,
    isInpaintToolSelected,
    isMarkupToolSelected,
    queuePendingHistoryApplyEntry,
    transformHistoryState,
    setTransformHistoryState,
    commitTransformHistoryTransition,
  });
  const canUndoGeneralAction = canUndoStageGeneralAction || canUndoPanelHistoryAction;
  const canRedoGeneralAction = canRedoStageGeneralAction || canRedoPanelHistoryAction;
  const handleUndoGeneralAction = React.useCallback(() => {
    if (canUndoStageGeneralAction) {
      handleUndoStageGeneralAction();
      return;
    }
    handleUndoPanelHistoryAction();
  }, [canUndoStageGeneralAction, handleUndoPanelHistoryAction, handleUndoStageGeneralAction]);
  const handleRedoGeneralAction = React.useCallback(() => {
    if (canRedoStageGeneralAction) {
      handleRedoStageGeneralAction();
      return;
    }
    handleRedoPanelHistoryAction();
  }, [canRedoStageGeneralAction, handleRedoPanelHistoryAction, handleRedoStageGeneralAction]);
  const clearHistoryEphemera = React.useCallback(() => {
    clearStageHistoryEphemera();
    clearPanelHistoryEphemera();
  }, [clearPanelHistoryEphemera, clearStageHistoryEphemera]);

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
    isAdvancedEditModesEnabled: isGenerationModeToggleEnabled,
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
    panelRootRef,
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
    inlineStageHeaderControls,
    renderMoveControlsContent,
    renderMarkupModalGeneralPanel,
    renderPresetUtilityActionButtons,
    renderInpaintControlsContent,
  } = useExpertEditPanelControlsRuntime({
    selectedRailTool,
    isGenerationModeToggleEnabled,
    effectiveEditSubmitIntent,
    moveStageZoomSliderValue,
    canUndoGeneralAction,
    canRedoGeneralAction,
    isGeneralResetDisabled,
    aspect,
    aspectOptionsForModel,
    onAspectChange,
    setSelectedRailTool,
    handleRecenterMoveAction,
    handleFlipLayerHorizontalAction,
    handleFlipLayerVerticalAction,
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
    canFlipSelectedLayer: Boolean(selectedLayerImageUrl),
    handleCompositeRegeneratePromptInsert,
  });

  const {
    inlineStageHeaderControls: resolvedInlineStageHeaderControls,
    inlineBackdropPanHandlers: inlineStageBackdropPanHandlers,
    inlineStageWheelHandler,
    inlineInteractionHandlers,
    inlineSceneContent,
    inlineTransformOverlay,
    inlinePostStageTools,
    modalSurface,
  } = useExpertEditStageWorkspaceRuntime({
    isAdvancedEditModesEnabled: isGenerationModeToggleEnabled,
    inlineStageHeaderControls,
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
    modalStagePanCaptureHandlers,
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
    extraImageUrls: normalizedExtraImageUrls,
    visibleSecondarySlotIndexes,
    onAddSecondaryReferenceSlot: handleAddSecondaryReferenceSlot,
    onRemoveSecondaryReferenceSlot: handleRemoveSecondaryReferenceSlot,
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
    acceptExtraCanvasTearOutPayload,
    canvasTearOutTargetRegistry,
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
    removeBackgroundCostCredits,
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
    handleClearAllLayers,
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
    extraImageUrls: normalizedExtraImageUrls,
    insertPromptTokenFromPicker,
    promptTokenInlineError,
    isPromptCanvasTearOutActive,
    onPinPromptReference,
    handleInlineGenerate,
    inlineGenerateDisabled,
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
    inputRefs,
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
    isAdvancedEditModesEnabled: isGenerationModeToggleEnabled,
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
    removeBackgroundCostCredits,
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
    handleClearAllLayers,
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
    inlineStageHeaderControls: resolvedInlineStageHeaderControls,
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
    isPrimaryDragActive: primaryDragActive || isPrimaryCanvasTearOutActive,
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
    suppressNextPrimaryPublishUrlRef,
    removeBackgroundPendingSourceUrlRef,
    setLayers,
    rebasePanelHistoryLayerImage,
    clearRemoveBackgroundPending,
    onPrimaryImageChange,
    onSessionStateChange,
    revokeObjectUrlSafe,
  });

  return (
    <div
      ref={panelRootRef}
      className={`tool-properties edit-expert-panel ${
        isMarkupExpandSelected ? "is-markup-modal-open" : ""
      } ${isSecondaryReferenceTrayWrapped ? "has-wrapped-secondary-references" : ""}`.trim()}
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
