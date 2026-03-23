import Image from "next/image";
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
  Plus,
  Sliders,
  StackSimple,
  TrashSimple,
  UploadSimple,
  X,
} from "phosphor-react";
import { AgentGenerateButton } from "../../../../prefabs/agent";
import { modelLogos } from "../../constants";
import { AspectDropdown } from "../AspectDropdown";
import { ResolutionDropdown } from "../ResolutionDropdown";
import { stripEditLabel } from "../../utils/modelLabels";
import { extractDragDropPayload, isImageDragTransfer } from "../../utils/dragDrop";
import {
  composePrimaryStageLayersToBlob,
  type StageFlattenCameraTransformInput,
} from "../../logic/expertEditStageFlatten";
import { parseAspectRatioToken } from "../../logic/expertEditLayerCrop";
import {
  analyzeExpertEditPromptTokens,
  buildExpertEditPromptHighlightSegments,
  extractExpertEditPromptTokenFromTransfer,
  insertExpertEditPromptTokenAtSelection,
  setExpertEditPromptTokenDragData,
} from "../../logic/expertEditPromptReferences";
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
import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../../logic/editPromptPolicy";
import { useReferencePropertiesConstraintEffects } from "../useReferencePropertiesConstraintEffects";
import { useReferencePropertiesDerivedState } from "../useReferencePropertiesDerivedState";
import { useReferencePropertiesInteractions } from "../useReferencePropertiesInteractions";
import { useCreateCharacterModeController } from "../create/useCreateCharacterModeController";
import {
  areInpaintMaskSnapshotsEqual,
  type InpaintMaskSnapshot,
  useInpaintMaskController,
} from "./useInpaintMaskController";
import {
  createIdleMarkupDrawPointerSession,
  resolveMarkupStrokePointRadiusPx,
  resolveMarkupStrokePointToSurfacePoint,
  resolveMarkupStrokeWidthPx,
  type MarkupDrawPointerSession,
  type MarkupStroke,
  type MarkupViewportState,
} from "./markupStrokeController";
import { useExpertEditInlineGenerate } from "./useExpertEditInlineGenerate";
import { ExpertEditMarkupModalShell } from "./ExpertEditMarkupModalShell";
import { useExpertEditStageInteractionRouter } from "./useExpertEditStageInteractionRouter";
import { useExpertEditMarkupDrawController } from "./useExpertEditMarkupDrawController";
import { useExpertEditMarkupViewportController } from "./useExpertEditMarkupViewportController";
import { useExpertEditTransformController } from "./useExpertEditTransformController";
import { ExpertEditPresetsSurface } from "./ExpertEditPresetsSurface";
import { StylesControl } from "../StylesControl";
import { ExpertEditCharacterPickerModal } from "./ExpertEditCharacterPickerModal";
import { ExpertEditModeRailPanel } from "./ExpertEditModeRailPanel";
import {
  COMPOSITE_REGENERATE_COHESION_PROMPT,
  FLATTEN_IMAGE_ACTION_ID,
  INPAINT_COLLAPSE_ANIMATION_MS,
  INPAINT_STROKE_SIZE_DEFAULT,
  LAYER_LIMIT_REACHED_TOAST,
  MAX_LAYERS,
  LOCKED_EDIT_TOOL_MODEL_LOGO_SRC,
  MARKUP_COLOR_DEFAULT,
  MARKUP_COLOR_SWATCHES,
  MARKUP_STROKE_SIZE_DEFAULT,
  MARKUP_STROKE_SIZE_MAX,
  PRESET_PANEL_LIMIT_TOAST,
  REMOVE_BACKGROUND_ACTION_ID,
  REMOVE_BACKGROUND_PENDING_TIMEOUT_MS,
  STATUS_TOAST_FADE_MS,
  STATUS_TOAST_VISIBLE_MS,
  TRANSIENT_OBJECT_URL_REVOKE_MS,
  TRANSFORM_HISTORY_LIMIT,
  clampNumber,
  editGenerationModeOptions,
  editLayerUtilityActions,
  editPresetUtilityActions,
  inpaintRailTools,
  isSpaceActivationKey,
  resolveElementViewportSize,
  resolveImageDimensionsFromUrl,
  resolveLayerFrameTransformStyle,
  resolveLayerOverlayTransformStyle,
  resolveValidStageRect,
  secondaries,
  selectedLayerTransformHandleCorners,
  type ExpertEditPanelViewProps,
  type InpaintHistoryState,
  type InpaintMode,
  type InpaintSelectionTab,
  type MarkupHistoryState,
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
  cloneBlobObjectUrl,
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
  MARKUP_VIEWPORT_DEFAULT_SCALE,
  MARKUP_VIEWPORT_EPSILON,
  MOVE_STAGE_ZOOM_SLIDER_DEFAULT,
  MOVE_STAGE_ZOOM_SLIDER_MAX,
  MOVE_STAGE_ZOOM_SLIDER_MIN,
  createDefaultMarkupViewportState,
  createIdleMarkupPanPointerSession,
  isResolvedStageViewportSize,
  resolveMarkupViewportOffsetPixels,
  resolveMoveStageZoomSliderValue,
  resolveRenderableStageViewportSize,
  resolveStageViewportSize,
  type MarkupPanPointerSession,
  type StageViewportSize,
} from "./expertEditViewportUtils";
import {
  applyTransformHistoryEntryToLayers,
  areLayerTransformsEqual,
  areTransformHistoryEntriesEqual,
  buildTransformHistoryEntry,
  clampLayerOpacity,
  defaultLayerTransform,
  type TransformHistoryEntry,
  type TransformHistoryState,
} from "./expertEditLayerTransformUtils";
import {
  LAYER_OPACITY_DEFAULT,
  LAYER_REORDER_DRAG_MIME,
  collectOwnedLayerImageUrls,
  cloneLayerForSessionState,
  enforceLayerStackInvariants,
  formatLayerName,
  isLayerIndexInBounds,
  isLayerReorderDrag,
  isAutoLayerName,
  layerHasImage,
  resolveLayerIndexOrFallback,
  resolveLayerIndexOrNull,
  resolveStaleOwnedLayerImageUrls,
  resolveLayersAfterContextMenuRemoveImage,
  resolveLayerReorderFromIndex,
  resolveLayerStateAfterDelete,
  resolveInitialExpertEditSessionState,
  resolveReorderedLayerState,
  resolveLayerIdCounterFromLayers,
  resolveLowestUnusedAutoLayerNumber,
  resolveMarkupStrokeIdCounterFromStrokes,
  type ExpertEditLayer,
} from "./expertEditLayerSessionUtils";
import {
  buildInpaintBrushReticleCursor,
  buildInpaintLassoCursor,
  buildMarkupBrushReticleCursor,
} from "./expertEditCursorUtils";
import {
  autoResizeTextareaWithinComputedBounds,
  clampCaretPosition,
  clearWindowAnimationFrameRef,
  clearTransientObjectUrlRevokeTimers,
  clearWindowTimeoutRef,
  createIdleTransformPointerSession,
  isEventTargetInsideElement,
  isKeyboardEventFromEditableTarget,
  lockDocumentCursor,
  resolveInpaintCollapseToggleDecision,
  resolveRailToolForGenerationMode,
  runPointerStageTerminalAction,
  scheduleWindowAnimationFrame,
  scheduleTransientObjectUrlRevoke as scheduleTransientObjectUrlRevokeTimer,
  resolveStageContextMenuPosition,
  syncTextareaMirrorScroll,
  unlockDocumentCursor,
  type TransformPointerSession,
} from "./expertEditInteractionUtils";
import {
  EXPERT_EDIT_SESSION_STATE_VERSION,
  areExpertEditSessionStatesEqual,
  areMarkupStrokeSnapshotsEqual,
  cloneExpertEditSessionState,
  cloneInpaintHistoryState,
  cloneInpaintMaskSnapshot,
  cloneMarkupHistoryState,
  cloneMarkupStrokesSnapshot,
  type ExpertEditSessionState,
} from "./expertEditSessionState";
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
  const layerIdCounterRef = React.useRef(initialSessionState.layerState.layerIdCounter);
  const previousLayersRef = React.useRef<ExpertEditLayer[]>([]);
  const lastDispatchedSessionStateRef = React.useRef<ExpertEditSessionState | null>(null);
  const pendingSessionStateRef = React.useRef<ExpertEditSessionState | null>(null);
  const sessionDispatchFrameRef = React.useRef<number | null>(null);
  const lastDispatchedPrimaryRef = React.useRef<string | null>(referenceImageUrl);
  const previousPrimaryPropRef = React.useRef<string | null>(referenceImageUrl);
  const inpaintCollapseTimerRef = React.useRef<number | null>(null);
  const toastVisibleTimerRef = React.useRef<number | null>(null);
  const toastFadeTimerRef = React.useRef<number | null>(null);
  const removeBackgroundPendingTimeoutRef = React.useRef<number | null>(null);
  const removeBackgroundPendingSourceUrlRef = React.useRef<string | null>(null);
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
  const inlineStageWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const primaryDropzoneRef = React.useRef<HTMLDivElement | null>(null);
  const markupModalRef = React.useRef<HTMLDivElement | null>(null);
  const markupModalControlsRef = React.useRef<HTMLDivElement | null>(null);
  const markupModalStageRef = React.useRef<HTMLDivElement | null>(null);
  const markupModalLayersRef = React.useRef<HTMLDivElement | null>(null);
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
  const promptTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const promptInputShellRef = React.useRef<HTMLDivElement | null>(null);
  const promptHighlightRef = React.useRef<HTMLDivElement | null>(null);
  const pendingPromptCaretRef = React.useRef<number | null>(null);
  const transformPointerSessionRef = React.useRef<TransformPointerSession>(
    createIdleTransformPointerSession()
  );
  const transformGestureBaselineRef = React.useRef<TransformHistoryEntry | null>(null);
  const pendingHistoryApplyEntryRef = React.useRef<TransformHistoryEntry | null>(null);
  const markupGestureBaselineRef = React.useRef<MarkupStroke[] | null>(null);
  const inpaintGestureBaselineRef = React.useRef<InpaintMaskSnapshot | null>(null);
  const pendingMarkupHistoryApplyRef = React.useRef<MarkupStroke[] | null>(null);
  const pendingInpaintHistoryApplyRef = React.useRef<InpaintMaskSnapshot | null>(null);
  const inpaintSessionRestorePendingRef = React.useRef(
    initialSessionState.inpaintHistory.present.layers.length > 0
  );
  const createLayer = React.useCallback(
    ({
      indexOneBased,
      imageUrl,
      name,
      opacity = LAYER_OPACITY_DEFAULT,
      isAutoNamed = true,
      ownsImageUrl = false,
    }: {
      indexOneBased: number;
      imageUrl?: string | null;
      name?: string;
      opacity?: number;
      isAutoNamed?: boolean;
      ownsImageUrl?: boolean;
    }): ExpertEditLayer => ({
      id: `layer-${layerIdCounterRef.current++}`,
      name: name ?? formatLayerName(indexOneBased),
      imageUrl: imageUrl ?? null,
      opacity: clampLayerOpacity(opacity),
      isAutoNamed,
      ownsImageUrl,
      transform: defaultLayerTransform(),
    }),
    []
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
  const [markupViewport, setMarkupViewport] = React.useState<MarkupViewportState>(() =>
    createDefaultMarkupViewportState()
  );
  const [isMarkupPanDragging, setIsMarkupPanDragging] = React.useState(false);
  const [isMarkupPanSpacePressed, setIsMarkupPanSpacePressed] = React.useState(false);
  const [inlineStageViewportSize, setInlineStageViewportSize] = React.useState<StageViewportSize>({
    width: 1,
    height: 1,
  });
  const [markupModalStageSize, setMarkupModalStageSize] = React.useState<StageViewportSize | null>(
    null
  );
  const [markupModalViewportSize, setMarkupModalViewportSize] = React.useState<StageViewportSize>({
    width: 1,
    height: 1,
  });
  const [markupModalDomVersion, setMarkupModalDomVersion] = React.useState(0);
  const [stageContextMenuState, setStageContextMenuState] = React.useState<{
    isOpen: boolean;
    x: number;
    y: number;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
  });
  const [moveStageZoomSliderValue, setMoveStageZoomSliderValue] = React.useState(() =>
    resolveMoveStageZoomSliderValue(MARKUP_VIEWPORT_DEFAULT_SCALE)
  );
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
  const [primaryDragActive, setPrimaryDragActive] = React.useState(false);
  const [layers, setLayers] = React.useState<ExpertEditLayer[]>(() => [
    ...initialSessionState.layerState.layers,
  ]);
  const [layerImageDimensionCache, setLayerImageDimensionCache] = React.useState<
    Record<string, { url: string; width: number; height: number }>
  >({});
  const [foundationLayerId, setFoundationLayerId] = React.useState<string | null>(
    initialSessionState.layerState.foundationLayerId
  );
  const [transformHistoryState, setTransformHistoryState] = React.useState<TransformHistoryState>(
    () => ({
      past: [],
      present: buildTransformHistoryEntry(layers),
      future: [],
    })
  );
  const [markupHistoryState, setMarkupHistoryState] = React.useState<MarkupHistoryState>(() =>
    cloneMarkupHistoryState(initialSessionState.markupHistory)
  );
  const [inpaintHistoryState, setInpaintHistoryState] = React.useState<InpaintHistoryState>(() =>
    cloneInpaintHistoryState(initialSessionState.inpaintHistory)
  );
  const [selectedLayerIndex, setSelectedLayerIndex] = React.useState<number | null>(
    initialSessionState.layerState.selectedLayerIndex
  );
  const [editingLayerIndex, setEditingLayerIndex] = React.useState<number | null>(null);
  const [editingLayerValue, setEditingLayerValue] = React.useState("");
  const [draggingLayerIndex, setDraggingLayerIndex] = React.useState<number | null>(null);
  const [dragOverLayerIndex, setDragOverLayerIndex] = React.useState<number | null>(null);
  const draggingLayerIndexRef = React.useRef<number | null>(null);
  const [statusToastMessage, setStatusToastMessage] = React.useState<string | null>(null);
  const [statusToastTone, setStatusToastTone] = React.useState<"info" | "warning">("info");
  const [isStatusToastFading, setIsStatusToastFading] = React.useState(false);
  const [showPromptTokenInlineError, setShowPromptTokenInlineError] = React.useState(false);
  const [isTransformPointerDragging, setIsTransformPointerDragging] = React.useState(false);
  const [activeTransformDragMode, setActiveTransformDragMode] =
    React.useState<TransformPointerSession["dragMode"]>("move");
  const syncMarkupModalTrackedRef = React.useCallback(
    (refObject: React.MutableRefObject<HTMLDivElement | null>, node: HTMLDivElement | null) => {
      if (refObject.current === node) return;
      refObject.current = node;
      setMarkupModalDomVersion((previous) => previous + 1);
    },
    []
  );
  const handleMarkupModalRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      syncMarkupModalTrackedRef(markupModalRef, node);
    },
    [syncMarkupModalTrackedRef]
  );
  const handleMarkupModalControlsRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      syncMarkupModalTrackedRef(markupModalControlsRef, node);
    },
    [syncMarkupModalTrackedRef]
  );
  const handleMarkupModalStageRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      syncMarkupModalTrackedRef(markupModalStageRef, node);
    },
    [syncMarkupModalTrackedRef]
  );
  const handleMarkupModalLayersRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      syncMarkupModalTrackedRef(markupModalLayersRef, node);
    },
    [syncMarkupModalTrackedRef]
  );
  const [removeBackgroundPendingLayerId, setRemoveBackgroundPendingLayerId] = React.useState<
    string | null
  >(null);
  const [isFlattenPending, setIsFlattenPending] = React.useState(false);
  React.useEffect(() => {
    if (markupStrokeSize === resolvedMarkupStrokeSize) return;
    setMarkupStrokeSize(resolvedMarkupStrokeSize);
  }, [markupStrokeSize, resolvedMarkupStrokeSize]);
  const markupColor = React.useMemo(() => rgbToHex(hsvToRgb(markupColorHsv)), [markupColorHsv]);
  const resolvedSelectedLayerIndex = resolveLayerIndexOrFallback({
    selectedLayerIndex,
    layerCount: layers.length,
  });
  const currentTransformHistoryEntry = React.useMemo(
    () => buildTransformHistoryEntry(layers),
    [layers]
  );
  const canUndoTransformHistory = transformHistoryState.past.length > 0;
  const canRedoTransformHistory = transformHistoryState.future.length > 0;
  const canUndoMarkupHistory = markupHistoryState.past.length > 0;
  const canRedoMarkupHistory = markupHistoryState.future.length > 0;
  const canUndoInpaintHistory = inpaintHistoryState.past.length > 0;
  const canRedoInpaintHistory = inpaintHistoryState.future.length > 0;
  const selectedStyleId = controlledSelectedStyleId ?? null;
  const selectedLayer = layers[resolvedSelectedLayerIndex] ?? null;
  const selectedLayerImageUrl = selectedLayer?.imageUrl ?? null;
  React.useEffect(() => {
    setLayerImageDimensionCache((previousCache) => {
      let didChange = false;
      const nextCache: Record<string, { url: string; width: number; height: number }> = {};
      layers.forEach((layer) => {
        if (!layer.imageUrl) return;
        const cached = previousCache[layer.id];
        if (!cached || cached.url !== layer.imageUrl) {
          didChange = true;
          return;
        }
        nextCache[layer.id] = cached;
      });
      if (!didChange && Object.keys(previousCache).length === Object.keys(nextCache).length) {
        return previousCache;
      }
      return nextCache;
    });
  }, [layers]);
  React.useEffect(() => {
    const pendingLayers = layers.filter((layer) => {
      if (!layer.imageUrl) return false;
      const cached = layerImageDimensionCache[layer.id];
      return !cached || cached.url !== layer.imageUrl;
    });
    if (pendingLayers.length <= 0) return;

    let isCancelled = false;
    pendingLayers.forEach((layer) => {
      const imageUrl = layer.imageUrl;
      if (!imageUrl) return;
      void resolveImageDimensionsFromUrl(imageUrl)
        .then((dimensions) => {
          if (isCancelled) return;
          setLayerImageDimensionCache((previousCache) => {
            const current = previousCache[layer.id];
            if (
              current &&
              current.url === imageUrl &&
              current.width === dimensions.width &&
              current.height === dimensions.height
            ) {
              return previousCache;
            }
            return {
              ...previousCache,
              [layer.id]: {
                url: imageUrl,
                width: dimensions.width,
                height: dimensions.height,
              },
            };
          });
        })
        .catch(() => {
          if (isCancelled) return;
          setLayerImageDimensionCache((previousCache) => {
            const current = previousCache[layer.id];
            if (current && current.url === imageUrl) {
              return previousCache;
            }
            return {
              ...previousCache,
              [layer.id]: {
                url: imageUrl,
                width: 1,
                height: 1,
              },
            };
          });
        });
    });

    return () => {
      isCancelled = true;
    };
  }, [layerImageDimensionCache, layers]);
  const populatedLayerCount = React.useMemo(
    () => layers.filter((layer) => layerHasImage(layer)).length,
    [layers]
  );
  const hasPrimaryCompositePreview = populatedLayerCount > 0;
  const isRemoveBackgroundPending = removeBackgroundPendingLayerId != null;
  const isPrimaryStageBusy =
    isFlattenPending || isRemoveBackgroundPending || isPrimaryStageGenerating;
  const isLayerLimitStatusToast = statusToastMessage === LAYER_LIMIT_REACHED_TOAST;
  const hostPrimaryImageUrl = React.useMemo(
    () =>
      selectedLayerImageUrl ?? layers.find((layer) => Boolean(layer.imageUrl))?.imageUrl ?? null,
    [layers, selectedLayerImageUrl]
  );
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
  const handlePromptTextChange = React.useCallback(
    (value: string) => {
      setShowPromptTokenInlineError(false);
      onPromptTextChange(value);
    },
    [onPromptTextChange]
  );

  const {
    extraOneInputRef,
    extraTwoInputRef,
    extraThreeInputRef,
    extraDragActive,
    handleFileSelection,
    handlePromptDrop,
    handleExtraDrop,
    handleExtraDragEnter,
    handleExtraDragOver,
    handleExtraDragLeave,
  } = useReferencePropertiesInteractions({
    referenceImageUrl: selectedLayerImageUrl,
    extraImageUrls,
    onPrimaryImageChange: () => {},
    onExtraImageChange,
    onPromptTextChange: handlePromptTextChange,
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
  const promptTextValue = referenceText ?? "";
  const promptTokenAnalysis = React.useMemo(
    () => analyzeExpertEditPromptTokens(promptTextValue, extraImageUrls),
    [extraImageUrls, promptTextValue]
  );
  const promptHighlightSegments = React.useMemo(
    () => buildExpertEditPromptHighlightSegments(promptTextValue, promptTokenAnalysis.diagnostics),
    [promptTextValue, promptTokenAnalysis.diagnostics]
  );
  const promptTokenInlineError = showPromptTokenInlineError
    ? promptTokenAnalysis.inlineError
    : null;
  const shouldShowResolutionControl = imageResolutionOptions.length > 0;
  const hasPromptText = promptTextValue.trim().length > 0;
  const inlineGenerateDisabled = isGenerateDisabled || populatedLayerCount <= 0 || !hasPromptText;
  const inpaintLayerSources = React.useMemo(
    () => layers.map((layer) => ({ id: layer.id, imageUrl: layer.imageUrl })),
    [layers]
  );
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
  const handleInvalidPromptReferenceToken = React.useCallback(
    (message: string) => {
      setShowPromptTokenInlineError(true);
      showStatusToast(message, "warning");
    },
    [showStatusToast]
  );

  const syncPromptHighlightScroll = React.useCallback(() => {
    syncTextareaMirrorScroll({
      textarea: promptTextareaRef.current,
      mirror: promptHighlightRef.current,
    });
  }, []);

  const syncPromptTextareaHeight = React.useCallback(() => {
    autoResizeTextareaWithinComputedBounds(promptTextareaRef.current);
  }, []);

  const handlePromptScroll = React.useCallback(() => {
    syncPromptHighlightScroll();
  }, [syncPromptHighlightScroll]);

  const handlePromptDropWithTokenInsert = React.useCallback(
    (event: React.DragEvent<HTMLTextAreaElement>) => {
      event.preventDefault();
      const droppedToken = extractExpertEditPromptTokenFromTransfer(event.dataTransfer);
      if (!droppedToken) {
        handlePromptDrop(event);
        return;
      }
      const textarea = promptTextareaRef.current;
      const selectionStart = textarea?.selectionStart ?? promptTextValue.length;
      const selectionEnd = textarea?.selectionEnd ?? selectionStart;
      const insertedPrompt = insertExpertEditPromptTokenAtSelection({
        prompt: promptTextValue,
        token: droppedToken,
        selectionStart,
        selectionEnd,
      });
      pendingPromptCaretRef.current = insertedPrompt.caret;
      handlePromptTextChange(insertedPrompt.prompt);
    },
    [handlePromptDrop, handlePromptTextChange, promptTextValue]
  );

  React.useEffect(() => {
    if (!onEditSubmitIntentChange) return;
    onEditSubmitIntentChange(effectiveEditSubmitIntent);
  }, [effectiveEditSubmitIntent, onEditSubmitIntentChange]);

  React.useEffect(() => {
    const caretPosition = pendingPromptCaretRef.current;
    if (caretPosition == null) return;
    const textarea = promptTextareaRef.current;
    if (!textarea) return;
    const maxCaret = clampCaretPosition({
      caretPosition,
      textLength: promptTextValue.length,
    });
    textarea.focus();
    textarea.setSelectionRange(maxCaret, maxCaret);
    pendingPromptCaretRef.current = null;
  }, [promptTextValue]);

  React.useEffect(() => {
    syncPromptTextareaHeight();
  }, [promptTextValue, syncPromptTextareaHeight]);

  React.useEffect(() => {
    const promptInputShell = promptInputShellRef.current;
    if (!promptInputShell || typeof ResizeObserver === "undefined") return;
    const resizeObserver = new ResizeObserver(() => {
      syncPromptTextareaHeight();
      syncPromptHighlightScroll();
    });
    resizeObserver.observe(promptInputShell);
    return () => {
      resizeObserver.disconnect();
    };
  }, [syncPromptHighlightScroll, syncPromptTextareaHeight]);

  React.useEffect(() => {
    syncPromptHighlightScroll();
  }, [promptTextValue, syncPromptHighlightScroll]);

  React.useEffect(() => {
    if (!promptTokenAnalysis.inlineError && showPromptTokenInlineError) {
      setShowPromptTokenInlineError(false);
    }
  }, [promptTokenAnalysis.inlineError, showPromptTokenInlineError]);

  React.useEffect(() => {
    return () => {
      if (presetDragPreviewCleanupRef.current) {
        presetDragPreviewCleanupRef.current();
        presetDragPreviewCleanupRef.current = null;
      }
    };
  }, []);

  const clearRemoveBackgroundPending = React.useCallback(() => {
    clearWindowTimeoutRef(removeBackgroundPendingTimeoutRef);
    removeBackgroundPendingSourceUrlRef.current = null;
    setRemoveBackgroundPendingLayerId(null);
  }, []);
  const beginRemoveBackgroundPending = React.useCallback(
    (layerId: string | null, sourceImageUrl: string | null) => {
      clearRemoveBackgroundPending();
      if (!layerId) return;
      setRemoveBackgroundPendingLayerId(layerId);
      removeBackgroundPendingSourceUrlRef.current = sourceImageUrl;
      removeBackgroundPendingTimeoutRef.current = window.setTimeout(() => {
        clearRemoveBackgroundPending();
      }, REMOVE_BACKGROUND_PENDING_TIMEOUT_MS);
    },
    [clearRemoveBackgroundPending]
  );
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

  const resolveInteractionViewportOffsetPixels = (
    interactionRect: DOMRect,
    currentTarget: HTMLDivElement
  ) => {
    if (!hasPrimaryCompositePreview) {
      return {
        offsetX: 0,
        offsetY: 0,
      };
    }

    const resolveInlineInteractionAuthorityRect = () => {
      const wrapperRect = resolveValidStageRect(
        inlineStageWrapperRef.current?.getBoundingClientRect() ?? null
      );
      if (wrapperRect) return wrapperRect;
      const dropzoneRect = resolveValidStageRect(
        primaryDropzoneRef.current?.getBoundingClientRect() ?? null
      );
      if (dropzoneRect) return dropzoneRect;
      return resolveValidStageRect(currentTarget.getBoundingClientRect() ?? interactionRect);
    };

    const authoritativeViewportSize =
      currentTarget === markupModalStageRef.current
        ? isResolvedStageViewportSize(markupModalViewportSize)
          ? markupModalViewportSize
          : resolveStageViewportSize(
              resolveValidStageRect(
                markupModalStageRef.current?.getBoundingClientRect() ?? interactionRect
              )
            )
        : isResolvedStageViewportSize(inlineStageViewportSize)
          ? inlineStageViewportSize
          : resolveStageViewportSize(resolveInlineInteractionAuthorityRect() ?? interactionRect);

    return resolveMarkupViewportOffsetPixels(markupViewport, authoritativeViewportSize);
  };

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
    dropzoneRef: primaryDropzoneRef,
    selectedLayerId: selectedLayer?.id ?? null,
    selectedLayerImageUrl,
    layerSources: inpaintLayerSources,
    enabled: isInpaintToolSelected,
    sceneScale: markupViewport.scale,
    shouldApplyViewportTransform: hasPrimaryCompositePreview,
    viewportOffsetXRatio: markupViewport.offsetXRatio,
    viewportOffsetYRatio: markupViewport.offsetYRatio,
    resolveViewportOffsetPixels: resolveInteractionViewportOffsetPixels,
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
    isMoveToolSelected && Boolean(selectedLayerImageUrl) && hasPrimaryCompositePreview;
  const selectedLayerImageAspectRatio = React.useMemo(() => {
    if (!selectedLayer?.imageUrl) return 1;
    const dimensions = layerImageDimensionCache[selectedLayer.id];
    if (!dimensions || dimensions.url !== selectedLayer.imageUrl || dimensions.height <= 0) {
      return 1;
    }
    return Math.max(0.0001, dimensions.width / dimensions.height);
  }, [layerImageDimensionCache, selectedLayer]);
  const selectedLayerTransformOverlayStyle = React.useMemo<React.CSSProperties | null>(() => {
    if (!selectedLayer) return null;
    return {
      transform: resolveLayerOverlayTransformStyle(selectedLayer),
      transformOrigin: "center center",
    };
  }, [selectedLayer]);
  const morePresetsSurfaceId = React.useId();
  const activeStageRenderScale = markupViewport.scale;
  const primaryDropzoneCursor = React.useMemo(() => {
    if (isMoveToolSelected && selectedLayerImageUrl) {
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
  const primaryDropzoneAspectRatio = React.useMemo(() => {
    const parsedAspectRatio = parseAspectRatioToken(aspect);
    if (
      parsedAspectRatio == null ||
      !Number.isFinite(parsedAspectRatio) ||
      parsedAspectRatio <= 0
    ) {
      return "1 / 1";
    }
    return aspect.replace(":", " / ");
  }, [aspect]);
  const primaryDropzoneAspectRatioValue = React.useMemo(
    () => parseAspectRatioToken(aspect) ?? 1,
    [aspect]
  );
  const primaryStageWidthScale = React.useMemo(
    () => Math.max(primaryDropzoneAspectRatioValue, 0.0001),
    [primaryDropzoneAspectRatioValue]
  );
  const primaryStageStyle = React.useMemo<React.CSSProperties>(
    () => ({
      width: `max(0px, min(100%, calc(var(--edit-expert-primary-size) * ${primaryStageWidthScale})))`,
      height: "var(--edit-expert-primary-size)",
    }),
    [primaryStageWidthScale]
  );
  const markupViewportCursor = React.useMemo(() => {
    if (isMarkupPanDragging) return "grabbing";
    if (isMarkupPanSpacePressed) return "grab";
    return undefined;
  }, [isMarkupPanDragging, isMarkupPanSpacePressed]);

  const inlineMarkupViewportStyle = React.useMemo<React.CSSProperties>(() => {
    const viewportOffset = resolveMarkupViewportOffsetPixels(
      markupViewport,
      inlineStageViewportSize
    );
    return {
      transform: `translate3d(${Math.round(viewportOffset.offsetX * 100) / 100}px, ${Math.round(viewportOffset.offsetY * 100) / 100}px, 0) scale(${Math.round(markupViewport.scale * 10000) / 10000})`,
      transformOrigin: "center center",
    };
  }, [inlineStageViewportSize, markupViewport]);

  const inlineDropzoneViewportSize = resolveElementViewportSize(primaryDropzoneRef.current);

  const modalMarkupViewportStyle = React.useMemo<React.CSSProperties>(() => {
    const viewportOffset = resolveMarkupViewportOffsetPixels(
      markupViewport,
      markupModalViewportSize
    );
    return {
      transform: `translate3d(${Math.round(viewportOffset.offsetX * 100) / 100}px, ${Math.round(viewportOffset.offsetY * 100) / 100}px, 0) scale(${Math.round(markupViewport.scale * 10000) / 10000})`,
      transformOrigin: "center center",
    };
  }, [markupModalViewportSize, markupViewport]);

  const primaryDropzoneStyle = React.useMemo(() => {
    const style: React.CSSProperties = {
      ...primaryStageStyle,
      aspectRatio: primaryDropzoneAspectRatio,
    };
    if (!isMorePresetsSurfaceOpen) {
      if (markupViewportCursor) {
        style.cursor = markupViewportCursor;
      } else if (primaryDropzoneCursor) {
        style.cursor = primaryDropzoneCursor;
      }
    }
    return style;
  }, [
    isMorePresetsSurfaceOpen,
    markupViewportCursor,
    primaryDropzoneAspectRatio,
    primaryStageStyle,
    primaryDropzoneCursor,
  ]);
  const noopStageWheel = React.useCallback(() => {}, []);
  const markupModalStageStyle = React.useMemo<React.CSSProperties>(() => {
    const modalCursor =
      markupViewportCursor ??
      primaryDropzoneCursor ??
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
      aspectRatio: primaryDropzoneAspectRatio,
      width: "100%",
      maxWidth: "100%",
      maxHeight: "100%",
      ...(cursorStyle ?? {}),
    };
  }, [
    isVideoToolSelected,
    markupModalStageSize,
    markupViewportCursor,
    primaryDropzoneAspectRatio,
    primaryDropzoneCursor,
  ]);

  const resolveInlineStageRect = React.useCallback(
    (currentTarget?: HTMLDivElement | null): DOMRect | null => {
      const wrapperRect = resolveValidStageRect(
        inlineStageWrapperRef.current?.getBoundingClientRect() ?? null
      );
      if (wrapperRect) return wrapperRect;
      const primaryDropzoneRect = resolveValidStageRect(
        primaryDropzoneRef.current?.getBoundingClientRect() ?? null
      );
      if (primaryDropzoneRect) return primaryDropzoneRect;
      return resolveValidStageRect(currentTarget?.getBoundingClientRect() ?? null);
    },
    []
  );

  const resolveStageFlattenSnapshot = React.useCallback(() => {
    const modalStageRect = isMarkupExpandSelected
      ? (markupModalStageRef.current?.getBoundingClientRect() ?? null)
      : null;
    const inlineStageRect = resolveInlineStageRect();
    const activeStageRect =
      modalStageRect && modalStageRect.width > 0 && modalStageRect.height > 0
        ? modalStageRect
        : inlineStageRect;
    const activeViewportSize = resolveStageViewportSize(activeStageRect);
    const viewportOffset = resolveMarkupViewportOffsetPixels(markupViewport, activeViewportSize);
    const camera: StageFlattenCameraTransformInput = {
      scale: markupViewport.scale,
      offsetX: viewportOffset.offsetX,
      offsetY: viewportOffset.offsetY,
      viewportWidth: activeViewportSize.width,
      viewportHeight: activeViewportSize.height,
    };
    return {
      outputAspectRatio: primaryDropzoneAspectRatioValue,
      camera,
    };
  }, [
    isMarkupExpandSelected,
    markupViewport,
    primaryDropzoneAspectRatioValue,
    resolveInlineStageRect,
  ]);
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
        isResolvedStageViewportSize(inlineDropzoneViewportSize)
          ? inlineDropzoneViewportSize
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
    [inlineDropzoneViewportSize, markupStrokes]
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

  const applyPrimaryImageIngress = React.useCallback(
    (payload: { url: string; ownsImageUrl: boolean }) => {
      const candidateUrl = payload.url.trim();
      if (!candidateUrl) {
        if (payload.ownsImageUrl && payload.url.startsWith("blob:")) {
          revokeObjectUrlSafe(payload.url);
        }
        return;
      }

      const targetIndex = resolveLayerIndexOrFallback({
        selectedLayerIndex,
        layerCount: layers.length,
      });
      const targetLayer = layers[targetIndex];
      if (!targetLayer) return;

      const foundationIndex = foundationLayerId
        ? layers.findIndex((layer) => layer.id === foundationLayerId)
        : -1;
      const foundationLayer = foundationIndex >= 0 ? layers[foundationIndex] : null;
      const hasAnyPopulatedLayer = layers.some((layer) => layerHasImage(layer));
      if (!hasAnyPopulatedLayer && foundationLayer) {
        const nextLayers = [...layers];
        nextLayers[foundationIndex] = {
          ...foundationLayer,
          imageUrl: candidateUrl,
          ownsImageUrl: payload.ownsImageUrl,
          opacity: LAYER_OPACITY_DEFAULT,
          transform: defaultLayerTransform(),
        };
        setLayers(nextLayers);
        setSelectedLayerIndex(foundationIndex);
        setEditingLayerIndex(null);
        setEditingLayerValue("");
        return;
      }

      if (layers.length >= MAX_LAYERS) {
        if (payload.ownsImageUrl && candidateUrl.startsWith("blob:")) {
          revokeObjectUrlSafe(candidateUrl);
        }
        showStatusToast(LAYER_LIMIT_REACHED_TOAST);
        return;
      }

      const insertedLayer = createLayer({
        indexOneBased: resolveLowestUnusedAutoLayerNumber({ layers }),
        imageUrl: candidateUrl,
        ownsImageUrl: payload.ownsImageUrl,
      });
      const nextLayers = enforceLayerStackInvariants({
        layers: [...layers.slice(0, targetIndex), insertedLayer, ...layers.slice(targetIndex)],
        foundationLayerId,
      });
      setLayers(nextLayers);
      const insertedIndex = nextLayers.findIndex((layer) => layer.id === insertedLayer.id);
      setSelectedLayerIndex(insertedIndex >= 0 ? insertedIndex : 0);
      setEditingLayerIndex(null);
      setEditingLayerValue("");
    },
    [createLayer, foundationLayerId, layers, selectedLayerIndex, showStatusToast]
  );

  const handleManualFlatten = React.useCallback(async () => {
    if (populatedLayerCount <= 0) {
      showStatusToast("Add at least one layer image before flattening.");
      return;
    }
    if (isFlattenPending) return;

    setIsFlattenPending(true);
    try {
      const flattenSnapshot = resolveStageFlattenSnapshot();
      const exportBlob = await composePrimaryStageLayersToBlob(layers, {
        mimeType: "image/png",
        outputAspectRatio: flattenSnapshot.outputAspectRatio,
        camera: flattenSnapshot.camera,
      });
      const flattenedLayerUrl = URL.createObjectURL(exportBlob);
      const flattenedReferenceUrl = onAddSessionMediaReference
        ? URL.createObjectURL(exportBlob)
        : null;
      const layerOne =
        layers.find((layer) => layer.id === foundationLayerId) ??
        layers[0] ??
        createLayer({ indexOneBased: layerIdCounterRef.current });
      const flattenedLayer: ExpertEditLayer = {
        ...layerOne,
        name: layerOne.isAutoNamed ? formatLayerName(1) : layerOne.name,
        isAutoNamed: layerOne.isAutoNamed,
        imageUrl: flattenedLayerUrl,
        opacity: LAYER_OPACITY_DEFAULT,
        ownsImageUrl: true,
        transform: defaultLayerTransform(),
      };
      setLayers([flattenedLayer]);
      setSelectedLayerIndex(0);
      setEditingLayerIndex(null);
      setEditingLayerValue("");
      if (flattenedReferenceUrl) {
        onAddSessionMediaReference?.({
          url: flattenedReferenceUrl,
          mimeType: exportBlob.type || "image/png",
        });
      }
    } catch {
      showStatusToast("Unable to flatten layers.");
    } finally {
      setIsFlattenPending(false);
    }
  }, [
    createLayer,
    foundationLayerId,
    isFlattenPending,
    layers,
    onAddSessionMediaReference,
    populatedLayerCount,
    resolveStageFlattenSnapshot,
    showStatusToast,
  ]);

  const handleRemoveBackground = React.useCallback(() => {
    const run = async () => {
      const selectedLayerInput = selectedLayerImageUrl?.trim() ?? "";
      if (!selectedLayerInput) {
        showStatusToast("Select a layer with an image before removing background.");
        return;
      }
      if (!onRegenerateWithReferenceInputs) {
        showStatusToast("Remove background is unavailable in this session.");
        return;
      }
      const pendingLayerId = selectedLayer?.id ?? null;
      beginRemoveBackgroundPending(pendingLayerId, selectedLayer?.imageUrl ?? null);

      try {
        await onRegenerateWithReferenceInputs([selectedLayerInput], {
          modelIdOverride: BRIA_BACKGROUND_REMOVE_MODEL_ID,
          referenceInputsMode: "replace",
        });
      } catch {
        clearRemoveBackgroundPending();
        showStatusToast("Unable to remove background.");
      }
    };
    void run();
  }, [
    beginRemoveBackgroundPending,
    clearRemoveBackgroundPending,
    onRegenerateWithReferenceInputs,
    selectedLayer,
    selectedLayerImageUrl,
    showStatusToast,
  ]);

  const { handleInlineGenerate } = useExpertEditInlineGenerate({
    layers,
    promptText: promptTextValue,
    extraImageUrls,
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

  const handlePrimaryFileSelection = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const objectUrl = URL.createObjectURL(file);
      applyPrimaryImageIngress({ url: objectUrl, ownsImageUrl: true });
      event.target.value = "";
    },
    [applyPrimaryImageIngress]
  );

  const allowPrimaryImageDrag = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (isImageDragTransfer(event.dataTransfer)) {
      event.preventDefault();
      return true;
    }
    return false;
  }, []);

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

  const handlePrimaryDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) {
        event.preventDefault();
        setPrimaryDragActive(false);
        return;
      }
      if (allowPrimaryImageDrag(event)) {
        setPrimaryDragActive(true);
      }
    },
    [allowPrimaryImageDrag, isMorePresetsSurfaceOpen]
  );

  const handlePrimaryDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) {
        event.preventDefault();
        setPrimaryDragActive(false);
        return;
      }
      if (allowPrimaryImageDrag(event)) {
        setPrimaryDragActive(true);
      }
    },
    [allowPrimaryImageDrag, isMorePresetsSurfaceOpen]
  );

  const handlePrimaryDragLeave = React.useCallback(() => {
    setPrimaryDragActive(false);
  }, []);

  const handlePrimaryDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) {
        event.preventDefault();
        setPrimaryDragActive(false);
        return;
      }
      event.preventDefault();
      setPrimaryDragActive(false);
      const { imageUrl, fromFile, referenceId } = extractDragDropPayload(event.dataTransfer);
      void (async () => {
        let nextUrl = imageUrl;
        if ((!nextUrl || nextUrl.startsWith("blob:")) && referenceId && resolvePreviewUrlById) {
          nextUrl = resolvePreviewUrlById(referenceId);
        }
        if (!nextUrl) return;
        const isBlobUrl = nextUrl.startsWith("blob:");
        const canAcceptBlob = fromFile || Boolean(referenceId);
        if (isBlobUrl && !canAcceptBlob) return;
        let ownsImageUrl = Boolean(fromFile && isBlobUrl);
        if (isBlobUrl && !ownsImageUrl) {
          const clonedBlobUrl = await cloneBlobObjectUrl(nextUrl);
          if (clonedBlobUrl) {
            nextUrl = clonedBlobUrl;
            ownsImageUrl = true;
          }
        }
        applyPrimaryImageIngress({ url: nextUrl, ownsImageUrl });
      })();
    },
    [applyPrimaryImageIngress, isMorePresetsSurfaceOpen, resolvePreviewUrlById]
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

  const applyTransformHistoryEntry = React.useCallback((entry: TransformHistoryEntry) => {
    setLayers((previousLayers) => applyTransformHistoryEntryToLayers(previousLayers, entry));
  }, []);

  const commitMarkupHistoryTransition = React.useCallback(
    (nextEntry: MarkupStroke[], baselineEntry?: MarkupStroke[] | null) => {
      setMarkupHistoryState((previousHistory) => {
        const previousEntry = baselineEntry ?? previousHistory.present;
        if (areMarkupStrokeSnapshotsEqual(previousEntry, nextEntry)) {
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

  const commitInpaintHistoryTransition = React.useCallback(
    (nextEntry: InpaintMaskSnapshot, baselineEntry?: InpaintMaskSnapshot | null) => {
      setInpaintHistoryState((previousHistory) => {
        const previousEntry = baselineEntry ?? previousHistory.present;
        if (areInpaintMaskSnapshotsEqual(previousEntry, nextEntry)) {
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

  const beginInpaintGestureHistory = React.useCallback(() => {
    inpaintGestureBaselineRef.current = captureInpaintMaskSnapshot();
  }, [captureInpaintMaskSnapshot]);

  const finalizeInpaintGestureHistory = React.useCallback(() => {
    const baselineEntry = inpaintGestureBaselineRef.current;
    if (!baselineEntry) return;
    inpaintGestureBaselineRef.current = null;
    const nextEntry = captureInpaintMaskSnapshot();
    commitInpaintHistoryTransition(nextEntry, baselineEntry);
  }, [captureInpaintMaskSnapshot, commitInpaintHistoryTransition]);

  const clearInpaintSelectionWithHistory = React.useCallback(() => {
    const baselineEntry = captureInpaintMaskSnapshot();
    clearSelectedLayerMask();
    const nextEntry = captureInpaintMaskSnapshot();
    commitInpaintHistoryTransition(nextEntry, baselineEntry);
  }, [captureInpaintMaskSnapshot, clearSelectedLayerMask, commitInpaintHistoryTransition]);

  const invertInpaintSelectionWithHistory = React.useCallback(() => {
    const baselineEntry = captureInpaintMaskSnapshot();
    invertSelectedLayerMask();
    const nextEntry = captureInpaintMaskSnapshot();
    commitInpaintHistoryTransition(nextEntry, baselineEntry);
  }, [captureInpaintMaskSnapshot, commitInpaintHistoryTransition, invertSelectedLayerMask]);

  const clearAllInpaintMasksWithHistory = React.useCallback(() => {
    const baselineEntry = captureInpaintMaskSnapshot();
    clearAllInpaintMasks();
    const nextEntry = captureInpaintMaskSnapshot();
    commitInpaintHistoryTransition(nextEntry, baselineEntry);
  }, [captureInpaintMaskSnapshot, clearAllInpaintMasks, commitInpaintHistoryTransition]);

  const beginMarkupGestureHistory = React.useCallback(() => {
    if (markupGestureBaselineRef.current) return;
    markupGestureBaselineRef.current = cloneMarkupStrokesSnapshot(markupStrokes);
  }, [markupStrokes]);

  const finalizeMarkupGestureHistory = React.useCallback(() => {
    const baselineEntry = markupGestureBaselineRef.current;
    if (!baselineEntry) return;
    markupGestureBaselineRef.current = null;
    const commit = () => {
      const nextEntry = cloneMarkupStrokesSnapshot(markupStrokes);
      commitMarkupHistoryTransition(nextEntry, baselineEntry);
    };
    if (typeof window === "undefined") {
      commit();
      return;
    }
    window.requestAnimationFrame(commit);
  }, [commitMarkupHistoryTransition, markupStrokes]);

  const clearMarkupStrokesWithHistory = React.useCallback(() => {
    const baselineEntry = cloneMarkupStrokesSnapshot(markupStrokes);
    setMarkupStrokes([]);
    commitMarkupHistoryTransition([], baselineEntry);
  }, [commitMarkupHistoryTransition, markupStrokes]);

  const handleUndoMoveAction = React.useCallback(() => {
    setTransformHistoryState((previousHistory) => {
      if (!previousHistory.past.length) return previousHistory;
      const targetEntry = previousHistory.past[previousHistory.past.length - 1] ?? null;
      if (!targetEntry) return previousHistory;
      pendingHistoryApplyEntryRef.current = targetEntry;
      return {
        past: previousHistory.past.slice(0, -1),
        present: targetEntry,
        future: [previousHistory.present, ...previousHistory.future],
      };
    });
  }, []);

  const handleRedoMoveAction = React.useCallback(() => {
    setTransformHistoryState((previousHistory) => {
      if (!previousHistory.future.length) return previousHistory;
      const targetEntry = previousHistory.future[0] ?? null;
      if (!targetEntry) return previousHistory;
      pendingHistoryApplyEntryRef.current = targetEntry;
      return {
        past: [...previousHistory.past, previousHistory.present],
        present: targetEntry,
        future: previousHistory.future.slice(1),
      };
    });
  }, []);

  const handleUndoMarkupAction = React.useCallback(() => {
    setMarkupHistoryState((previousHistory) => {
      if (!previousHistory.past.length) return previousHistory;
      const targetEntry = previousHistory.past[previousHistory.past.length - 1] ?? null;
      if (!targetEntry) return previousHistory;
      pendingMarkupHistoryApplyRef.current = cloneMarkupStrokesSnapshot(targetEntry);
      return {
        past: previousHistory.past.slice(0, -1),
        present: targetEntry,
        future: [previousHistory.present, ...previousHistory.future],
      };
    });
  }, []);

  const handleRedoMarkupAction = React.useCallback(() => {
    setMarkupHistoryState((previousHistory) => {
      if (!previousHistory.future.length) return previousHistory;
      const targetEntry = previousHistory.future[0] ?? null;
      if (!targetEntry) return previousHistory;
      pendingMarkupHistoryApplyRef.current = cloneMarkupStrokesSnapshot(targetEntry);
      return {
        past: [...previousHistory.past, previousHistory.present],
        present: targetEntry,
        future: previousHistory.future.slice(1),
      };
    });
  }, []);

  const handleUndoInpaintAction = React.useCallback(() => {
    setInpaintHistoryState((previousHistory) => {
      if (!previousHistory.past.length) return previousHistory;
      const targetEntry = previousHistory.past[previousHistory.past.length - 1] ?? null;
      if (!targetEntry) return previousHistory;
      pendingInpaintHistoryApplyRef.current = targetEntry;
      return {
        past: previousHistory.past.slice(0, -1),
        present: targetEntry,
        future: [previousHistory.present, ...previousHistory.future],
      };
    });
  }, []);

  const handleRedoInpaintAction = React.useCallback(() => {
    setInpaintHistoryState((previousHistory) => {
      if (!previousHistory.future.length) return previousHistory;
      const targetEntry = previousHistory.future[0] ?? null;
      if (!targetEntry) return previousHistory;
      pendingInpaintHistoryApplyRef.current = targetEntry;
      return {
        past: [...previousHistory.past, previousHistory.present],
        present: targetEntry,
        future: previousHistory.future.slice(1),
      };
    });
  }, []);

  const canUndoGeneralAction =
    canUndoTransformHistory || canUndoMarkupHistory || canUndoInpaintHistory;
  const canRedoGeneralAction =
    canRedoTransformHistory || canRedoMarkupHistory || canRedoInpaintHistory;

  const handleUndoGeneralAction = React.useCallback(() => {
    if (isInpaintToolSelected && canUndoInpaintHistory) {
      handleUndoInpaintAction();
      return;
    }
    if (isVideoToolSelected && canUndoMarkupHistory) {
      handleUndoMarkupAction();
      return;
    }
    if (canUndoTransformHistory) {
      handleUndoMoveAction();
      return;
    }
    if (canUndoInpaintHistory) {
      handleUndoInpaintAction();
      return;
    }
    if (canUndoMarkupHistory) {
      handleUndoMarkupAction();
    }
  }, [
    canUndoInpaintHistory,
    canUndoMarkupHistory,
    canUndoTransformHistory,
    handleUndoInpaintAction,
    handleUndoMarkupAction,
    handleUndoMoveAction,
    isInpaintToolSelected,
    isVideoToolSelected,
  ]);

  const handleRedoGeneralAction = React.useCallback(() => {
    if (isInpaintToolSelected && canRedoInpaintHistory) {
      handleRedoInpaintAction();
      return;
    }
    if (isVideoToolSelected && canRedoMarkupHistory) {
      handleRedoMarkupAction();
      return;
    }
    if (canRedoTransformHistory) {
      handleRedoMoveAction();
      return;
    }
    if (canRedoInpaintHistory) {
      handleRedoInpaintAction();
      return;
    }
    if (canRedoMarkupHistory) {
      handleRedoMarkupAction();
    }
  }, [
    canRedoInpaintHistory,
    canRedoMarkupHistory,
    canRedoTransformHistory,
    handleRedoInpaintAction,
    handleRedoMarkupAction,
    handleRedoMoveAction,
    isInpaintToolSelected,
    isVideoToolSelected,
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

  const handleRecenterMoveAction = React.useCallback(() => {
    if (selectedLayer) {
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
  }, [commitTransformHistoryTransition, layers, resetMarkupViewport, selectedLayer]);

  const resetAllMoveToolTransforms = React.useCallback(() => {
    const baselineEntry = buildTransformHistoryEntry(layers);
    const nextLayers = layers.map((layer) =>
      areLayerTransformsEqual(layer.transform, defaultLayerTransform())
        ? layer
        : {
            ...layer,
            transform: defaultLayerTransform(),
          }
    );
    const nextEntry = buildTransformHistoryEntry(nextLayers);
    if (areTransformHistoryEntriesEqual(baselineEntry, nextEntry)) return;
    setLayers(nextLayers);
    commitTransformHistoryTransition(nextEntry, baselineEntry);
  }, [commitTransformHistoryTransition, layers]);

  const handleResetGeneralAction = React.useCallback(() => {
    resetAllMoveToolTransforms();
    resetMarkupViewport();
    clearAllInpaintMasksWithHistory();
    clearMarkupStrokesWithHistory();
  }, [
    clearAllInpaintMasksWithHistory,
    clearMarkupStrokesWithHistory,
    resetAllMoveToolTransforms,
    resetMarkupViewport,
  ]);

  const clearGenerationModeSelectionArtifacts = React.useCallback(() => {
    clearAllInpaintMasksWithHistory();
    clearMarkupStrokesWithHistory();
  }, [clearAllInpaintMasksWithHistory, clearMarkupStrokesWithHistory]);

  const hasAnyMoveTransformChanges = React.useMemo(
    () =>
      layers.some((layer) => !areLayerTransformsEqual(layer.transform, defaultLayerTransform())),
    [layers]
  );
  const isMoveTransformCentered = React.useMemo(() => {
    if (!selectedLayer) return true;
    return areLayerTransformsEqual(selectedLayer.transform, defaultLayerTransform());
  }, [selectedLayer]);
  const isMarkupViewportAtRest = React.useMemo(
    () =>
      Math.abs(markupViewport.scale - MARKUP_VIEWPORT_DEFAULT_SCALE) <= MARKUP_VIEWPORT_EPSILON &&
      Math.abs(markupViewport.offsetXRatio) <= MARKUP_VIEWPORT_EPSILON &&
      Math.abs(markupViewport.offsetYRatio) <= MARKUP_VIEWPORT_EPSILON,
    [markupViewport]
  );
  const hasInpaintMaskContent = inpaintHistoryState.present.layers.length > 0;
  const isGeneralResetDisabled =
    !hasAnyMoveTransformChanges &&
    isMarkupViewportAtRest &&
    markupStrokes.length === 0 &&
    !hasInpaintMaskContent;

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
    resolveViewportOffsetPixels: resolveInteractionViewportOffsetPixels,
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

  const {
    clearTransformPointerSession,
    endTransformPointerSession,
    handleMovePointerDown,
    handleMovePointerMove,
    handleMovePointerLeave,
  } = useExpertEditTransformController({
    layers,
    selectedLayer,
    sceneZoomScale: markupViewport.scale,
    shouldApplyViewportTransform: true,
    viewportOffsetXRatio: markupViewport.offsetXRatio,
    viewportOffsetYRatio: markupViewport.offsetYRatio,
    resolveViewportOffsetPixels: resolveInteractionViewportOffsetPixels,
    transformPointerSessionRef,
    transformGestureBaselineRef,
    setLayers,
    setActiveTransformDragMode,
    setIsTransformPointerDragging,
    commitTransformHistoryTransition,
    showStatusToast,
  });

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
        handleMovePointerDown(event);
      },
      onPointerMove: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && continueMarkupPanGesture(event)) return;
        handleMovePointerMove(event);
      },
      onPointerUp: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGesture(event)) return;
        endTransformPointerSession(event);
      },
      onPointerCancel: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGesture(event)) return;
        endTransformPointerSession(event);
      },
      onPointerLeave: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGestureOnLeave(event)) return;
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

  const handleInlineStagePointerDownCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      if (!beginMarkupPanGesture(event, "inline")) return;
      event.stopPropagation();
    },
    [beginMarkupPanGesture, isMorePresetsSurfaceOpen]
  );

  const handleInlineStagePointerMoveCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      if (!continueMarkupPanGesture(event)) return;
      event.stopPropagation();
    },
    [continueMarkupPanGesture, isMorePresetsSurfaceOpen]
  );

  const handleInlineStagePointerUpCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      if (!endMarkupPanGesture(event)) return;
      event.stopPropagation();
    },
    [endMarkupPanGesture, isMorePresetsSurfaceOpen]
  );

  const handleInlineStagePointerCancelCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      if (!endMarkupPanGesture(event)) return;
      event.stopPropagation();
    },
    [endMarkupPanGesture, isMorePresetsSurfaceOpen]
  );

  const handleInlineStagePointerLeaveCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      if (!endMarkupPanGestureOnLeave(event)) return;
      event.stopPropagation();
    },
    [endMarkupPanGestureOnLeave, isMorePresetsSurfaceOpen]
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
      event.preventDefault();
      openStageContextMenu(event.clientX, event.clientY);
    },
    [isMorePresetsSurfaceOpen, openStageContextMenu]
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
    const selectedLayerId = selectedLayer?.id ?? null;
    if (!selectedLayerId) {
      closeStageContextMenu();
      return;
    }
    setLayers((previousLayers) =>
      resolveLayersAfterContextMenuRemoveImage({
        layers: previousLayers,
        selectedLayerId,
        foundationLayerId,
      })
    );
    closeStageContextMenu();
  }, [closeStageContextMenu, foundationLayerId, selectedLayer?.id]);

  const handlePrimaryDropzoneClick = React.useCallback(() => {
    if (isMorePresetsSurfaceOpen || hasPrimaryCompositePreview) return;
    primaryInputRef.current?.click();
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
    setPrimaryDragActive(false);
    setIsPresetsSurfaceDropActive(false);
    setIsPresetPanelDropActive(false);
  }, []);

  const toggleMorePresetsSurface = React.useCallback(() => {
    setIsMorePresetsSurfaceOpen((previous) => !previous);
  }, []);
  const handleStylesPanelToggle = React.useCallback(() => {
    onStylesPanelToggle?.();
  }, [onStylesPanelToggle]);

  const handleReorderLayers = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      const nextLayerState = resolveReorderedLayerState({
        layers,
        fromIndex,
        toIndex,
        resolvedSelectedLayerIndex,
        editingLayerIndex,
      });
      if (!nextLayerState) return;
      setLayers(nextLayerState.nextLayers);
      if (nextLayerState.nextSelectedLayerIndex !== undefined) {
        setSelectedLayerIndex(nextLayerState.nextSelectedLayerIndex);
      }
      if (nextLayerState.nextEditingLayerIndex !== undefined) {
        setEditingLayerIndex(nextLayerState.nextEditingLayerIndex);
      }
      draggingLayerIndexRef.current = null;
      setDragOverLayerIndex(null);
      setDraggingLayerIndex(null);
    },
    [editingLayerIndex, layers, resolvedSelectedLayerIndex]
  );

  const handleLayerDragStart = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      if (editingLayerIndex === index) {
        event.preventDefault();
        return;
      }
      event.stopPropagation();
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(LAYER_REORDER_DRAG_MIME, String(index));
      draggingLayerIndexRef.current = index;
      setDraggingLayerIndex(index);
      setDragOverLayerIndex(index);
    },
    [editingLayerIndex]
  );

  const handleLayerDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      const isLayerReorderDragActive = isLayerReorderDrag({
        draggingLayerIndex: draggingLayerIndexRef.current,
        dataTransferTypes: Array.from(event.dataTransfer?.types ?? []),
      });
      if (!isLayerReorderDragActive) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      if (dragOverLayerIndex !== index) {
        setDragOverLayerIndex(index);
      }
    },
    [dragOverLayerIndex]
  );

  const handleLayerDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      event.preventDefault();
      event.stopPropagation();
      const fromIndex = resolveLayerReorderFromIndex({
        transferIndexRaw: event.dataTransfer.getData(LAYER_REORDER_DRAG_MIME),
        draggingLayerIndexRef: draggingLayerIndexRef.current,
        draggingLayerIndex,
      });
      if (fromIndex == null) return;
      handleReorderLayers(fromIndex, index);
    },
    [draggingLayerIndex, handleReorderLayers]
  );

  const handleLayerDragEnd = React.useCallback(() => {
    draggingLayerIndexRef.current = null;
    setDraggingLayerIndex(null);
    setDragOverLayerIndex(null);
  }, []);

  const handleMarkupModalDragShield = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const isDragTargetInsideMarkupModal = React.useCallback((target: EventTarget | null) => {
    return isEventTargetInsideElement(markupModalRef.current, target);
  }, []);

  const handleMarkupModalRootDragCapture = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isMarkupExpandSelected) return;
      if (isDragTargetInsideMarkupModal(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
    },
    [isDragTargetInsideMarkupModal, isMarkupExpandSelected]
  );

  const handleDeleteLayer = React.useCallback(
    (index: number) => {
      const nextLayerState = resolveLayerStateAfterDelete({
        layers,
        index,
        foundationLayerId,
        resolvedSelectedLayerIndex,
        editingLayerIndex,
      });
      if (!nextLayerState) return;
      setLayers(nextLayerState.normalizedLayers);
      setEditingLayerValue("");
      setEditingLayerIndex(nextLayerState.nextEditingLayerIndex);
      setSelectedLayerIndex(nextLayerState.nextSelectedLayerIndex);
    },
    [editingLayerIndex, foundationLayerId, layers, resolvedSelectedLayerIndex]
  );

  React.useEffect(() => {
    if (layers.length <= 0) {
      setFoundationLayerId((previous) => (previous === null ? previous : null));
      return;
    }
    const hasCurrentFoundation = foundationLayerId
      ? layers.some((layer) => layer.id === foundationLayerId)
      : false;
    const resolvedFoundationId = hasCurrentFoundation ? foundationLayerId : (layers[0]?.id ?? null);
    setFoundationLayerId((previous) =>
      previous === resolvedFoundationId ? previous : resolvedFoundationId
    );
  }, [foundationLayerId, layers]);

  React.useEffect(() => {
    const syncedSliderValue = resolveMoveStageZoomSliderValue(markupViewport.scale);
    setMoveStageZoomSliderValue((previous) =>
      previous === syncedSliderValue ? previous : syncedSliderValue
    );
  }, [markupViewport.scale]);

  React.useEffect(() => {
    if (!layers.length) {
      setSelectedLayerIndex(null);
      return;
    }
    if (!isLayerIndexInBounds({ index: selectedLayerIndex, layerCount: layers.length })) {
      setSelectedLayerIndex(0);
    }
  }, [layers.length, selectedLayerIndex]);

  const buildCurrentSessionState = React.useCallback((): ExpertEditSessionState => {
    const normalizedSelectedLayerIndex = resolveLayerIndexOrNull({
      selectedLayerIndex,
      layerCount: layers.length,
    });
    const normalizedLayerIdCounter = Math.max(
      layerIdCounterRef.current,
      resolveLayerIdCounterFromLayers(layers)
    );
    return {
      version: EXPERT_EDIT_SESSION_STATE_VERSION,
      layers: {
        layerIdCounter: normalizedLayerIdCounter,
        foundationLayerId,
        selectedLayerIndex: normalizedSelectedLayerIndex,
        layers: layers.map((layer) => cloneLayerForSessionState(layer)),
      },
      markup: {
        strokes: cloneMarkupStrokesSnapshot(markupStrokes),
        history: cloneMarkupHistoryState(markupHistoryState),
      },
      inpaint: {
        history: cloneInpaintHistoryState(inpaintHistoryState),
      },
    };
  }, [
    foundationLayerId,
    inpaintHistoryState,
    layers,
    markupHistoryState,
    markupStrokes,
    selectedLayerIndex,
  ]);

  React.useEffect(() => {
    if (!onSessionStateChange) {
      pendingSessionStateRef.current = null;
      clearWindowAnimationFrameRef(sessionDispatchFrameRef);
      return;
    }
    const nextState = buildCurrentSessionState();
    const lastState = lastDispatchedSessionStateRef.current;
    if (lastState && areExpertEditSessionStatesEqual(lastState, nextState)) {
      return;
    }
    pendingSessionStateRef.current = nextState;
    const dispatch = () => {
      const pendingState = pendingSessionStateRef.current;
      pendingSessionStateRef.current = null;
      if (!pendingState) return;
      const previousState = lastDispatchedSessionStateRef.current;
      if (previousState && areExpertEditSessionStatesEqual(previousState, pendingState)) {
        return;
      }
      const clonedState = cloneExpertEditSessionState(pendingState);
      lastDispatchedSessionStateRef.current = clonedState;
      onSessionStateChange(clonedState);
    };
    scheduleWindowAnimationFrame({
      frameRef: sessionDispatchFrameRef,
      callback: dispatch,
    });
  }, [buildCurrentSessionState, onSessionStateChange]);

  React.useEffect(() => {
    const previousLayers = previousLayersRef.current;
    if (!previousLayers.length) {
      previousLayersRef.current = layers;
      return;
    }
    resolveStaleOwnedLayerImageUrls({
      previousLayers,
      activeLayers: layers,
    }).forEach((url) => {
      revokeObjectUrlSafe(url);
    });
    previousLayersRef.current = layers;
  }, [layers]);

  React.useEffect(() => {
    if (previousPrimaryPropRef.current === referenceImageUrl) return;
    previousPrimaryPropRef.current = referenceImageUrl;
    if (referenceImageUrl === lastDispatchedPrimaryRef.current) return;

    setLayers((previous) => {
      if (!previous.length) return previous;
      const lockedRemoveBackgroundIndex = removeBackgroundPendingLayerId
        ? previous.findIndex((layer) => layer.id === removeBackgroundPendingLayerId)
        : -1;
      const targetIndex =
        lockedRemoveBackgroundIndex >= 0
          ? lockedRemoveBackgroundIndex
          : resolveLayerIndexOrFallback({
              selectedLayerIndex,
              layerCount: previous.length,
            });
      const targetLayer = previous[targetIndex];
      if (!targetLayer) return previous;
      if (targetLayer.imageUrl === referenceImageUrl && !targetLayer.ownsImageUrl) {
        return previous;
      }
      const preserveLayerTransform = lockedRemoveBackgroundIndex >= 0;
      const nextLayers = [...previous];
      nextLayers[targetIndex] = {
        ...targetLayer,
        imageUrl: referenceImageUrl,
        ownsImageUrl: false,
        transform: preserveLayerTransform ? targetLayer.transform : defaultLayerTransform(),
      };
      return enforceLayerStackInvariants({
        layers: nextLayers,
        foundationLayerId,
      });
    });
  }, [foundationLayerId, referenceImageUrl, removeBackgroundPendingLayerId, selectedLayerIndex]);

  React.useEffect(() => {
    if (!removeBackgroundPendingLayerId) return;
    const pendingLayer =
      layers.find((layer) => layer.id === removeBackgroundPendingLayerId) ?? null;
    if (!pendingLayer) {
      clearRemoveBackgroundPending();
      return;
    }
    const pendingSourceUrl = removeBackgroundPendingSourceUrlRef.current;
    if (
      typeof pendingLayer.imageUrl === "string" &&
      pendingLayer.imageUrl.length > 0 &&
      pendingLayer.imageUrl !== pendingSourceUrl
    ) {
      clearRemoveBackgroundPending();
    }
  }, [clearRemoveBackgroundPending, layers, removeBackgroundPendingLayerId]);

  React.useEffect(() => {
    if (!isMoveToolSelected) {
      clearTransformPointerSession();
    }
  }, [clearTransformPointerSession, isMoveToolSelected]);

  React.useEffect(() => {
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
  }, []);

  React.useEffect(() => {
    if (isVideoToolSelected) return;
    clearMarkupDrawGestureSession();
  }, [clearMarkupDrawGestureSession, isVideoToolSelected]);

  React.useEffect(() => {
    if (hasPrimaryCompositePreview || markupStrokes.length <= 0) return;
    setMarkupStrokes([]);
    markupGestureBaselineRef.current = null;
    setMarkupHistoryState({
      past: [],
      present: [],
      future: [],
    });
  }, [hasPrimaryCompositePreview, markupStrokes.length]);

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
  }, [handleNativeMarkupViewportWheel, isMorePresetsSurfaceOpen]);

  React.useEffect(() => {
    const inlineStageElement = inlineStageWrapperRef.current;
    if (!inlineStageElement) return;

    const updateInlineSize = () => {
      const nextViewportSize = resolveStageViewportSize(resolveInlineStageRect(inlineStageElement));
      setInlineStageViewportSize((previous) =>
        previous.width === nextViewportSize.width && previous.height === nextViewportSize.height
          ? previous
          : nextViewportSize
      );
    };

    updateInlineSize();

    if (typeof ResizeObserver === "undefined") {
      if (typeof window === "undefined") return;
      window.addEventListener("resize", updateInlineSize);
      return () => {
        window.removeEventListener("resize", updateInlineSize);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateInlineSize();
    });
    resizeObserver.observe(inlineStageElement);
    return () => {
      resizeObserver.disconnect();
    };
  }, [aspect, isMarkupExpandSelected, resolveInlineStageRect]);

  React.useEffect(() => {
    if (!isMarkupExpandSelected) {
      setMarkupModalStageSize(null);
      return;
    }
    const markupModalElement = markupModalRef.current;
    if (!markupModalElement) return;

    const updateStageSize = () => {
      const modalRect = markupModalElement.getBoundingClientRect();
      const controlsRect = markupModalControlsRef.current?.getBoundingClientRect();
      const layersRect = markupModalLayersRef.current?.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(markupModalElement);
      const horizontalGapRaw = Number.parseFloat(computedStyle.columnGap || computedStyle.gap);
      const horizontalGap = Number.isFinite(horizontalGapRaw) ? horizontalGapRaw : 0;
      const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0;
      const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
      const controlsWidth = controlsRect?.width ?? 0;
      const layersWidth = layersRect?.width ?? 0;
      const availableWidth =
        modalRect.width -
        paddingLeft -
        paddingRight -
        controlsWidth -
        layersWidth -
        horizontalGap * 2;
      const availableHeight = modalRect.height - paddingTop - paddingBottom;
      const safeAspectRatio =
        Number.isFinite(primaryDropzoneAspectRatioValue) && primaryDropzoneAspectRatioValue > 0
          ? primaryDropzoneAspectRatioValue
          : 1;
      if (availableWidth <= 0 || availableHeight <= 0) {
        setMarkupModalStageSize((previous) => (previous == null ? previous : null));
        return;
      }
      let fittedWidth = availableWidth;
      let fittedHeight = fittedWidth / safeAspectRatio;
      if (fittedHeight > availableHeight) {
        fittedHeight = availableHeight;
        fittedWidth = fittedHeight * safeAspectRatio;
      }
      const nextStageSize = {
        width: Math.max(1, Math.floor(fittedWidth)),
        height: Math.max(1, Math.floor(fittedHeight)),
      };
      setMarkupModalStageSize((previous) => {
        if (!previous) {
          return nextStageSize;
        }
        return previous.width === nextStageSize.width && previous.height === nextStageSize.height
          ? previous
          : nextStageSize;
      });
    };

    updateStageSize();

    if (typeof ResizeObserver === "undefined") {
      if (typeof window === "undefined") return;
      window.addEventListener("resize", updateStageSize);
      return () => {
        window.removeEventListener("resize", updateStageSize);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateStageSize();
    });
    resizeObserver.observe(markupModalElement);
    if (markupModalControlsRef.current) {
      resizeObserver.observe(markupModalControlsRef.current);
    }
    if (markupModalLayersRef.current) {
      resizeObserver.observe(markupModalLayersRef.current);
    }

    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateStageSize);
    }

    return () => {
      resizeObserver.disconnect();
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", updateStageSize);
      }
    };
  }, [isMarkupExpandSelected, markupModalDomVersion, primaryDropzoneAspectRatioValue]);

  React.useEffect(() => {
    if (!isMarkupExpandSelected) return;
    const modalStageElement = markupModalStageRef.current;
    if (!modalStageElement) return;

    const updateModalViewportSize = () => {
      const nextViewportSize = resolveStageViewportSize(
        modalStageElement.getBoundingClientRect() ?? null
      );
      setMarkupModalViewportSize((previous) =>
        previous.width === nextViewportSize.width && previous.height === nextViewportSize.height
          ? previous
          : nextViewportSize
      );
    };

    updateModalViewportSize();

    if (typeof ResizeObserver === "undefined") {
      if (typeof window === "undefined") return;
      window.addEventListener("resize", updateModalViewportSize);
      return () => {
        window.removeEventListener("resize", updateModalViewportSize);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateModalViewportSize();
    });
    resizeObserver.observe(modalStageElement);
    return () => {
      resizeObserver.disconnect();
    };
  }, [isMarkupExpandSelected, markupModalDomVersion, markupModalStageSize]);

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
  }, [handleNativeMarkupViewportWheel, isMarkupExpandSelected, markupModalDomVersion]);

  React.useEffect(() => {
    if (!shouldShowInpaintBrushReticle || isMorePresetsSurfaceOpen) {
      unlockGlobalCursor();
    }
  }, [isMorePresetsSurfaceOpen, shouldShowInpaintBrushReticle, unlockGlobalCursor]);

  React.useEffect(() => {
    if (isTransformPointerDragging) return;
    setTransformHistoryState((previousHistory) => {
      if (areTransformHistoryEntriesEqual(previousHistory.present, currentTransformHistoryEntry)) {
        return previousHistory;
      }
      return {
        past: [],
        present: currentTransformHistoryEntry,
        future: [],
      };
    });
  }, [currentTransformHistoryEntry, isTransformPointerDragging]);

  React.useEffect(() => {
    if (!inpaintSessionRestorePendingRef.current) return;
    restoreInpaintMaskSnapshot(
      cloneInpaintMaskSnapshot(initialSessionState.inpaintHistory.present)
    );
    inpaintSessionRestorePendingRef.current = false;
  }, [initialSessionState.inpaintHistory.present, restoreInpaintMaskSnapshot]);

  React.useEffect(() => {
    if (inpaintSessionRestorePendingRef.current) return;
    const snapshot = captureInpaintMaskSnapshot();
    setInpaintHistoryState((previousHistory) =>
      areInpaintMaskSnapshotsEqual(previousHistory.present, snapshot)
        ? previousHistory
        : {
            past: [],
            present: snapshot,
            future: [],
          }
    );
  }, [captureInpaintMaskSnapshot, inpaintLayerSources]);

  React.useEffect(() => {
    const pendingEntry = pendingHistoryApplyEntryRef.current;
    if (!pendingEntry) return;
    pendingHistoryApplyEntryRef.current = null;
    applyTransformHistoryEntry(pendingEntry);
  }, [applyTransformHistoryEntry, transformHistoryState]);

  React.useEffect(() => {
    const pendingEntry = pendingMarkupHistoryApplyRef.current;
    if (!pendingEntry) return;
    pendingMarkupHistoryApplyRef.current = null;
    setMarkupStrokes(cloneMarkupStrokesSnapshot(pendingEntry));
  }, [markupHistoryState]);

  React.useEffect(() => {
    const pendingEntry = pendingInpaintHistoryApplyRef.current;
    if (!pendingEntry) return;
    pendingInpaintHistoryApplyRef.current = null;
    restoreInpaintMaskSnapshot(pendingEntry);
  }, [inpaintHistoryState, restoreInpaintMaskSnapshot]);

  React.useEffect(() => {
    if (lastDispatchedPrimaryRef.current === hostPrimaryImageUrl) return;
    lastDispatchedPrimaryRef.current = hostPrimaryImageUrl;
    onPrimaryImageChange(hostPrimaryImageUrl);
  }, [hostPrimaryImageUrl, onPrimaryImageChange]);

  React.useEffect(
    () => () => {
      unlockGlobalCursor();
      pendingHistoryApplyEntryRef.current = null;
      pendingMarkupHistoryApplyRef.current = null;
      pendingInpaintHistoryApplyRef.current = null;
      pendingSessionStateRef.current = null;
      lastDispatchedSessionStateRef.current = null;
      markupGestureBaselineRef.current = null;
      inpaintGestureBaselineRef.current = null;
      inpaintSessionRestorePendingRef.current = false;
      clearWindowAnimationFrameRef(sessionDispatchFrameRef);
      clearWindowTimeoutRef(inpaintCollapseTimerRef);
      clearWindowTimeoutRef(toastVisibleTimerRef);
      clearWindowTimeoutRef(toastFadeTimerRef);
      clearWindowTimeoutRef(removeBackgroundPendingTimeoutRef);
      clearTransientObjectUrlRevokeTimers({
        timersByUrl: transientRevokeTimersRef.current,
        revokeObjectUrl: revokeObjectUrlSafe,
      });
      if (!onSessionStateChange) {
        const ownedUrlsOnUnmount = collectOwnedLayerImageUrls(previousLayersRef.current);
        ownedUrlsOnUnmount.forEach((url) => revokeObjectUrlSafe(url));
      }
      previousLayersRef.current = [];
    },
    [onSessionStateChange, unlockGlobalCursor]
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

  const handleCommitLayerRename = React.useCallback(
    (index: number) => {
      const nextName = editingLayerValue.trim();
      if (nextName.length > 0) {
        const targetLayer = layers[index];
        if (!targetLayer) {
          setEditingLayerIndex(null);
          setEditingLayerValue("");
          return;
        }
        const shouldRemainAutoNamed = isAutoLayerName(nextName);
        const mappedName = shouldRemainAutoNamed
          ? formatLayerName(
              resolveLowestUnusedAutoLayerNumber({
                layers,
                excludeLayerId: targetLayer.id,
              })
            )
          : nextName;
        const nextLayers = layers.map((layer, layerIndex) =>
          layerIndex === index
            ? {
                ...layer,
                name: mappedName,
                isAutoNamed: shouldRemainAutoNamed,
              }
            : layer
        );
        setLayers(nextLayers);
      }
      setEditingLayerIndex(null);
      setEditingLayerValue("");
    },
    [editingLayerValue, layers]
  );

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

  const renderLayerUtilityActionButtons = () =>
    editLayerUtilityActions.map((action) => {
      const Icon = action.icon;
      const actionCreditCost = action.creditCost;
      const isFlattenAction = action.id === FLATTEN_IMAGE_ACTION_ID;
      const isFlattenActionPending = isFlattenAction && isFlattenPending;
      const isActionDisabled = Boolean(
        (action.id === REMOVE_BACKGROUND_ACTION_ID &&
          (isGenerateDisabled || !selectedLayerImageUrl || isRemoveBackgroundPending)) ||
        (isFlattenAction && (populatedLayerCount <= 0 || isFlattenPending))
      );
      return (
        <button
          key={action.id}
          type="button"
          className={`edit-expert-preset-action-btn ${action.buttonClassName ?? ""}`.trim()}
          aria-label={isFlattenActionPending ? "Flattening layers" : action.label}
          aria-busy={isFlattenActionPending || undefined}
          disabled={isActionDisabled}
          onClick={
            isFlattenAction
              ? () => void handleManualFlatten()
              : action.id === REMOVE_BACKGROUND_ACTION_ID
                ? handleRemoveBackground
                : undefined
          }
        >
          <span className="edit-expert-preset-action-btn-icon" aria-hidden="true">
            {isFlattenActionPending ? (
              <span className="edit-expert-preset-action-btn-spinner" />
            ) : (
              <Icon size={20} weight="regular" />
            )}
          </span>
          <span className="edit-expert-preset-action-btn-copy">
            <span>{isFlattenActionPending ? "Flattening..." : action.label}</span>
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

  const renderLayerUtilityActions = (className = "edit-expert-layers-actions") => (
    <div className={className} aria-label="Layer utility actions">
      {renderLayerUtilityActionButtons()}
    </div>
  );

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

  const renderLayersToolbar = (scope: "main" | "modal") => {
    const isModalScope = scope === "modal";
    const shouldShowUtilityActions = true;
    const layersToolbarBody = (
      <>
        <div className="edit-expert-layers-toolbar-card">
          <div className="edit-expert-layers-toolbar-list">
            {layers.map((layer, index) =>
              editingLayerIndex === index ? (
                <input
                  key={layer.id}
                  type="text"
                  className="edit-expert-layer-input"
                  value={editingLayerValue}
                  autoFocus
                  aria-label={`Rename ${layer.name}`}
                  onChange={(event) => setEditingLayerValue(event.target.value)}
                  onBlur={() => handleCommitLayerRename(index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCommitLayerRename(index);
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setEditingLayerIndex(null);
                      setEditingLayerValue("");
                    }
                  }}
                />
              ) : (
                <div
                  key={layer.id}
                  className={`edit-expert-layer-row ${
                    draggingLayerIndex === index ? "is-dragging" : ""
                  } ${dragOverLayerIndex === index ? "is-drop-target" : ""}`.trim()}
                  draggable={editingLayerIndex !== index}
                  onDragStart={(event) => handleLayerDragStart(event, index)}
                  onDragOver={(event) => handleLayerDragOver(event, index)}
                  onDrop={(event) => handleLayerDrop(event, index)}
                  onDragEnd={handleLayerDragEnd}
                >
                  <button
                    type="button"
                    className={`edit-expert-preset-btn edit-expert-layer-btn ${
                      resolvedSelectedLayerIndex === index ? "is-selected" : ""
                    }`}
                    onClick={() => setSelectedLayerIndex(index)}
                    onDoubleClick={() => {
                      setEditingLayerIndex(index);
                      setEditingLayerValue(layer.name);
                    }}
                  >
                    <span className="edit-expert-layer-label">{layer.name}</span>
                  </button>
                  <button
                    type="button"
                    className="edit-expert-layer-delete-btn"
                    aria-label={`Delete ${layer.name}`}
                    onClick={() => handleDeleteLayer(index)}
                  >
                    <TrashSimple size={12} weight="regular" />
                  </button>
                </div>
              )
            )}
          </div>
        </div>
        {shouldShowUtilityActions && isModalScope ? renderLayerUtilityActions() : null}
        {statusToastMessage && isLayerLimitStatusToast ? (
          <div
            className={`edit-expert-stage-status-toast edit-expert-stage-status-toast--layers ${
              statusToastTone === "warning" ? "is-warning" : "is-info"
            } ${isStatusToastFading ? "is-fading" : ""}`.trim()}
            role="status"
            aria-live="polite"
          >
            {statusToastMessage}
          </div>
        ) : null}
      </>
    );
    return (
      <div
        ref={isModalScope ? handleMarkupModalLayersRef : undefined}
        className={`edit-expert-layers-toolbar ${
          isModalScope ? "edit-expert-layers-toolbar--modal" : ""
        }`.trim()}
        aria-label={isModalScope ? "Expanded canvas layers toolbar" : "Edit layers toolbar"}
      >
        {isModalScope ? (
          <>
            <div className="edit-expert-layers-toolbar-header-row">
              <div className="edit-expert-layers-toolbar-title-card">
                <p className="edit-expert-layers-toolbar-title">Layers</p>
              </div>
              <button
                type="button"
                className="edit-expert-markup-modal-close-btn"
                aria-label="Close expanded markup canvas"
                onClick={closeMarkupModal}
              >
                <X size={14} weight="bold" />
              </button>
            </div>
            {layersToolbarBody}
          </>
        ) : (
          <div className="edit-expert-column-wrapper edit-expert-column-wrapper--right">
            <div className="edit-expert-layers-toolbar-title-card">
              <p className="edit-expert-layers-toolbar-title">Layers</p>
              <span className="edit-expert-layers-toolbar-title-icon" aria-hidden="true">
                <StackSimple size={14} weight="regular" />
              </span>
            </div>
            {layersToolbarBody}
          </div>
        )}
      </div>
    );
  };

  const renderSelectedLayerTransformOverlay = React.useCallback(
    (scope: "inline" | "modal"): React.ReactNode | null => {
      if (!shouldShowSelectedLayerTransformOverlay || !selectedLayerTransformOverlayStyle) {
        return null;
      }
      const viewportSize = scope === "modal" ? markupModalViewportSize : inlineDropzoneViewportSize;
      const resolvedDropzoneAspectRatio =
        viewportSize.width > 1 && viewportSize.height > 1
          ? viewportSize.width / viewportSize.height
          : primaryDropzoneAspectRatioValue;
      let selectionBoxWidthPercent = 100;
      let selectionBoxHeightPercent = 100;
      if (selectedLayerImageAspectRatio > resolvedDropzoneAspectRatio) {
        selectionBoxHeightPercent =
          (resolvedDropzoneAspectRatio / selectedLayerImageAspectRatio) * 100;
      } else {
        selectionBoxWidthPercent =
          (selectedLayerImageAspectRatio / resolvedDropzoneAspectRatio) * 100;
      }
      const selectedLayerScale = Math.max(0.0001, selectedLayer?.transform.scale ?? 1);
      return (
        <div
          className="edit-expert-primary-layer-selection-overlay"
          style={selectedLayerTransformOverlayStyle}
          aria-hidden="true"
          data-testid={`edit-expert-transform-overlay-${scope}`}
        >
          <div
            className="edit-expert-primary-layer-selection-box"
            style={{
              width: `${Math.max(0.0001, selectionBoxWidthPercent * selectedLayerScale)}%`,
              height: `${Math.max(0.0001, selectionBoxHeightPercent * selectedLayerScale)}%`,
            }}
          >
            <span className="edit-expert-primary-layer-selection-outline" />
            {selectedLayerTransformHandleCorners.map((corner) => (
              <span
                key={`${scope}-selected-layer-handle-${corner}`}
                className={`edit-expert-primary-layer-selection-handle is-corner-${corner}`}
                data-edit-expert-transform-drag-mode="resize"
                data-testid={`edit-expert-transform-handle-${scope}-${corner}`}
              />
            ))}
          </div>
        </div>
      );
    },
    [
      inlineDropzoneViewportSize,
      markupModalViewportSize,
      primaryDropzoneAspectRatioValue,
      selectedLayer,
      selectedLayerImageAspectRatio,
      selectedLayerTransformOverlayStyle,
      shouldShowSelectedLayerTransformOverlay,
    ]
  );

  const renderPrimaryStageViewport = React.useCallback(
    ({
      scope,
      viewportStyle,
      overlayCanvas,
      stageSize,
      stageElement,
    }: {
      scope: "inline" | "modal";
      viewportStyle: React.CSSProperties;
      overlayCanvas: React.RefObject<HTMLCanvasElement>;
      stageSize: StageViewportSize;
      stageElement: HTMLDivElement | null;
    }) => (
      <div className="edit-expert-markup-viewport" style={viewportStyle}>
        <div className="edit-expert-primary-layer-content-clip">
          {layers.map((layer, index) =>
            layer.imageUrl ? (
              <div
                key={scope === "modal" ? `markup-modal-${layer.id}` : layer.id}
                className="edit-expert-primary-layer-frame"
                style={{
                  backgroundImage: `url(${layer.imageUrl})`,
                  zIndex: layers.length - index,
                  opacity: clampLayerOpacity(layer.opacity),
                  transform: resolveLayerFrameTransformStyle(layer),
                  transformOrigin: "center center",
                }}
              />
            ) : null
          )}
          <canvas
            ref={overlayCanvas}
            className="edit-expert-inpaint-overlay-canvas"
            aria-hidden="true"
          />
          {renderMarkupStrokeOverlay(scope, stageSize, stageElement)}
          {renderPrimaryStageBusyOverlay()}
        </div>
        {renderSelectedLayerTransformOverlay(scope)}
      </div>
    ),
    [
      layers,
      renderMarkupStrokeOverlay,
      renderPrimaryStageBusyOverlay,
      renderSelectedLayerTransformOverlay,
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
            <div className="edit-expert-preset-toolbar-title-card">
              <p className="edit-expert-preset-toolbar-title">Prompt Presets</p>
              <span className="edit-expert-preset-toolbar-title-icon" aria-hidden="true">
                <Sliders size={14} weight="regular" />
              </span>
            </div>
            <div className="edit-expert-preset-toolbar-card">
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
              {renderLayerUtilityActionButtons()}
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
        {!isMarkupExpandSelected ? renderLayersToolbar("main") : null}

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
          <div
            ref={inlineStageWrapperRef}
            className={`edit-expert-column-wrapper edit-expert-column-wrapper--center edit-expert-stage-wrapper ${
              shouldShowSelectedLayerTransformOverlay ? "is-transform-overlay-active" : ""
            }`.trim()}
            onPointerDownCapture={handleInlineStagePointerDownCapture}
            onPointerMoveCapture={handleInlineStagePointerMoveCapture}
            onPointerUpCapture={handleInlineStagePointerUpCapture}
            onPointerCancelCapture={handleInlineStagePointerCancelCapture}
            onPointerLeave={handleInlineStagePointerLeaveCapture}
          >
            <div
              ref={primaryDropzoneRef}
              className={`edit-expert-primary-dropzone ${hasPrimaryCompositePreview ? "has-preview" : ""} ${
                isMorePresetsSurfaceOpen ? "is-presets-open" : ""
              } ${primaryDragActive ? "is-dragging" : ""} ${
                shouldShowSelectedLayerTransformOverlay ? "is-transform-overlay-active" : ""
              }`}
              style={primaryDropzoneStyle}
              onDrop={handlePrimaryDrop}
              onDragEnter={handlePrimaryDragEnter}
              onDragOver={handlePrimaryDragOver}
              onDragLeave={handlePrimaryDragLeave}
              onPointerDown={inlineStageInteractionRouter.onPointerDown}
              onPointerMove={inlineStageInteractionRouter.onPointerMove}
              onPointerUp={inlineStageInteractionRouter.onPointerUp}
              onPointerCancel={inlineStageInteractionRouter.onPointerCancel}
              onPointerLeave={inlineStageInteractionRouter.onPointerLeave}
              onMouseDown={handleMarkupStageMiddleClickSuppress}
              onAuxClick={handleMarkupStageMiddleClickSuppress}
              onContextMenu={handlePrimaryDropzoneContextMenu}
              onClick={handlePrimaryDropzoneClick}
              onDoubleClick={handlePrimaryDropzoneDoubleClick}
              aria-label="Primary edit image"
              aria-busy={isPrimaryStageBusy || undefined}
            >
              {hasPrimaryCompositePreview ? (
                renderPrimaryStageViewport({
                  scope: "inline",
                  viewportStyle: inlineMarkupViewportStyle,
                  overlayCanvas: overlayCanvasRef,
                  stageSize: inlineDropzoneViewportSize,
                  stageElement: primaryDropzoneRef.current,
                })
              ) : (
                <div className="edit-expert-markup-viewport" style={inlineMarkupViewportStyle}>
                  <div className="edit-expert-markup-viewport-empty-state">
                    <div className="reference-drop-content image-drop-content">
                      <UploadSimple size={28} weight="regular" />
                      <p className="reference-drop-title">Click to upload an image</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
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
                <>
                  <div className="edit-expert-secondary-control">
                    <p className="edit-expert-secondary-title">Reference Images</p>
                    <div className="edit-expert-secondary-row">
                      {secondaries.map((index) => {
                        const previewUrl = extraImageUrls[index];
                        const inputRef = inputRefs[index];
                        return (
                          <div
                            className="edit-expert-secondary-slot"
                            key={`expert-edit-secondary-${index}`}
                          >
                            <div
                              className={`reference-dropzone extra ${previewUrl ? "has-preview" : ""} ${
                                extraDragActive[index] ? "is-dragging" : ""
                              }`}
                              draggable={Boolean(previewUrl)}
                              onDragStart={(event) =>
                                handleSecondaryPromptTokenDragStart(event, index)
                              }
                              onDrop={handleExtraDrop(index)}
                              onDragEnter={handleExtraDragEnter(index)}
                              onDragOver={handleExtraDragOver(index)}
                              onDragLeave={handleExtraDragLeave(index)}
                              onClick={() => inputRef.current?.click()}
                              style={
                                previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined
                              }
                              aria-label={`Secondary edit image ${index + 1}`}
                            >
                              {previewUrl ? (
                                <button
                                  type="button"
                                  className="dropzone-clear"
                                  aria-label={`Remove secondary image ${index + 1}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onExtraImageChange(index, null);
                                  }}
                                >
                                  <TrashSimple size={14} weight="regular" />
                                </button>
                              ) : (
                                <Plus size={18} weight="regular" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <StylesControl
                    isOpen={isStylesPanelOpen}
                    selectedStyleId={selectedStyleId}
                    styles={stylesCatalog}
                    onToggle={handleStylesPanelToggle}
                  />
                </>
              ) : null}
            </div>
            <div className="edit-expert-bottom-row">
              <div className="edit-expert-prompt-shell">
                <div className="edit-expert-prompt-row">
                  <div className="edit-expert-prompt-input-shell" ref={promptInputShellRef}>
                    <div
                      ref={promptHighlightRef}
                      className="edit-expert-prompt-highlight"
                      aria-hidden="true"
                    >
                      {promptHighlightSegments.map((segment, index) => (
                        <span
                          key={`prompt-highlight-${index}-${segment.kind}`}
                          className={`edit-expert-prompt-highlight-segment is-${segment.kind}`}
                        >
                          {segment.text}
                        </span>
                      ))}
                      <span className="edit-expert-prompt-highlight-segment edit-expert-prompt-highlight-segment--buffer">
                        {"\n"}
                      </span>
                    </div>
                    <textarea
                      ref={promptTextareaRef}
                      className="prompt-drop-input edit-expert-prompt-input"
                      value={promptTextValue}
                      onChange={(event) => handlePromptTextChange(event.target.value)}
                      onDrop={handlePromptDropWithTokenInsert}
                      onDragOver={(event) => event.preventDefault()}
                      onScroll={handlePromptScroll}
                      placeholder="Write your prompt..."
                      aria-label="Edit prompt"
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="off"
                      data-gramm="false"
                    />
                  </div>
                </div>
                {promptTokenInlineError ? (
                  <p className="edit-expert-prompt-token-error" role="alert">
                    {promptTokenInlineError}
                  </p>
                ) : null}
              </div>
              <div className="edit-expert-inline-generate edit-expert-inline-generate--outside">
                <AgentGenerateButton
                  onClick={handleInlineGenerate}
                  disabled={inlineGenerateDisabled}
                  isBusy={isGenerateBusy}
                  cost={costCredits != null ? costCredits : "—"}
                />
              </div>
            </div>
            <div className="edit-expert-selector-row create-expert-secondary-row create-expert-controls-row">
              <div className="create-expert-controls">
                <div className="create-expert-control create-expert-model-control">
                  <button
                    type="button"
                    className={`model-picker-btn create-expert-picker-control create-expert-model-picker-trigger ${
                      !modelId ? "is-empty" : ""
                    } ${isModelPickerLocked ? "is-locked" : ""} ${
                      isModelModalOpen && modelModalAnchor === "reference-model" ? "is-open" : ""
                    }`}
                    data-model-anchor="reference-model"
                    aria-label="Open model picker"
                    disabled={isModelPickerLocked}
                    onClick={(event) =>
                      onModelPickerOpen("reference-model", event.currentTarget, "reference-image")
                    }
                  >
                    {effectiveModelPickerLogoSrc ? (
                      <Image
                        className="model-chip-logo-img"
                        src={effectiveModelPickerLogoSrc}
                        alt=""
                        aria-hidden
                        width={74}
                        height={18}
                        unoptimized={false}
                      />
                    ) : null}
                    <span className="model-picker-name">{effectiveModelPickerLabel}</span>
                  </button>
                </div>

                <div className="create-expert-control create-expert-aspect-control">
                  <AspectDropdown
                    aspect={aspect}
                    onSelect={onAspectChange}
                    options={aspectOptionsForModel}
                  />
                </div>

                {shouldShowResolutionControl ? (
                  <div className="create-expert-control create-expert-resolution-control">
                    <ResolutionDropdown
                      value={imageResolutionValue}
                      options={imageResolutionOptions}
                      onSelect={onImageResolutionChange}
                    />
                  </div>
                ) : null}
              </div>
            </div>
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

      <ExpertEditMarkupModalShell
        isOpen={isMarkupExpandSelected}
        modalRef={handleMarkupModalRef}
        controlsColumnRef={handleMarkupModalControlsRef}
        stageRef={handleMarkupModalStageRef}
        stageClassName={
          shouldShowSelectedLayerTransformOverlay ? "is-transform-overlay-active" : undefined
        }
        stageStyle={markupModalStageStyle}
        generalPanel={renderMarkupModalGeneralPanel()}
        movePanel={renderMarkupModalMovePanel()}
        inpaintPanel={renderMarkupModalInpaintPanel("modal")}
        markupPanel={renderMarkupControlsContent("modal")}
        stageContent={renderPrimaryStageViewport({
          scope: "modal",
          viewportStyle: modalMarkupViewportStyle,
          overlayCanvas: modalOverlayCanvasRef,
          stageSize: markupModalViewportSize,
          stageElement: markupModalStageRef.current,
        })}
        layersPanel={renderLayersToolbar("modal")}
        onClose={closeMarkupModal}
        onDragShield={handleMarkupModalDragShield}
        onStageMouseDown={handleMarkupStageMiddleClickSuppress}
        onStageAuxClick={handleMarkupStageMiddleClickSuppress}
        onStagePointerDown={modalStageInteractionRouter.onPointerDown}
        onStagePointerMove={modalStageInteractionRouter.onPointerMove}
        onStagePointerUp={modalStageInteractionRouter.onPointerUp}
        onStagePointerCancel={modalStageInteractionRouter.onPointerCancel}
        onStagePointerLeave={modalStageInteractionRouter.onPointerLeave}
        onStageWheel={noopStageWheel}
      />

      {stageContextMenuState.isOpen ? (
        <div
          ref={stageContextMenuRef}
          className="edit-expert-stage-context-menu"
          role="menu"
          aria-label="Stage actions"
          style={{
            left: `${stageContextMenuState.x}px`,
            top: `${stageContextMenuState.y}px`,
          }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button type="button" role="menuitem" onClick={handleStageContextMenuRecenter}>
            Recenter
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleStageContextMenuExpand}
            disabled={isMarkupExpandSelected}
          >
            Expand
          </button>
          <button type="button" role="menuitem" onClick={handleStageContextMenuAddImage}>
            Add Image
          </button>
          <button
            type="button"
            role="menuitem"
            className="is-danger"
            onClick={handleStageContextMenuReset}
          >
            Reset
          </button>
          <button
            type="button"
            role="menuitem"
            className="is-danger"
            onClick={handleStageContextMenuRemoveImage}
            disabled={!selectedLayerImageUrl}
          >
            Remove Image
          </button>
        </div>
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
