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
  GearSix,
  MagicWand,
  PaintBrush,
  PaintBrushBroad,
  Plus,
  Sliders,
  Sparkle,
  StackSimple,
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
import { composePrimaryStageLayersToBlob } from "../../logic/expertEditStageFlatten";
import {
  composeExpertEditLayerCropToBlob,
  parseAspectRatioToken,
  resolveCenteredAspectCropRect,
} from "../../logic/expertEditLayerCrop";
import {
  analyzeExpertEditPromptTokens,
  buildExpertEditPromptHighlightSegments,
  extractExpertEditPromptTokenFromTransfer,
  insertExpertEditPromptTokenAtSelection,
  setExpertEditPromptTokenDragData,
} from "../../logic/expertEditPromptReferences";
import {
  INPAINT_FLUX_FILL_MODEL_LABEL,
  type InpaintSubmissionOverride,
} from "../../logic/inpaintSubmission";
import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../../logic/editPromptPolicy";
import { useReferencePropertiesConstraintEffects } from "../useReferencePropertiesConstraintEffects";
import { useReferencePropertiesDerivedState } from "../useReferencePropertiesDerivedState";
import { useReferencePropertiesInteractions } from "../useReferencePropertiesInteractions";
import {
  getCreateCharacterInitials,
  type CreateCharacterOption,
  useCreateCharacterModeController,
} from "../create/useCreateCharacterModeController";
import { resolveInpaintBrushDiameter, useInpaintMaskController } from "./useInpaintMaskController";
import { useExpertEditInlineGenerate } from "./useExpertEditInlineGenerate";
import { ExpertEditPresetsSurface } from "./ExpertEditPresetsSurface";
import { StylesControl } from "../StylesControl";
import {
  EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS,
  EDIT_PRESET_PANEL_MAX,
  EDIT_PRESET_MORE_LABEL,
  EXPERT_EDIT_PRESET_DRAG_MIME,
  type ExpertEditCustomPresetOverride,
  type ExpertEditCustomPresetOverrides,
  type ExpertEditCustomPresetId,
  type ExpertEditPresetId,
  type ExpertEditPresetDragPayload,
  normalizeExpertEditCustomPresetOverrides,
  normalizePresetPanelPresetIds,
  parseExpertEditPresetDragPayload,
  resolveExpertEditPresetCatalog,
  resolveExpertEditPresetLabelById,
  resolveExpertEditPresetPromptById,
  serializeExpertEditPresetDragPayload,
  sortPresetIdsByCanonicalOrder,
} from "./expertEditPresets";
import type { ExpertEditStyleTile } from "./expertEditStyles";

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
      costOverrideCredits?: number | null;
      hideOutputFromReferenceGrid?: boolean;
      displayPromptOverride?: string | null;
      submissionPromptOverride?: string | null;
    }
  ) => void | Promise<void>;
  onAddSessionMediaReference?: (payload: { url: string; mimeType?: string | null }) => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  costCredits?: number | null;
  isGenerateDisabled?: boolean;
  isGenerateBusy?: boolean;
  isPrimaryStageGenerating?: boolean;
  referenceImageWarning?: string | null;
  onImageResolutionChange?: (value: string) => void;
  characterOptions?: CreateCharacterOption[];
  selectedCharacterId?: string;
  onSelectedCharacterIdChange?: (value: string) => void;
  isCharacterOptionsLoading?: boolean;
  characterModeEnabled?: boolean;
  onCharacterModeEnabledChange?: (value: boolean) => void;
  selectedPresetIds?: readonly ExpertEditPresetId[];
  onSelectedPresetIdsChange?: (presetIds: ExpertEditPresetId[]) => void;
  customPresetOverrides?: ExpertEditCustomPresetOverrides;
  onCustomPresetOverridesChange?: (overrides: ExpertEditCustomPresetOverrides) => void;
  isStylesPanelOpen?: boolean;
  onStylesPanelToggle?: () => void;
  selectedStyleId?: string | null;
  stylesCatalog?: readonly ExpertEditStyleTile[];
  onClearSelectedStyle?: () => void;
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
export const COMPOSITE_REGENERATE_COHESION_PROMPT = [
  "Integrate all visible layers into one cohesive scene with consistent spatial logic.",
  "Match lighting direction, intensity, and color temperature across all elements.",
  "Add believable contact shadows, ambient occlusion, reflected light, and clean edge integration (no cutout outlines or haloing).",
  "Align perspective, scale, depth, lens/scene continuity, and texture treatment so every element feels captured in the same environment.",
  "If subjects interact with surfaces or objects, make overlaps, occlusion, and grounding physically plausible.",
  "Harmonize global color and contrast while preserving the original subject identity, facial features, pose, and key design details.",
  "Keep the existing creative style intact; only improve cohesion and integration.",
].join(" ");
const editPresetUtilityActions = [
  {
    id: "composite-regenerate",
    label: "Composite & Regenerate",
    icon: ArrowClockwise,
    iconWeight: "regular" as const,
    buttonClassName: "edit-expert-preset-action-btn--compose-image",
    creditCost: null,
    hideIcon: false,
    requiresPrimaryImage: false,
  },
] as const;
const editLayerUtilityActions = [
  {
    id: "remove-background",
    label: "Remove Background",
    icon: MagicWand,
    buttonClassName: "edit-expert-preset-action-btn--compose-image",
  },
  {
    id: "flatten-image",
    label: "Flatten Layers",
    icon: StackSimple,
    buttonClassName: "edit-expert-preset-action-btn--compose-image",
  },
] as const;
type RailTool = "move" | "inpaint";
const inpaintRailTools: ReadonlyArray<{
  id: RailTool;
  label: string;
  selectedClassName: string;
  icon: PhosphorIcon;
}> = [
  {
    id: "move",
    label: "Move",
    selectedClassName: "is-selected-move",
    icon: ArrowsOutCardinal,
  },
  {
    id: "inpaint",
    label: "Inpaint",
    selectedClassName: "is-selected-inpaint",
    icon: PaintBrushBroad,
  },
];
type InpaintMode = "lasso" | "brush" | "auto";
type InpaintSelectionTab = "select" | "unselect";
type TransformDragMode = "move" | "resize" | "rotate";
const cropAspectRatioPresets = [
  { value: "9:16", label: "Vertical", ratio: 9 / 16 },
  { value: "4:5", label: "Social Post", ratio: 4 / 5 },
  { value: "1:1", label: "Square", ratio: 1 },
  { value: "5:4", label: "Photo", ratio: 5 / 4 },
  { value: "16:9", label: "Landscape", ratio: 16 / 9 },
] as const;
const MAX_LAYERS = 8;
const LAYER_LIMIT_REACHED_TOAST = `Layer limit reached (${MAX_LAYERS}).`;
const PRESET_PANEL_LIMIT_TOAST = "Preset panel is full (max 11).";
const INPAINT_COLLAPSE_ANIMATION_MS = 140;
const STATUS_TOAST_VISIBLE_MS = 1_000;
const STATUS_TOAST_FADE_MS = 220;
const TRANSIENT_OBJECT_URL_REVOKE_MS = 60_000;
const REMOVE_BACKGROUND_PENDING_TIMEOUT_MS = 120_000;
const REMOVE_BACKGROUND_ACTION_ID = "remove-background";
const TRANSFORM_HISTORY_LIMIT = 80;
const INPAINT_STROKE_SIZE_DEFAULT = 26;
const INPAINT_CURSOR_DIAMETER_MIN = 8;
const INPAINT_CURSOR_DIAMETER_MAX = 52;
const INPAINT_CURSOR_PADDING = 6;
const LAYER_OPACITY_MIN = 0;
const LAYER_OPACITY_MAX = 1;
const LAYER_OPACITY_DEFAULT = 1;
const LAYER_TRANSLATE_RATIO_MIN = -1;
const LAYER_TRANSLATE_RATIO_MAX = 1;
const LAYER_SCALE_MIN = 0.2;
const LAYER_SCALE_MAX = 2;
const TRANSFORM_ROTATE_HANDLE_INSET_PX = 16;
const formatLayerName = (indexOneBased: number) => `layer ${indexOneBased}`;
const autoLayerNamePattern = /^layer\s*'?(\d+)'?$/i;
const isAutoLayerName = (value: string) => autoLayerNamePattern.test(value.trim());
const resolveAutoLayerNameNumber = (value: string) => {
  const match = autoLayerNamePattern.exec(value.trim());
  if (!match) return null;
  const candidate = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isInteger(candidate) || candidate <= 0) return null;
  return candidate;
};
const clampLayerOpacity = (value: number) =>
  Math.min(LAYER_OPACITY_MAX, Math.max(LAYER_OPACITY_MIN, value));
