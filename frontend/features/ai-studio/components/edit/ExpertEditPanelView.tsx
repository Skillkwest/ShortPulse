import React from "react";
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsInCardinal,
  ArrowsOutSimple,
  ArrowsOutCardinal,
  CaretRight,
  CircleDashed,
  CircleHalf,
  Eraser,
  GearSix,
  PaintBrush,
  PencilSimple,
  Sliders,
  TrashSimple,
} from "phosphor-react";
import { modelLogos } from "../../constants";
import { AspectDropdown } from "../AspectDropdown";
import { stripEditLabel } from "../../utils/modelLabels";
import { setExpertEditPromptTokenDragData } from "../../logic/expertEditPromptReferences";
import {
  INPAINT_FLUX_FILL_MODEL_LABEL,
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_LABEL,
  isEditGenerationModeToggleEnabled,
  isMarkupCollapsedOpenModalEnabled,
  isMarkupModelLockEnabled,
} from "../../logic/inpaintSubmission";
import {
  resolveEditSubmitIntentFromRailSelection,
  type EditSubmitIntent,
} from "../../logic/editSubmitIntent";
import { useReferencePropertiesConstraintEffects } from "../useReferencePropertiesConstraintEffects";
import { useReferencePropertiesDerivedState } from "../useReferencePropertiesDerivedState";
import { useReferencePropertiesInteractions } from "../useReferencePropertiesInteractions";
import { useCreateCharacterModeController } from "../create/useCreateCharacterModeController";
import { useInpaintMaskController } from "./useInpaintMaskController";
import {
  createIdleMarkupDrawPointerSession,
  resolveMarkupStrokePointRadiusPx,
  resolveMarkupStrokePointToSurfacePoint,
  resolveMarkupStrokeWidthPx,
  type MarkupDrawPointerSession,
  type MarkupStroke,
} from "./markupStrokeController";
import { useExpertEditInlineGenerate } from "./useExpertEditInlineGenerate";
import { useExpertEditDocumentState } from "./useExpertEditDocumentState";
import { useExpertEditLayerActions } from "./useExpertEditLayerActions";
import { useExpertEditPromptTokenController } from "./useExpertEditPromptTokenController";
import { useExpertEditSessionBridge } from "./useExpertEditSessionBridge";
import { useExpertEditStageHistory } from "./useExpertEditStageHistory";
import { useExpertEditStageViewport } from "./useExpertEditStageViewport";
import { ExpertEditStageContextMenu } from "./ExpertEditStagePrimitives";
import {
  ExpertEditInlineStageSurface,
  ExpertEditModalStageSurface,
} from "./ExpertEditStageSurface";
import { useExpertEditStageInteractionRouter } from "./useExpertEditStageInteractionRouter";
import { useExpertEditMarkupDrawController } from "./useExpertEditMarkupDrawController";
import { useExpertEditMarkupViewportController } from "./useExpertEditMarkupViewportController";
import { useExpertEditTransformSession } from "./useExpertEditTransformSession";
import { ExpertEditLayersPanel, ExpertEditLayerUtilityActions } from "./ExpertEditLayersPanel";
import { ExpertEditPresetsSurface } from "./ExpertEditPresetsSurface";
import { ExpertEditCharacterPickerModal } from "./ExpertEditCharacterPickerModal";
import { ExpertEditModeRailPanel } from "./ExpertEditModeRailPanel";
import {
  ExpertEditSecondaryReferences,
  ExpertEditSelectorControls,
} from "./ExpertEditReferenceControls";
import { ExpertEditPromptComposer } from "./ExpertEditPromptComposer";
import {
  COMPOSITE_REGENERATE_COHESION_PROMPT,
  INPAINT_COLLAPSE_ANIMATION_MS,
  INPAINT_STROKE_SIZE_DEFAULT,
  LAYER_LIMIT_REACHED_TOAST,
  LOCKED_EDIT_TOOL_MODEL_LOGO_SRC,
  MARKUP_COLOR_DEFAULT,
  MARKUP_COLOR_SWATCHES,
  MARKUP_STROKE_SIZE_DEFAULT,
  MARKUP_STROKE_SIZE_MAX,
  PRESET_PANEL_LIMIT_TOAST,
  STATUS_TOAST_FADE_MS,
  STATUS_TOAST_VISIBLE_MS,
  TRANSIENT_OBJECT_URL_REVOKE_MS,
  TRANSFORM_HISTORY_LIMIT,
  clampNumber,
  editGenerationModeOptions,
  editPresetUtilityActions,
  inpaintRailTools,
  isSpaceActivationKey,
  type ExpertEditPanelViewProps,
  type InpaintMode,
  type InpaintSelectionTab,
  type MarkupMode,
  type RailTool,
} from "./expertEditPanelViewContract";
export type { ExpertEditPanelViewProps } from "./expertEditPanelViewContract";
export { COMPOSITE_REGENERATE_COHESION_PROMPT } from "./expertEditPanelViewContract";
import {
  EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS,
  EDIT_PRESET_PANEL_MAX,
  EDIT_PRESET_MORE_LABEL,
  type ExpertEditCustomPresetOverride,
  type ExpertEditCustomPresetOverrides,
  type ExpertEditCustomPresetId,
  type ExpertEditPresetId,
  type ExpertEditPresetDragPayload,
  normalizeExpertEditCustomPresetOverrides,
  normalizePresetPanelPresetIds,
  resolveExpertEditPresetCatalog,
  resolveExpertEditPresetLabelById,
  resolveExpertEditPresetPromptById,
  sortPresetIdsByCanonicalOrder,
} from "./expertEditPresets";
import {
  resolveBlobDimensions,
  resolvePresetDragPayload,
  revokeObjectUrlSafe,
  setOpaquePresetDragImage,
  writePresetDragTransfer,
} from "./expertEditPanelUtilities";
import {
  hexToHsv,
  hsvToRgb,
  parseHexColor,
  rgbToHex,
  rgbToHsv,
  type HsvColor,
} from "./expertEditColorUtils";
import {
  MOVE_STAGE_ZOOM_SLIDER_DEFAULT,
  MOVE_STAGE_ZOOM_SLIDER_MAX,
  MOVE_STAGE_ZOOM_SLIDER_MIN,
  createIdleMarkupPanPointerSession,
  isResolvedStageViewportSize,
  resolveRenderableStageViewportSize,
  type MarkupPanPointerSession,
  type StageViewportSize,
} from "./expertEditViewportUtils";
import {
  areLayerTransformsEqual,
  areTransformHistoryEntriesEqual,
  buildTransformHistoryEntry,
  clampLayerOpacity,
  defaultLayerTransform,
  resolveClippedLayerTransform,
  resolveContainedLayerRect,
  type TransformHistoryEntry,
  type TransformHistoryState,
} from "./expertEditLayerTransformUtils";
import {
  layerHasImage,
  resolveInitialExpertEditSessionState,
  resolveMarkupStrokeIdCounterFromStrokes,
  type ExpertEditLayer,
} from "./expertEditLayerSessionUtils";
import {
  buildInpaintBrushReticleCursor,
  buildInpaintLassoCursor,
  buildMarkupBrushReticleCursor,
} from "./expertEditCursorUtils";
import {
  clearTransientObjectUrlRevokeTimers,
  clearWindowTimeoutRef,
  isEventTargetInsideElement,
  isKeyboardEventFromEditableTarget,
  lockDocumentCursor,
  resolveInpaintCollapseToggleDecision,
  resolveRailToolForGenerationMode,
  runPointerStageTerminalAction,
  scheduleTransientObjectUrlRevoke as scheduleTransientObjectUrlRevokeTimer,
  resolveStageContextMenuPosition,
  unlockDocumentCursor,
} from "./expertEditInteractionUtils";
import { cloneMarkupStrokesSnapshot } from "./expertEditSessionState";
const EXPERT_EDIT_IMAGE_TRANSFORM_EDITING_ENABLED = false;

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
  const activePresetDragPayloadRef = React.useRef<ExpertEditPresetDragPayload | null>(null);
  const presetDragPreviewCleanupRef = React.useRef<(() => void) | null>(null);
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
  const markupColorPickerAnchorRef = React.useRef<HTMLDivElement | null>(null);
  const markupColorSaturationRef = React.useRef<HTMLDivElement | null>(null);
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
  const [selectedGenerationMode, setSelectedGenerationMode] =
    React.useState<EditSubmitIntent>("standard");
  const [selectedRailTool, setSelectedRailTool] = React.useState<RailTool>("move");
  const [inpaintStrokeSize, setInpaintStrokeSize] = React.useState(INPAINT_STROKE_SIZE_DEFAULT);
  const [markupStrokeSize, setMarkupStrokeSize] = React.useState(MARKUP_STROKE_SIZE_DEFAULT);
  const resolvedMarkupStrokeSize = React.useMemo(
    () => clampNumber(markupStrokeSize, 1, MARKUP_STROKE_SIZE_MAX),
    [markupStrokeSize]
  );
  const [selectedInpaintSelectionTab, setSelectedInpaintSelectionTab] =
    React.useState<InpaintSelectionTab>("select");
  const [selectedMarkupMode, setSelectedMarkupMode] = React.useState<MarkupMode>("pen");
  const [isMarkupExpandSelected, setIsMarkupExpandSelected] = React.useState(false);
  const [isMarkupColorPickerOpen, setIsMarkupColorPickerOpen] = React.useState(false);
  const [markupColorHsv, setMarkupColorHsv] = React.useState<HsvColor>(() =>
    hexToHsv(MARKUP_COLOR_DEFAULT)
  );
  const [isMarkupPanDragging, setIsMarkupPanDragging] = React.useState(false);
  const [isMarkupPanSpacePressed, setIsMarkupPanSpacePressed] = React.useState(false);
  const [stageContextMenuState, setStageContextMenuState] = React.useState<{
    isOpen: boolean;
    x: number;
    y: number;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
  });
  const [markupStrokes, setMarkupStrokes] = React.useState<MarkupStroke[]>(() =>
    cloneMarkupStrokesSnapshot(initialSessionState.markupStrokes)
  );
  const [isInpaintCollapsed, setIsInpaintCollapsed] = React.useState(true);
  const [isInpaintCollapsing, setIsInpaintCollapsing] = React.useState(false);
  const [isMorePresetsSurfaceOpen, setIsMorePresetsSurfaceOpen] = React.useState(false);
  const [internalSelectedPresetIds, setInternalSelectedPresetIds] = React.useState<
    ExpertEditPresetId[]
  >(() => normalizePresetPanelPresetIds(EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS));
  const [internalCustomPresetOverrides, setInternalCustomPresetOverrides] =
    React.useState<ExpertEditCustomPresetOverrides>({});
  const [isPresetPanelDropActive, setIsPresetPanelDropActive] = React.useState(false);
  const [isPresetsSurfaceDropActive, setIsPresetsSurfaceDropActive] = React.useState(false);
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
    showStatusToast,
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
  const markupColor = React.useMemo(() => rgbToHex(hsvToRgb(markupColorHsv)), [markupColorHsv]);
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
  const isLayerLimitStatusToast = statusToastMessage === LAYER_LIMIT_REACHED_TOAST;
  const isCustomOverridesControlled =
    controlledCustomPresetOverrides != null && onCustomPresetOverridesChange != null;
  const customPresetOverrides = React.useMemo(
    () =>
      normalizeExpertEditCustomPresetOverrides(
        isCustomOverridesControlled
          ? controlledCustomPresetOverrides
          : internalCustomPresetOverrides
      ),
    [controlledCustomPresetOverrides, internalCustomPresetOverrides, isCustomOverridesControlled]
  );
  const normalizedControlledPresetIds = React.useMemo(
    () =>
      controlledPresetIds == null
        ? null
        : normalizePresetPanelPresetIds(controlledPresetIds, customPresetOverrides),
    [controlledPresetIds, customPresetOverrides]
  );
  const controlledPresetChangeHandler = onSelectedPresetIdsChange ?? null;
  const isPresetPanelControlled =
    normalizedControlledPresetIds != null && controlledPresetChangeHandler != null;
  const selectedPresetIds = isPresetPanelControlled
    ? normalizedControlledPresetIds
    : internalSelectedPresetIds;
  const updateSelectedPresetIds = React.useCallback(
    (updater: (previous: ExpertEditPresetId[]) => ExpertEditPresetId[]) => {
      if (isPresetPanelControlled) {
        const next = normalizePresetPanelPresetIds(
          updater(normalizedControlledPresetIds),
          customPresetOverrides
        );
        controlledPresetChangeHandler(next);
        return;
      }
      setInternalSelectedPresetIds((previous) =>
        normalizePresetPanelPresetIds(updater(previous), customPresetOverrides)
      );
    },
    [
      controlledPresetChangeHandler,
      customPresetOverrides,
      isPresetPanelControlled,
      normalizedControlledPresetIds,
    ]
  );
  const updateCustomPresetOverrides = React.useCallback(
    (updater: (previous: ExpertEditCustomPresetOverrides) => ExpertEditCustomPresetOverrides) => {
      if (isCustomOverridesControlled) {
        const nextValue = normalizeExpertEditCustomPresetOverrides(updater(customPresetOverrides));
        onCustomPresetOverridesChange(nextValue);
        return;
      }
      setInternalCustomPresetOverrides((previous) =>
        normalizeExpertEditCustomPresetOverrides(updater(previous))
      );
    },
    [customPresetOverrides, isCustomOverridesControlled, onCustomPresetOverridesChange]
  );
  const availablePresets = React.useMemo(() => {
    const selectedPresetIdSet = new Set(selectedPresetIds);
    return resolveExpertEditPresetCatalog(customPresetOverrides).filter(
      (preset) => !selectedPresetIdSet.has(preset.presetId)
    );
  }, [customPresetOverrides, selectedPresetIds]);
  const selectedPanelPresets = React.useMemo(
    () =>
      selectedPresetIds.map((presetId) => ({
        presetId,
        label: resolveExpertEditPresetLabelById(presetId, customPresetOverrides),
      })),
    [customPresetOverrides, selectedPresetIds]
  );
  const hasSelectedPresetIds = selectedPresetIds.length > 0;

  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;
  const isInpaintToolSelected = selectedRailTool === "inpaint";
  const isVideoToolSelected = selectedRailTool === "video";
  const railSelectionSubmitIntent = React.useMemo(
    () =>
      resolveEditSubmitIntentFromRailSelection({
        isInpaintSelected: isInpaintToolSelected,
        isMarkupSelected: isVideoToolSelected,
      }),
    [isInpaintToolSelected, isVideoToolSelected]
  );
  const effectiveEditSubmitIntent = isGenerationModeToggleEnabled
    ? selectedGenerationMode
    : railSelectionSubmitIntent;
  const effectiveGenerationModeIndex = React.useMemo(() => {
    const resolvedIndex = editGenerationModeOptions.findIndex(
      (modeOption) => modeOption.id === effectiveEditSubmitIntent
    );
    return resolvedIndex >= 0 ? resolvedIndex : 0;
  }, [effectiveEditSubmitIntent]);
  const generationModeTabsStyle = React.useMemo(
    () =>
      ({
        "--edit-expert-generation-mode-index": effectiveGenerationModeIndex,
      }) as React.CSSProperties,
    [effectiveGenerationModeIndex]
  );
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
  const activeCollapsedRailTool =
    inpaintRailTools.find((tool) => tool.id === selectedRailTool) ?? inpaintRailTools[0];
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
    onPromptTextChange,
    showStatusToast,
  });

  React.useEffect(() => {
    if (!onEditSubmitIntentChange) return;
    onEditSubmitIntentChange(effectiveEditSubmitIntent);
  }, [effectiveEditSubmitIntent, onEditSubmitIntentChange]);

  React.useEffect(() => {
    return () => {
      if (presetDragPreviewCleanupRef.current) {
        presetDragPreviewCleanupRef.current();
        presetDragPreviewCleanupRef.current = null;
      }
    };
  }, []);
  const addPresetToPanel = React.useCallback(
    (presetId: ExpertEditPresetId | null | undefined) => {
      if (!presetId) return;
      updateSelectedPresetIds((previous) => {
        if (previous.includes(presetId)) return previous;
        if (previous.length >= EDIT_PRESET_PANEL_MAX) {
          showStatusToast(PRESET_PANEL_LIMIT_TOAST, "warning");
          return previous;
        }
        return sortPresetIdsByCanonicalOrder([...previous, presetId]);
      });
    },
    [showStatusToast, updateSelectedPresetIds]
  );
  const removePresetFromPanel = React.useCallback(
    (presetId: ExpertEditPresetId | null | undefined) => {
      if (!presetId) return;
      updateSelectedPresetIds((previous) =>
        previous.includes(presetId)
          ? previous.filter((candidatePresetId) => candidatePresetId !== presetId)
          : previous
      );
    },
    [updateSelectedPresetIds]
  );

  const handlePanelPresetApply = React.useCallback(
    (presetId: ExpertEditPresetId) => {
      const presetPrompt = resolveExpertEditPresetPromptById(presetId, customPresetOverrides);
      if (!presetPrompt) return;
      handlePromptTextChange(presetPrompt);
    },
    [customPresetOverrides, handlePromptTextChange]
  );
  const handleCompositeRegeneratePromptInsert = React.useCallback(() => {
    handlePromptTextChange(COMPOSITE_REGENERATE_COHESION_PROMPT);
  }, [handlePromptTextChange]);

  const handleCustomPresetSave = React.useCallback(
    (presetId: ExpertEditCustomPresetId, override: ExpertEditCustomPresetOverride) => {
      updateCustomPresetOverrides((previous) => ({
        ...previous,
        [presetId]: {
          label: override.label,
          prompt: override.prompt,
        },
      }));
    },
    [updateCustomPresetOverrides]
  );

  const beginPresetDragSession = React.useCallback(
    (
      event: React.DragEvent<HTMLButtonElement>,
      payload: ExpertEditPresetDragPayload,
      label: string
    ) => {
      event.stopPropagation();
      activePresetDragPayloadRef.current = payload;
      event.dataTransfer.effectAllowed = "move";
      writePresetDragTransfer(event.dataTransfer, payload, label);
      if (presetDragPreviewCleanupRef.current) {
        presetDragPreviewCleanupRef.current();
        presetDragPreviewCleanupRef.current = null;
      }
      presetDragPreviewCleanupRef.current = setOpaquePresetDragImage(
        event.dataTransfer,
        event.currentTarget
      );
      if (!presetDragPreviewCleanupRef.current) return;
      window.setTimeout(() => {
        if (presetDragPreviewCleanupRef.current) {
          presetDragPreviewCleanupRef.current();
          presetDragPreviewCleanupRef.current = null;
        }
      }, 0);
    },
    []
  );

  const handleSurfacePresetDragStart = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>, presetId: ExpertEditPresetId) => {
      beginPresetDragSession(
        event,
        { presetId, source: "surface" },
        resolveExpertEditPresetLabelById(presetId, customPresetOverrides)
      );
    },
    [beginPresetDragSession, customPresetOverrides]
  );

  const handlePanelPresetDragStart = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>, presetId: ExpertEditPresetId) => {
      beginPresetDragSession(
        event,
        { presetId, source: "panel" },
        resolveExpertEditPresetLabelById(presetId, customPresetOverrides)
      );
    },
    [beginPresetDragSession, customPresetOverrides]
  );

  const handlePresetDragEnd = React.useCallback(() => {
    setIsPresetPanelDropActive(false);
    setIsPresetsSurfaceDropActive(false);
    activePresetDragPayloadRef.current = null;
    if (presetDragPreviewCleanupRef.current) {
      presetDragPreviewCleanupRef.current();
      presetDragPreviewCleanupRef.current = null;
    }
  }, []);

  const handlePresetPanelDragOver = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    const payload = resolvePresetDragPayload(
      event.dataTransfer,
      activePresetDragPayloadRef.current
    );
    if (!payload || payload.source !== "surface") return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setIsPresetPanelDropActive(true);
  }, []);

  const handlePresetPanelDragLeave = React.useCallback(() => {
    setIsPresetPanelDropActive(false);
  }, []);

  const handlePresetPanelDrop = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const payload = resolvePresetDragPayload(
        event.dataTransfer,
        activePresetDragPayloadRef.current
      );
      if (!payload || payload.source !== "surface") return;
      event.preventDefault();
      event.stopPropagation();
      setIsPresetPanelDropActive(false);
      addPresetToPanel(payload.presetId);
    },
    [addPresetToPanel]
  );

  const handlePresetsSurfaceDragOver = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    const payload = resolvePresetDragPayload(
      event.dataTransfer,
      activePresetDragPayloadRef.current
    );
    if (!payload || payload.source !== "panel") return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setIsPresetsSurfaceDropActive(true);
  }, []);

  const handlePresetsSurfaceDragLeave = React.useCallback(() => {
    setIsPresetsSurfaceDropActive(false);
  }, []);

  const handlePresetsSurfaceDrop = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const payload = resolvePresetDragPayload(
        event.dataTransfer,
        activePresetDragPayloadRef.current
      );
      if (!payload || payload.source !== "panel") return;
      event.preventDefault();
      event.stopPropagation();
      setIsPresetsSurfaceDropActive(false);
      removePresetFromPanel(payload.presetId);
    },
    [removePresetFromPanel]
  );

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
  const shouldShowSelectedLayerTransformOverlay =
    EXPERT_EDIT_IMAGE_TRANSFORM_EDITING_ENABLED &&
    isMoveToolSelected &&
    Boolean(selectedLayerImageUrl) &&
    hasPrimaryCompositePreview;
  const selectedLayerImageAspectRatio = React.useMemo(
    () => resolveLayerImageAspectRatio(selectedLayer),
    [resolveLayerImageAspectRatio, selectedLayer]
  );
  const resolveRenderableLayerTransform = React.useCallback(
    (layer: ExpertEditLayer) =>
      resolveClippedLayerTransform({
        transform: layer.transform,
      }),
    []
  );
  const morePresetsSurfaceId = React.useId();
  const activeStageRenderScale = markupViewport.scale;

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
  const renderMarkupStrokeOverlay = React.useCallback(
    (
      keyPrefix: string,
      stageSize: StageViewportSize,
      stageElement: HTMLDivElement | null = null
    ) => {
      if (!markupStrokes.length) return null;
      const resolvedStageSize = resolveRenderableStageViewportSize({
        preferredSize: stageSize,
        stageElement,
      });
      const effectiveStageSize =
        keyPrefix === "modal" &&
        !isResolvedStageViewportSize(resolvedStageSize) &&
        isResolvedStageViewportSize(inlineCompositionSurfaceViewportSize)
          ? inlineCompositionSurfaceViewportSize
          : resolvedStageSize;
      const stageWidth = Math.max(1, effectiveStageSize.width);
      const stageHeight = Math.max(1, effectiveStageSize.height);
      return (
        <svg
          className="edit-expert-markup-strokes-overlay"
          viewBox={`0 0 ${stageWidth} ${stageHeight}`}
          aria-hidden="true"
        >
          {markupStrokes.map((stroke) => {
            const strokeWidthPx = resolveMarkupStrokeWidthPx({
              stroke,
              stageHeight,
            });
            if (stroke.points.length <= 1) {
              const point = stroke.points[0];
              if (!point) return null;
              const pointPx = resolveMarkupStrokePointToSurfacePoint({
                point,
                stageWidth,
                stageHeight,
              });
              return (
                <circle
                  key={`${keyPrefix}-${stroke.id}-point`}
                  cx={pointPx.x}
                  cy={pointPx.y}
                  r={resolveMarkupStrokePointRadiusPx({
                    stroke,
                    stageHeight,
                  })}
                  fill={stroke.color}
                />
              );
            }
            const pointsValue = stroke.points
              .map((point) => {
                const pointPx = resolveMarkupStrokePointToSurfacePoint({
                  point,
                  stageWidth,
                  stageHeight,
                });
                return `${pointPx.x},${pointPx.y}`;
              })
              .join(" ");
            return (
              <polyline
                key={`${keyPrefix}-${stroke.id}`}
                points={pointsValue}
                fill="none"
                stroke={stroke.color}
                strokeWidth={strokeWidthPx}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
        </svg>
      );
    },
    [inlineCompositionSurfaceViewportSize, markupStrokes]
  );

  const renderPrimaryStageBusyOverlay = React.useCallback((): React.ReactNode | null => {
    if (isFlattenPending) {
      return (
        <div
          className="edit-expert-primary-layer-loading-overlay"
          data-testid="edit-expert-flatten-loading-overlay"
        >
          <div
            className="edit-expert-primary-layer-loading"
            role="status"
            aria-label="Flattening layers"
            aria-live="polite"
          >
            <span className="edit-expert-primary-layer-loading-spinner" aria-hidden="true" />
            <span className="edit-expert-primary-layer-loading-text">Flattening layers...</span>
          </div>
        </div>
      );
    }
    if (isRemoveBackgroundPending) {
      return (
        <div
          className="edit-expert-primary-layer-loading-overlay"
          data-testid="edit-expert-remove-background-loading-overlay"
        >
          <div
            className="edit-expert-primary-layer-loading"
            role="status"
            aria-label="Removing background"
            aria-live="polite"
          >
            <span className="edit-expert-primary-layer-loading-spinner" aria-hidden="true" />
            <span className="edit-expert-primary-layer-loading-text">Removing background...</span>
          </div>
        </div>
      );
    }
    if (isPrimaryStageGenerating) {
      return (
        <div
          className="edit-expert-primary-layer-loading-overlay"
          data-testid="edit-expert-inline-generate-loading-overlay"
        >
          <div
            className="edit-expert-primary-layer-loading"
            role="status"
            aria-label="Generating image"
            aria-live="polite"
          >
            <span className="edit-expert-primary-layer-loading-spinner" aria-hidden="true" />
            <span className="edit-expert-primary-layer-loading-text">Generating...</span>
          </div>
        </div>
      );
    }
    return null;
  }, [isFlattenPending, isPrimaryStageGenerating, isRemoveBackgroundPending]);

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

  const commitTransformHistoryTransition = React.useCallback(
    (nextEntry: TransformHistoryEntry, baselineEntry?: TransformHistoryEntry | null) => {
      setTransformHistoryState((previousHistory) => {
        const previousEntry = baselineEntry ?? previousHistory.present;
        if (areTransformHistoryEntriesEqual(previousEntry, nextEntry)) {
          return previousHistory;
        }
        const nextPast = [...previousHistory.past, previousEntry];
        const trimmedPast =
          nextPast.length > TRANSFORM_HISTORY_LIMIT
            ? nextPast.slice(nextPast.length - TRANSFORM_HISTORY_LIMIT)
            : nextPast;
        return {
          past: trimmedPast,
          present: nextEntry,
          future: [],
        };
      });
    },
    []
  );

  const {
    activeTransformDragMode,
    clearTransformPointerSession,
    endTransformPointerSession,
    handleMovePointerDown,
    handleMovePointerMove,
    handleMovePointerLeave,
    isTransformPointerDragging,
    queuePendingHistoryApplyEntry,
    renderSelectedLayerTransformOverlay,
  } = useExpertEditTransformSession({
    layers,
    setLayers,
    selectedLayer,
    selectedLayerImageAspectRatio,
    shouldShowSelectedLayerTransformOverlay,
    resolveRenderableLayerTransform,
    sceneZoomScale: markupViewport.scale,
    viewportOffsetXRatio: markupViewport.offsetXRatio,
    viewportOffsetYRatio: markupViewport.offsetYRatio,
    resolveViewportOffsetPixels: resolveInteractionViewportOffsetPixels,
    commitTransformHistoryTransition,
    showStatusToast,
    transformHistoryState,
    setTransformHistoryState,
  });

  const primaryCompositionSurfaceCursor = React.useMemo(() => {
    if (
      EXPERT_EDIT_IMAGE_TRANSFORM_EDITING_ENABLED &&
      isMoveToolSelected &&
      selectedLayerImageUrl
    ) {
      if (activeTransformDragMode === "rotate") {
        return isTransformPointerDragging ? "grabbing" : "crosshair";
      }
      if (activeTransformDragMode === "resize") {
        return "nwse-resize";
      }
      if (activeTransformDragMode === "move" && isTransformPointerDragging) {
        return "grabbing";
      }
      return "grab";
    }
    if (shouldShowInpaintBrushReticle) {
      return buildInpaintBrushReticleCursor(inpaintStrokeSize, activeStageRenderScale);
    }
    if (shouldShowInpaintLassoCursor) {
      return buildInpaintLassoCursor();
    }
    if (shouldShowMarkupBrushReticle) {
      return buildMarkupBrushReticleCursor(
        resolvedMarkupStrokeSize,
        MARKUP_STROKE_SIZE_MAX,
        activeStageRenderScale
      );
    }
    return undefined;
  }, [
    activeStageRenderScale,
    activeTransformDragMode,
    inpaintStrokeSize,
    isTransformPointerDragging,
    isMoveToolSelected,
    resolvedMarkupStrokeSize,
    selectedLayerImageUrl,
    shouldShowInpaintBrushReticle,
    shouldShowInpaintLassoCursor,
    shouldShowMarkupBrushReticle,
  ]);

  const markupViewportCursor = React.useMemo(() => {
    if (isMarkupPanDragging) return "grabbing";
    if (isMarkupPanSpacePressed) return "grab";
    return undefined;
  }, [isMarkupPanDragging, isMarkupPanSpacePressed]);

  const primaryCompositionSurfaceStyle = React.useMemo(() => {
    const style: React.CSSProperties = {};
    if (!isMorePresetsSurfaceOpen) {
      if (markupViewportCursor) {
        style.cursor = markupViewportCursor;
      } else if (primaryCompositionSurfaceCursor) {
        style.cursor = primaryCompositionSurfaceCursor;
      }
    }
    return style;
  }, [isMorePresetsSurfaceOpen, markupViewportCursor, primaryCompositionSurfaceCursor]);

  const emptyPrimaryCompositionSurfaceStyle = React.useMemo<React.CSSProperties>(
    () => ({
      cursor: "default",
    }),
    []
  );

  const noopStageWheel = React.useCallback(() => {}, []);

  const markupModalStageStyle = React.useMemo<React.CSSProperties>(() => {
    const modalCursor =
      markupViewportCursor ??
      primaryCompositionSurfaceCursor ??
      (isVideoToolSelected ? "crosshair" : undefined);
    const cursorStyle = modalCursor ? { cursor: modalCursor } : null;
    if (markupModalStageSize) {
      return {
        width: `${markupModalStageSize.width}px`,
        height: `${markupModalStageSize.height}px`,
        maxWidth: "100%",
        maxHeight: "100%",
        ...(cursorStyle ?? {}),
      };
    }
    return {
      aspectRatio: primaryCompositionSurfaceAspectRatio,
      width: "100%",
      maxWidth: "100%",
      maxHeight: "100%",
      ...(cursorStyle ?? {}),
    };
  }, [
    isVideoToolSelected,
    markupModalStageSize,
    markupViewportCursor,
    primaryCompositionSurfaceAspectRatio,
    primaryCompositionSurfaceCursor,
  ]);

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
    markupHistoryState,
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
    clearGenerationModeSelectionArtifacts,
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

  const handleRecenterMoveAction = React.useCallback(() => {
    if (EXPERT_EDIT_IMAGE_TRANSFORM_EDITING_ENABLED && selectedLayer) {
      const nextLayers = layers.map((layer) =>
        layer.id === selectedLayer.id
          ? {
              ...layer,
              transform: defaultLayerTransform(),
            }
          : layer
      );
      const baselineEntry = buildTransformHistoryEntry(layers);
      const nextEntry = buildTransformHistoryEntry(nextLayers);
      if (!areTransformHistoryEntriesEqual(baselineEntry, nextEntry)) {
        setLayers(nextLayers);
        commitTransformHistoryTransition(nextEntry, baselineEntry);
      }
    }
    resetMarkupViewport();
  }, [commitTransformHistoryTransition, layers, resetMarkupViewport, selectedLayer, setLayers]);

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

  const handleMarkupStagePointerTerminal = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (endMarkupPanGesture(event)) return;
      endMarkupDrawGesture(event);
    },
    [endMarkupDrawGesture, endMarkupPanGesture]
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

  const moveStageHandlers = React.useMemo(
    () => ({
      onPointerDown: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && beginMarkupPanGesture(event, context.scope)) return;
        if (!EXPERT_EDIT_IMAGE_TRANSFORM_EDITING_ENABLED) return;
        handleMovePointerDown(event);
      },
      onPointerMove: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && continueMarkupPanGesture(event)) return;
        if (!EXPERT_EDIT_IMAGE_TRANSFORM_EDITING_ENABLED) return;
        handleMovePointerMove(event);
      },
      onPointerUp: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGesture(event)) return;
        if (!EXPERT_EDIT_IMAGE_TRANSFORM_EDITING_ENABLED) return;
        endTransformPointerSession(event);
      },
      onPointerCancel: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGesture(event)) return;
        if (!EXPERT_EDIT_IMAGE_TRANSFORM_EDITING_ENABLED) return;
        endTransformPointerSession(event);
      },
      onPointerLeave: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGestureOnLeave(event)) return;
        if (!EXPERT_EDIT_IMAGE_TRANSFORM_EDITING_ENABLED) return;
        handleMovePointerLeave(event);
      },
      onWheel: (
        event: React.WheelEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope !== "modal") return;
        handleMarkupViewportWheel(event, context.scope);
      },
    }),
    [
      beginMarkupPanGesture,
      continueMarkupPanGesture,
      endMarkupPanGesture,
      endMarkupPanGestureOnLeave,
      handleMovePointerDown,
      handleMovePointerLeave,
      handleMovePointerMove,
      handleMarkupViewportWheel,
      endTransformPointerSession,
    ]
  );

  const inpaintStageHandlers = React.useMemo(
    () => ({
      onPointerDown: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && beginMarkupPanGesture(event, context.scope)) return;
        handleInpaintStagePointerDown(event);
      },
      onPointerMove: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && continueMarkupPanGesture(event)) return;
        handleInpaintStagePointerMove(event);
      },
      onPointerUp: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGesture(event)) return;
        handleInpaintStagePointerUp(event);
      },
      onPointerCancel: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGesture(event)) return;
        handleInpaintStagePointerCancel(event);
      },
      onPointerLeave: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGestureOnLeave(event)) return;
        handleInpaintStagePointerLeave(event);
      },
      onWheel: (
        event: React.WheelEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope !== "modal") return;
        handleMarkupViewportWheel(event, context.scope);
      },
    }),
    [
      beginMarkupPanGesture,
      continueMarkupPanGesture,
      endMarkupPanGesture,
      endMarkupPanGestureOnLeave,
      handleInpaintStagePointerCancel,
      handleInpaintStagePointerDown,
      handleInpaintStagePointerLeave,
      handleInpaintStagePointerMove,
      handleInpaintStagePointerUp,
      handleMarkupViewportWheel,
    ]
  );

  const markupStageHandlers = React.useMemo(
    () => ({
      onPointerDown: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && beginMarkupPanGesture(event, context.scope)) return;
        beginMarkupDrawGesture(event);
      },
      onPointerMove: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && continueMarkupPanGesture(event)) return;
        continueMarkupDrawGesture(event);
      },
      onPointerUp: handleMarkupStagePointerTerminal,
      onPointerCancel: handleMarkupStagePointerTerminal,
      onPointerLeave: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGestureOnLeave(event)) return;
        endMarkupDrawGestureOnLeave(event);
      },
      onWheel: (
        event: React.WheelEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope !== "modal") return;
        handleMarkupViewportWheel(event, context.scope);
      },
    }),
    [
      beginMarkupDrawGesture,
      beginMarkupPanGesture,
      continueMarkupDrawGesture,
      continueMarkupPanGesture,
      endMarkupDrawGestureOnLeave,
      endMarkupPanGestureOnLeave,
      handleMarkupStagePointerTerminal,
      handleMarkupViewportWheel,
    ]
  );

  const inlineStageInteractionRouter = useExpertEditStageInteractionRouter({
    scope: "inline",
    mode: activeStageInteractionMode,
    isBlocked: isMorePresetsSurfaceOpen,
    moveHandlers: moveStageHandlers,
    inpaintHandlers: inpaintStageHandlers,
    markupHandlers: markupStageHandlers,
  });

  const modalStageInteractionRouter = useExpertEditStageInteractionRouter({
    scope: "modal",
    mode: activeStageInteractionMode,
    moveHandlers: moveStageHandlers,
    inpaintHandlers: inpaintStageHandlers,
    markupHandlers: markupStageHandlers,
  });
  const shouldRenderInlineInteractiveStage = hasPrimaryCompositePreview && !isMarkupExpandSelected;

  const handleInlineStagePointerDownCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMarkupExpandSelected) return;
      if (isMorePresetsSurfaceOpen) return;
      if (
        event.target instanceof Element &&
        event.target.closest(".edit-expert-stage-overlay-ui")
      ) {
        return;
      }
      if (!beginMarkupPanGesture(event, "inline")) return;
      event.stopPropagation();
    },
    [beginMarkupPanGesture, isMarkupExpandSelected, isMorePresetsSurfaceOpen]
  );

  const handleInlineStagePointerMoveCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMarkupExpandSelected) return;
      if (isMorePresetsSurfaceOpen) return;
      if (
        event.target instanceof Element &&
        event.target.closest(".edit-expert-stage-overlay-ui")
      ) {
        return;
      }
      if (!continueMarkupPanGesture(event)) return;
      event.stopPropagation();
    },
    [continueMarkupPanGesture, isMarkupExpandSelected, isMorePresetsSurfaceOpen]
  );

  const handleInlineStagePointerUpCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMarkupExpandSelected) return;
      if (isMorePresetsSurfaceOpen) return;
      if (
        event.target instanceof Element &&
        event.target.closest(".edit-expert-stage-overlay-ui")
      ) {
        return;
      }
      if (!endMarkupPanGesture(event)) return;
      event.stopPropagation();
    },
    [endMarkupPanGesture, isMarkupExpandSelected, isMorePresetsSurfaceOpen]
  );

  const handleInlineStagePointerCancelCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMarkupExpandSelected) return;
      if (isMorePresetsSurfaceOpen) return;
      if (
        event.target instanceof Element &&
        event.target.closest(".edit-expert-stage-overlay-ui")
      ) {
        return;
      }
      if (!endMarkupPanGesture(event)) return;
      event.stopPropagation();
    },
    [endMarkupPanGesture, isMarkupExpandSelected, isMorePresetsSurfaceOpen]
  );

  const closeStageContextMenu = React.useCallback(() => {
    setStageContextMenuState((previous) =>
      previous.isOpen ? { ...previous, isOpen: false } : previous
    );
  }, []);

  const openStageContextMenu = React.useCallback((clientX: number, clientY: number) => {
    if (typeof window === "undefined") return;
    const { x, y } = resolveStageContextMenuPosition({
      clientX,
      clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
    setStageContextMenuState({
      isOpen: true,
      x,
      y,
    });
  }, []);

  const handlePrimaryDropzoneContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      if (!hasPrimaryCompositePreview) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      openStageContextMenu(event.clientX, event.clientY);
    },
    [hasPrimaryCompositePreview, isMorePresetsSurfaceOpen, openStageContextMenu]
  );

  const handleStageContextMenuRecenter = React.useCallback(() => {
    handleRecenterMoveAction();
    closeStageContextMenu();
  }, [closeStageContextMenu, handleRecenterMoveAction]);

  const openMarkupModal = React.useCallback(
    (tool?: RailTool) => {
      if (tool && tool !== selectedRailTool) {
        setSelectedRailTool(tool);
      }
      if (shouldOpenMarkupModalFromCollapsedTools) {
        clearWindowTimeoutRef(inpaintCollapseTimerRef);
        setIsInpaintCollapsed(true);
        setIsInpaintCollapsing(false);
      }
      setIsMarkupExpandSelected(true);
    },
    [selectedRailTool, shouldOpenMarkupModalFromCollapsedTools]
  );

  const closeMarkupModal = React.useCallback(() => {
    setIsMarkupExpandSelected(false);
    if (shouldOpenMarkupModalFromCollapsedTools) {
      clearWindowTimeoutRef(inpaintCollapseTimerRef);
      setIsInpaintCollapsed(true);
      setIsInpaintCollapsing(false);
      setSelectedRailTool("move");
    }
  }, [shouldOpenMarkupModalFromCollapsedTools]);

  const handleGenerationModeChange = React.useCallback((nextMode: EditSubmitIntent) => {
    setSelectedGenerationMode(nextMode);
    setSelectedRailTool(resolveRailToolForGenerationMode(nextMode));
  }, []);

  const handleStageContextMenuExpand = React.useCallback(() => {
    openMarkupModal("video");
    closeStageContextMenu();
  }, [closeStageContextMenu, openMarkupModal]);

  const handleStageContextMenuAddImage = React.useCallback(() => {
    closeStageContextMenu();
    primaryInputRef.current?.click();
  }, [closeStageContextMenu]);

  const handleStageContextMenuReset = React.useCallback(() => {
    handleResetGeneralAction();
    closeStageContextMenu();
  }, [closeStageContextMenu, handleResetGeneralAction]);

  const handleStageContextMenuRemoveImage = React.useCallback(() => {
    handleRemoveSelectedLayerImage();
    closeStageContextMenu();
  }, [closeStageContextMenu, handleRemoveSelectedLayerImage]);

  const handlePrimaryDropzoneClick = React.useCallback(() => {
    if (isMorePresetsSurfaceOpen || !hasPrimaryCompositePreview) return;
  }, [hasPrimaryCompositePreview, isMorePresetsSurfaceOpen]);

  const handlePrimaryDropzoneDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen || !hasPrimaryCompositePreview) return;
      if (!isMoveToolSelected) return;
      event.preventDefault();
      handleRecenterMoveAction();
    },
    [
      handleRecenterMoveAction,
      hasPrimaryCompositePreview,
      isMorePresetsSurfaceOpen,
      isMoveToolSelected,
    ]
  );

  const closeMorePresetsSurface = React.useCallback(() => {
    setIsMorePresetsSurfaceOpen(false);
    clearPrimaryDragActive();
    setIsPresetsSurfaceDropActive(false);
    setIsPresetPanelDropActive(false);
  }, [clearPrimaryDragActive]);

  const toggleMorePresetsSurface = React.useCallback(() => {
    setIsMorePresetsSurfaceOpen((previous) => !previous);
  }, []);
  const handleStylesPanelToggle = React.useCallback(() => {
    onStylesPanelToggle?.();
  }, [onStylesPanelToggle]);

  const handleMarkupModalDragShield = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const isDragTargetInsideMarkupModal = React.useCallback(
    (target: EventTarget | null) => {
      return isEventTargetInsideElement(markupModalRef.current, target);
    },
    [markupModalRef]
  );

  const handleMarkupModalRootDragCapture = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isMarkupExpandSelected) return;
      if (isDragTargetInsideMarkupModal(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
    },
    [isDragTargetInsideMarkupModal, isMarkupExpandSelected]
  );

  useExpertEditSessionBridge({
    initialReferenceImageUrl: referenceImageUrl,
    foundationLayerId,
    selectedLayerIndex,
    layers,
    markupStrokes,
    markupHistoryState,
    inpaintHistoryState,
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

  React.useEffect(() => {
    if (!isMoveToolSelected) {
      clearTransformPointerSession();
    }
  }, [clearTransformPointerSession, isMoveToolSelected]);

  React.useEffect(() => {
    const isMarkupPanKeyboardListeningEnabled = isMarkupExpandSelected || !isMorePresetsSurfaceOpen;
    if (!isMarkupPanKeyboardListeningEnabled) {
      setIsMarkupPanSpacePressed(false);
      return;
    }
    if (typeof window === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isSpaceActivationKey(event)) return;
      setIsMarkupPanSpacePressed(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (!isSpaceActivationKey(event)) return;
      setIsMarkupPanSpacePressed(false);
    };
    const handleWindowBlur = () => {
      setIsMarkupPanSpacePressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [isMarkupExpandSelected, isMorePresetsSurfaceOpen]);

  React.useEffect(() => {
    if (isVideoToolSelected) return;
    clearMarkupDrawGestureSession();
  }, [clearMarkupDrawGestureSession, isVideoToolSelected]);

  React.useEffect(() => {
    if (!isMarkupExpandSelected || typeof document === "undefined") return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isMarkupExpandSelected]);

  React.useEffect(() => {
    if (!isMarkupExpandSelected || typeof window === "undefined") return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeMarkupModal();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeMarkupModal, isMarkupExpandSelected]);

  React.useEffect(() => {
    if (!isMarkupExpandSelected || typeof window === "undefined") return;
    const handleHistoryHotkey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.altKey) return;
      if (isKeyboardEventFromEditableTarget(event)) return;
      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier) return;
      const key = event.key.toLowerCase();
      const isUndo = key === "z" && !event.shiftKey;
      const isRedo = (key === "z" && event.shiftKey) || key === "y";
      if (!isUndo && !isRedo) return;
      event.preventDefault();
      if (isUndo) {
        if (!canUndoGeneralAction) return;
        handleUndoGeneralAction();
        return;
      }
      if (!canRedoGeneralAction) return;
      handleRedoGeneralAction();
    };
    window.addEventListener("keydown", handleHistoryHotkey);
    return () => {
      window.removeEventListener("keydown", handleHistoryHotkey);
    };
  }, [
    canRedoGeneralAction,
    canUndoGeneralAction,
    handleRedoGeneralAction,
    handleUndoGeneralAction,
    isMarkupExpandSelected,
  ]);

  React.useEffect(() => {
    if (!stageContextMenuState.isOpen || typeof document === "undefined") return;
    const handlePointerDown = (event: PointerEvent) => {
      if (isEventTargetInsideElement(stageContextMenuRef.current, event.target)) return;
      closeStageContextMenu();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeStageContextMenu();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeStageContextMenu, stageContextMenuState.isOpen]);

  React.useEffect(() => {
    if (!isMorePresetsSurfaceOpen && !isMarkupExpandSelected) return;
    closeStageContextMenu();
  }, [closeStageContextMenu, isMarkupExpandSelected, isMorePresetsSurfaceOpen]);

  React.useEffect(() => {
    if (isMarkupExpandSelected) return;
    const inlineStageElement = inlineStageWrapperRef.current;
    if (!inlineStageElement) return;

    const handleInlineStageWheel = (event: WheelEvent) => {
      if (isMorePresetsSurfaceOpen) return;
      handleNativeMarkupViewportWheel(event, "inline", inlineStageElement);
      if (event.defaultPrevented) {
        event.stopPropagation();
      }
    };

    inlineStageElement.addEventListener("wheel", handleInlineStageWheel, { passive: false });
    return () => {
      inlineStageElement.removeEventListener("wheel", handleInlineStageWheel);
    };
  }, [
    handleNativeMarkupViewportWheel,
    inlineStageWrapperRef,
    isMarkupExpandSelected,
    isMorePresetsSurfaceOpen,
  ]);

  React.useEffect(() => {
    if (!isMarkupExpandSelected) return;
    const modalStageElement = markupModalStageRef.current;
    if (!modalStageElement) return;

    const handleModalStageWheel = (event: WheelEvent) => {
      handleNativeMarkupViewportWheel(event, "modal", modalStageElement);
      if (event.defaultPrevented) {
        event.stopPropagation();
      }
    };

    modalStageElement.addEventListener("wheel", handleModalStageWheel, {
      passive: false,
    });
    return () => {
      modalStageElement.removeEventListener("wheel", handleModalStageWheel);
    };
  }, [
    handleNativeMarkupViewportWheel,
    isMarkupExpandSelected,
    markupModalStageRef,
    markupModalStageSize,
  ]);

  React.useEffect(() => {
    if (!shouldShowInpaintBrushReticle || isMorePresetsSurfaceOpen) {
      unlockGlobalCursor();
    }
  }, [isMorePresetsSurfaceOpen, shouldShowInpaintBrushReticle, unlockGlobalCursor]);

  React.useEffect(
    () => () => {
      unlockGlobalCursor();
      queuePendingHistoryApplyEntry(null);
      clearHistoryEphemera();
      clearWindowTimeoutRef(inpaintCollapseTimerRef);
      clearWindowTimeoutRef(toastVisibleTimerRef);
      clearWindowTimeoutRef(toastFadeTimerRef);
      clearTransientObjectUrlRevokeTimers({
        timersByUrl: transientRevokeTimersRef.current,
        revokeObjectUrl: revokeObjectUrlSafe,
      });
    },
    [clearHistoryEphemera, queuePendingHistoryApplyEntry, unlockGlobalCursor]
  );

  const handleInpaintCollapseToggle = React.useCallback(() => {
    const collapseDecision = resolveInpaintCollapseToggleDecision({
      isInpaintCollapsed,
      shouldOpenMarkupModalFromCollapsedTools,
    });
    if (collapseDecision === "open_markup_modal") {
      openMarkupModal();
      return;
    }

    clearWindowTimeoutRef(inpaintCollapseTimerRef);

    if (collapseDecision === "expand_inpaint") {
      setIsInpaintCollapsed(false);
      setIsInpaintCollapsing(false);
      return;
    }

    setIsInpaintCollapsing(true);
    inpaintCollapseTimerRef.current = window.setTimeout(() => {
      setIsInpaintCollapsed(true);
      setIsInpaintCollapsing(false);
      inpaintCollapseTimerRef.current = null;
    }, INPAINT_COLLAPSE_ANIMATION_MS);
  }, [isInpaintCollapsed, openMarkupModal, shouldOpenMarkupModalFromCollapsedTools]);

  const applyMarkupColorFromHex = React.useCallback((value: string) => {
    const parsed = parseHexColor(value);
    if (!parsed) return;
    setMarkupColorHsv(rgbToHsv(parsed));
    setIsMarkupColorPickerOpen(false);
  }, []);

  const applyMarkupSaturationValueFromPointer = React.useCallback(
    (clientX: number, clientY: number) => {
      const saturationSurface = markupColorSaturationRef.current;
      if (!saturationSurface) return;
      const rect = saturationSurface.getBoundingClientRect();
      if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return;
      if (rect.width <= 0 || rect.height <= 0) return;
      const saturation = clampNumber((clientX - rect.left) / rect.width, 0, 1);
      const value = 1 - clampNumber((clientY - rect.top) / rect.height, 0, 1);
      setMarkupColorHsv((previous) => ({
        ...previous,
        s: saturation,
        v: value,
      }));
    },
    []
  );

  const handleMarkupSaturationPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      applyMarkupSaturationValueFromPointer(event.clientX, event.clientY);
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },
    [applyMarkupSaturationValueFromPointer]
  );

  const handleMarkupSaturationPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const isPointerActive =
        event.buttons > 0 || event.currentTarget.hasPointerCapture(event.pointerId);
      if (!isPointerActive) return;
      event.preventDefault();
      applyMarkupSaturationValueFromPointer(event.clientX, event.clientY);
    },
    [applyMarkupSaturationValueFromPointer]
  );

  const handleMarkupSaturationPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setIsMarkupColorPickerOpen(false);
    },
    []
  );

  const handleMarkupHueChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextHue = clampNumber(Number(event.target.value), 0, 360);
    setMarkupColorHsv((previous) => ({
      ...previous,
      h: nextHue,
    }));
  }, []);

  React.useEffect(() => {
    if (!isVideoToolSelected) {
      setIsMarkupColorPickerOpen(false);
    }
  }, [isVideoToolSelected]);

  React.useEffect(() => {
    if (!isMarkupColorPickerOpen || typeof document === "undefined") return;
    const handlePointerDown = (event: PointerEvent) => {
      if (isEventTargetInsideElement(markupColorPickerAnchorRef.current, event.target)) return;
      setIsMarkupColorPickerOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsMarkupColorPickerOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMarkupColorPickerOpen]);

  const renderMarkupControlsContent = (scope: "inline" | "modal") => {
    const isModalScope = scope === "modal";
    const isMarkupToolActive = isVideoToolSelected;
    const modeIconSize = isModalScope ? 19 : 16;
    const strokeSizeControlId = `edit-expert-markup-stroke-size-${scope}`;
    const colorPickerId = `edit-expert-markup-color-picker-${scope}`;
    const hueSliderId = `edit-expert-markup-color-hue-${scope}`;
    return (
      <div className="edit-expert-markup-controls-content">
        <div className="edit-expert-inpaint-mode-row" role="group" aria-label="Markup tool mode">
          <button
            type="button"
            className={`edit-expert-inpaint-mode-btn ${isModalScope ? "edit-expert-markup-icon-only-btn" : ""} ${
              selectedMarkupMode === "pen" && isMarkupToolActive ? "is-active" : ""
            }`.trim()}
            aria-pressed={selectedMarkupMode === "pen" && isMarkupToolActive}
            aria-label="Pen"
            onClick={() => {
              setSelectedRailTool("video");
              setSelectedMarkupMode("pen");
            }}
          >
            <PencilSimple size={modeIconSize} weight="regular" />
            {!isModalScope ? <span>Pen</span> : null}
          </button>
          <button
            type="button"
            className={`edit-expert-inpaint-mode-btn edit-expert-markup-eraser-btn ${
              isModalScope ? "edit-expert-markup-icon-only-btn" : ""
            } ${selectedMarkupMode === "eraser" && isMarkupToolActive ? "is-active" : ""}`.trim()}
            aria-pressed={selectedMarkupMode === "eraser" && isMarkupToolActive}
            aria-label="Eraser"
            onClick={() => {
              setSelectedRailTool("video");
              setSelectedMarkupMode("eraser");
            }}
          >
            <Eraser size={modeIconSize} weight="regular" />
            {!isModalScope ? <span>Eraser</span> : null}
          </button>
          {isModalScope ? (
            <button
              type="button"
              className="edit-expert-inpaint-action-btn edit-expert-markup-clear-btn-modal"
              aria-label="Clear markup strokes"
              onClick={clearMarkupStrokesWithHistory}
            >
              <TrashSimple size={19} weight="regular" />
            </button>
          ) : (
            <button
              type="button"
              className={`edit-expert-inpaint-mode-btn edit-expert-markup-collapse-btn ${
                isMarkupExpandSelected ? "is-active" : ""
              }`}
              aria-pressed={isMarkupExpandSelected}
              onClick={() => {
                if (isMarkupExpandSelected) {
                  closeMarkupModal();
                  return;
                }
                openMarkupModal("video");
              }}
              aria-label="Expand markup tools"
            >
              <ArrowsOutSimple size={modeIconSize} weight="regular" />
            </button>
          )}
        </div>
        <div className="edit-expert-inpaint-stroke-row">
          <label className="edit-expert-inpaint-stroke-label" htmlFor={strokeSizeControlId}>
            Stroke Size
          </label>
          <input
            id={strokeSizeControlId}
            className="edit-expert-inpaint-stroke-slider"
            type="range"
            min={1}
            max={MARKUP_STROKE_SIZE_MAX}
            value={resolvedMarkupStrokeSize}
            onChange={(event) =>
              setMarkupStrokeSize(
                clampNumber(Number(event.target.value), 1, MARKUP_STROKE_SIZE_MAX)
              )
            }
            onDoubleClick={() => setMarkupStrokeSize(MARKUP_STROKE_SIZE_DEFAULT)}
            aria-label="Stroke size"
          />
        </div>
        <div className="edit-expert-markup-color-row">
          <span className="edit-expert-markup-color-label">Color</span>
          <div className="edit-expert-markup-color-picker-anchor" ref={markupColorPickerAnchorRef}>
            <button
              id={colorPickerId}
              type="button"
              className="edit-expert-markup-color-picker"
              style={{ backgroundColor: markupColor }}
              aria-label="Markup color"
              aria-expanded={isMarkupColorPickerOpen}
              aria-haspopup="dialog"
              onClick={() => setIsMarkupColorPickerOpen((previous) => !previous)}
            />
            {isMarkupColorPickerOpen ? (
              <div
                className="edit-expert-markup-color-popover"
                role="dialog"
                aria-label="Markup color picker"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="edit-expert-markup-color-popover-header">
                  <p className="edit-expert-markup-color-popover-title">Markup Color</p>
                  <span className="edit-expert-markup-color-popover-value">
                    {markupColor.toUpperCase()}
                  </span>
                </div>
                <div
                  ref={markupColorSaturationRef}
                  className="edit-expert-markup-color-popover-saturation"
                  style={{
                    background: `linear-gradient(to top, #000000, rgba(0, 0, 0, 0)), linear-gradient(to right, #ffffff, hsl(${Math.round(markupColorHsv.h)}, 100%, 50%))`,
                  }}
                  onPointerDown={handleMarkupSaturationPointerDown}
                  onPointerMove={handleMarkupSaturationPointerMove}
                  onPointerUp={handleMarkupSaturationPointerUp}
                  onPointerCancel={handleMarkupSaturationPointerUp}
                >
                  <span
                    className="edit-expert-markup-color-popover-saturation-thumb"
                    style={{
                      left: `${markupColorHsv.s * 100}%`,
                      top: `${(1 - markupColorHsv.v) * 100}%`,
                    }}
                    aria-hidden="true"
                  />
                </div>
                <div className="edit-expert-markup-color-popover-hue">
                  <label
                    htmlFor={hueSliderId}
                    className="edit-expert-markup-color-popover-hue-label"
                  >
                    Hue
                  </label>
                  <input
                    id={hueSliderId}
                    type="range"
                    min={0}
                    max={360}
                    step={1}
                    value={Math.round(markupColorHsv.h)}
                    className="edit-expert-markup-color-popover-hue-slider"
                    aria-label="Markup hue"
                    onChange={handleMarkupHueChange}
                  />
                </div>
                <div
                  className="edit-expert-markup-color-popover-swatches"
                  aria-label="Markup swatches"
                >
                  {MARKUP_COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      className={`edit-expert-markup-color-popover-swatch ${
                        markupColor.toLowerCase() === swatch.toLowerCase() ? "is-active" : ""
                      }`}
                      style={{ backgroundColor: swatch }}
                      aria-label={`Select ${swatch} color`}
                      onClick={() => applyMarkupColorFromHex(swatch)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {!isModalScope ? (
            <button
              type="button"
              className="edit-expert-inpaint-action-btn edit-expert-markup-clear-btn"
              aria-label="Clear markup strokes"
              onClick={clearMarkupStrokesWithHistory}
            >
              <TrashSimple size={18} weight="regular" />
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const renderMoveControlsContent = (scope: "inline" | "modal") => {
    const isModalScope = scope === "modal";
    const isAdjustSelected = isMoveToolSelected;
    const modeIconSize = isModalScope ? 18 : 16;
    const recenterIconSize = isModalScope ? 16 : 14;
    const zoomSliderId = isModalScope
      ? "edit-expert-move-zoom-slider-modal"
      : "edit-expert-move-zoom-slider";
    return (
      <div className="edit-expert-move-controls-content">
        <div
          className={`edit-expert-move-mode-row ${isModalScope ? "edit-expert-move-mode-row--modal" : ""}`.trim()}
          role="group"
          aria-label="Move tool mode"
        >
          <button
            type="button"
            className={`edit-expert-move-mode-btn edit-expert-move-adjust-btn ${
              isAdjustSelected ? "is-active" : ""
            }`.trim()}
            aria-pressed={isAdjustSelected}
            aria-label="Adjust"
            onClick={() => setSelectedRailTool("move")}
          >
            <ArrowsOutCardinal size={modeIconSize} weight="regular" />
            Adjust
          </button>
          <button
            type="button"
            className="edit-expert-move-mode-btn edit-expert-move-center-btn"
            aria-label="Center move action"
            onClick={handleRecenterMoveAction}
            disabled={!isModalScope && isMoveTransformCentered && isMarkupViewportAtRest}
          >
            <ArrowsInCardinal size={recenterIconSize} weight="regular" />
            Center
          </button>
          {!isModalScope ? (
            <button
              type="button"
              className="edit-expert-move-mode-btn edit-expert-move-expand-btn"
              aria-label="Expand markup tools"
              onClick={() => openMarkupModal("video")}
            >
              <ArrowsOutSimple size={modeIconSize} weight="regular" />
            </button>
          ) : null}
        </div>
        <div className="edit-expert-move-zoom-row">
          <label className="edit-expert-move-zoom-label" htmlFor={zoomSliderId}>
            Zoom
          </label>
          <input
            id={zoomSliderId}
            className="edit-expert-move-zoom-slider"
            type="range"
            min={MOVE_STAGE_ZOOM_SLIDER_MIN}
            max={MOVE_STAGE_ZOOM_SLIDER_MAX}
            step={1}
            value={moveStageZoomSliderValue}
            onChange={(event) => handleMoveZoomSliderChange(Number(event.target.value))}
            onDoubleClick={() => handleMoveZoomSliderChange(MOVE_STAGE_ZOOM_SLIDER_DEFAULT)}
            aria-label="Zoom stage"
          />
        </div>
        {!isModalScope ? (
          <div className="edit-expert-move-history-row">
            <button
              type="button"
              className="edit-expert-move-history-btn"
              aria-label="Undo move action"
              onClick={handleUndoGeneralAction}
              disabled={!canUndoGeneralAction}
            >
              <ArrowCounterClockwise size={14} weight="regular" />
              Undo
            </button>
            <button
              type="button"
              className="edit-expert-move-history-btn"
              aria-label="Redo move action"
              onClick={handleRedoGeneralAction}
              disabled={!canRedoGeneralAction}
            >
              <ArrowClockwise size={14} weight="regular" />
              Redo
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  const renderMarkupModalGeneralPanel = () => {
    return (
      <div className="edit-expert-markup-modal-general-content">
        <div
          className="edit-expert-markup-modal-general-row"
          role="group"
          aria-label="General actions"
        >
          <button
            type="button"
            className="edit-expert-markup-modal-general-btn edit-expert-markup-modal-general-btn--icon"
            aria-label="Undo action"
            onClick={handleUndoGeneralAction}
            disabled={!canUndoGeneralAction}
          >
            <ArrowCounterClockwise size={15} weight="regular" />
          </button>
          <button
            type="button"
            className="edit-expert-markup-modal-general-btn edit-expert-markup-modal-general-btn--icon"
            aria-label="Redo action"
            onClick={handleRedoGeneralAction}
            disabled={!canRedoGeneralAction}
          >
            <ArrowClockwise size={15} weight="regular" />
          </button>
          <button
            type="button"
            className="edit-expert-markup-modal-general-btn edit-expert-markup-modal-general-btn--reset"
            aria-label="Reset stage"
            onClick={handleResetGeneralAction}
            disabled={isGeneralResetDisabled}
          >
            Reset
          </button>
        </div>
        <div
          className="edit-expert-markup-modal-general-row edit-expert-markup-modal-general-row--aspect"
          role="group"
          aria-label="Aspect ratio selector"
        >
          <p className="edit-expert-markup-modal-general-subtitle">Frame</p>
          <AspectDropdown
            aspect={aspect}
            onSelect={onAspectChange}
            options={aspectOptionsForModel}
          />
        </div>
      </div>
    );
  };

  const renderMarkupModalMovePanel = () => {
    return renderMoveControlsContent("modal");
  };

  const renderPresetUtilityActionButtons = () =>
    editPresetUtilityActions.map((action) => {
      const Icon = action.icon;
      const isActionDisabled = Boolean(
        isGenerateDisabled || (action.requiresPrimaryImage && !selectedLayerImageUrl)
      );
      const actionCreditCost = action.creditCost;
      return (
        <button
          key={action.id}
          type="button"
          className={`edit-expert-preset-action-btn ${action.buttonClassName ?? ""}`.trim()}
          aria-label={action.label}
          disabled={isActionDisabled}
          onClick={
            action.id === "composite-regenerate" ? handleCompositeRegeneratePromptInsert : undefined
          }
        >
          {!action.hideIcon ? (
            <span className="edit-expert-preset-action-btn-icon" aria-hidden="true">
              <Icon size={20} weight={action.iconWeight ?? "regular"} />
            </span>
          ) : null}
          <span className="edit-expert-preset-action-btn-copy">
            <span>{action.label}</span>
          </span>
          {actionCreditCost != null ? (
            <span className="edit-expert-preset-action-btn-cost-column" aria-hidden="true">
              <span className="edit-expert-preset-action-btn-cost">
                <span className="model-chip-icon">✦</span>
                <span className="model-chip-credits">{actionCreditCost}</span>
              </span>
            </span>
          ) : null}
        </button>
      );
    });

  const renderMarkupModalInpaintPanel = (scope: "modal" | "rail" = "modal") => {
    const isRailScope = scope === "rail";
    const modeIconSize = 19;
    const strokeSizeControlId = `edit-expert-markup-modal-inpaint-stroke-size-${scope}`;
    return (
      <div
        className={`edit-expert-markup-modal-inpaint-content ${
          isRailScope ? "edit-expert-markup-modal-inpaint-content--rail" : ""
        }`.trim()}
      >
        <div
          className={`edit-expert-inpaint-mode-row ${
            isRailScope ? "edit-expert-inpaint-mode-row--rail" : ""
          }`.trim()}
          role="group"
          aria-label="In-paint tool mode"
        >
          <button
            type="button"
            className={`edit-expert-inpaint-mode-btn edit-expert-markup-icon-only-btn ${
              selectedInpaintMode === "brush" && isInpaintToolSelected ? "is-active" : ""
            }`}
            aria-pressed={selectedInpaintMode === "brush" && isInpaintToolSelected}
            aria-label="Brush"
            onClick={() => {
              setSelectedRailTool("inpaint");
              setSelectedInpaintMode("brush");
            }}
          >
            <PaintBrush size={modeIconSize} weight="regular" />
          </button>
          <button
            type="button"
            className={`edit-expert-inpaint-mode-btn edit-expert-markup-icon-only-btn ${
              selectedInpaintMode === "lasso" && isInpaintToolSelected ? "is-active" : ""
            }`}
            aria-pressed={selectedInpaintMode === "lasso" && isInpaintToolSelected}
            aria-label="Lasso"
            onClick={() => {
              setSelectedRailTool("inpaint");
              setSelectedInpaintMode("lasso");
            }}
          >
            <CircleDashed size={modeIconSize} weight="regular" />
          </button>
          <button
            type="button"
            className="edit-expert-inpaint-action-btn edit-expert-markup-modal-inpaint-clear-btn"
            aria-label="Clear in-paint selection"
            onClick={clearInpaintSelectionWithHistory}
          >
            <TrashSimple size={19} weight="regular" />
          </button>
        </div>
        <div className="edit-expert-inpaint-stroke-row">
          <label className="edit-expert-inpaint-stroke-label" htmlFor={strokeSizeControlId}>
            Stroke Size
          </label>
          <input
            id={strokeSizeControlId}
            className="edit-expert-inpaint-stroke-slider"
            type="range"
            min={1}
            max={100}
            value={inpaintStrokeSize}
            onChange={(event) => setInpaintStrokeSize(Number(event.target.value))}
            onDoubleClick={() => setInpaintStrokeSize(INPAINT_STROKE_SIZE_DEFAULT)}
            aria-label="In-paint stroke size"
          />
        </div>
        <div className="edit-expert-inpaint-selection-row">
          <div
            className="edit-expert-inpaint-select-tabs"
            role="tablist"
            aria-label="In-paint selection mode"
          >
            <button
              type="button"
              className={`edit-expert-inpaint-select-tab ${
                selectedInpaintSelectionTab === "select" ? "is-active" : ""
              }`}
              role="tab"
              aria-selected={selectedInpaintSelectionTab === "select"}
              onClick={() => setSelectedInpaintSelectionTab("select")}
            >
              Select
            </button>
            <button
              type="button"
              className={`edit-expert-inpaint-select-tab ${
                selectedInpaintSelectionTab === "unselect" ? "is-active" : ""
              }`}
              role="tab"
              aria-selected={selectedInpaintSelectionTab === "unselect"}
              onClick={() => setSelectedInpaintSelectionTab("unselect")}
            >
              Unselect
            </button>
          </div>
          {!isRailScope ? (
            <button
              type="button"
              className="edit-expert-inpaint-action-btn edit-expert-markup-modal-inpaint-invert-btn"
              aria-label="Invert in-paint selection"
              onClick={invertInpaintSelectionWithHistory}
              disabled={!imageHasInteractiveMask}
            >
              <CircleHalf size={18} weight="regular" />
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const renderPrimaryStageSceneContent = React.useCallback(
    ({
      scope,
      overlayCanvas,
      stageSize,
      stageElement,
    }: {
      scope: "inline" | "modal";
      overlayCanvas: React.RefObject<HTMLCanvasElement>;
      stageSize: StageViewportSize;
      stageElement: HTMLDivElement | null;
    }) => {
      const renderStageSize = resolveRenderableStageViewportSize({
        preferredSize: stageSize,
        stageElement,
      });
      return (
        <>
          {layers.map((layer, index) =>
            layer.imageUrl
              ? (() => {
                  const constrainedTransform = resolveRenderableLayerTransform(layer);
                  const layerRect = resolveContainedLayerRect({
                    imageAspectRatio: resolveLayerImageAspectRatio(layer),
                    viewportWidth: renderStageSize.width,
                    viewportHeight: renderStageSize.height,
                  });
                  const translateX = constrainedTransform.translateXRatio * renderStageSize.width;
                  const translateY = constrainedTransform.translateYRatio * renderStageSize.height;
                  return (
                    <div
                      key={scope === "modal" ? `markup-modal-${layer.id}` : layer.id}
                      className="edit-expert-primary-layer-frame"
                      style={{
                        left: `${layerRect.leftPercent}%`,
                        top: `${layerRect.topPercent}%`,
                        width: `${layerRect.widthPercent}%`,
                        height: `${layerRect.heightPercent}%`,
                        backgroundImage: `url(${layer.imageUrl})`,
                        zIndex: layers.length - index,
                        opacity: clampLayerOpacity(layer.opacity),
                        transform: `translate(${Math.round(translateX * 100) / 100}px, ${
                          Math.round(translateY * 100) / 100
                        }px) scale(${constrainedTransform.scale}) rotate(${constrainedTransform.rotationDeg}deg)`,
                        transformOrigin: "center center",
                      }}
                    />
                  );
                })()
              : null
          )}
          <canvas
            ref={overlayCanvas}
            className="edit-expert-inpaint-overlay-canvas"
            aria-hidden="true"
          />
          {renderMarkupStrokeOverlay(scope, renderStageSize, stageElement)}
          {renderPrimaryStageBusyOverlay()}
        </>
      );
    },
    [
      layers,
      resolveRenderableLayerTransform,
      resolveLayerImageAspectRatio,
      renderMarkupStrokeOverlay,
      renderPrimaryStageBusyOverlay,
    ]
  );

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
      <div className="edit-expert-main-stage">
        <div className="edit-expert-preset-toolbar" aria-label="Edit preset toolbar">
          <div className="edit-expert-column-wrapper edit-expert-column-wrapper--left">
            {isGenerationModeToggleEnabled && !shouldHideSelectedModeRailPanel ? (
              <ExpertEditModeRailPanel
                selectedRailTool={selectedRailTool}
                renderMarkupModalInpaintPanel={renderMarkupModalInpaintPanel}
                renderMarkupControlsContent={renderMarkupControlsContent}
                renderMoveControlsContent={renderMoveControlsContent}
              />
            ) : null}
            <div className="edit-expert-preset-toolbar-card edit-expert-preset-toolbar-card--inline">
              <div className="edit-expert-preset-toolbar-title-card edit-expert-preset-toolbar-title-card--embedded">
                <p className="edit-expert-preset-toolbar-title">Prompt Presets</p>
                <span className="edit-expert-preset-toolbar-title-icon" aria-hidden="true">
                  <Sliders size={14} weight="regular" />
                </span>
              </div>
              <div className="edit-expert-preset-toolbar-list">
                <div
                  className={`edit-expert-preset-dropzone ${
                    hasSelectedPresetIds ? "is-populated" : "is-empty"
                  } ${isPresetPanelDropActive ? "is-drop-active" : ""}`.trim()}
                  aria-label="Preset panel list"
                  onDragOver={handlePresetPanelDragOver}
                  onDragLeave={handlePresetPanelDragLeave}
                  onDrop={handlePresetPanelDrop}
                >
                  {hasSelectedPresetIds ? (
                    selectedPanelPresets.map((preset) => (
                      <button
                        key={preset.presetId}
                        type="button"
                        draggable
                        className="edit-expert-preset-btn edit-expert-preset-btn--selected"
                        aria-label={`Apply ${preset.label} preset`}
                        onClick={() => handlePanelPresetApply(preset.presetId)}
                        onDragStart={(event) => handlePanelPresetDragStart(event, preset.presetId)}
                        onDragEnd={handlePresetDragEnd}
                      >
                        {preset.label}
                      </button>
                    ))
                  ) : (
                    <button
                      type="button"
                      className="edit-expert-preset-empty-drop"
                      aria-label="Empty preset drop target"
                      onClick={() => setIsMorePresetsSurfaceOpen(true)}
                    >
                      Drag presets here
                    </button>
                  )}
                </div>
                <div className="edit-expert-preset-divider" aria-hidden="true" />
                <button
                  type="button"
                  className="edit-expert-preset-btn"
                  aria-label={`Apply ${EDIT_PRESET_MORE_LABEL} preset`}
                  aria-expanded={isMorePresetsSurfaceOpen}
                  aria-controls={morePresetsSurfaceId}
                  onClick={toggleMorePresetsSurface}
                >
                  <span className="edit-expert-preset-btn-icon" aria-hidden="true">
                    <GearSix size={12} weight="regular" />
                  </span>
                  {EDIT_PRESET_MORE_LABEL}
                </button>
              </div>
            </div>
            <div className="edit-expert-utility-actions" aria-label="Edit utility actions">
              {renderPresetUtilityActionButtons()}
              <ExpertEditLayerUtilityActions
                isGenerateDisabled={isGenerateDisabled}
                selectedLayerImageUrl={selectedLayerImageUrl}
                isRemoveBackgroundPending={isRemoveBackgroundPending}
                populatedLayerCount={populatedLayerCount}
                isFlattenPending={isFlattenPending}
                onFlatten={() => void handleManualFlatten()}
                onRemoveBackground={handleRemoveBackground}
                className={null}
              />
            </div>
            <ExpertEditPresetsSurface
              id={morePresetsSurfaceId}
              isOpen={isMorePresetsSurfaceOpen}
              presets={availablePresets}
              onClose={closeMorePresetsSurface}
              onPresetDragStart={handleSurfacePresetDragStart}
              onPresetDragEnd={handlePresetDragEnd}
              onSurfaceDragOver={handlePresetsSurfaceDragOver}
              onSurfaceDragLeave={handlePresetsSurfaceDragLeave}
              onSurfaceDrop={handlePresetsSurfaceDrop}
              onCustomPresetSave={handleCustomPresetSave}
              isDropActive={isPresetsSurfaceDropActive}
            />
          </div>
        </div>

        <div className="edit-expert-primary-column">
          {isGenerationModeToggleEnabled ? (
            <div className="edit-expert-primary-column-header">
              <div className="edit-expert-generation-mode-header-controls">
                <div
                  className="edit-expert-generation-mode-tabs"
                  role="tablist"
                  aria-label="Generation mode"
                  style={generationModeTabsStyle}
                >
                  <span className="edit-expert-generation-mode-indicator" aria-hidden="true" />
                  {editGenerationModeOptions.map((modeOption) => (
                    <button
                      key={modeOption.id}
                      type="button"
                      className={`edit-expert-generation-mode-tab ${
                        effectiveEditSubmitIntent === modeOption.id ? "is-active" : ""
                      }`}
                      role="tab"
                      aria-selected={effectiveEditSubmitIntent === modeOption.id}
                      onClick={() => handleGenerationModeChange(modeOption.id)}
                    >
                      {modeOption.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="edit-expert-inpaint-action-btn edit-expert-generation-mode-clear-btn"
                  aria-label="Clear all in-paint selections and markup strokes"
                  onClick={clearGenerationModeSelectionArtifacts}
                >
                  <TrashSimple size={19} weight="regular" />
                </button>
              </div>
            </div>
          ) : null}
          <ExpertEditInlineStageSurface
            stageRef={inlineStageWrapperRef}
            isEmpty={!hasPrimaryCompositePreview}
            isBusy={isPrimaryStageBusy}
            overlayActions={
              hasPrimaryCompositePreview && selectedLayer ? (
                <div className="edit-expert-stage-overlay-ui">
                  <button
                    type="button"
                    className="edit-expert-layer-delete-btn edit-expert-stage-delete-btn"
                    aria-label={`Delete selected layer (${selectedLayer.name})`}
                    onClick={handleDeleteSelectedLayer}
                  >
                    <TrashSimple size={12} weight="regular" />
                  </button>
                </div>
              ) : null
            }
            onPointerDownCapture={handleInlineStagePointerDownCapture}
            onPointerMoveCapture={handleInlineStagePointerMoveCapture}
            onPointerUpCapture={handleInlineStagePointerUpCapture}
            onPointerCancelCapture={handleInlineStagePointerCancelCapture}
            viewportStyle={inlineMarkupViewportStyle}
            frameStackRef={handlePrimaryCanvasFrameStackRef}
            isPopulated={hasPrimaryCompositePreview}
            isDragActive={primaryDragActive}
            frameStyle={primaryCanvasFrameBoundsStyle}
            onDrop={handlePrimaryDrop}
            onDragEnter={handlePrimaryDragEnter}
            onDragOver={handlePrimaryDragOver}
            onDragLeave={handlePrimaryDragLeave}
            surfaceRef={primaryCompositionSurfaceRef}
            isVisible={hasPrimaryCompositePreview}
            isPresetsOpen={isMorePresetsSurfaceOpen}
            surfaceStyle={
              hasPrimaryCompositePreview
                ? primaryCompositionSurfaceStyle
                : emptyPrimaryCompositionSurfaceStyle
            }
            shouldRenderInteractive={shouldRenderInlineInteractiveStage}
            interactionHandlers={{
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
            sceneContent={renderPrimaryStageSceneContent({
              scope: "inline",
              overlayCanvas: overlayCanvasRef,
              stageSize: inlineCompositionSurfaceViewportSize,
              stageElement: primaryCanvasFrameStackElement,
            })}
            transformOverlay={renderSelectedLayerTransformOverlay(
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
          />
          <ExpertEditLayersPanel
            scope="main"
            layers={layers}
            editingLayerIndex={editingLayerIndex}
            editingLayerValue={editingLayerValue}
            draggingLayerIndex={draggingLayerIndex}
            dragOverLayerIndex={dragOverLayerIndex}
            resolvedSelectedLayerIndex={resolvedSelectedLayerIndex}
            statusToastMessage={statusToastMessage}
            statusToastTone={statusToastTone}
            isStatusToastFading={isStatusToastFading}
            isLayerLimitStatusToast={isLayerLimitStatusToast}
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
          <div className="edit-expert-column-wrapper edit-expert-column-wrapper--center edit-expert-post-stage-wrapper">
            <div
              className={`edit-expert-inpaint-row ${isInpaintCollapsed ? "is-collapsed" : ""} ${
                isInpaintCollapsing ? "is-collapsing" : ""
              }`.trim()}
            >
              {isInpaintCollapsed ? (
                <button
                  type="button"
                  className={`edit-expert-inpaint-collapse-btn edit-expert-inpaint-collapse-btn--hidden ${collapsedToolsThemeClass}`}
                  aria-label="Expand inpaint controls"
                  aria-expanded={!isInpaintCollapsed}
                  aria-controls="edit-expert-inpaint-content"
                  onClick={handleInpaintCollapseToggle}
                >
                  {activeCollapsedRailTool.label}
                </button>
              ) : null}
              {!isInpaintCollapsed ? (
                <div className="edit-expert-inpaint-collapse-control">
                  <button
                    type="button"
                    className={`edit-expert-inpaint-collapse-btn ${collapsedToolsThemeClass}`}
                    aria-label="Collapse inpaint controls"
                    aria-expanded={!isInpaintCollapsed}
                    aria-controls="edit-expert-inpaint-content"
                    onClick={handleInpaintCollapseToggle}
                  >
                    <CaretRight size={20} weight="fill" data-testid="inpaint-collapse-icon-dots" />
                  </button>
                </div>
              ) : null}
              {!isInpaintCollapsed ? (
                <div
                  className={`edit-expert-inpaint-wrapper ${isInpaintCollapsed ? "is-collapsed" : ""}`}
                  role="group"
                  aria-label="Inpaint controls group"
                >
                  <div
                    id="edit-expert-inpaint-content"
                    className={`edit-expert-inpaint-content ${isInpaintCollapsing ? "is-collapsing" : ""}`}
                  >
                    <div
                      className="edit-expert-inpaint-tool-rail"
                      aria-label="Inpaint action tools"
                    >
                      <p className="edit-expert-inpaint-tool-rail-title">Select tool</p>
                      <div className="edit-expert-inpaint-tool-rail-buttons">
                        {inpaintRailTools.map((tool) => {
                          const Icon = tool.icon;
                          const isSelected = selectedRailTool === tool.id;
                          const iconWeight = isSelected ? "bold" : "regular";
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              className={`edit-expert-inpaint-tool-rail-btn ${
                                isSelected ? `is-selected ${tool.selectedClassName}` : ""
                              }`.trim()}
                              aria-pressed={isSelected}
                              onClick={() => setSelectedRailTool(tool.id)}
                            >
                              <Icon size={14} weight={iconWeight} />
                              <span>{tool.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div
                      className={`edit-expert-inpaint-controls ${
                        isInpaintToolSelected ? "is-themed-inpaint" : ""
                      } ${isVideoToolSelected ? "is-themed-video" : ""} ${
                        isMoveToolSelected ? "is-themed-move" : ""
                      }`.trim()}
                      role="group"
                      aria-label={
                        isInpaintLikeToolSelected
                          ? isVideoToolSelected
                            ? "Markup tools"
                            : "Inpaint tools"
                          : "Move tools"
                      }
                    >
                      {isInpaintToolSelected ? (
                        <div className="edit-expert-inpaint-controls-content">
                          <div className="edit-expert-inpaint-mode-row">
                            <button
                              type="button"
                              className={`edit-expert-inpaint-mode-btn ${
                                selectedInpaintMode === "brush" ? "is-active" : ""
                              }`}
                              aria-pressed={selectedInpaintMode === "brush"}
                              onClick={() => setSelectedInpaintMode("brush")}
                            >
                              <PaintBrush size={16} weight="regular" />
                              <span>Brush</span>
                            </button>
                            <button
                              type="button"
                              className={`edit-expert-inpaint-mode-btn ${
                                selectedInpaintMode === "lasso" ? "is-active" : ""
                              }`}
                              aria-pressed={selectedInpaintMode === "lasso"}
                              onClick={() => setSelectedInpaintMode("lasso")}
                            >
                              <CircleDashed size={16} weight="regular" />
                              <span>Lasso</span>
                            </button>
                            <button
                              type="button"
                              className="edit-expert-inpaint-mode-btn edit-expert-inpaint-expand-btn"
                              aria-label="Expand markup tools"
                              onClick={() => openMarkupModal("video")}
                            >
                              <ArrowsOutSimple size={16} weight="regular" />
                            </button>
                          </div>
                          <div className="edit-expert-inpaint-stroke-row">
                            <label
                              className="edit-expert-inpaint-stroke-label"
                              htmlFor="edit-expert-inpaint-stroke-size"
                            >
                              Stroke Size
                            </label>
                            <input
                              id="edit-expert-inpaint-stroke-size"
                              className="edit-expert-inpaint-stroke-slider"
                              type="range"
                              min={1}
                              max={100}
                              value={inpaintStrokeSize}
                              onChange={(event) => setInpaintStrokeSize(Number(event.target.value))}
                              onDoubleClick={() =>
                                setInpaintStrokeSize(INPAINT_STROKE_SIZE_DEFAULT)
                              }
                              aria-label="Stroke size"
                            />
                          </div>
                          <div className="edit-expert-inpaint-selection-row">
                            <div
                              className="edit-expert-inpaint-select-tabs"
                              role="tablist"
                              aria-label="Selection mode"
                            >
                              <button
                                type="button"
                                className={`edit-expert-inpaint-select-tab ${
                                  selectedInpaintSelectionTab === "select" ? "is-active" : ""
                                }`}
                                role="tab"
                                aria-selected={selectedInpaintSelectionTab === "select"}
                                onClick={() => setSelectedInpaintSelectionTab("select")}
                              >
                                Select
                              </button>
                              <button
                                type="button"
                                className={`edit-expert-inpaint-select-tab ${
                                  selectedInpaintSelectionTab === "unselect" ? "is-active" : ""
                                }`}
                                role="tab"
                                aria-selected={selectedInpaintSelectionTab === "unselect"}
                                onClick={() => setSelectedInpaintSelectionTab("unselect")}
                              >
                                Unselect
                              </button>
                            </div>
                            <button
                              type="button"
                              className="edit-expert-inpaint-action-btn edit-expert-inpaint-invert-btn"
                              aria-label="Invert selection"
                              onClick={invertInpaintSelectionWithHistory}
                              disabled={!imageHasInteractiveMask}
                            >
                              <CircleHalf size={18} weight="regular" />
                            </button>
                            <button
                              type="button"
                              className="edit-expert-inpaint-action-btn edit-expert-inpaint-clear-btn"
                              aria-label="Clear selection"
                              onClick={clearInpaintSelectionWithHistory}
                              disabled={!imageHasInteractiveMask}
                            >
                              <TrashSimple size={18} weight="regular" />
                            </button>
                          </div>
                        </div>
                      ) : isVideoToolSelected ? (
                        renderMarkupControlsContent("inline")
                      ) : (
                        renderMoveControlsContent("inline")
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
              {shouldShowSecondaryReferenceAndStylesRow ? (
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
              ) : null}
            </div>
            <ExpertEditPromptComposer
              promptInputShellRef={promptInputShellRef}
              promptHighlightRef={promptHighlightRef}
              promptTextareaRef={promptTextareaRef}
              promptHighlightSegments={promptHighlightSegments}
              promptTextValue={promptTextValue}
              onPromptTextChange={handlePromptTextChange}
              onPromptKeyDown={handlePromptKeyDown}
              onPromptDrop={handlePromptDropWithTokenInsert}
              onPromptScroll={handlePromptScroll}
              onPromptBlur={closePromptTokenPicker}
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
            />
            <ExpertEditSelectorControls
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
          </div>
        </div>
      </div>

      {statusToastMessage && !isLayerLimitStatusToast ? (
        <div
          className={`edit-expert-stage-status-toast ${
            statusToastTone === "warning" ? "is-warning" : "is-info"
          } ${isStatusToastFading ? "is-fading" : ""}`.trim()}
          role="status"
          aria-live="polite"
        >
          {statusToastMessage}
        </div>
      ) : null}

      <ExpertEditModalStageSurface
        isOpen={isMarkupExpandSelected}
        modalRef={handleMarkupModalRef}
        controlsColumnRef={handleMarkupModalControlsRef}
        stageRef={handleMarkupModalStageRef}
        stageStyle={markupModalStageStyle}
        generalPanel={renderMarkupModalGeneralPanel()}
        movePanel={renderMarkupModalMovePanel()}
        inpaintPanel={renderMarkupModalInpaintPanel("modal")}
        markupPanel={renderMarkupControlsContent("modal")}
        viewportStyle={modalMarkupViewportStyle}
        sceneContent={renderPrimaryStageSceneContent({
          scope: "modal",
          overlayCanvas: modalOverlayCanvasRef,
          stageSize: markupModalViewportSize,
          stageElement: markupModalStageElement,
        })}
        transformOverlay={renderSelectedLayerTransformOverlay(
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
        )}
        layersPanel={
          <ExpertEditLayersPanel
            scope="modal"
            layers={layers}
            editingLayerIndex={editingLayerIndex}
            editingLayerValue={editingLayerValue}
            draggingLayerIndex={draggingLayerIndex}
            dragOverLayerIndex={dragOverLayerIndex}
            resolvedSelectedLayerIndex={resolvedSelectedLayerIndex}
            statusToastMessage={statusToastMessage}
            statusToastTone={statusToastTone}
            isStatusToastFading={isStatusToastFading}
            isLayerLimitStatusToast={isLayerLimitStatusToast}
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
        }
        onClose={closeMarkupModal}
        onDragShield={handleMarkupModalDragShield}
        onStageMouseDown={handleMarkupStageMiddleClickSuppress}
        onStageAuxClick={handleMarkupStageMiddleClickSuppress}
        interactionHandlers={{
          onPointerDown: modalStageInteractionRouter.onPointerDown,
          onPointerMove: modalStageInteractionRouter.onPointerMove,
          onPointerUp: modalStageInteractionRouter.onPointerUp,
          onPointerCancel: modalStageInteractionRouter.onPointerCancel,
          onPointerLeave: modalStageInteractionRouter.onPointerLeave,
        }}
        onStageWheel={noopStageWheel}
      />

      {stageContextMenuState.isOpen ? (
        <ExpertEditStageContextMenu
          menuRef={stageContextMenuRef}
          x={stageContextMenuState.x}
          y={stageContextMenuState.y}
          isMarkupExpandSelected={isMarkupExpandSelected}
          hasSelectedLayerImage={Boolean(selectedLayerImageUrl)}
          onRecenter={handleStageContextMenuRecenter}
          onExpand={handleStageContextMenuExpand}
          onAddImage={handleStageContextMenuAddImage}
          onReset={handleStageContextMenuReset}
          onRemoveImage={handleStageContextMenuRemoveImage}
        />
      ) : null}

      <input
        ref={primaryInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePrimaryFileSelection}
      />
      <input
        ref={extraOneInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection((url) => onExtraImageChange(0, url))}
      />
      <input
        ref={extraTwoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection((url) => onExtraImageChange(1, url))}
      />
      <input
        ref={extraThreeInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection((url) => onExtraImageChange(2, url))}
      />

      <ExpertEditCharacterPickerModal
        isOpen={isCharacterPickerOpen}
        characterModeEnabled={characterModeEnabled}
        isCharacterOptionsLoading={isCharacterOptionsLoading}
        onClose={closeCharacterPicker}
        characterOptions={characterOptions}
        selectedCharacterId={selectedCharacterId}
        onSelectedCharacterIdChange={onSelectedCharacterIdChange}
        refreshCharacterOptions={refreshCharacterOptions}
        resolveCharacterAvatarUrlById={resolveCharacterAvatarUrlById}
      />
    </div>
  );
}
