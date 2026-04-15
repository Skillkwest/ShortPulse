/**
 * Contract, constants, and shared helpers for the Expert Edit panel view.
 */
import type { Icon as PhosphorIcon } from "phosphor-react";
import {
  ArrowClockwise,
  ArrowsOutCardinal,
  MagicWand,
  PaintBrushBroad,
  PencilSimple,
  StackSimple,
} from "phosphor-react";
import type { AspectOption } from "../../types";
import type { InpaintSubmissionOverride } from "../../logic/inpaintSubmission";
import type { EditSubmitIntent } from "../../logic/editSubmitIntent";
import type { ModelModalContext } from "../ModelModal";
import type { CreateCharacterOption } from "../create/useCreateCharacterModeController";
import type { ExpertEditCustomPresetOverrides, ExpertEditPresetId } from "./expertEditPresets";
import type { ExpertEditStyleTile } from "./expertEditStyles";
import type {
  ExpertEditInpaintHistoryState,
  ExpertEditSessionState,
  ExpertEditMarkupHistoryState,
} from "./expertEditSessionState";
import { resolveStageViewportSize, type StageViewportSize } from "./expertEditViewportUtils";

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
  onEditSubmitIntentChange?: (intent: EditSubmitIntent) => void;
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
      referenceInputsMode?: "merge" | "replace";
    }
  ) => void | Promise<void>;
  onAddSessionMediaReference?: (payload: { url: string; mimeType?: string | null }) => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  costCredits?: number | null;
  isGenerateDisabled?: boolean;
  isGenerateBusy?: boolean;
  guardrailReason?: string | null;
  isPrimaryStageGenerating?: boolean;
  referenceImageWarning?: string | null;
  onImageResolutionChange?: (value: string) => void;
  characterOptions?: CreateCharacterOption[];
  selectedCharacterId?: string;
  onSelectedCharacterIdChange?: (value: string) => void;
  isCharacterOptionsLoading?: boolean;
  characterModeEnabled?: boolean;
  onCharacterModeEnabledChange?: (value: boolean) => void;
  refreshCharacterOptions?: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  resolveCharacterAvatarUrlById?: (characterId: string | null | undefined) => string | null;
  selectedPresetIds?: readonly ExpertEditPresetId[];
  onSelectedPresetIdsChange?: (presetIds: ExpertEditPresetId[]) => void;
  customPresetOverrides?: ExpertEditCustomPresetOverrides;
  onCustomPresetOverridesChange?: (overrides: ExpertEditCustomPresetOverrides) => void;
  isStylesPanelOpen?: boolean;
  onStylesPanelToggle?: () => void;
  selectedStyleId?: string | null;
  stylesCatalog?: readonly ExpertEditStyleTile[];
  sessionState?: ExpertEditSessionState | null;
  onSessionStateChange?: (state: ExpertEditSessionState) => void;
};

export const secondaries = [0, 1, 2] as const;

export const COMPOSITE_REGENERATE_COHESION_PROMPT = [
  "Integrate all visible layers into one cohesive scene with consistent spatial logic.",
  "Match lighting direction, intensity, and color temperature across all elements.",
  "Add believable contact shadows, ambient occlusion, reflected light, and clean edge integration (no cutout outlines or haloing).",
  "Align perspective, scale, depth, lens/scene continuity, and texture treatment so every element feels captured in the same environment.",
  "If subjects interact with surfaces or objects, make overlaps, occlusion, and grounding physically plausible.",
  "Harmonize global color and contrast while preserving the original subject identity, facial features, pose, and key design details.",
  "Keep the existing creative style intact; only improve cohesion and integration.",
].join(" ");

export const editPresetUtilityActions = [
  {
    id: "composite-regenerate",
    label: "Composite & Regenerate",
    icon: ArrowClockwise,
    iconWeight: "regular" as const,
    buttonClassName:
      "edit-expert-preset-action-btn--compose-image edit-expert-preset-action-btn--hidden",
    creditCost: null,
    hideIcon: false,
    requiresPrimaryImage: false,
  },
] as const;

