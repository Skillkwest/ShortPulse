import Image from "next/image";
import React from "react";
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsOutCardinal,
  CaretLeft,
  CaretRight,
  CircleDashed,
  CircleHalf,
  Crop,
  GearSix,
  MagicWand,
  PaintBrush,
  PaintBrushBroad,
  Plus,
  Sliders,
  Sparkle,
  StackSimple,
  Sticker,
  TrashSimple,
  UploadSimple,
} from "phosphor-react";
import type { Icon as PhosphorIcon } from "phosphor-react";
import { AgentGenerateButton } from "../../../../prefabs/agent";
import type { AspectOption } from "../../types";
import { modelLogos } from "../../constants";
import type { ModelModalContext } from "../ModelModal";
import { AspectDropdown } from "../AspectDropdown";
import { ResolutionDropdown } from "../ResolutionDropdown";
import { stripEditLabel } from "../../utils/modelLabels";
import { extractDragDropPayload, isImageDragTransfer } from "../../utils/dragDrop";
import { composePrimaryLayersToBlob } from "../../logic/expertEditLayerCompose";
import type { InpaintSubmissionOverride } from "../../logic/inpaintSubmission";
import { computeCostForModel } from "../../logic/pricing";
import { useReferencePropertiesConstraintEffects } from "../useReferencePropertiesConstraintEffects";
import { useReferencePropertiesDerivedState } from "../useReferencePropertiesDerivedState";
import { useReferencePropertiesInteractions } from "../useReferencePropertiesInteractions";
import {
  getCreateCharacterInitials,
  type CreateCharacterOption,
  useCreateCharacterModeController,
} from "../create/useCreateCharacterModeController";
import { resolveInpaintBrushDiameter, useInpaintMaskController } from "./useInpaintMaskController";
import { ExpertEditPresetsSurface } from "./ExpertEditPresetsSurface";
import {
  EDIT_PRESET_MORE_LABEL,
  EDIT_PRESET_SURFACE_LABELS,
  EDIT_PRESET_TOOLBAR_LABELS,
} from "./expertEditPresets";

export type ExpertEditPanelViewProps = {
  expertEditEligible: boolean;
  aspect: string;
  modelId: string | null;
  modelLabel: string;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  referenceText: string | null;
  imageResolution?: string;
  aspectOptions: AspectOption[];
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
  onPrimaryImageChange: (url: string | null) => void;
  onExtraImageChange: (index: number, url: string | null) => void;
  onPromptTextChange: (value: string) => void;
  onRegenerate: () => void;
  onRegenerateWithReferenceInputs?: (
    referenceInputs: string[],
    options?: {
      inpaintOverride?: InpaintSubmissionOverride | null;
      modelIdOverride?: string | null;
    }
  ) => void | Promise<void>;
  onAddSessionMediaReference?: (payload: { url: string; mimeType?: string | null }) => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  costCredits?: number | null;
  isGenerateDisabled?: boolean;
  isGenerateBusy?: boolean;
  referenceImageWarning?: string | null;
  onImageResolutionChange?: (value: string) => void;
  characterOptions?: CreateCharacterOption[];
  selectedCharacterId?: string;
  onSelectedCharacterIdChange?: (value: string) => void;
  isCharacterOptionsLoading?: boolean;
  characterModeEnabled?: boolean;
  onCharacterModeEnabledChange?: (value: boolean) => void;
};

type CharacterPickerModalProps = {
  isOpen: boolean;
  characterModeEnabled: boolean;
  onClose: () => void;
  characterOptions: CreateCharacterOption[];
  selectedCharacterId: string;
  onSelectedCharacterIdChange?: (value: string) => void;
};

