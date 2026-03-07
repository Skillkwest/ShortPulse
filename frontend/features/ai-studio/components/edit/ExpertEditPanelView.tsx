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
import { ExpertEditPresetsSurface } from "./ExpertEditPresetsSurface";
import {
  EDIT_PRESET_PANEL_MAX,
  EDIT_PRESET_MORE_LABEL,
  EDIT_PRESET_SURFACE_LABELS,
  EXPERT_EDIT_PRESET_DRAG_MIME,
  type ExpertEditPresetDragPayload,
  parseExpertEditPresetDragPayload,
  serializeExpertEditPresetDragPayload,
  sortPresetLabelsByCanonicalOrder,
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
      costOverrideCredits?: number | null;
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
  {
    id: "crop",
    label: "Crop",
    selectedClassName: "is-selected-crop",
    icon: Crop,
  },
];
type InpaintMode = "lasso" | "brush" | "auto";
type InpaintSelectionTab = "select" | "unselect";
type TransformDragMode = "move" | "resize" | "rotate";
const cropAspectRatioPresets = [
  { value: "9:16", label: "Vertical" },
  { value: "4:5", label: "Social Post" },
  { value: "1:1", label: "Square" },
  { value: "5:4", label: "Photo" },
  { value: "16:9", label: "Landscape" },
] as const;
const MAX_LAYERS = 10;
const PRESET_PANEL_LIMIT_TOAST = "Preset panel is full (max 11).";
const INPAINT_COLLAPSE_ANIMATION_MS = 140;
const STATUS_TOAST_VISIBLE_MS = 1_000;
const STATUS_TOAST_FADE_MS = 220;
const TRANSIENT_OBJECT_URL_REVOKE_MS = 60_000;
const REMOVE_BACKGROUND_PENDING_TIMEOUT_MS = 120_000;
const INPAINT_FILL_MODEL_ID = "fal-ai/flux-pro/v1/fill";
const REMOVE_BACKGROUND_ACTION_ID = "remove-background";
const MOVE_ZOOM_MIN = 50;
const MOVE_ZOOM_MAX = 200;
const MOVE_ZOOM_DEFAULT = 125;
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
const LAYER_SCALE_MIN = 0.5;
const LAYER_SCALE_MAX = 2;
const TRANSFORM_ROTATE_HANDLE_INSET_PX = 16;
const formatLayerName = (indexOneBased: number) => `layer ${indexOneBased}`;
const autoLayerNamePattern = /^layer\s*'?\d+'?$/i;
const isAutoLayerName = (value: string) => autoLayerNamePattern.test(value.trim());
const clampLayerOpacity = (value: number) =>
  Math.min(LAYER_OPACITY_MAX, Math.max(LAYER_OPACITY_MIN, value));
const clampLayerTranslateRatio = (value: number) =>
  Math.min(LAYER_TRANSLATE_RATIO_MAX, Math.max(LAYER_TRANSLATE_RATIO_MIN, value));
const clampLayerScale = (value: number) =>
  Math.min(LAYER_SCALE_MAX, Math.max(LAYER_SCALE_MIN, value));
const resolveMoveScaleFromZoom = (zoomValue: number) => clampLayerScale(zoomValue / 100);
const clampMoveZoomValue = (value: number) =>
  Math.min(MOVE_ZOOM_MAX, Math.max(MOVE_ZOOM_MIN, value));

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
  zoomValue: number;
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