export const editLayerUtilityActions = [
  {
    id: "flatten-image",
    label: "Flatten Layers",
    icon: StackSimple,
    buttonClassName: "edit-expert-preset-action-btn--compose-image",
    creditCost: null,
  },
  {
    id: "remove-background",
    label: "Remove Background",
    icon: MagicWand,
    buttonClassName:
      "edit-expert-preset-action-btn--compose-image edit-expert-preset-action-btn--remove-bg",
    creditCost: 1,
  },
] as const;

export type RailTool = "move" | "inpaint" | "markup";

export const editGenerationModeOptions: ReadonlyArray<{
  id: EditSubmitIntent;
  label: string;
}> = [
  { id: "standard", label: "Standard" },
  { id: "inpaint", label: "Inpaint" },
  { id: "markup", label: "Markup" },
];

export const inpaintRailTools: ReadonlyArray<{
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
    id: "markup",
    label: "Markup",
    selectedClassName: "is-selected-markup",
    icon: PencilSimple,
  },
];

export type InpaintMode = "lasso" | "brush" | "auto";
export type InpaintSelectionTab = "select" | "unselect";
export type MarkupMode = "pen" | "lasso" | "eraser";

export const MAX_LAYERS = 6;
export const PRESET_PANEL_LIMIT_TOAST = "Preset panel is full (max 11).";
export const INPAINT_COLLAPSE_ANIMATION_MS = 140;
export const STATUS_TOAST_VISIBLE_MS = 1_000;
export const STATUS_TOAST_FADE_MS = 220;
export const TRANSIENT_OBJECT_URL_REVOKE_MS = 60_000;
export const REMOVE_BACKGROUND_PENDING_TIMEOUT_MS = 120_000;
export const selectedLayerTransformHandleCorners = ["nw", "ne", "se", "sw"] as const;

export const resolveImageDimensionsFromUrl = (
  url: string
): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Image dimension resolution requires a browser environment."));
      return;
    }
    const image = new window.Image();
    image.onload = () =>
      resolve({
        width: Math.max(1, image.naturalWidth || 1),
        height: Math.max(1, image.naturalHeight || 1),
      });
    image.onerror = () => reject(new Error("Unable to resolve image dimensions."));
    image.src = url;
  });

export const REMOVE_BACKGROUND_ACTION_ID = "remove-background";
export const FLATTEN_IMAGE_ACTION_ID = "flatten-image";
export const TRANSFORM_HISTORY_LIMIT = 80;
export const MARKUP_COLOR_DEFAULT = "#f43f5e";
export const MARKUP_COLOR_SWATCHES = [
  "#ff4fa3",
  "#f43f5e",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#22d3ee",
  "#60a5fa",
  "#a78bfa",
] as const;
export const LOCKED_EDIT_TOOL_MODEL_LOGO_SRC = "/tiny-logo.png";
export const INPAINT_STROKE_SIZE_DEFAULT = 26;
export const MARKUP_STROKE_SIZE_DEFAULT = 4;
export const MARKUP_STROKE_SIZE_MAX = 30;

export const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const isSpaceActivationKey = (event: KeyboardEvent) =>
  event.code === "Space" || event.key === " " || event.key === "Spacebar";

export const resolveValidStageRect = (rect: DOMRect | null): DOMRect | null => {
  if (!rect) return null;
  if (rect.width <= 0 || rect.height <= 0) return null;
  return rect;
};

export const resolveElementViewportSize = (
  element: HTMLDivElement | null | undefined
): StageViewportSize => {
  if (element) {
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (width > 0 && height > 0) {
      return {
        width,
        height,
      };
    }
  }
  return resolveStageViewportSize(resolveValidStageRect(element?.getBoundingClientRect() ?? null));
};

export type MarkupHistoryState = ExpertEditMarkupHistoryState;
export type InpaintHistoryState = ExpertEditInpaintHistoryState;