const clampLayerTranslateRatio = (value: number) =>
  Math.min(LAYER_TRANSLATE_RATIO_MAX, Math.max(LAYER_TRANSLATE_RATIO_MIN, value));
const clampLayerScale = (value: number) =>
  Math.min(LAYER_SCALE_MAX, Math.max(LAYER_SCALE_MIN, value));
type LayerTransform = {
  translateXRatio: number;
  translateYRatio: number;
  scale: number;
  rotationDeg: number;
};

const defaultLayerTransform = (): LayerTransform => ({
  translateXRatio: 0,
  translateYRatio: 0,
  scale: 1,
  rotationDeg: 0,
});

type TransformHistoryLayerSnapshot = {
  layerId: string;
  transform: LayerTransform;
};

type TransformHistoryEntry = {
  layerOrderSignature: string;
  layerSnapshots: TransformHistoryLayerSnapshot[];
};

type TransformHistoryState = {
  past: TransformHistoryEntry[];
  present: TransformHistoryEntry;
  future: TransformHistoryEntry[];
};

const cloneLayerTransform = (transform: LayerTransform): LayerTransform => ({
  translateXRatio: transform.translateXRatio,
  translateYRatio: transform.translateYRatio,
  scale: transform.scale,
  rotationDeg: transform.rotationDeg,
});

const areLayerTransformsEqual = (left: LayerTransform, right: LayerTransform) =>
  left.translateXRatio === right.translateXRatio &&
  left.translateYRatio === right.translateYRatio &&
  left.scale === right.scale &&
  left.rotationDeg === right.rotationDeg;

const buildTransformHistoryEntry = (layers: ExpertEditLayer[]): TransformHistoryEntry => ({
  layerOrderSignature: layers.map((layer) => layer.id).join("|"),
  layerSnapshots: layers.map((layer) => ({
    layerId: layer.id,
    transform: cloneLayerTransform(layer.transform),
  })),
});

const areTransformHistoryEntriesEqual = (
  left: TransformHistoryEntry,
  right: TransformHistoryEntry
) => {
  if (left.layerOrderSignature !== right.layerOrderSignature) return false;
  if (left.layerSnapshots.length !== right.layerSnapshots.length) return false;
  for (let index = 0; index < left.layerSnapshots.length; index += 1) {
    const leftSnapshot = left.layerSnapshots[index];
    const rightSnapshot = right.layerSnapshots[index];
    if (!leftSnapshot || !rightSnapshot) return false;
    if (leftSnapshot.layerId !== rightSnapshot.layerId) return false;
    if (!areLayerTransformsEqual(leftSnapshot.transform, rightSnapshot.transform)) {
      return false;
    }
  }
  return true;
};

const applyTransformHistoryEntryToLayers = (
  layers: ExpertEditLayer[],
  entry: TransformHistoryEntry
) => {
  const currentLayerOrderSignature = layers.map((layer) => layer.id).join("|");
  if (currentLayerOrderSignature !== entry.layerOrderSignature) {
    return layers;
  }
  const transformByLayerId = new Map(
    entry.layerSnapshots.map((snapshot) => [snapshot.layerId, snapshot.transform])
  );
  return layers.map((layer) => {
    const snapshotTransform = transformByLayerId.get(layer.id);
    if (!snapshotTransform || areLayerTransformsEqual(layer.transform, snapshotTransform)) {
      return layer;
    }
    return {
      ...layer,
      transform: cloneLayerTransform(snapshotTransform),
    };
  });
};