const buildTransformHistoryEntry = (
  layers: ExpertEditLayer[],
  zoomValue: number
): TransformHistoryEntry => ({
  zoomValue: clampMoveZoomValue(zoomValue),
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
  if (left.zoomValue !== right.zoomValue) return false;
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
  transform: LayerTransform;
};

const normalizeAutoLayers = (layers: ExpertEditLayer[]) =>
  layers.map((layer, index) =>
    layer.isAutoNamed ? { ...layer, name: formatLayerName(index + 1) } : layer
  );

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
  payload: { label: string; source: "surface" | "panel" }
) => {
  const serializedPayload = serializeExpertEditPresetDragPayload(payload);
  transfer.setData(EXPERT_EDIT_PRESET_DRAG_MIME, serializedPayload);
  transfer.setData("text/plain", payload.label);
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
  const removeBackgroundPendingTimeoutRef = React.useRef<number | null>(null);
  const removeBackgroundPendingSourceUrlRef = React.useRef<string | null>(null);
  const transientRevokeTimersRef = React.useRef<Map<string, number>>(new Map());
  const activePresetDragPayloadRef = React.useRef<ExpertEditPresetDragPayload | null>(null);
  const presetDragPreviewCleanupRef = React.useRef<(() => void) | null>(null);
  const primaryInputRef = React.useRef<HTMLInputElement | null>(null);
  const primaryDropzoneRef = React.useRef<HTMLDivElement | null>(null);
  const transformPointerSessionRef = React.useRef<TransformPointerSession>(
    createIdleTransformPointerSession()
  );
  const transformGestureBaselineRef = React.useRef<TransformHistoryEntry | null>(null);

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
  const [selectedRailTool, setSelectedRailTool] = React.useState<RailTool>("inpaint");
  const [selectedTransformMode, setSelectedTransformMode] =
    React.useState<TransformDragMode>("move");
  const [moveZoomValue, setMoveZoomValue] = React.useState(MOVE_ZOOM_DEFAULT);
  const [inpaintStrokeSize, setInpaintStrokeSize] = React.useState(INPAINT_STROKE_SIZE_DEFAULT);
  const [selectedCropAspect, setSelectedCropAspect] = React.useState(aspect);
  const [selectedInpaintSelectionTab, setSelectedInpaintSelectionTab] =
    React.useState<InpaintSelectionTab>("select");
  const [isInpaintCollapsed, setIsInpaintCollapsed] = React.useState(true);
  const [isInpaintCollapsing, setIsInpaintCollapsing] = React.useState(false);
  const [isMorePresetsSurfaceOpen, setIsMorePresetsSurfaceOpen] = React.useState(false);
  const [selectedPresetLabels, setSelectedPresetLabels] = React.useState<string[]>([]);
  const [isPresetPanelDropActive, setIsPresetPanelDropActive] = React.useState(false);
  const [isPresetsSurfaceDropActive, setIsPresetsSurfaceDropActive] = React.useState(false);
  const [primaryDragActive, setPrimaryDragActive] = React.useState(false);
  const [layers, setLayers] = React.useState<ExpertEditLayer[]>(() => [
    createLayer({
      indexOneBased: 1,
      imageUrl: referenceImageUrl,
      isAutoNamed: true,
      ownsImageUrl: false,
    }),
  ]);
  const [transformHistoryState, setTransformHistoryState] = React.useState<TransformHistoryState>(
    () => ({
      past: [],
      present: buildTransformHistoryEntry(layers, moveZoomValue),
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
  const [isTransformPointerDragging, setIsTransformPointerDragging] = React.useState(false);
  const [removeBackgroundPendingLayerId, setRemoveBackgroundPendingLayerId] = React.useState<
    string | null
  >(null);
  const globalZoomScale = React.useMemo(
    () => resolveMoveScaleFromZoom(moveZoomValue),
    [moveZoomValue]
  );

  const resolvedSelectedLayerIndex =
    selectedLayerIndex == null || selectedLayerIndex < 0 || selectedLayerIndex >= layers.length
      ? 0
      : selectedLayerIndex;
  const currentTransformHistoryEntry = React.useMemo(
    () => buildTransformHistoryEntry(layers, moveZoomValue),
    [layers, moveZoomValue]
  );
  const canUndoTransformHistory = transformHistoryState.past.length > 0;
  const canRedoTransformHistory = transformHistoryState.future.length > 0;
  const selectedLayer = layers[resolvedSelectedLayerIndex] ?? null;
  const selectedLayerImageUrl = selectedLayer?.imageUrl ?? null;
  const populatedLayerCount = React.useMemo(
    () => layers.filter((layer) => Boolean(layer.imageUrl)).length,
    [layers]
  );
  const hasPrimaryCompositePreview = populatedLayerCount > 0;
  const isRemoveBackgroundPending = removeBackgroundPendingLayerId != null;
  const hostPrimaryImageUrl = React.useMemo(
    () =>
      selectedLayerImageUrl ?? layers.find((layer) => Boolean(layer.imageUrl))?.imageUrl ?? null,
    [layers, selectedLayerImageUrl]
  );
  const availablePresetLabels = React.useMemo(() => {
    if (!selectedPresetLabels.length) return EDIT_PRESET_SURFACE_LABELS;
    const selectedLabelSet = new Set(selectedPresetLabels);
    return EDIT_PRESET_SURFACE_LABELS.filter((label) => !selectedLabelSet.has(label));
  }, [selectedPresetLabels]);
  const hasSelectedPresetLabels = selectedPresetLabels.length > 0;

  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;
  const isCropToolSelected = selectedRailTool === "crop";
  const isInpaintToolSelected = selectedRailTool === "inpaint";
  const isMoveToolSelected = selectedRailTool === "move";
  const sceneZoomScale = isMoveToolSelected ? globalZoomScale : 1;

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
      computeCostForModel(BRIA_BACKGROUND_REMOVE_MODEL_ID, {
        aspect,
      })?.credits ?? 1
    );
  }, [aspect]);
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
    (label: string) => {
      const candidateLabel = label.trim();
      if (!candidateLabel) return;
      setSelectedPresetLabels((previous) => {
        if (previous.includes(candidateLabel)) return previous;
        if (previous.length >= EDIT_PRESET_PANEL_MAX) {
          showStatusToast(PRESET_PANEL_LIMIT_TOAST, "warning");
          return previous;
        }
        return sortPresetLabelsByCanonicalOrder([...previous, candidateLabel]);
      });
    },
    [showStatusToast]
  );

  const removePresetFromPanel = React.useCallback((label: string) => {
    const candidateLabel = label.trim();
    if (!candidateLabel) return;
    setSelectedPresetLabels((previous) =>
      previous.includes(candidateLabel)
        ? previous.filter((presetLabel) => presetLabel !== candidateLabel)
        : previous
    );
  }, []);

  const beginPresetDragSession = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>, payload: ExpertEditPresetDragPayload) => {
      event.stopPropagation();
      activePresetDragPayloadRef.current = payload;
      event.dataTransfer.effectAllowed = "move";
      writePresetDragTransfer(event.dataTransfer, payload);
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
    (event: React.DragEvent<HTMLButtonElement>, label: string) => {
      beginPresetDragSession(event, { label, source: "surface" });
    },
    [beginPresetDragSession]
  );

  const handlePanelPresetDragStart = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>, label: string) => {
      beginPresetDragSession(event, { label, source: "panel" });
    },
    [beginPresetDragSession]
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
      addPresetToPanel(payload.label);
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
      removePresetFromPanel(payload.label);
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
          transform: defaultLayerTransform(),
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
        transform: defaultLayerTransform(),
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
          costOverrideCredits: removeBackgroundCostCredits,
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
    removeBackgroundCostCredits,
    onRegenerateWithReferenceInputs,
    selectedLayer,
    selectedLayerImageUrl,
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
    setMoveZoomValue(entry.zoomValue);
  }, []);

  const handleMoveZoomChange = React.useCallback(
    (nextZoomRawValue: number) => {
      if (!Number.isFinite(nextZoomRawValue)) return;
      const nextZoomValue = clampMoveZoomValue(Math.round(nextZoomRawValue));
      if (nextZoomValue === moveZoomValue) return;
      const baselineEntry = buildTransformHistoryEntry(layers, moveZoomValue);
      const nextEntry = buildTransformHistoryEntry(layers, nextZoomValue);
      setMoveZoomValue(nextZoomValue);
      commitTransformHistoryTransition(nextEntry, baselineEntry);
    },
    [commitTransformHistoryTransition, layers, moveZoomValue]
  );

  const handleMoveZoomReset = React.useCallback(() => {
    handleMoveZoomChange(MOVE_ZOOM_DEFAULT);
  }, [handleMoveZoomChange]);

  const handleUndoMoveAction = React.useCallback(() => {
    let targetEntry: TransformHistoryEntry | null = null;
    setTransformHistoryState((previousHistory) => {
      if (!previousHistory.past.length) return previousHistory;
      targetEntry = previousHistory.past[previousHistory.past.length - 1] ?? null;
      if (!targetEntry) return previousHistory;
      return {
        past: previousHistory.past.slice(0, -1),
        present: targetEntry,
        future: [previousHistory.present, ...previousHistory.future],
      };
    });
    if (targetEntry) {
      applyTransformHistoryEntry(targetEntry);
    }
  }, [applyTransformHistoryEntry]);

  const handleRedoMoveAction = React.useCallback(() => {
    let targetEntry: TransformHistoryEntry | null = null;
    setTransformHistoryState((previousHistory) => {
      if (!previousHistory.future.length) return previousHistory;
      targetEntry = previousHistory.future[0] ?? null;
      if (!targetEntry) return previousHistory;
      return {
        past: [...previousHistory.past, previousHistory.present],
        present: targetEntry,
        future: previousHistory.future.slice(1),
      };
    });
    if (targetEntry) {
      applyTransformHistoryEntry(targetEntry);
    }
  }, [applyTransformHistoryEntry]);

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
        transformGestureBaselineRef.current = buildTransformHistoryEntry(layers, moveZoomValue);
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
      handleInpaintPointerDown(event);
    },
    [
      handleInpaintPointerDown,
      isMorePresetsSurfaceOpen,
      isMoveToolSelected,
      layers,
      moveZoomValue,
      selectedLayer,
      selectedTransformMode,
      sceneZoomScale,
      showStatusToast,
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
      const nextEntry = buildTransformHistoryEntry(layers, moveZoomValue);
      commitTransformHistoryTransition(nextEntry, baselineEntry);
    },
    [commitTransformHistoryTransition, layers, moveZoomValue]
  );

  const handlePrimaryPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      if (isMoveToolSelected) {
        endTransformPointerSession(event);
        return;
      }
      handleInpaintPointerUp(event);
    },
    [
      endTransformPointerSession,
      handleInpaintPointerUp,
      isMorePresetsSurfaceOpen,
      isMoveToolSelected,
    ]
  );

  const handlePrimaryPointerCancel = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      if (isMoveToolSelected) {
        endTransformPointerSession(event);
        return;
      }
      handleInpaintPointerCancel(event);
    },
    [
      endTransformPointerSession,
      handleInpaintPointerCancel,
      isMorePresetsSurfaceOpen,
      isMoveToolSelected,
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
      handleInpaintPointerLeave(event);
    },
    [
      endTransformPointerSession,
      handleInpaintPointerLeave,
      isMorePresetsSurfaceOpen,
      isMoveToolSelected,
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
                  transform: defaultLayerTransform(),
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
      return nextLayers;
    });
  }, [referenceImageUrl, removeBackgroundPendingLayerId, selectedLayerIndex]);

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
            <div
              className={`edit-expert-preset-toolbar-list ${
                hasSelectedPresetLabels ? "is-populated" : "is-empty"
              } ${isPresetPanelDropActive ? "is-drop-active" : ""}`.trim()}
              aria-label="Preset panel list"
              onDragOver={handlePresetPanelDragOver}
              onDragLeave={handlePresetPanelDragLeave}
              onDrop={handlePresetPanelDrop}
            >
              {hasSelectedPresetLabels ? (
                selectedPresetLabels.map((label) => (
                  <button
                    key={label}
                    type="button"
                    draggable
                    className="edit-expert-preset-btn edit-expert-preset-btn--selected"
                    aria-label={`Apply ${label} preset`}
                    onDragStart={(event) => handlePanelPresetDragStart(event, label)}
                    onDragEnd={handlePresetDragEnd}
                  >
                    {label}
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
                isGenerateDisabled ||
                (action.requiresPrimaryImage && !selectedLayerImageUrl) ||
                (action.id === REMOVE_BACKGROUND_ACTION_ID && isRemoveBackgroundPending)
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
          aria-busy={isRemoveBackgroundPending || undefined}
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
            labels={availablePresetLabels}
            onClose={closeMorePresetsSurface}
            onPresetDragStart={handleSurfacePresetDragStart}
            onPresetDragEnd={handlePresetDragEnd}
            onSurfaceDragOver={handlePresetsSurfaceDragOver}
            onSurfaceDragLeave={handlePresetsSurfaceDragLeave}
            onSurfaceDrop={handlePresetsSurfaceDrop}
            isDropActive={isPresetsSurfaceDropActive}
          />
        </div>

        {statusToastMessage ? (
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
                          min={MOVE_ZOOM_MIN}
                          max={MOVE_ZOOM_MAX}
                          value={moveZoomValue}
                          onChange={(event) => handleMoveZoomChange(Number(event.target.value))}
                          onDoubleClick={handleMoveZoomReset}
                          aria-label="Zoom image"
                        />
                      </div>
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