const CharacterPickerModal = ({
  isOpen,
  characterModeEnabled,
  onClose,
  characterOptions,
  selectedCharacterId,
  onSelectedCharacterIdChange,
}: CharacterPickerModalProps) => {
  if (!isOpen || !characterModeEnabled) {
    return null;
  }

  return (
    <>
      <div className="model-modal-backdrop ai-character-picker-backdrop" onClick={onClose} />
      <div
        className="model-modal ai-character-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Choose character"
      >
        <div className="model-modal-header">
          <div className="model-modal-title-group">
            <h3 className="model-modal-title">Character Picker</h3>
            <p className="model-modal-subtitle">
              Select a character profile from Character Manager.
            </p>
          </div>
          <button
            type="button"
            className="ghost-btn mini model-modal-close"
            aria-label="Close character picker"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="model-modal-scroll">
          {characterOptions.length > 0 ? (
            <div className="ai-character-picker-grid" role="list" aria-label="Character options">
              {characterOptions.map((option) => {
                const isActive = option.id === selectedCharacterId;
                return (
                  <article
                    key={option.id}
                    role="listitem"
                    className={`ai-character-list-card ai-character-picker-card ${
                      isActive ? "is-active" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="ai-character-list-select-btn"
                      aria-pressed={isActive}
                      onClick={() => {
                        onSelectedCharacterIdChange?.(option.id);
                        onClose();
                      }}
                    >
                      <div className="ai-character-list-main">
                        <span className="ai-character-list-avatar" aria-hidden="true">
                          {option.profileImageUrl ? (
                            <Image
                              src={option.profileImageUrl}
                              alt=""
                              className="ai-character-list-avatar-image"
                              width={44}
                              height={44}
                              unoptimized
                            />
                          ) : (
                            <span className="ai-character-list-avatar-initials">
                              {getCreateCharacterInitials(option.name)}
                            </span>
                          )}
                        </span>
                        <div className="ai-character-list-copy">
                          <p className="metric-label tiny">{isActive ? "Selected" : "Character"}</p>
                          <p className="ai-character-list-name">{option.name}</p>
                        </div>
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="tiny subdued ai-character-picker-empty">
              No character profiles available.
            </p>
          )}
        </div>
      </div>
    </>
  );
};

const secondaries = [0, 1, 2] as const;
const editPresetUtilityActions = [
  {
    id: "remove-background",
    label: "Remove Background",
    icon: MagicWand,
    iconWeight: "fill" as const,
    buttonClassName: "edit-expert-preset-action-btn--remove-bg",
    creditCost: 1,
    hideIcon: true,
    requiresPrimaryImage: true,
  },
] as const;
const editLayerUtilityActions = [
  {
    label: "Flatten Image",
    icon: StackSimple,
    buttonClassName: "edit-expert-preset-action-btn--compose-image",
  },
] as const;
type RailTool = "move" | "inpaint" | "crop";
const inpaintRailTools: ReadonlyArray<{
  id: RailTool;
  label: string;
  selectedClassName: string;
  icon: PhosphorIcon;
}> = [
  {
    id: "inpaint",
    label: "Inpaint",
    selectedClassName: "is-selected-inpaint",
    icon: PaintBrushBroad,
  },
  {
    id: "move",
    label: "Move",
    selectedClassName: "is-selected-move",
    icon: ArrowsOutCardinal,
  },
  {
    id: "crop",
    label: "Crop",
    selectedClassName: "is-selected-crop",
    icon: Crop,
  },
];
type InpaintMode = "lasso" | "brush" | "auto";
type InpaintSelectionTab = "select" | "unselect";
type MoveMode = "move" | "resize" | "rotate";
const cropAspectRatioPresets = [
  { value: "9:16", label: "Vertical" },
  { value: "4:5", label: "Social Post" },
  { value: "1:1", label: "Square" },
  { value: "5:4", label: "Photo" },
  { value: "16:9", label: "Landscape" },
] as const;
const MAX_LAYERS = 10;
const INPAINT_COLLAPSE_ANIMATION_MS = 140;
const STATUS_TOAST_VISIBLE_MS = 1_000;
const STATUS_TOAST_FADE_MS = 220;
const TRANSIENT_OBJECT_URL_REVOKE_MS = 60_000;
const INPAINT_FILL_MODEL_ID = "fal-ai/flux-pro/v1/fill";
const BRIA_REMOVE_BACKGROUND_MODEL_ID = "fal-ai/bria/background/remove";
const REMOVE_BACKGROUND_ACTION_ID = "remove-background";
const MOVE_ZOOM_DEFAULT = 125;
const INPAINT_STROKE_SIZE_DEFAULT = 26;
const INPAINT_CURSOR_DIAMETER_MIN = 8;
const INPAINT_CURSOR_DIAMETER_MAX = 52;
const INPAINT_CURSOR_PADDING = 6;
const LAYER_OPACITY_MIN = 0;
const LAYER_OPACITY_MAX = 1;
const LAYER_OPACITY_DEFAULT = 1;
const formatLayerName = (indexOneBased: number) => `layer ${indexOneBased}`;
const autoLayerNamePattern = /^layer\s*'?\d+'?$/i;
const isAutoLayerName = (value: string) => autoLayerNamePattern.test(value.trim());
const clampLayerOpacity = (value: number) =>
  Math.min(LAYER_OPACITY_MAX, Math.max(LAYER_OPACITY_MIN, value));

const buildInpaintBrushReticleCursor = (strokeSize: number) => {
  const diameter = Math.min(
    INPAINT_CURSOR_DIAMETER_MAX,
    Math.max(INPAINT_CURSOR_DIAMETER_MIN, resolveInpaintBrushDiameter(strokeSize))
  );
  const canvasSize = diameter + INPAINT_CURSOR_PADDING * 2;
  const center = canvasSize / 2;
  const radius = diameter / 2;
  const ringStrokeWidth = diameter >= 34 ? 2 : 1.6;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="rgba(0,0,0,0.8)" stroke-width="${ringStrokeWidth + 1}" />
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="rgba(245,249,255,0.98)" stroke-width="${ringStrokeWidth}" />
    </svg>
  `.trim();
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${center} ${center}, crosshair`;
};

const buildInpaintLassoCursor = () => {
  const cursorSize = 28;
  const center = 9;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${cursorSize}" height="${cursorSize}" viewBox="0 0 ${cursorSize} ${cursorSize}">
      <g id="lasso-cursor">
        <path d="M9 2.6c3.8 0 6.9 2.9 6.9 6.4s-3.1 6.4-6.9 6.4S2.1 12.5 2.1 9s3.1-6.4 6.9-6.4Z" fill="none" stroke="rgba(0,0,0,0.86)" stroke-width="2.2" />
        <path d="M9 2.6c3.8 0 6.9 2.9 6.9 6.4s-3.1 6.4-6.9 6.4S2.1 12.5 2.1 9s3.1-6.4 6.9-6.4Z" fill="none" stroke="rgba(97,234,255,0.98)" stroke-width="1.4" />
        <path d="M13.9 13.5l5.4 5.4" fill="none" stroke="rgba(0,0,0,0.86)" stroke-width="2.4" stroke-linecap="round" />
        <path d="M13.9 13.5l5.4 5.4" fill="none" stroke="rgba(97,234,255,0.98)" stroke-width="1.4" stroke-linecap="round" />
      </g>
    </svg>
  `.trim();
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${center} ${center}, crosshair`;
};

type ExpertEditLayer = {
  id: string;
  name: string;
  imageUrl: string | null;
  opacity: number;
  isAutoNamed: boolean;
  ownsImageUrl: boolean;
};

const normalizeAutoLayers = (layers: ExpertEditLayer[]) =>
  layers.map((layer, index) =>
    layer.isAutoNamed ? { ...layer, name: formatLayerName(index + 1) } : layer
  );

const revokeObjectUrlSafe = (url: string) => {
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Preserve UI flow even when revocation fails.
  }
};

const resolveBlobDimensions = async (blob: Blob): Promise<{ width: number; height: number }> => {
  if (typeof window !== "undefined" && typeof window.createImageBitmap === "function") {
    const bitmap = await window.createImageBitmap(blob);
    const dimensions = {
      width: Math.max(1, bitmap.width),
      height: Math.max(1, bitmap.height),
    };
    bitmap.close();
    return dimensions;
  }
  const tempUrl = URL.createObjectURL(blob);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () =>
        resolve({
          width: Math.max(1, image.naturalWidth || 1),
          height: Math.max(1, image.naturalHeight || 1),
        });
      image.onerror = () => reject(new Error("Unable to read image dimensions."));
      image.src = tempUrl;
    });
    return dimensions;
  } finally {
    revokeObjectUrlSafe(tempUrl);
  }
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
  onExtraImageChange,
  onPromptTextChange,
  onRegenerate,
  onRegenerateWithReferenceInputs,
  onAddSessionMediaReference,
  resolvePreviewUrlById,
  costCredits,
  isGenerateDisabled = false,
  isGenerateBusy = false,
  onImageResolutionChange,
  characterOptions = [],
  selectedCharacterId = "",
  onSelectedCharacterIdChange,
  isCharacterOptionsLoading = false,
  characterModeEnabled = false,
  onCharacterModeEnabledChange,
}: ExpertEditPanelViewProps) {
  const layerIdCounterRef = React.useRef(1);
  const previousLayersRef = React.useRef<ExpertEditLayer[]>([]);
  const lastDispatchedPrimaryRef = React.useRef<string | null>(referenceImageUrl);
  const previousPrimaryPropRef = React.useRef<string | null>(referenceImageUrl);
  const inpaintCollapseTimerRef = React.useRef<number | null>(null);
  const toastVisibleTimerRef = React.useRef<number | null>(null);
  const toastFadeTimerRef = React.useRef<number | null>(null);
  const transientRevokeTimersRef = React.useRef<Map<string, number>>(new Map());
  const primaryInputRef = React.useRef<HTMLInputElement | null>(null);
  const primaryDropzoneRef = React.useRef<HTMLDivElement | null>(null);

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
    }),
    []
  );

  const [selectedInpaintMode, setSelectedInpaintMode] = React.useState<InpaintMode>("brush");
  const [selectedRailTool, setSelectedRailTool] = React.useState<RailTool>("inpaint");
  const [selectedMoveMode, setSelectedMoveMode] = React.useState<MoveMode>("move");
  const [moveZoomValue, setMoveZoomValue] = React.useState(MOVE_ZOOM_DEFAULT);
  const [inpaintStrokeSize, setInpaintStrokeSize] = React.useState(INPAINT_STROKE_SIZE_DEFAULT);
  const [selectedCropAspect, setSelectedCropAspect] = React.useState(aspect);
  const [selectedInpaintSelectionTab, setSelectedInpaintSelectionTab] =
    React.useState<InpaintSelectionTab>("select");
  const [isInpaintCollapsed, setIsInpaintCollapsed] = React.useState(true);
  const [isInpaintCollapsing, setIsInpaintCollapsing] = React.useState(false);
  const [isMorePresetsSurfaceOpen, setIsMorePresetsSurfaceOpen] = React.useState(false);
  const [primaryDragActive, setPrimaryDragActive] = React.useState(false);
  const [layers, setLayers] = React.useState<ExpertEditLayer[]>(() => [
    createLayer({
      indexOneBased: 1,
      imageUrl: referenceImageUrl,
      isAutoNamed: true,
      ownsImageUrl: false,
    }),
  ]);
  const [selectedLayerIndex, setSelectedLayerIndex] = React.useState<number | null>(0);
  const [editingLayerIndex, setEditingLayerIndex] = React.useState<number | null>(null);
  const [editingLayerValue, setEditingLayerValue] = React.useState("");
  const [draggingLayerIndex, setDraggingLayerIndex] = React.useState<number | null>(null);
  const [dragOverLayerIndex, setDragOverLayerIndex] = React.useState<number | null>(null);
  const [statusToastMessage, setStatusToastMessage] = React.useState<string | null>(null);
  const [isStatusToastFading, setIsStatusToastFading] = React.useState(false);

  const resolvedSelectedLayerIndex =
    selectedLayerIndex == null || selectedLayerIndex < 0 || selectedLayerIndex >= layers.length
      ? 0
      : selectedLayerIndex;
  const selectedLayer = layers[resolvedSelectedLayerIndex] ?? null;
  const selectedLayerImageUrl = selectedLayer?.imageUrl ?? null;
  const populatedLayerCount = React.useMemo(
    () => layers.filter((layer) => Boolean(layer.imageUrl)).length,
    [layers]
  );
  const hasPrimaryCompositePreview = populatedLayerCount > 0;
  const hostPrimaryImageUrl = React.useMemo(
    () =>
      selectedLayerImageUrl ?? layers.find((layer) => Boolean(layer.imageUrl))?.imageUrl ?? null,
    [layers, selectedLayerImageUrl]
  );

  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;
  const isCropToolSelected = selectedRailTool === "crop";
  const isInpaintToolSelected = selectedRailTool === "inpaint";
  const isMoveToolSelected = selectedRailTool === "move";
  React.useEffect(() => {
    setSelectedCropAspect(aspect);
  }, [aspect]);

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

  const {
    isCharacterPickerOpen,
    openCharacterPicker,
    closeCharacterPicker,
    handleCharacterModeEnabledToggle,
    characterSelectDisabled,
    isCharacterSelectionEmpty,
    selectedCharacterName,
    selectedCharacterProfileImageUrl,
    selectedCharacterInitials,
  } = useCreateCharacterModeController({
    beginnerMode: false,
    characterModeEnabled,
    characterOptions,
    selectedCharacterId,
    isCharacterOptionsLoading,
    onCharacterModeEnabledChange,
  });

  const inputRefs = [extraOneInputRef, extraTwoInputRef, extraThreeInputRef] as const;
  const shouldShowResolutionControl = imageResolutionOptions.length > 0;
  const hasPromptText = (referenceText ?? "").trim().length > 0;
  const inlineGenerateDisabled = isGenerateDisabled || populatedLayerCount <= 0 || !hasPromptText;
  const removeBackgroundCostCredits = React.useMemo(() => {
    return (
      computeCostForModel(BRIA_REMOVE_BACKGROUND_MODEL_ID, {
        aspect,
      })?.credits ?? 1
    );
  }, [aspect]);
  const inpaintLayerSources = React.useMemo(
    () => layers.map((layer) => ({ id: layer.id, imageUrl: layer.imageUrl })),
    [layers]
  );

  const showStatusToast = React.useCallback((message: string) => {
    if (toastVisibleTimerRef.current != null) {
      window.clearTimeout(toastVisibleTimerRef.current);
      toastVisibleTimerRef.current = null;
    }
    if (toastFadeTimerRef.current != null) {
      window.clearTimeout(toastFadeTimerRef.current);
      toastFadeTimerRef.current = null;
    }
    setStatusToastMessage(message);
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
  }, []);

  const {
    overlayCanvasRef,
    hasSelectedLayerMask,
    imageHasInteractiveMask,
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
  const morePresetsSurfaceId = React.useId();
  const primaryDropzoneCursor = React.useMemo(() => {
    if (shouldShowInpaintBrushReticle) {
      return buildInpaintBrushReticleCursor(inpaintStrokeSize);
    }
    if (shouldShowInpaintLassoCursor) {
      return buildInpaintLassoCursor();
    }
    return undefined;
  }, [inpaintStrokeSize, shouldShowInpaintBrushReticle, shouldShowInpaintLassoCursor]);
  const primaryDropzoneStyle = React.useMemo(() => {
    if (isMorePresetsSurfaceOpen) return undefined;
    if (!primaryDropzoneCursor) return undefined;
    return { cursor: primaryDropzoneCursor };
  }, [isMorePresetsSurfaceOpen, primaryDropzoneCursor]);

  const scheduleTransientObjectUrlRevoke = React.useCallback((url: string) => {
    const existingTimer = transientRevokeTimersRef.current.get(url);
    if (existingTimer != null) {
      window.clearTimeout(existingTimer);
    }
    const timer = window.setTimeout(() => {
      transientRevokeTimersRef.current.delete(url);
      revokeObjectUrlSafe(url);
    }, TRANSIENT_OBJECT_URL_REVOKE_MS);
    transientRevokeTimersRef.current.set(url, timer);
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

      const targetIndex =
        selectedLayerIndex == null || selectedLayerIndex < 0 || selectedLayerIndex >= layers.length
          ? 0
          : selectedLayerIndex;
      const targetLayer = layers[targetIndex];
      if (!targetLayer) return;

      if (!targetLayer.imageUrl) {
        const nextLayers = [...layers];
        nextLayers[targetIndex] = {
          ...targetLayer,
          imageUrl: candidateUrl,
          ownsImageUrl: payload.ownsImageUrl,
        };
        setLayers(nextLayers);
        return;
      }

      if (layers.length >= MAX_LAYERS) {
        if (payload.ownsImageUrl && candidateUrl.startsWith("blob:")) {
          revokeObjectUrlSafe(candidateUrl);
        }
        showStatusToast("Layer limit reached (10).");
        return;
      }

      const appendedLayer = createLayer({
        indexOneBased: layers.length + 1,
        imageUrl: candidateUrl,
        ownsImageUrl: payload.ownsImageUrl,
      });
      const nextLayers = normalizeAutoLayers([...layers, appendedLayer]);
      setLayers(nextLayers);
      setSelectedLayerIndex(nextLayers.length - 1);
      setEditingLayerIndex(null);
      setEditingLayerValue("");
    },
    [createLayer, layers, selectedLayerIndex, showStatusToast]
  );

  const buildFlattenReferenceInputs = React.useCallback(
    (flattenedPrimaryUrl: string) => {
      const candidates = [
        flattenedPrimaryUrl,
        ...extraImageUrls.map((value) => value?.trim() ?? "").filter((value) => value.length > 0),
      ];
      const deduped = Array.from(new Set(candidates));
      return deduped.slice(0, 8);
    },
    [extraImageUrls]
  );

  const handleManualFlatten = React.useCallback(async () => {
    if (populatedLayerCount <= 0) {
      showStatusToast("Add at least one layer image before flattening.");
      return;
    }

    try {
      const flattenedBlob = await composePrimaryLayersToBlob(layers, { mimeType: "image/png" });
      const flattenedLayerUrl = URL.createObjectURL(flattenedBlob);
      const flattenedReferenceUrl = URL.createObjectURL(flattenedBlob);
      const layerOne = layers[0] ?? createLayer({ indexOneBased: 1 });
      const flattenedLayer: ExpertEditLayer = {
        ...layerOne,
        name: layerOne.isAutoNamed ? formatLayerName(1) : layerOne.name,
        isAutoNamed: layerOne.isAutoNamed,
        imageUrl: flattenedLayerUrl,
        opacity: LAYER_OPACITY_DEFAULT,
        ownsImageUrl: true,
      };
      setLayers([flattenedLayer]);
      setSelectedLayerIndex(0);
      setEditingLayerIndex(null);
      setEditingLayerValue("");
      if (onAddSessionMediaReference) {
        onAddSessionMediaReference({
          url: flattenedReferenceUrl,
          mimeType: "image/png",
        });
      } else {
        scheduleTransientObjectUrlRevoke(flattenedReferenceUrl);
      }
    } catch {
      showStatusToast("Unable to flatten layers.");
    }
  }, [
    createLayer,
    layers,
    onAddSessionMediaReference,
    populatedLayerCount,
    scheduleTransientObjectUrlRevoke,
    showStatusToast,
  ]);

  const handleRemoveBackground = React.useCallback(() => {
    const run = async () => {
      if (populatedLayerCount <= 0) {
        showStatusToast("Add at least one layer image before removing background.");
        return;
      }
      if (!onRegenerateWithReferenceInputs) {
        showStatusToast("Remove background is unavailable in this session.");
        return;
      }

      let flattenedUrl: string | null = null;
      try {
        const flattenedBlob = await composePrimaryLayersToBlob(layers, { mimeType: "image/png" });
        flattenedUrl = URL.createObjectURL(flattenedBlob);
        const referenceInputs = buildFlattenReferenceInputs(flattenedUrl);
        await onRegenerateWithReferenceInputs(referenceInputs, {
          modelIdOverride: BRIA_REMOVE_BACKGROUND_MODEL_ID,
        });
      } catch {
        if (flattenedUrl) {
          revokeObjectUrlSafe(flattenedUrl);
          flattenedUrl = null;
        }
        showStatusToast("Unable to remove background.");
      } finally {
        if (flattenedUrl) {
          scheduleTransientObjectUrlRevoke(flattenedUrl);
        }
      }
    };
    void run();
  }, [
    buildFlattenReferenceInputs,
    layers,
    onRegenerateWithReferenceInputs,
    populatedLayerCount,
    scheduleTransientObjectUrlRevoke,
    showStatusToast,
  ]);

  const handleInlineGenerate = React.useCallback(() => {
    const run = async () => {
      if (populatedLayerCount <= 0) {
        showStatusToast("Add at least one layer image before generating.");
        return;
      }

      let flattenedUrl: string | null = null;
      let inpaintMaskUrl: string | null = null;
      try {
        const flattenedBlob = await composePrimaryLayersToBlob(layers, { mimeType: "image/png" });
        flattenedUrl = URL.createObjectURL(flattenedBlob);
        const referenceInputs = buildFlattenReferenceInputs(flattenedUrl);

        if (hasSelectedLayerMask) {
          if (!onRegenerateWithReferenceInputs) {
            showStatusToast("Inpaint generate is unavailable in this session.");
            return;
          }
          const flattenedDimensions = await resolveBlobDimensions(flattenedBlob);
          const inpaintMaskBlob = await exportSelectedLayerMaskBlob({
            targetWidth: flattenedDimensions.width,
            targetHeight: flattenedDimensions.height,
            mimeType: "image/png",
          });
          if (!inpaintMaskBlob) {
            showStatusToast("Mask selection is required for inpaint.");
            return;
          }
          inpaintMaskUrl = URL.createObjectURL(inpaintMaskBlob);
          await onRegenerateWithReferenceInputs(referenceInputs, {
            inpaintOverride: {
              modelId: INPAINT_FILL_MODEL_ID,
              baseImageInput: flattenedUrl,
              maskInput: inpaintMaskUrl,
              outputFormat: "png",
            },
          });
          return;
        }

        if (!onRegenerateWithReferenceInputs) {
          onRegenerate();
          return;
        }
        await onRegenerateWithReferenceInputs(referenceInputs);
      } catch {
        if (flattenedUrl) {
          revokeObjectUrlSafe(flattenedUrl);
          flattenedUrl = null;
        }
        if (inpaintMaskUrl) {
          revokeObjectUrlSafe(inpaintMaskUrl);
          inpaintMaskUrl = null;
        }
        showStatusToast("Unable to flatten layers.");
      } finally {
        if (flattenedUrl) {
          if (onRegenerateWithReferenceInputs) {
            scheduleTransientObjectUrlRevoke(flattenedUrl);
          } else {
            revokeObjectUrlSafe(flattenedUrl);
          }
        }
        if (inpaintMaskUrl) {
          if (onRegenerateWithReferenceInputs) {
            scheduleTransientObjectUrlRevoke(inpaintMaskUrl);
          } else {
            revokeObjectUrlSafe(inpaintMaskUrl);
          }
        }
      }
    };
    void run();
  }, [
    buildFlattenReferenceInputs,
    exportSelectedLayerMaskBlob,
    hasSelectedLayerMask,
    layers,
    onRegenerate,
    onRegenerateWithReferenceInputs,
    populatedLayerCount,
    scheduleTransientObjectUrlRevoke,
    showStatusToast,
  ]);

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
      let nextUrl = imageUrl;
      if ((!nextUrl || nextUrl.startsWith("blob:")) && referenceId && resolvePreviewUrlById) {
        nextUrl = resolvePreviewUrlById(referenceId);
      }
      if (!nextUrl) return;
      const isBlobUrl = nextUrl.startsWith("blob:");
      const canAcceptBlob = fromFile || Boolean(referenceId);
      if (isBlobUrl && !canAcceptBlob) return;
      applyPrimaryImageIngress({ url: nextUrl, ownsImageUrl: Boolean(fromFile && isBlobUrl) });
    },
    [applyPrimaryImageIngress, isMorePresetsSurfaceOpen, resolvePreviewUrlById]
  );

  const handlePrimaryPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      handleInpaintPointerDown(event);
    },
    [handleInpaintPointerDown, isMorePresetsSurfaceOpen]
  );

  const handlePrimaryPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      handleInpaintPointerMove(event);
    },
    [handleInpaintPointerMove, isMorePresetsSurfaceOpen]
  );

  const handlePrimaryPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      handleInpaintPointerUp(event);
    },
    [handleInpaintPointerUp, isMorePresetsSurfaceOpen]
  );

  const handlePrimaryPointerCancel = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      handleInpaintPointerCancel(event);
    },
    [handleInpaintPointerCancel, isMorePresetsSurfaceOpen]
  );

  const handlePrimaryPointerLeave = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      handleInpaintPointerLeave(event);
    },
    [handleInpaintPointerLeave, isMorePresetsSurfaceOpen]
  );

  const handlePrimaryDropzoneClick = React.useCallback(() => {
    if (isMorePresetsSurfaceOpen || hasPrimaryCompositePreview) return;
    primaryInputRef.current?.click();
  }, [hasPrimaryCompositePreview, isMorePresetsSurfaceOpen]);

  const closeMorePresetsSurface = React.useCallback(() => {
    setIsMorePresetsSurfaceOpen(false);
    setPrimaryDragActive(false);
  }, []);

  const handleAddLayer = React.useCallback(() => {
    if (layers.length >= MAX_LAYERS) {
      showStatusToast("Layer limit reached (10).");
      return;
    }
    const nextLayers = normalizeAutoLayers([
      ...layers,
      createLayer({ indexOneBased: layers.length + 1 }),
    ]);
    setLayers(nextLayers);
    setSelectedLayerIndex(nextLayers.length - 1);
  }, [createLayer, layers, showStatusToast]);

  const handleReorderLayers = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const movingLayer = layers[fromIndex];
      if (!movingLayer) return;

      const selectedLayerId = layers[resolvedSelectedLayerIndex]?.id ?? null;
      const editingLayerId =
        editingLayerIndex != null ? (layers[editingLayerIndex]?.id ?? null) : null;
      const nextLayers = [...layers];
      const [movedLayer] = nextLayers.splice(fromIndex, 1);
      if (!movedLayer) return;
      nextLayers.splice(toIndex, 0, movedLayer);
      setLayers(nextLayers);

      if (selectedLayerId) {
        const nextSelectedIndex = nextLayers.findIndex((layer) => layer.id === selectedLayerId);
        setSelectedLayerIndex(nextSelectedIndex >= 0 ? nextSelectedIndex : 0);
      }
      if (editingLayerId) {
        const nextEditingIndex = nextLayers.findIndex((layer) => layer.id === editingLayerId);
        setEditingLayerIndex(nextEditingIndex >= 0 ? nextEditingIndex : null);
      }
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
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", layers[index]?.id ?? "");
      setDraggingLayerIndex(index);
      setDragOverLayerIndex(index);
    },
    [editingLayerIndex, layers]
  );

  const handleLayerDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      if (draggingLayerIndex == null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (dragOverLayerIndex !== index) {
        setDragOverLayerIndex(index);
      }
    },
    [dragOverLayerIndex, draggingLayerIndex]
  );

  const handleLayerDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      event.preventDefault();
      if (draggingLayerIndex == null) return;
      handleReorderLayers(draggingLayerIndex, index);
    },
    [draggingLayerIndex, handleReorderLayers]
  );

  const handleLayerDragEnd = React.useCallback(() => {
    setDraggingLayerIndex(null);
    setDragOverLayerIndex(null);
  }, []);

  const handleDeleteLayer = React.useCallback(
    (index: number) => {
      const targetLayer = layers[index];
      if (!targetLayer) return;

      if (index === 0) {
        const nextLayers = normalizeAutoLayers(
          layers.map((layer, layerIndex) =>
            layerIndex === 0
              ? {
                  ...layer,
                  name: formatLayerName(1),
                  isAutoNamed: true,
                  imageUrl: null,
                  opacity: LAYER_OPACITY_DEFAULT,
                  ownsImageUrl: false,
                }
              : layer
          )
        );
        setLayers(nextLayers);
        setSelectedLayerIndex(0);
        setEditingLayerIndex((previousIndex) => (previousIndex === 0 ? null : previousIndex));
        setEditingLayerValue("");
        return;
      }

      const nextLayers = normalizeAutoLayers(
        layers.filter((_, layerIndex) => layerIndex !== index)
      );
      setLayers(nextLayers);
      setEditingLayerIndex((previousIndex) => {
        if (previousIndex == null) return previousIndex;
        if (previousIndex === index) return null;
        if (previousIndex > index) return previousIndex - 1;
        return previousIndex;
      });
      setEditingLayerValue("");
      setSelectedLayerIndex((previousIndex) => {
        if (previousIndex == null) return previousIndex;
        if (previousIndex === index) {
          return Math.max(0, Math.min(index - 1, nextLayers.length - 1));
        }
        if (previousIndex > index) return previousIndex - 1;
        return previousIndex;
      });
    },
    [layers]
  );

  React.useEffect(() => {
    if (!layers.length) {
      setSelectedLayerIndex(null);
      return;
    }
    if (
      selectedLayerIndex == null ||
      selectedLayerIndex < 0 ||
      selectedLayerIndex >= layers.length
    ) {
      setSelectedLayerIndex(0);
    }
  }, [layers.length, selectedLayerIndex]);

  React.useEffect(() => {
    const previousLayers = previousLayersRef.current;
    if (!previousLayers.length) {
      previousLayersRef.current = layers;
      return;
    }
    const activeOwnedUrls = new Set(
      layers
        .filter((layer) => layer.ownsImageUrl && typeof layer.imageUrl === "string")
        .map((layer) => layer.imageUrl as string)
    );
    previousLayers.forEach((layer) => {
      if (!layer.ownsImageUrl || !layer.imageUrl) return;
      if (activeOwnedUrls.has(layer.imageUrl)) return;
      revokeObjectUrlSafe(layer.imageUrl);
    });
    previousLayersRef.current = layers;
  }, [layers]);

  React.useEffect(() => {
    if (previousPrimaryPropRef.current === referenceImageUrl) return;
    previousPrimaryPropRef.current = referenceImageUrl;
    if (referenceImageUrl === lastDispatchedPrimaryRef.current) return;

    setLayers((previous) => {
      if (!previous.length) return previous;
      const targetIndex =
        selectedLayerIndex == null ||
        selectedLayerIndex < 0 ||
        selectedLayerIndex >= previous.length
          ? 0
          : selectedLayerIndex;
      const targetLayer = previous[targetIndex];
      if (!targetLayer) return previous;
      if (targetLayer.imageUrl === referenceImageUrl && !targetLayer.ownsImageUrl) {
        return previous;
      }
      const nextLayers = [...previous];
      nextLayers[targetIndex] = {
        ...targetLayer,
        imageUrl: referenceImageUrl,
        ownsImageUrl: false,
      };
      return nextLayers;
    });
  }, [referenceImageUrl, selectedLayerIndex]);

  React.useEffect(() => {
    if (lastDispatchedPrimaryRef.current === hostPrimaryImageUrl) return;
    lastDispatchedPrimaryRef.current = hostPrimaryImageUrl;
    onPrimaryImageChange(hostPrimaryImageUrl);
  }, [hostPrimaryImageUrl, onPrimaryImageChange]);

  React.useEffect(
    () => () => {
      if (inpaintCollapseTimerRef.current != null) {
        window.clearTimeout(inpaintCollapseTimerRef.current);
        inpaintCollapseTimerRef.current = null;
      }
      if (toastVisibleTimerRef.current != null) {
        window.clearTimeout(toastVisibleTimerRef.current);
        toastVisibleTimerRef.current = null;
      }
      if (toastFadeTimerRef.current != null) {
        window.clearTimeout(toastFadeTimerRef.current);
        toastFadeTimerRef.current = null;
      }
      transientRevokeTimersRef.current.forEach((timer, url) => {
        window.clearTimeout(timer);
        revokeObjectUrlSafe(url);
      });
      transientRevokeTimersRef.current.clear();
      const ownedUrlsOnUnmount = new Set(
        previousLayersRef.current
          .filter((layer) => layer.ownsImageUrl && typeof layer.imageUrl === "string")
          .map((layer) => layer.imageUrl as string)
      );
      ownedUrlsOnUnmount.forEach((url) => revokeObjectUrlSafe(url));
      previousLayersRef.current = [];
    },
    []
  );

  const handleInpaintCollapseToggle = React.useCallback(() => {
    if (inpaintCollapseTimerRef.current != null) {
      window.clearTimeout(inpaintCollapseTimerRef.current);
      inpaintCollapseTimerRef.current = null;
    }

    if (isInpaintCollapsed) {
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
  }, [isInpaintCollapsed]);

  const handleCommitLayerRename = React.useCallback(
    (index: number) => {
      const nextName = editingLayerValue.trim();
      if (nextName.length > 0) {
        const shouldRemainAutoNamed = isAutoLayerName(nextName);
        const mappedName = shouldRemainAutoNamed ? formatLayerName(index + 1) : nextName;
        const nextLayers = normalizeAutoLayers(
          layers.map((layer, layerIndex) =>
            layerIndex === index
              ? {
                  ...layer,
                  name: mappedName,
                  isAutoNamed: shouldRemainAutoNamed,
                }
              : layer
          )
        );
        setLayers(nextLayers);
      }
      setEditingLayerIndex(null);
      setEditingLayerValue("");
    },
    [editingLayerValue, layers]
  );

  return (
    <div
      className="tool-properties edit-expert-panel create-expert-panel"
      role="group"
      aria-label="Expert edit composer"
    >
      <div className="edit-expert-main-stage">
        <div className="edit-expert-preset-toolbar" aria-label="Edit preset toolbar">
          <div className="edit-expert-preset-toolbar-title-card">
            <p className="edit-expert-preset-toolbar-title">Presets</p>
            <span className="edit-expert-preset-toolbar-title-icon" aria-hidden="true">
              <Sliders size={14} weight="regular" />
            </span>
          </div>
          <div className="edit-expert-preset-toolbar-card">
            <div className="edit-expert-preset-toolbar-list">
              {EDIT_PRESET_TOOLBAR_LABELS.map((label) => (
                <React.Fragment key={label}>
                  {label === EDIT_PRESET_MORE_LABEL ? (
                    <div className="edit-expert-preset-divider" aria-hidden="true" />
                  ) : null}
                  <button
                    type="button"
                    className="edit-expert-preset-btn"
                    aria-label={`Apply ${label} preset`}
                    aria-expanded={
                      label === EDIT_PRESET_MORE_LABEL ? isMorePresetsSurfaceOpen : undefined
                    }
                    aria-controls={
                      label === EDIT_PRESET_MORE_LABEL ? morePresetsSurfaceId : undefined
                    }
                    onClick={
                      label === EDIT_PRESET_MORE_LABEL
                        ? () => setIsMorePresetsSurfaceOpen(isMorePresetsSurfaceOpen ? false : true)
                        : undefined
                    }
                  >
                    {label === EDIT_PRESET_MORE_LABEL ? (
                      <span className="edit-expert-preset-btn-icon" aria-hidden="true">
                        <GearSix size={12} weight="regular" />
                      </span>
                    ) : null}
                    {label}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="edit-expert-preset-actions" aria-label="Preset utility actions">
            {editPresetUtilityActions.map((action) => {
              const Icon = action.icon;
              const isActionDisabled = Boolean(
                isGenerateDisabled || (action.requiresPrimaryImage && !selectedLayerImageUrl)
              );
              const actionCreditCost =
                action.id === REMOVE_BACKGROUND_ACTION_ID
                  ? removeBackgroundCostCredits
                  : action.creditCost;
              return (
                <button
                  key={action.id}
                  type="button"
                  className={`edit-expert-preset-action-btn ${action.buttonClassName ?? ""}`.trim()}
                  aria-label={action.label}
                  disabled={isActionDisabled}
                  onClick={
                    action.id === REMOVE_BACKGROUND_ACTION_ID ? handleRemoveBackground : undefined
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
            })}
          </div>
        </div>
        <div className="edit-expert-layers-toolbar" aria-label="Edit layers toolbar">
          <div className="edit-expert-layers-toolbar-title-card">
            <p className="edit-expert-layers-toolbar-title">Layers</p>
            <span className="edit-expert-layers-toolbar-title-icon" aria-hidden="true">
              <StackSimple size={14} weight="regular" />
            </span>
          </div>
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
          <button
            type="button"
            className="edit-expert-layers-add-btn"
            aria-label="Add layer"
            onClick={handleAddLayer}
          >
            <Plus size={12} weight="bold" />
          </button>
          <div className="edit-expert-layers-actions" aria-label="Layer utility actions">
            {editLayerUtilityActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  className={`edit-expert-preset-action-btn ${action.buttonClassName ?? ""}`.trim()}
                  aria-label={action.label}
                  onClick={
                    action.label === "Flatten Image" ? () => void handleManualFlatten() : undefined
                  }
                >
                  <Icon size={20} weight="regular" />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
          {statusToastMessage ? (
            <div
              className={`edit-expert-layer-status-toast ${isStatusToastFading ? "is-fading" : ""}`}
              role="status"
              aria-live="polite"
            >
              {statusToastMessage}
            </div>
          ) : null}
        </div>

        <div
          ref={primaryDropzoneRef}
          className={`edit-expert-primary-dropzone ${hasPrimaryCompositePreview ? "has-preview" : ""} ${
            isMorePresetsSurfaceOpen ? "is-presets-open" : ""
          } ${primaryDragActive ? "is-dragging" : ""}`}
          style={primaryDropzoneStyle}
          onDrop={handlePrimaryDrop}
          onDragEnter={handlePrimaryDragEnter}
          onDragOver={handlePrimaryDragOver}
          onDragLeave={handlePrimaryDragLeave}
          onPointerDown={handlePrimaryPointerDown}
          onPointerMove={handlePrimaryPointerMove}
          onPointerUp={handlePrimaryPointerUp}
          onPointerCancel={handlePrimaryPointerCancel}
          onPointerLeave={handlePrimaryPointerLeave}
          onClick={handlePrimaryDropzoneClick}
          aria-label="Primary edit image"
        >
          {hasPrimaryCompositePreview ? (
            <div className="edit-expert-primary-layer-canvas" aria-hidden="true">
              {layers.map((layer, index) =>
                layer.imageUrl ? (
                  <div
                    key={layer.id}
                    className="edit-expert-primary-layer-frame"
                    style={{
                      backgroundImage: `url(${layer.imageUrl})`,
                      zIndex: layers.length - index,
                      opacity: clampLayerOpacity(layer.opacity),
                    }}
                  />
                ) : null
              )}
              <canvas
                ref={overlayCanvasRef}
                className="edit-expert-inpaint-overlay-canvas"
                aria-hidden="true"
              />
            </div>
          ) : null}
          {hasPrimaryCompositePreview ? null : (
            <div className="reference-drop-content image-drop-content">
              <UploadSimple size={28} weight="regular" />
              <p className="reference-drop-title">Click to upload an image</p>
            </div>
          )}
          <ExpertEditPresetsSurface
            id={morePresetsSurfaceId}
            isOpen={isMorePresetsSurfaceOpen}
            labels={EDIT_PRESET_SURFACE_LABELS}
            onClose={closeMorePresetsSurface}
          />
        </div>

        <div
          className={`edit-expert-inpaint-row ${isInpaintCollapsed ? "is-collapsed" : ""} ${
            isInpaintCollapsing ? "is-collapsing" : ""
          }`.trim()}
        >
          <div
            className={`edit-expert-inpaint-wrapper ${isInpaintCollapsed ? "is-collapsed" : ""}`}
            role="group"
            aria-label="Inpaint controls group"
          >
            <div className="edit-expert-inpaint-collapse-control">
              {isInpaintCollapsed ? (
                <p className="edit-expert-inpaint-collapse-title">Tools</p>
              ) : null}
              <button
                type="button"
                className="edit-expert-inpaint-collapse-btn"
                aria-label={
                  isInpaintCollapsed ? "Expand inpaint controls" : "Collapse inpaint controls"
                }
                aria-expanded={!isInpaintCollapsed}
                aria-controls="edit-expert-inpaint-content"
                onClick={handleInpaintCollapseToggle}
              >
                {isInpaintCollapsed ? (
                  <CaretLeft size={20} weight="fill" data-testid="inpaint-collapse-icon-left" />
                ) : (
                  <CaretRight size={20} weight="fill" data-testid="inpaint-collapse-icon-dots" />
                )}
              </button>
            </div>
            {!isInpaintCollapsed ? (
              <div
                id="edit-expert-inpaint-content"
                className={`edit-expert-inpaint-content ${isInpaintCollapsing ? "is-collapsing" : ""}`}
              >
                <div className="edit-expert-inpaint-tool-rail" aria-label="Inpaint action tools">
                  <p className="edit-expert-inpaint-tool-rail-title">Tools</p>
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
                  } ${isCropToolSelected ? "is-themed-crop" : ""} ${
                    isMoveToolSelected ? "is-themed-move" : ""
                  }`.trim()}
                  role="group"
                  aria-label={
                    isCropToolSelected
                      ? "Crop tools"
                      : isInpaintToolSelected
                        ? "Inpaint tools"
                        : "Move tools"
                  }
                >
                  {isCropToolSelected ? (
                    <div className="edit-expert-crop-controls-content">
                      <div className="edit-expert-crop-grid" aria-label="Crop aspect ratios">
                        {cropAspectRatioPresets.map((preset) => {
                          const isSelected = selectedCropAspect === preset.value;
                          return (
                            <button
                              key={preset.value}
                              type="button"
                              className={`edit-expert-crop-chip ${
                                isSelected ? "is-selected" : ""
                              }`.trim()}
                              aria-pressed={isSelected}
                              onClick={() => setSelectedCropAspect(preset.value)}
                            >
                              <span className="edit-expert-crop-chip-ratio">{preset.value}</span>
                              <span className="edit-expert-crop-chip-label">{preset.label}</span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          className="edit-expert-crop-apply-btn"
                          aria-label="Apply crop"
                        >
                          Crop
                        </button>
                      </div>
                    </div>
                  ) : isInpaintToolSelected ? (
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
                          className={`edit-expert-inpaint-mode-btn ${
                            selectedInpaintMode === "auto" ? "is-active" : ""
                          }`}
                          aria-pressed={selectedInpaintMode === "auto"}
                          onClick={() => setSelectedInpaintMode("auto")}
                        >
                          <Sparkle size={16} weight="regular" />
                          <span>Auto</span>
                        </button>
                      </div>
                      <div className="edit-expert-inpaint-divider" aria-hidden="true" />
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
                          className="edit-expert-inpaint-action-btn"
                          aria-label="Invert selection"
                          onClick={invertSelectedLayerMask}
                          disabled={!imageHasInteractiveMask}
                        >
                          <CircleHalf size={18} weight="regular" />
                        </button>
                        <button
                          type="button"
                          className="edit-expert-inpaint-action-btn"
                          aria-label="Clear selection"
                          onClick={clearSelectedLayerMask}
                          disabled={!imageHasInteractiveMask}
                        >
                          <TrashSimple size={18} weight="regular" />
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
                          onDoubleClick={() => setInpaintStrokeSize(INPAINT_STROKE_SIZE_DEFAULT)}
                          aria-label="Stroke size"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="edit-expert-move-controls-content">
                      <div
                        className="edit-expert-move-mode-row"
                        role="group"
                        aria-label="Move tool mode"
                      >
                        <button
                          type="button"
                          className={`edit-expert-move-mode-btn ${
                            selectedMoveMode === "move" ? "is-active" : ""
                          }`}
                          aria-pressed={selectedMoveMode === "move"}
                          onClick={() => setSelectedMoveMode("move")}
                        >
                          Move
                        </button>
                        <button
                          type="button"
                          className={`edit-expert-move-mode-btn ${
                            selectedMoveMode === "resize" ? "is-active" : ""
                          }`}
                          aria-pressed={selectedMoveMode === "resize"}
                          onClick={() => setSelectedMoveMode("resize")}
                        >
                          Resize
                        </button>
                        <button
                          type="button"
                          className={`edit-expert-move-mode-btn ${
                            selectedMoveMode === "rotate" ? "is-active" : ""
                          }`}
                          aria-pressed={selectedMoveMode === "rotate"}
                          onClick={() => setSelectedMoveMode("rotate")}
                        >
                          Rotate
                        </button>
                      </div>
                      <div className="edit-expert-move-divider" aria-hidden="true" />
                      <div className="edit-expert-move-zoom-row">
                        <label
                          className="edit-expert-move-zoom-label"
                          htmlFor="edit-expert-move-zoom"
                        >
                          Zoom
                        </label>
                        <input
                          id="edit-expert-move-zoom"
                          className="edit-expert-move-zoom-slider"
                          type="range"
                          min={50}
                          max={200}
                          value={moveZoomValue}
                          onChange={(event) => setMoveZoomValue(Number(event.target.value))}
                          onDoubleClick={() => setMoveZoomValue(MOVE_ZOOM_DEFAULT)}
                          aria-label="Zoom image"
                        />
                      </div>
                      <div className="edit-expert-move-history-row">
                        <button
                          type="button"
                          className="edit-expert-move-history-btn"
                          aria-label="Undo move action"
                        >
                          <ArrowCounterClockwise size={14} weight="regular" />
                          Undo
                        </button>
                        <button
                          type="button"
                          className="edit-expert-move-history-btn"
                          aria-label="Redo move action"
                        >
                          <ArrowClockwise size={14} weight="regular" />
                          Redo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
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
                      onDrop={handleExtraDrop(index)}
                      onDragEnter={handleExtraDragEnter(index)}
                      onDragOver={handleExtraDragOver(index)}
                      onDragLeave={handleExtraDragLeave(index)}
                      onClick={() => inputRef.current?.click()}
                      style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
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
          <div className="edit-expert-styles-control">
            <div className="edit-expert-styles-wrapper">
              <p className="edit-expert-styles-title">Styles</p>
              <button type="button" className="edit-expert-styles-btn" aria-label="Styles">
                <Sticker size={22} weight="regular" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="edit-expert-bottom-row">
        <div className="edit-expert-prompt-shell">
          <div className="edit-expert-prompt-row">
            <textarea
              className="prompt-drop-input edit-expert-prompt-input"
              value={referenceText ?? ""}
              onChange={(event) => onPromptTextChange(event.target.value)}
              onDrop={handlePromptDrop}
              onDragOver={(event) => event.preventDefault()}
              placeholder="Write your prompt..."
              aria-label="Edit prompt"
            />
          </div>
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
          <div
            className={`create-expert-control create-expert-character-mode-control ${
              characterModeEnabled ? "is-character-mode-on" : "is-character-mode-off"
            }`}
          >
            <div className="create-expert-character-mode-meta">
              <p className="create-expert-character-mode-title">Character</p>
              <button
                type="button"
                className={`audio-toggle ai-character-mode-toggle create-expert-toggle-control ${
                  characterModeEnabled ? "is-active" : ""
                }`}
                aria-pressed={characterModeEnabled}
                aria-label={
                  characterModeEnabled ? "Disable character mode" : "Enable character mode"
                }
                onClick={handleCharacterModeEnabledToggle}
              >
                <span className="audio-toggle-track" aria-hidden="true">
                  <span className="audio-toggle-dot" />
                </span>
              </button>
            </div>
            {characterModeEnabled ? (
              <button
                type="button"
                className={`model-picker-btn create-expert-picker-control create-expert-character-picker-trigger ${
                  isCharacterSelectionEmpty ? "is-empty" : ""
                } ${isCharacterPickerOpen ? "is-open" : ""}`}
                aria-haspopup="dialog"
                aria-expanded={isCharacterPickerOpen}
                aria-label="Open character picker"
                disabled={characterSelectDisabled}
                onClick={openCharacterPicker}
              >
                {selectedCharacterProfileImageUrl ? (
                  <Image
                    src={selectedCharacterProfileImageUrl}
                    alt={`${selectedCharacterName} profile`}
                    className="ai-character-picker-trigger-avatar"
                    width={20}
                    height={20}
                    unoptimized
                  />
                ) : selectedCharacterInitials ? (
                  <span className="ai-character-picker-trigger-avatar ai-character-picker-trigger-avatar--fallback">
                    {selectedCharacterInitials}
                  </span>
                ) : null}
                <span className="model-picker-name">{selectedCharacterName}</span>
              </button>
            ) : null}
          </div>

          <div className="create-expert-control create-expert-model-control">
            <button
              type="button"
              className={`model-picker-btn create-expert-picker-control create-expert-model-picker-trigger ${
                !modelId ? "is-empty" : ""
              } ${isModelModalOpen && modelModalAnchor === "reference-model" ? "is-open" : ""}`}
              data-model-anchor="reference-model"
              aria-label="Open model picker"
              onClick={(event) =>
                onModelPickerOpen("reference-model", event.currentTarget, "reference-image")
              }
            >
              {modelLogoSrc ? (
                <Image
                  className="model-chip-logo-img"
                  src={modelLogoSrc}
                  alt=""
                  aria-hidden
                  width={74}
                  height={18}
                  unoptimized={false}
                />
              ) : null}
              <span className="model-picker-name">{stripEditLabel(modelLabel)}</span>
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

      <CharacterPickerModal
        isOpen={isCharacterPickerOpen}
        characterModeEnabled={characterModeEnabled}
        onClose={closeCharacterPicker}
        characterOptions={characterOptions}
        selectedCharacterId={selectedCharacterId}
        onSelectedCharacterIdChange={onSelectedCharacterIdChange}
      />
    </div>
  );
}