type TransformGeometry = {
  centerX: number;
  centerY: number;
  resizeHandleX: number;
  resizeHandleY: number;
  rotateHandleX: number;
  rotateHandleY: number;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

const rotatePoint = (x: number, y: number, rotationDeg: number) => {
  const rotation = toRadians(rotationDeg);
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return {
    x: x * cosine - y * sine,
    y: x * sine + y * cosine,
  };
};

const resolveTransformGeometry = ({
  transform,
  width,
  height,
}: {
  transform: LayerTransform;
  width: number;
  height: number;
}): TransformGeometry => {
  const centerX = width / 2 + transform.translateXRatio * width;
  const centerY = height / 2 + transform.translateYRatio * height;
  const halfWidth = (width / 2) * transform.scale;
  const halfHeight = (height / 2) * transform.scale;
  const cornerVector = rotatePoint(halfWidth, -halfHeight, transform.rotationDeg);
  const rotateHandleDistance = Math.max(
    halfHeight - TRANSFORM_ROTATE_HANDLE_INSET_PX,
    halfHeight * 0.35
  );
  const rotateVector = rotatePoint(0, -rotateHandleDistance, transform.rotationDeg);
  return {
    centerX,
    centerY,
    resizeHandleX: centerX + cornerVector.x,
    resizeHandleY: centerY + cornerVector.y,
    rotateHandleX: centerX + rotateVector.x,
    rotateHandleY: centerY + rotateVector.y,
  };
};

const computeDistance = (x1: number, y1: number, x2: number, y2: number) =>
  Math.hypot(x2 - x1, y2 - y1);

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
        <path d="M9 2.6c3.8 0 6.9 2.9 6.9 6.4s-3.1 6.4-6.9 6.4S2.1 12.5 2.1 9s3.1-6.4 6.9-6.4Z" fill="none" stroke="rgba(245,185,66,0.98)" stroke-width="1.4" />
        <path d="M13.9 13.5l5.4 5.4" fill="none" stroke="rgba(0,0,0,0.86)" stroke-width="2.4" stroke-linecap="round" />
        <path d="M13.9 13.5l5.4 5.4" fill="none" stroke="rgba(245,185,66,0.98)" stroke-width="1.4" stroke-linecap="round" />
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
  transform: LayerTransform;
};

const layerHasImage = (layer: ExpertEditLayer) =>
  typeof layer.imageUrl === "string" && layer.imageUrl.trim().length > 0;

const resolveLowestUnusedAutoLayerNumber = ({
  layers,
  excludeLayerId,
}: {
  layers: ExpertEditLayer[];
  excludeLayerId?: string | null;
}) => {
  const usedNumbers = new Set<number>();
  layers.forEach((layer) => {
    if (excludeLayerId && layer.id === excludeLayerId) return;
    const resolvedNumber = resolveAutoLayerNameNumber(layer.name);
    if (resolvedNumber != null) {
      usedNumbers.add(resolvedNumber);
    }
  });
  let candidate = 1;
  while (usedNumbers.has(candidate)) {
    candidate += 1;
  }
  return candidate;
};

const enforceLayerStackInvariants = ({
  layers,
  foundationLayerId,
}: {
  layers: ExpertEditLayer[];
  foundationLayerId: string | null;
}) => {
  const resolvedFoundationId = foundationLayerId ?? layers[0]?.id ?? null;
  if (!resolvedFoundationId) return layers;
  const foundationLayer =
    layers.find((layer) => layer.id === resolvedFoundationId) ?? layers[0] ?? null;
  if (!foundationLayer) return layers;
  const nextLayers = layers.filter(
    (layer) => layer.id === resolvedFoundationId || layerHasImage(layer)
  );
  const populatedNonFoundationLayers = nextLayers.filter(
    (layer) => layer.id !== resolvedFoundationId
  );
  if (!layerHasImage(foundationLayer) && populatedNonFoundationLayers.length === 1) {
    const promotedLayer = populatedNonFoundationLayers[0];
    if (!promotedLayer) return nextLayers;
    return [
      promotedLayer.isAutoNamed
        ? {
            ...promotedLayer,
            name: formatLayerName(1),
          }
        : promotedLayer,
    ];
  }
  if (nextLayers.some((layer) => layer.id === resolvedFoundationId)) {
    return nextLayers;
  }
  return [foundationLayer, ...nextLayers];
};

type TransformPointerSession = {
  active: boolean;
  pointerId: number;
  layerId: string | null;
  dragMode: TransformDragMode;
  startCanvasX: number;
  startCanvasY: number;
  baseTranslateXRatio: number;
  baseTranslateYRatio: number;
  baseScale: number;
  dropzoneWidth: number;
  dropzoneHeight: number;
  centerX: number;
  centerY: number;
  baseDistanceToCenter: number;
  baseAngleOffsetRad: number;
};

const createIdleTransformPointerSession = (): TransformPointerSession => ({
  active: false,
  pointerId: -1,
  layerId: null,
  dragMode: "move",
  startCanvasX: 0,
  startCanvasY: 0,
  baseTranslateXRatio: 0,
  baseTranslateYRatio: 0,
  baseScale: 1,
  dropzoneWidth: 1,
  dropzoneHeight: 1,
  centerX: 0,
  centerY: 0,
  baseDistanceToCenter: 1,
  baseAngleOffsetRad: 0,
});

const writePresetDragTransfer = (
  transfer: DataTransfer,
  payload: ExpertEditPresetDragPayload,
  label: string
) => {
  const serializedPayload = serializeExpertEditPresetDragPayload(payload);
  transfer.setData(EXPERT_EDIT_PRESET_DRAG_MIME, serializedPayload);
  transfer.setData("text/plain", label);
};

const resolvePresetDragPayload = (
  transfer: DataTransfer | null | undefined,
  activeDragPayload: ExpertEditPresetDragPayload | null
) => parseExpertEditPresetDragPayload(transfer) ?? activeDragPayload;

const setOpaquePresetDragImage = (
  transfer: DataTransfer,
  sourceElement: HTMLElement
): (() => void) | null => {
  if (typeof document === "undefined" || typeof transfer.setDragImage !== "function") {
    return null;
  }
  const rect = sourceElement.getBoundingClientRect();
  const dragPreview = sourceElement.cloneNode(true) as HTMLElement;
  dragPreview.style.position = "fixed";
  dragPreview.style.top = "-9999px";
  dragPreview.style.left = "-9999px";
  dragPreview.style.pointerEvents = "none";
  dragPreview.style.opacity = "1";
  dragPreview.style.transform = "none";
  dragPreview.style.margin = "0";
  dragPreview.style.width = `${Math.max(1, Math.round(rect.width))}px`;
  dragPreview.style.height = `${Math.max(1, Math.round(rect.height))}px`;
  dragPreview.style.boxSizing = "border-box";
  dragPreview.style.background = "#1a1f27";
  dragPreview.style.border = "1px solid rgba(201, 205, 214, 0.36)";
  dragPreview.style.color = "rgba(238, 242, 248, 0.94)";
  dragPreview.style.boxShadow = "0 8px 22px rgba(0, 0, 0, 0.45)";
  document.body.appendChild(dragPreview);
  transfer.setDragImage(dragPreview, Math.round(rect.width / 2), Math.round(rect.height / 2));
  return () => {
    if (dragPreview.parentNode) {
      dragPreview.parentNode.removeChild(dragPreview);
    }
  };
};

const revokeObjectUrlSafe = (url: string) => {
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Preserve UI flow even when revocation fails.
  }
};

const cloneBlobObjectUrl = async (sourceUrl: string): Promise<string | null> => {
  if (!sourceUrl.startsWith("blob:")) return null;
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
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

const resolveCanvasSpacePoint = ({
  clientX,
  clientY,
  rect,
  sceneScale,
}: {
  clientX: number;
  clientY: number;
  rect: DOMRect;
  sceneScale: number;
}) => {
  const rawX = clientX - rect.left;
  const rawY = clientY - rect.top;
  if (!Number.isFinite(sceneScale) || sceneScale <= 0 || sceneScale === 1) {
    return { x: rawX, y: rawY };
  }
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  return {
    x: centerX + (rawX - centerX) / sceneScale,
    y: centerY + (rawY - centerY) / sceneScale,
  };
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
  selectedPresetIds: controlledPresetIds,
  onSelectedPresetIdsChange,
  customPresetOverrides: controlledCustomPresetOverrides,
  onCustomPresetOverridesChange,
  isStylesPanelOpen = false,
  onStylesPanelToggle,
  selectedStyleId: controlledSelectedStyleId,
  stylesCatalog,
  onClearSelectedStyle,
}: ExpertEditPanelViewProps) {
  const layerIdCounterRef = React.useRef(1);
  const foundationLayerIdRef = React.useRef<string | null>(null);
  const previousLayersRef = React.useRef<ExpertEditLayer[]>([]);
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
  const primaryDropzoneRef = React.useRef<HTMLDivElement | null>(null);
  const promptTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const promptInputShellRef = React.useRef<HTMLDivElement | null>(null);
  const promptHighlightRef = React.useRef<HTMLDivElement | null>(null);
  const pendingPromptCaretRef = React.useRef<number | null>(null);
  const transformPointerSessionRef = React.useRef<TransformPointerSession>(
    createIdleTransformPointerSession()
  );
  const transformGestureBaselineRef = React.useRef<TransformHistoryEntry | null>(null);
  const pendingHistoryApplyEntryRef = React.useRef<TransformHistoryEntry | null>(null);

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
  const [selectedRailTool, setSelectedRailTool] = React.useState<RailTool>("move");
  const [selectedTransformMode, setSelectedTransformMode] =
    React.useState<TransformDragMode>("move");
  const [inpaintStrokeSize, setInpaintStrokeSize] = React.useState(INPAINT_STROKE_SIZE_DEFAULT);
  const [selectedInpaintSelectionTab, setSelectedInpaintSelectionTab] =
    React.useState<InpaintSelectionTab>("select");
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
  const [layers, setLayers] = React.useState<ExpertEditLayer[]>(() => {
    const foundationLayer = createLayer({
      indexOneBased: 1,
      imageUrl: referenceImageUrl,
      isAutoNamed: true,
      ownsImageUrl: false,
    });
    foundationLayerIdRef.current = foundationLayer.id;
    return [foundationLayer];
  });
  const [transformHistoryState, setTransformHistoryState] = React.useState<TransformHistoryState>(
    () => ({
      past: [],
      present: buildTransformHistoryEntry(layers),
      future: [],
    })
  );
  const [selectedLayerIndex, setSelectedLayerIndex] = React.useState<number | null>(0);
  const [editingLayerIndex, setEditingLayerIndex] = React.useState<number | null>(null);
  const [editingLayerValue, setEditingLayerValue] = React.useState("");
  const [draggingLayerIndex, setDraggingLayerIndex] = React.useState<number | null>(null);
  const [dragOverLayerIndex, setDragOverLayerIndex] = React.useState<number | null>(null);
  const [statusToastMessage, setStatusToastMessage] = React.useState<string | null>(null);
  const [statusToastTone, setStatusToastTone] = React.useState<"info" | "warning">("info");
  const [isStatusToastFading, setIsStatusToastFading] = React.useState(false);
  const [showPromptTokenInlineError, setShowPromptTokenInlineError] = React.useState(false);
  const [isTransformPointerDragging, setIsTransformPointerDragging] = React.useState(false);
  const [removeBackgroundPendingLayerId, setRemoveBackgroundPendingLayerId] = React.useState<
    string | null
  >(null);
  const foundationLayerId = foundationLayerIdRef.current;
  const resolvedSelectedLayerIndex =
    selectedLayerIndex == null || selectedLayerIndex < 0 || selectedLayerIndex >= layers.length
      ? 0
      : selectedLayerIndex;
  const currentTransformHistoryEntry = React.useMemo(
    () => buildTransformHistoryEntry(layers),
    [layers]
  );
  const canUndoTransformHistory = transformHistoryState.past.length > 0;
  const canRedoTransformHistory = transformHistoryState.future.length > 0;
  const selectedStyleId = controlledSelectedStyleId ?? null;
  const selectedLayer = layers[resolvedSelectedLayerIndex] ?? null;
  const selectedLayerImageUrl = selectedLayer?.imageUrl ?? null;
  const populatedLayerCount = React.useMemo(
    () => layers.filter((layer) => layerHasImage(layer)).length,
    [layers]
  );
  const hasPrimaryCompositePreview = populatedLayerCount > 0;
  const isRemoveBackgroundPending = removeBackgroundPendingLayerId != null;
  const isPrimaryStageBusy = isRemoveBackgroundPending || isPrimaryStageGenerating;
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
  const isMoveToolSelected = selectedRailTool === "move";
  const isModelPickerLocked = isInpaintToolSelected;
  const effectiveModelPickerLabel = isModelPickerLocked
    ? INPAINT_FLUX_FILL_MODEL_LABEL
    : stripEditLabel(modelLabel);
  const effectiveModelPickerLogoSrc = isModelPickerLocked ? undefined : modelLogoSrc;
  const collapsedToolsThemeClass = isMoveToolSelected ? "is-active-move" : "is-active-inpaint";
  const sceneZoomScale = 1;
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
      if (toastVisibleTimerRef.current != null) {
        window.clearTimeout(toastVisibleTimerRef.current);
        toastVisibleTimerRef.current = null;
      }
      if (toastFadeTimerRef.current != null) {
        window.clearTimeout(toastFadeTimerRef.current);
        toastFadeTimerRef.current = null;
      }
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
    const textarea = promptTextareaRef.current;
    const highlightLayer = promptHighlightRef.current;
    if (!textarea || !highlightLayer) return;
    highlightLayer.scrollTop = textarea.scrollTop;
    highlightLayer.scrollLeft = textarea.scrollLeft;
  }, []);

  const syncPromptTextareaHeight = React.useCallback(() => {
    const textarea = promptTextareaRef.current;
    if (!textarea) return;
    const computedStyle = window.getComputedStyle(textarea);
    const minHeightPx = Number.parseFloat(computedStyle.minHeight) || 72;
    const maxHeightPx = Number.parseFloat(computedStyle.maxHeight) || minHeightPx;
    textarea.style.height = "auto";
    const contentHeightPx = Math.max(minHeightPx, textarea.scrollHeight);
    const clampedHeightPx = Math.min(contentHeightPx, maxHeightPx);
    textarea.style.height = `${clampedHeightPx}px`;
    textarea.style.overflowY = contentHeightPx > maxHeightPx ? "auto" : "hidden";
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
    const caretPosition = pendingPromptCaretRef.current;
    if (caretPosition == null) return;
    const textarea = promptTextareaRef.current;
    if (!textarea) return;
    const maxCaret = Math.max(0, Math.min(promptTextValue.length, caretPosition));
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
    if (removeBackgroundPendingTimeoutRef.current != null) {
      window.clearTimeout(removeBackgroundPendingTimeoutRef.current);
      removeBackgroundPendingTimeoutRef.current = null;
    }
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
    sceneScale: sceneZoomScale,
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
    if (isMoveToolSelected && selectedLayerImageUrl) {
      const resolvedDragMode = isTransformPointerDragging
        ? transformPointerSessionRef.current.dragMode
        : selectedTransformMode;
      if (resolvedDragMode === "rotate") {
        return "crosshair";
      }
      if (resolvedDragMode === "resize") {
        return "nwse-resize";
      }
      if (resolvedDragMode === "move" && isTransformPointerDragging) {
        return "grabbing";
      }
      return "grab";
    }
    if (shouldShowInpaintBrushReticle) {
      return buildInpaintBrushReticleCursor(inpaintStrokeSize);
    }
    if (shouldShowInpaintLassoCursor) {
      return buildInpaintLassoCursor();
    }
    return undefined;
  }, [
    inpaintStrokeSize,
    isTransformPointerDragging,
    isMoveToolSelected,
    selectedTransformMode,
    selectedLayerImageUrl,
    shouldShowInpaintBrushReticle,
    shouldShowInpaintLassoCursor,
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
      width: `max(0px, min(calc(100% - ((var(--edit-expert-side-rail-width) + var(--edit-expert-side-rail-gap)) * 2)), calc(var(--edit-expert-primary-size) * ${primaryStageWidthScale})))`,
      height: "var(--edit-expert-primary-size)",
    }),
    [primaryStageWidthScale]
  );
  const primaryDropzoneStyle = React.useMemo(() => {
    const style: React.CSSProperties = {
      aspectRatio: primaryDropzoneAspectRatio,
      width: "100%",
    };
    if (!isMorePresetsSurfaceOpen && primaryDropzoneCursor) {
      style.cursor = primaryDropzoneCursor;
    }
    return style;
  }, [isMorePresetsSurfaceOpen, primaryDropzoneAspectRatio, primaryDropzoneCursor]);

  const lockGlobalCursor = React.useCallback((cursor: string) => {
    if (typeof document === "undefined") return;
    const lockState = globalCursorLockRef.current;
    const bodyStyle = document.body?.style;
    const htmlStyle = document.documentElement?.style;
    if (!bodyStyle || !htmlStyle) return;
    if (!lockState.active) {
      lockState.bodyCursor = bodyStyle.cursor;
      lockState.htmlCursor = htmlStyle.cursor;
      lockState.active = true;
    }
    bodyStyle.cursor = cursor;
    htmlStyle.cursor = cursor;
  }, []);

  const unlockGlobalCursor = React.useCallback(() => {
    if (typeof document === "undefined") return;
    const lockState = globalCursorLockRef.current;
    if (!lockState.active) return;
    const bodyStyle = document.body?.style;
    const htmlStyle = document.documentElement?.style;
    if (bodyStyle) {
      bodyStyle.cursor = lockState.bodyCursor;
    }
    if (htmlStyle) {
      htmlStyle.cursor = lockState.htmlCursor;
    }
    lockState.active = false;
    lockState.bodyCursor = "";
    lockState.htmlCursor = "";
  }, []);

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

    try {
      const flattenedStageBlob = await composePrimaryStageLayersToBlob(layers, {
        mimeType: "image/png",
      });
      let exportBlob = flattenedStageBlob;
      if (Math.abs(primaryDropzoneAspectRatioValue - 1) > Number.EPSILON) {
        const flattenedStageUrl = URL.createObjectURL(flattenedStageBlob);
        try {
          const flattenedStageDimensions = await resolveBlobDimensions(flattenedStageBlob);
          const cropRect = resolveCenteredAspectCropRect({
            stageWidth: flattenedStageDimensions.width,
            stageHeight: flattenedStageDimensions.height,
            aspectRatio: primaryDropzoneAspectRatioValue,
          });
          if (!cropRect) {
            throw new Error("Unable to resolve crop bounds for flattened export.");
          }
          exportBlob = await composeExpertEditLayerCropToBlob({
            imageUrl: flattenedStageUrl,
            stageWidth: flattenedStageDimensions.width,
            stageHeight: flattenedStageDimensions.height,
            cropRect,
            mimeType: "image/png",
          });
        } finally {
          revokeObjectUrlSafe(flattenedStageUrl);
        }
      }
      const flattenedLayerUrl = URL.createObjectURL(exportBlob);
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
    } catch {
      showStatusToast("Unable to flatten layers.");
    }
  }, [
    createLayer,
    foundationLayerId,
    layers,
    populatedLayerCount,
    primaryDropzoneAspectRatioValue,
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
          costOverrideCredits: 0,
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
    populatedLayerCount,
    isInpaintToolSelected,
    hasSelectedLayerMask,
    exportSelectedLayerMaskBlob,
    onRegenerate,
    onRegenerateWithReferenceInputs,
    scheduleTransientObjectUrlRevoke,
    revokeObjectUrlSafe,
    resolveBlobDimensions,
    showStatusToast,
    onInvalidPromptReferenceToken: handleInvalidPromptReferenceToken,
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

  const handlePrimaryPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      if (isMoveToolSelected) {
        if (!selectedLayer?.imageUrl) {
          showStatusToast("Select a layer image before transforming.");
          return;
        }
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const dropzone = primaryDropzoneRef.current;
        if (!dropzone) return;
        const rect = dropzone.getBoundingClientRect();
        const width = Math.max(1, rect.width);
        const height = Math.max(1, rect.height);
        const pointer = resolveCanvasSpacePoint({
          clientX: event.clientX,
          clientY: event.clientY,
          rect,
          sceneScale: sceneZoomScale,
        });
        const pointerX = pointer.x;
        const pointerY = pointer.y;
        const transformGeometry = resolveTransformGeometry({
          transform: selectedLayer.transform,
          width,
          height,
        });
        const dragMode = selectedTransformMode;
        const distanceToCenter = Math.max(
          1,
          computeDistance(pointerX, pointerY, transformGeometry.centerX, transformGeometry.centerY)
        );
        const pointerAngle = Math.atan2(
          pointerY - transformGeometry.centerY,
          pointerX - transformGeometry.centerX
        );
        event.preventDefault();
        if ((event.currentTarget as HTMLElement | null)?.setPointerCapture) {
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        }
        transformGestureBaselineRef.current = buildTransformHistoryEntry(layers);
        transformPointerSessionRef.current = {
          active: true,
          pointerId: event.pointerId,
          layerId: selectedLayer.id,
          dragMode,
          startCanvasX: pointerX,
          startCanvasY: pointerY,
          baseTranslateXRatio: selectedLayer.transform.translateXRatio,
          baseTranslateYRatio: selectedLayer.transform.translateYRatio,
          baseScale: selectedLayer.transform.scale,
          dropzoneWidth: width,
          dropzoneHeight: height,
          centerX: transformGeometry.centerX,
          centerY: transformGeometry.centerY,
          baseDistanceToCenter: distanceToCenter,
          baseAngleOffsetRad: pointerAngle - toRadians(selectedLayer.transform.rotationDeg),
        };
        setIsTransformPointerDragging(true);
        return;
      }
      if (shouldShowInpaintBrushReticle) {
        lockGlobalCursor(buildInpaintBrushReticleCursor(inpaintStrokeSize));
      }
      handleInpaintPointerDown(event);
    },
    [
      handleInpaintPointerDown,
      inpaintStrokeSize,
      isMorePresetsSurfaceOpen,
      isMoveToolSelected,
      layers,
      lockGlobalCursor,
      selectedLayer,
      selectedTransformMode,
      sceneZoomScale,
      showStatusToast,
      shouldShowInpaintBrushReticle,
    ]
  );

  const handlePrimaryPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      if (isMoveToolSelected) {
        const dropzone = primaryDropzoneRef.current;
        if (!dropzone) return;
        const rect = dropzone.getBoundingClientRect();
        const pointer = resolveCanvasSpacePoint({
          clientX: event.clientX,
          clientY: event.clientY,
          rect,
          sceneScale: sceneZoomScale,
        });
        const pointerX = pointer.x;
        const pointerY = pointer.y;
        const session = transformPointerSessionRef.current;
        if (!session.active || event.pointerId !== session.pointerId || !session.layerId) return;
        event.preventDefault();
        if (session.dragMode === "move") {
          const deltaX = pointerX - session.startCanvasX;
          const deltaY = pointerY - session.startCanvasY;
          const nextTranslateXRatio = clampLayerTranslateRatio(
            session.baseTranslateXRatio + deltaX / session.dropzoneWidth
          );
          const nextTranslateYRatio = clampLayerTranslateRatio(
            session.baseTranslateYRatio + deltaY / session.dropzoneHeight
          );
          setLayers((previousLayers) =>
            previousLayers.map((layer) =>
              layer.id === session.layerId
                ? {
                    ...layer,
                    transform: {
                      ...layer.transform,
                      translateXRatio: nextTranslateXRatio,
                      translateYRatio: nextTranslateYRatio,
                    },
                  }
                : layer
            )
          );
          return;
        }
        if (session.dragMode === "resize") {
          const nextDistanceToCenter = Math.max(
            1,
            computeDistance(pointerX, pointerY, session.centerX, session.centerY)
          );
          const nextScale = clampLayerScale(
            session.baseScale * (nextDistanceToCenter / session.baseDistanceToCenter)
          );
          setLayers((previousLayers) =>
            previousLayers.map((layer) =>
              layer.id === session.layerId
                ? {
                    ...layer,
                    transform: {
                      ...layer.transform,
                      scale: nextScale,
                    },
                  }
                : layer
            )
          );
          return;
        }
        const nextPointerAngle = Math.atan2(pointerY - session.centerY, pointerX - session.centerX);
        const nextRotationDeg = toDegrees(nextPointerAngle - session.baseAngleOffsetRad);
        setLayers((previousLayers) =>
          previousLayers.map((layer) =>
            layer.id === session.layerId
              ? {
                  ...layer,
                  transform: {
                    ...layer.transform,
                    rotationDeg: nextRotationDeg,
                  },
                }
              : layer
          )
        );
        return;
      }
      handleInpaintPointerMove(event);
    },
    [handleInpaintPointerMove, isMorePresetsSurfaceOpen, isMoveToolSelected, sceneZoomScale]
  );

  const endTransformPointerSession = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = transformPointerSessionRef.current;
      if (!session.active || event.pointerId !== session.pointerId) return;
      if ((event.currentTarget as HTMLElement | null)?.releasePointerCapture) {
        try {
          (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
        } catch {
          // Pointer capture can already be released.
        }
      }
      transformPointerSessionRef.current = createIdleTransformPointerSession();
      setIsTransformPointerDragging(false);
      const baselineEntry = transformGestureBaselineRef.current;
      transformGestureBaselineRef.current = null;
      if (!baselineEntry) return;
      const nextEntry = buildTransformHistoryEntry(layers);
      commitTransformHistoryTransition(nextEntry, baselineEntry);
    },
    [commitTransformHistoryTransition, layers]
  );

  const handlePrimaryPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      if (isMoveToolSelected) {
        endTransformPointerSession(event);
        return;
      }
      unlockGlobalCursor();
      handleInpaintPointerUp(event);
    },
    [
      endTransformPointerSession,
      handleInpaintPointerUp,
      isMorePresetsSurfaceOpen,
      isMoveToolSelected,
      unlockGlobalCursor,
    ]
  );

  const handlePrimaryPointerCancel = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      if (isMoveToolSelected) {
        endTransformPointerSession(event);
        return;
      }
      unlockGlobalCursor();
      handleInpaintPointerCancel(event);
    },
    [
      endTransformPointerSession,
      handleInpaintPointerCancel,
      isMorePresetsSurfaceOpen,
      isMoveToolSelected,
      unlockGlobalCursor,
    ]
  );

  const handlePrimaryPointerLeave = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      if (isMoveToolSelected) {
        const session = transformPointerSessionRef.current;
        if (!session.active) return;
        const currentTarget = event.currentTarget as HTMLElement | null;
        const hasPointerCapture = Boolean(
          currentTarget &&
          typeof currentTarget.hasPointerCapture === "function" &&
          currentTarget.hasPointerCapture(event.pointerId)
        );
        if (session.active && event.pointerId === session.pointerId && !hasPointerCapture) {
          endTransformPointerSession(event);
        }
        return;
      }
      unlockGlobalCursor();
      handleInpaintPointerLeave(event);
    },
    [
      endTransformPointerSession,
      handleInpaintPointerLeave,
      isMorePresetsSurfaceOpen,
      isMoveToolSelected,
      unlockGlobalCursor,
    ]
  );

  const handlePrimaryDropzoneClick = React.useCallback(() => {
    if (isMorePresetsSurfaceOpen || hasPrimaryCompositePreview) return;
    primaryInputRef.current?.click();
  }, [hasPrimaryCompositePreview, isMorePresetsSurfaceOpen]);

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
  const handleClearSelectedStyle = React.useCallback(() => {
    onClearSelectedStyle?.();
  }, [onClearSelectedStyle]);

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

      const isFoundationLayer = targetLayer.id === foundationLayerId;
      const selectedLayerId = layers[resolvedSelectedLayerIndex]?.id ?? null;
      const editingLayerId =
        editingLayerIndex != null ? (layers[editingLayerIndex]?.id ?? null) : null;

      const nextLayers = isFoundationLayer
        ? layers.map((layer) =>
            layer.id === targetLayer.id
              ? {
                  ...layer,
                  name: layer.isAutoNamed ? formatLayerName(1) : layer.name,
                  imageUrl: null,
                  opacity: LAYER_OPACITY_DEFAULT,
                  ownsImageUrl: false,
                  transform: defaultLayerTransform(),
                }
              : layer
          )
        : layers.filter((_, layerIndex) => layerIndex !== index);
      const normalizedLayers = enforceLayerStackInvariants({
        layers: nextLayers,
        foundationLayerId,
      });

      setLayers(normalizedLayers);
      setEditingLayerValue("");

      if (editingLayerId) {
        const nextEditingIndex = normalizedLayers.findIndex((layer) => layer.id === editingLayerId);
        setEditingLayerIndex(nextEditingIndex >= 0 ? nextEditingIndex : null);
      } else {
        setEditingLayerIndex(null);
      }

      if (isFoundationLayer) {
        const foundationIndex = normalizedLayers.findIndex((layer) => layer.id === targetLayer.id);
        setSelectedLayerIndex(foundationIndex >= 0 ? foundationIndex : 0);
        return;
      }
      if (selectedLayerId) {
        const selectedIndex = normalizedLayers.findIndex((layer) => layer.id === selectedLayerId);
        if (selectedIndex >= 0) {
          setSelectedLayerIndex(selectedIndex);
          return;
        }
      }
      setSelectedLayerIndex(Math.max(0, Math.min(index - 1, normalizedLayers.length - 1)));
    },
    [editingLayerIndex, foundationLayerId, layers, resolvedSelectedLayerIndex]
  );

  React.useEffect(() => {
    if (layers.length <= 0) {
      foundationLayerIdRef.current = null;
      return;
    }
    if (!foundationLayerIdRef.current) {
      foundationLayerIdRef.current = layers[0]?.id ?? null;
      return;
    }
    const hasCurrentFoundation = layers.some((layer) => layer.id === foundationLayerIdRef.current);
    if (!hasCurrentFoundation) {
      foundationLayerIdRef.current = layers[0]?.id ?? null;
    }
  }, [layers]);

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
      const lockedRemoveBackgroundIndex = removeBackgroundPendingLayerId
        ? previous.findIndex((layer) => layer.id === removeBackgroundPendingLayerId)
        : -1;
      const targetIndex =
        lockedRemoveBackgroundIndex >= 0
          ? lockedRemoveBackgroundIndex
          : selectedLayerIndex == null ||
              selectedLayerIndex < 0 ||
              selectedLayerIndex >= previous.length
            ? 0
            : selectedLayerIndex;
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
      if (isTransformPointerDragging) {
        setIsTransformPointerDragging(false);
      }
      transformPointerSessionRef.current = createIdleTransformPointerSession();
      transformGestureBaselineRef.current = null;
    }
  }, [isMoveToolSelected, isTransformPointerDragging]);

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
    const pendingEntry = pendingHistoryApplyEntryRef.current;
    if (!pendingEntry) return;
    pendingHistoryApplyEntryRef.current = null;
    applyTransformHistoryEntry(pendingEntry);
  }, [applyTransformHistoryEntry, transformHistoryState]);

  React.useEffect(() => {
    if (lastDispatchedPrimaryRef.current === hostPrimaryImageUrl) return;
    lastDispatchedPrimaryRef.current = hostPrimaryImageUrl;
    onPrimaryImageChange(hostPrimaryImageUrl);
  }, [hostPrimaryImageUrl, onPrimaryImageChange]);

  React.useEffect(
    () => () => {
      unlockGlobalCursor();
      pendingHistoryApplyEntryRef.current = null;
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
      if (removeBackgroundPendingTimeoutRef.current != null) {
        window.clearTimeout(removeBackgroundPendingTimeoutRef.current);
        removeBackgroundPendingTimeoutRef.current = null;
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
    [unlockGlobalCursor]
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

  return (
    <div
      className="tool-properties edit-expert-panel create-expert-panel"
      role="group"
      aria-label="Expert edit composer"
    >
      <div className="edit-expert-main-stage" style={primaryStageStyle}>
        <div className="edit-expert-preset-toolbar" aria-label="Edit preset toolbar">
          <div className="edit-expert-preset-toolbar-title-card">
            <p className="edit-expert-preset-toolbar-title">Presets</p>
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
          <div className="edit-expert-preset-actions" aria-label="Preset utility actions">
            {editPresetUtilityActions.map((action) => {
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
                    action.id === "composite-regenerate"
                      ? handleCompositeRegeneratePromptInsert
                      : undefined
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
          <div className="edit-expert-layers-actions" aria-label="Layer utility actions">
            {editLayerUtilityActions.map((action) => {
              const Icon = action.icon;
              const isActionDisabled = Boolean(
                (action.id === REMOVE_BACKGROUND_ACTION_ID &&
                  (isGenerateDisabled || !selectedLayerImageUrl || isRemoveBackgroundPending)) ||
                (action.id === "flatten-image" && populatedLayerCount <= 0)
              );
              return (
                <button
                  key={action.id}
                  type="button"
                  className={`edit-expert-preset-action-btn ${action.buttonClassName ?? ""}`.trim()}
                  aria-label={action.label}
                  disabled={isActionDisabled}
                  onClick={
                    action.id === "flatten-image"
                      ? () => void handleManualFlatten()
                      : action.id === REMOVE_BACKGROUND_ACTION_ID
                        ? handleRemoveBackground
                        : undefined
                  }
                >
                  <Icon size={20} weight="regular" />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
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
        </div>

        <div className="edit-expert-primary-stage-shell">
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
            aria-busy={isPrimaryStageBusy || undefined}
          >
            {hasPrimaryCompositePreview ? (
              <div
                className="edit-expert-primary-layer-canvas"
                style={{
                  transform: `scale(${sceneZoomScale})`,
                  transformOrigin: "center center",
                }}
                aria-hidden="true"
              >
                {layers.map((layer, index) =>
                  layer.imageUrl ? (
                    <div
                      key={layer.id}
                      className="edit-expert-primary-layer-frame"
                      style={{
                        backgroundImage: `url(${layer.imageUrl})`,
                        zIndex: layers.length - index,
                        opacity: clampLayerOpacity(layer.opacity),
                        transform: `translate(${Math.round(layer.transform.translateXRatio * 1000) / 10}%, ${Math.round(layer.transform.translateYRatio * 1000) / 10}%) scale(${layer.transform.scale}) rotate(${layer.transform.rotationDeg}deg)`,
                        transformOrigin: "center center",
                      }}
                    />
                  ) : null
                )}
                <canvas
                  ref={overlayCanvasRef}
                  className="edit-expert-inpaint-overlay-canvas"
                  aria-hidden="true"
                />
                {isRemoveBackgroundPending ? (
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
                      <span
                        className="edit-expert-primary-layer-loading-spinner"
                        aria-hidden="true"
                      />
                      <span className="edit-expert-primary-layer-loading-text">
                        Removing background...
                      </span>
                    </div>
                  </div>
                ) : isPrimaryStageGenerating ? (
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
                      <span
                        className="edit-expert-primary-layer-loading-spinner"
                        aria-hidden="true"
                      />
                      <span className="edit-expert-primary-layer-loading-text">Generating...</span>
                    </div>
                  </div>
                ) : null}
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

        <div
          className={`edit-expert-inpaint-row ${isInpaintCollapsed ? "is-collapsed" : ""} ${
            isInpaintCollapsing ? "is-collapsing" : ""
          }`.trim()}
        >
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
          <div
            className={`edit-expert-inpaint-wrapper ${isInpaintCollapsed ? "is-collapsed" : ""}`}
            role="group"
            aria-label="Inpaint controls group"
          >
            {isInpaintCollapsed ? (
              <div className="edit-expert-inpaint-collapse-control">
                <p className="edit-expert-inpaint-collapse-title">Tools</p>
                <button
                  type="button"
                  className={`edit-expert-inpaint-collapse-btn ${collapsedToolsThemeClass}`}
                  aria-label="Expand inpaint controls"
                  aria-expanded={!isInpaintCollapsed}
                  aria-controls="edit-expert-inpaint-content"
                  onClick={handleInpaintCollapseToggle}
                >
                  <CaretLeft size={20} weight="fill" data-testid="inpaint-collapse-icon-left" />
                </button>
              </div>
            ) : null}
            {!isInpaintCollapsed ? (
              <div
                id="edit-expert-inpaint-content"
                className={`edit-expert-inpaint-content ${isInpaintCollapsing ? "is-collapsing" : ""}`}
              >
                <div className="edit-expert-inpaint-tool-rail" aria-label="Inpaint action tools">
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
                  } ${isMoveToolSelected ? "is-themed-move" : ""}`.trim()}
                  role="group"
                  aria-label={isInpaintToolSelected ? "Inpaint tools" : "Move tools"}
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
                            selectedTransformMode === "move" ? "is-active" : ""
                          }`}
                          aria-pressed={selectedTransformMode === "move"}
                          onClick={() => setSelectedTransformMode("move")}
                        >
                          Move
                        </button>
                        <button
                          type="button"
                          className={`edit-expert-move-mode-btn ${
                            selectedTransformMode === "resize" ? "is-active" : ""
                          }`}
                          aria-pressed={selectedTransformMode === "resize"}
                          onClick={() => setSelectedTransformMode("resize")}
                        >
                          Resize
                        </button>
                        <button
                          type="button"
                          className={`edit-expert-move-mode-btn ${
                            selectedTransformMode === "rotate" ? "is-active" : ""
                          }`}
                          aria-pressed={selectedTransformMode === "rotate"}
                          onClick={() => setSelectedTransformMode("rotate")}
                        >
                          Rotate
                        </button>
                      </div>
                      <div className="edit-expert-move-divider" aria-hidden="true" />
                      <div className="edit-expert-move-history-row">
                        <button
                          type="button"
                          className="edit-expert-move-history-btn"
                          aria-label="Undo move action"
                          onClick={handleUndoMoveAction}
                          disabled={!canUndoTransformHistory}
                        >
                          <ArrowCounterClockwise size={14} weight="regular" />
                          Undo
                        </button>
                        <button
                          type="button"
                          className="edit-expert-move-history-btn"
                          aria-label="Redo move action"
                          onClick={handleRedoMoveAction}
                          disabled={!canRedoTransformHistory}
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
                      draggable={Boolean(previewUrl)}
                      onDragStart={(event) => handleSecondaryPromptTokenDragStart(event, index)}
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
          <StylesControl
            isOpen={isStylesPanelOpen}
            selectedStyleId={selectedStyleId}
            styles={stylesCatalog}
            onToggle={handleStylesPanelToggle}
            onClearSelection={handleClearSelectedStyle}
          />
        </div>
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
