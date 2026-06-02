/**
 * AI Studio page layout (presentational only).
 * Receives a prepared view model from the page and renders toolbar, panels, previews, and system banners.
 */
import React from "react";
import { Eye, FlowArrow, Globe, type IconProps, SquaresFour, StackSimple } from "phosphor-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  EXPLICIT_CONTENT_FAILURE_DETAIL,
  isExplicitContentFailureMessage,
} from "../../../lib/explicitContentFailure";
import {
  normalizeCustomerFacingProviderError,
  resolveCustomerFacingModelLabel,
} from "../../../lib/customerFacingProviderText";
import { resolveModelLabelById } from "../../../lib/model-runtime/modelCatalog";
import { AiStudioToolbar } from "./AiStudioToolbar";
import { AiStudioToolbarRail } from "./AiStudioToolbarRail";
import { StandardCreatePropertiesPanel } from "./create/StandardCreatePropertiesPanel";
import { PulseCreatePropertiesPanel } from "./create/PulseCreatePropertiesPanel";
import { CreateModeToggle } from "./create/CreateModeToggle";
import { DetailModal } from "./DetailModal";
import { SharedMediaDetailPreviewModal } from "./detail-modal/SharedMediaDetailPreviewModal";
import type { SharedMediaDetailItemBase } from "./detail-modal/detailModalPlatformTypes";
import { ModelModal, type ModelModalContext } from "./ModelModal";
import { AiStudioShellFrame } from "./AiStudioShellFrame";
import { ExpertEditPanelView } from "./edit/ExpertEditPanelView";
import { StudioPreview } from "./StudioPreview";
import type { ModelOption } from "../constants";
import { CharacterPanel } from "./CharacterPanel";
import { StylesLibraryPanel } from "./StylesLibraryPanel";
import { UnifiedPresetsLibraryPanel } from "./UnifiedPresetsLibraryPanel";
import { VideoPropertiesPanel } from "./VideoPropertiesPanel";
import { MusicPropertiesPanel, type MusicPropertiesPanelProps } from "./MusicPropertiesPanel";
import { SoundPropertiesPanel } from "./SoundPropertiesPanel";
import {
  SoundEffectsPropertiesPanel,
  type SoundEffectsPropertiesPanelProps,
} from "./SoundEffectsPropertiesPanel";
import { VoicesPropertiesPanel } from "./VoicesPropertiesPanel";
import { MediaLibraryPanel } from "./MediaLibraryPanel";
import { ElementsPanel } from "./ElementsPanel";
import type {
  ActiveVoiceChangerSourceVideo,
  VoicesPropertiesPanelProps,
} from "./VoicesPropertiesPanel";
import type { ResolveVoiceChangerInternalReferenceSource } from "./VoiceChangerSourceDropzone";
import type { SharedMediaDetailSelectionTarget } from "./detail-modal/detailModalPlatformTypes";
import { useAiStudioShellResize } from "../hooks/useAiStudioShellResize";
import { useAiStudioShellDndController } from "../hooks/useAiStudioShellDndController";
import { useVoiceChangerSourceController } from "../hooks/useVoiceChangerSourceController";
import { useAiStudioStylesRuntime } from "../hooks/useAiStudioStylesRuntime";
import type { CharacterPanelUploadRequest } from "../../../lib/characterPanelUploadRequest";
import type { ResolveCharacterDropReference } from "../../character-manager/hooks/useCharacterManagerDroppedReferenceController";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import type {
  AiStudioCreatePanelContract,
  AiStudioReferenceGridContract,
} from "../hooks/contracts/pageContentContracts";
import type { StudioOutput, ToolId } from "../types";
import type {
  LibraryMediaReferencePayload,
  LibraryPromptReferencePayload,
} from "../reference-grid/referenceGridTypes";
import type { MediaFileRow } from "../logic/mediaLibraryModalModel";
import { resolvePropertiesPanelKind } from "../logic/propertiesPanelRouting";
import { isCharacterShellTool, isPrimaryCharacterTool } from "../logic/primaryCharacterTool";
import { isSoundWorkflow } from "../logic/workflowIdentity";
import {
  PERF_FLAG_SHELL_BOUNDARY_SPLIT,
  PERF_FLAG_SHELL_DECOUPLE,
  PERF_FLAG_SHELL_DND_BACKPRESSURE,
  PERF_FLAG_SHELL_HIGH_DENSITY_MODE,
  PERF_FLAG_SHELL_PANEL_MEMOIZATION,
} from "../logic/perfProfileFlags";
import { useVisibleErrorTelemetry } from "../../../lib/useVisibleErrorTelemetry";
import {
  AI_SHELL_LEFT_CHARACTER_MIN_PX,
  AI_SHELL_LEFT_CHARACTER_DEFAULT_RATIO,
  AI_SHELL_LEFT_CREATE_MAX_PX,
  AI_SHELL_LEFT_CREATE_MIN_PX,
  AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX,
  AI_SHELL_LEFT_SOUND_MIN_PX,
  AI_SHELL_LEFT_VIDEO_DEFAULT_RATIO,
  AI_SHELL_LEFT_VIDEO_MIN_PX,
  AI_SHELL_RIGHT_CANVAS_MIN_PX,
  AI_SHELL_RIGHT_ELEMENTS_MIN_PX,
  resolveCreateShellResizeAction,
  shouldCollapseCreateOnSessionChange,
  shouldCollapseAiShellOnExpertEditPanelSelect,
  shouldCollapseAiShellOnInitialSoundSelection,
  shouldCollapseAiShellOnToolSelect,
} from "../logic/shellResize";
import { useOutputCounts } from "../hooks/aiStudioOutputStore";
import {
  createInitialPanelVisibility,
  resolveExpandedRightRailVisibility,
  resolveEffectivePanelVisibility,
  resolveHeaderShortcutStateMap,
  togglePanelVisibilityByShortcut,
  type ExpandableRightRailHeaderButtonId,
  type HeaderShortcutId,
  type PanelVisibilityState,
} from "../logic/panelVisibility";
import {
  isExpertEditCustomPresetId,
  resolveExpertEditPresetCatalog,
  type ExpertEditPresetId,
  type ExpertEditPresetOverride,
} from "./edit/expertEditPresets";
import {
  readMediaLibraryDragPayload,
  getMediaLibraryDragTypes,
} from "../logic/mediaLibraryDragPayload";
import {
  getNormalizedTransferTypes,
  hasInternalReferenceDragTypeHints,
  type InternalReferenceDragPayload,
} from "../utils/dragDrop";
import {
  doesReferenceGridOwnFileDrop,
  shouldBypassRightRailShellCapture,
} from "../logic/referenceGridDropOwnership";
import type { ResolveInternalStyleDrop } from "./style-creator/intake";

type FailureCard = Pick<
  StudioOutput,
  "id" | "model" | "modelId" | "prompt" | "errorMessage" | "errorMessageShort" | "errorDetail"
>;

type GroupedFailureCard = {
  ids: string[];
  modelLabel: string;
  failureMessage: string;
  count: number;
};

type ComingSoonToolId = "templates" | "workflows" | "my-generations" | "community";
type IconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

const comingSoonCopy: Record<
  ComingSoonToolId,
  { title: string; summary: string; detail: string; icon: IconComponent }
> = {
  templates: {
    title: "Templates",
    summary: "Preset model and setting bundles for common generation tasks.",
    detail:
      "Templates allow you to select pre-set models and selections for specific generative tasks.",
    icon: SquaresFour,
  },
  workflows: {
    title: "Workflows",
    summary: "Reusable Canvas Node Builder pipelines for advanced automations.",
    detail: "Workflows will be a library of pre-made Canvas Node Builder workflows.",
    icon: FlowArrow,
  },
  "my-generations": {
    title: "My Generations",
    summary: "Your personal gallery for every asset you have generated.",
    detail: "My Generations is where you can see all of your generated content in a gallery.",
    icon: StackSimple,
  },
  community: {
    title: "Community",
    summary: "Browse the shared gallery from other creators.",
    detail: "Community is where you can see community members' generated content in the gallery.",
    icon: Globe,
  },
};

const isComingSoonTool = (tool: ToolId | null): tool is ComingSoonToolId =>
  tool === "templates" || tool === "workflows" || tool === "my-generations" || tool === "community";
const AI_STUDIO_HEADER_SHORTCUT_BUTTONS = [
  { id: "quick-slot-inventory", label: "Quick Slot Inventory" },
  { id: "reference-grid", label: "Reference Grid" },
] as const;

type RightColumnDropMode = "none" | "text" | "media";
type PastedMediaReference = { url: string; mimeType?: string | null };
type RightRailExpandedSnapshot = {
  selectedTool: ToolId | null;
  isCanvasVisible: boolean;
  panelVisibility: PanelVisibilityState;
};
type RightColumnDropPayload =
  | { kind: "none" }
  | { kind: "internal" }
  | { kind: "files"; files: FileList }
  | { kind: "media"; reference: PastedMediaReference }
  | { kind: "libraryMedia"; payload: LibraryMediaReferencePayload }
  | { kind: "libraryPrompt"; payload: LibraryPromptReferencePayload }
  | { kind: "text"; text: string };

const DROPPED_IMAGE_URL_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
const DROPPED_AUDIO_URL_PATTERN = /\.(aac|flac|m4a|mp3|oga|ogg|wav)(?:[?#].*)?$/i;
const DROPPED_VIDEO_URL_PATTERN = /\.(m4v|mov|mp4|ogv|webm)(?:[?#].*)?$/i;

const parseDropUrlCandidate = (value: string): string | null => {
  const candidate = value.trim();
  if (!candidate || (typeof window !== "undefined" && candidate === window.location.href))
    return null;
  if (/^data:(image|video|audio)\//i.test(candidate)) return candidate;
  if (/^blob:/i.test(candidate)) return candidate;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const inferDropMediaMimeType = (url: string): string | null => {
  if (/^data:image\//i.test(url) || DROPPED_IMAGE_URL_PATTERN.test(url)) return "image/*";
  if (/^data:audio\//i.test(url) || DROPPED_AUDIO_URL_PATTERN.test(url)) return "audio/*";
  if (/^data:video\//i.test(url) || DROPPED_VIDEO_URL_PATTERN.test(url)) return "video/*";
  return null;
};

const isDropMediaUrl = (url: string): boolean => Boolean(inferDropMediaMimeType(url));

const getDropMediaReferenceFromUriList = (uriList: string): PastedMediaReference | null => {
  const entries = uriList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  for (const entry of entries) {
    const parsed = parseDropUrlCandidate(entry);
    if (!parsed || !isDropMediaUrl(parsed)) continue;
    return { url: parsed, mimeType: inferDropMediaMimeType(parsed) };
  }
  return null;
};

const getDropMediaReferenceFromHtml = (html: string): PastedMediaReference | null => {
  const trimmed = html.trim();
  if (!trimmed || typeof DOMParser === "undefined") return null;
  const fragment = new DOMParser().parseFromString(trimmed, "text/html");
  const nodes = Array.from(fragment.querySelectorAll("img[src],video[src],source[src],a[href]"));
  for (const node of nodes) {
    const raw =
      node.getAttribute("src") ??
      node.getAttribute("href") ??
      (node instanceof HTMLAnchorElement ? node.href : "");
    if (!raw) continue;
    const parsed = parseDropUrlCandidate(raw);
    if (!parsed || !isDropMediaUrl(parsed)) continue;
    return { url: parsed, mimeType: inferDropMediaMimeType(parsed) };
  }
  return null;
};

const getDroppedMediaReference = (transfer: DataTransfer): PastedMediaReference | null => {
  const explicitRefUrl = transfer.getData("text/reference-url");
  const parsedReferenceUrl = parseDropUrlCandidate(explicitRefUrl);
  if (parsedReferenceUrl && isDropMediaUrl(parsedReferenceUrl)) {
    return { url: parsedReferenceUrl, mimeType: inferDropMediaMimeType(parsedReferenceUrl) };
  }
  const uriListReference = getDropMediaReferenceFromUriList(transfer.getData("text/uri-list"));
  if (uriListReference) return uriListReference;
  const htmlReference = getDropMediaReferenceFromHtml(transfer.getData("text/html"));
  if (htmlReference) return htmlReference;
  const plainTextUrl = parseDropUrlCandidate(transfer.getData("text/plain"));
  if (plainTextUrl && isDropMediaUrl(plainTextUrl)) {
    return { url: plainTextUrl, mimeType: inferDropMediaMimeType(plainTextUrl) };
  }
  return null;
};

const normalizeDroppedPromptText = (transfer: DataTransfer): string | null => {
  const promptText = (
    transfer.getData("text/prompt") ||
    transfer.getData("text/plain") ||
    transfer.getData("text")
  ).trim();
  if (!promptText) return null;
  if (/^data:(image|video|audio)\//i.test(promptText)) return null;
  if (
    DROPPED_IMAGE_URL_PATTERN.test(promptText) ||
    DROPPED_AUDIO_URL_PATTERN.test(promptText) ||
    DROPPED_VIDEO_URL_PATTERN.test(promptText)
  ) {
    return null;
  }
  return promptText;
};

const MEDIA_LIBRARY_DRAG_TYPES_LOWERCASE = getMediaLibraryDragTypes().map((type) =>
  type.toLowerCase()
);

const resolveRightColumnDropMode = (
  transfer: DataTransfer | null | undefined
): RightColumnDropMode => {
  if (!transfer) return "none";
  const types = getNormalizedTransferTypes(transfer);
  const fileCount = transfer.files?.length ?? 0;
  const hasFileType = types.includes("files");
  const hasLibraryDragType = MEDIA_LIBRARY_DRAG_TYPES_LOWERCASE.some((type) =>
    types.includes(type)
  );
  const hasMediaUrlHints =
    types.includes("text/reference-url") ||
    types.includes("text/uri-list") ||
    types.includes("application/x-moz-file");
  const hasTextLikeType = types.some(
    (type) =>
      type.includes("text") ||
      type.includes("plain") ||
      type.includes("prompt") ||
      type.includes("utf8")
  );
  if (hasInternalReferenceDragTypeHints(transfer)) return "none";
  if (hasLibraryDragType) return "media";
  if (fileCount > 0) return "media";
  if (hasMediaUrlHints) return "media";
  if (hasTextLikeType) return "text";
  if (types.length === 0 && fileCount === 0) return "text";
  // Some browsers report "Files" for custom text drags while exposing zero files.
  // Treat that as droppable so the right column stays pre-warmed.
  if (hasFileType && fileCount === 0) return "text";
  return "none";
};

const resolveRightColumnDropPayload = (transfer: DataTransfer): RightColumnDropPayload => {
  if (hasInternalReferenceDragTypeHints(transfer)) return { kind: "internal" };
  const mediaLibraryDragPayload = readMediaLibraryDragPayload(transfer);
  if (mediaLibraryDragPayload?.kind === "libraryMedia") {
    return { kind: "libraryMedia", payload: mediaLibraryDragPayload.payload };
  }
  if (mediaLibraryDragPayload?.kind === "libraryPrompt") {
    return { kind: "libraryPrompt", payload: mediaLibraryDragPayload.payload };
  }
  const droppedFiles = transfer.files;
  if (droppedFiles && droppedFiles.length > 0) {
    return { kind: "files", files: droppedFiles };
  }
  const droppedPromptText = normalizeDroppedPromptText(transfer);
  if (droppedPromptText) {
    return { kind: "text", text: droppedPromptText };
  }
  const droppedMedia = getDroppedMediaReference(transfer);
  if (droppedMedia) {
    return { kind: "media", reference: droppedMedia };
  }
  return { kind: "none" };
};

type CreateSectionProps = AiStudioCreatePanelContract;
type EditExpertSectionProps = React.ComponentProps<typeof ExpertEditPanelView>;
type VideoSectionProps = React.ComponentProps<typeof VideoPropertiesPanel>;
const PERFORMANCE_DENSE_REFERENCE_COUNT = 40;
const FLAG_SHELL_DECOUPLE = PERF_FLAG_SHELL_DECOUPLE;
const FLAG_DND_BACKPRESSURE = PERF_FLAG_SHELL_DND_BACKPRESSURE;
const FLAG_PANEL_MEMOIZATION = PERF_FLAG_SHELL_PANEL_MEMOIZATION;
const FLAG_SHELL_BOUNDARY_SPLIT = PERF_FLAG_SHELL_BOUNDARY_SPLIT;
const FLAG_HIGH_DENSITY_SHELL_MODE = PERF_FLAG_SHELL_HIGH_DENSITY_MODE;

type AiStudioAlertsStackProps = {
  uiError: string | null;
  uiNotice: string | null;
  visibleFailures: FailureCard[];
  onDismissUiError: () => void;
  onDismissUiNotice: () => void;
  onDismissFailure: (id: string) => void;
};

type AiStudioAlertBannerProps = {
  message: string;
  variant: "error" | "warning";
  role: "alert" | "status";
  live: "assertive" | "polite";
  onDismiss: () => void;
};

const AiStudioAlertBanner = ({
  message,
  variant,
  role,
  live,
  onDismiss,
}: AiStudioAlertBannerProps) => (
  <div className={`ai-alert-banner ai-alert-banner--${variant}`} role={role} aria-live={live}>
    <p className="ai-alert-banner__message">{message}</p>
    <button type="button" className="ai-alert-banner__dismiss" onClick={onDismiss}>
      Dismiss
    </button>
  </div>
);

const normalizeAlertText = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const GENERIC_GENERATION_FAILURE_LABELS = new Set([
  "generation failed",
  "invalid request",
  "request failed",
]);

export const groupVisibleFailuresForAlertStack = (
  visibleFailures: FailureCard[]
): GroupedFailureCard[] => {
  const grouped = new Map<string, GroupedFailureCard>();
  visibleFailures.forEach((item) => {
    const modelLabel = resolveCustomerFacingModelLabel({
      model: item.model,
      modelId: item.modelId,
      resolveModelLabel: resolveModelLabelById,
      fallback: "Generation",
    });
    const isExplicitContentFailure =
      isExplicitContentFailureMessage(item.errorDetail) ||
      isExplicitContentFailureMessage(item.errorMessage) ||
      isExplicitContentFailureMessage(item.errorMessageShort);
    const normalizedShortFailure = normalizeAlertText(item.errorMessageShort);
    const rawFailureMessage = isExplicitContentFailure
      ? EXPLICIT_CONTENT_FAILURE_DETAIL
      : normalizedShortFailure && !GENERIC_GENERATION_FAILURE_LABELS.has(normalizedShortFailure)
        ? item.errorMessageShort
        : (item.errorDetail ?? item.errorMessage ?? item.errorMessageShort ?? "Generation failed");
    const failureMessage = normalizeCustomerFacingProviderError(
      rawFailureMessage,
      "Generation failed"
    );
    const groupKey = `${normalizeAlertText(modelLabel)}::${normalizeAlertText(failureMessage)}`;
    const existing = grouped.get(groupKey);
    if (existing) {
      existing.ids.push(item.id);
      existing.count += 1;
      return;
    }
    grouped.set(groupKey, {
      ids: [item.id],
      modelLabel,
      failureMessage,
      count: 1,
    });
  });
  return Array.from(grouped.values());
};

const AiStudioAlertsStack = React.memo(function AiStudioAlertsStack({
  uiError,
  uiNotice,
  visibleFailures,
  onDismissUiError,
  onDismissUiNotice,
  onDismissFailure,
}: AiStudioAlertsStackProps) {
  const normalizedUiError = normalizeAlertText(uiError);
  const suppressUiErrorForFailureStack =
    normalizedUiError.length > 0 &&
    visibleFailures.some((item) => {
      const modelLabel = resolveCustomerFacingModelLabel({
        model: item.model,
        modelId: item.modelId,
        resolveModelLabel: resolveModelLabelById,
        fallback: "Generation",
      });
      const detail = normalizeCustomerFacingProviderError(
        item.errorDetail ?? item.errorMessage ?? "",
        ""
      );
      const normalizedDetail = normalizeAlertText(detail);
      if (!normalizedDetail) return false;
      const normalizedModelLabel = normalizeAlertText(modelLabel);
      return (
        normalizedUiError === normalizedDetail ||
        normalizedUiError === `${normalizedModelLabel} failed: ${normalizedDetail}`
      );
    });
  const effectiveUiError = suppressUiErrorForFailureStack
    ? null
    : normalizeCustomerFacingProviderError(uiError, "");
  const groupedFailures = groupVisibleFailuresForAlertStack(visibleFailures);

  return (
    <>
      {effectiveUiError ? (
        <AiStudioAlertBanner
          message={effectiveUiError}
          variant="error"
          role="alert"
          live="assertive"
          onDismiss={onDismissUiError}
        />
      ) : null}
      {uiNotice ? (
        <AiStudioAlertBanner
          message={uiNotice}
          variant="warning"
          role="status"
          live="polite"
          onDismiss={onDismissUiNotice}
        />
      ) : null}
      {groupedFailures.length ? (
        <div className="ai-error-stack" role="alert" aria-live="polite">
          <ul className="ai-error-list">
            {groupedFailures.map((group) => {
              const title =
                group.count > 1 ? `${group.modelLabel} (${group.count})` : group.modelLabel;
              return (
                <li key={`${group.modelLabel}:${group.failureMessage}`} className="ai-error-row">
                  <div className="ai-error-row-copy">
                    <p className="ai-error-row-title">{title}</p>
                    <p className="ai-error-row-message">{group.failureMessage}</p>
                  </div>
                  <button
                    type="button"
                    className="ai-alert-banner__dismiss ai-error-row-dismiss"
                    onClick={() => {
                      group.ids.forEach((id) => onDismissFailure(id));
                    }}
                  >
                    Dismiss
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </>
  );
});

export type AiStudioPageContentProps = {
  sessionId?: string | null;
  referenceGridFileInputRef: React.RefObject<HTMLInputElement>;
  onFileBrowserSelection: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uiError: string | null;
  uiNotice: string | null;
  onDismissUiError: () => void;
  onDismissUiNotice: () => void;
  balanceCredits: number | null;
  pendingHoldCredits: number | null;
  balanceLoading: boolean;
  visibleFailures: FailureCard[];
  onDismissFailure: (id: string) => void;
  onInspectFailure: (id: string) => void;
  selectedTool: ToolId | null;
  characterCreateRequestKey?: number;
  elementCreateRequestKey?: number;
  showCreateTools: boolean;
  onOpenProjects?: () => void;
  onSelectTool: (tool: ToolId | null) => void;
  onToggleCreateTools: (value: boolean) => void;
  propertiesCreate: CreateSectionProps;
  propertiesEditExpert: EditExpertSectionProps;
  propertiesVideo: VideoSectionProps;
  propertiesMusic?: MusicPropertiesPanelProps;
  propertiesSoundEffects?: SoundEffectsPropertiesPanelProps;
  propertiesVoices?: VoicesPropertiesPanelProps;
  refreshCharacterOptions?: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  resolveCharacterAvatarUrlById?: (characterId: string | null | undefined) => string | null;
  isTemplateView: boolean;
  referenceGridProps: AiStudioReferenceGridContract;
  studioPreviewProps: React.ComponentProps<typeof StudioPreview>;
  detailModalOutput: StudioOutput | null;
  sharedDetailModalItem?: SharedMediaDetailItemBase | null;
  isMediaStorageFull?: boolean;
  onDetailClose: () => void;
  onUpdateOutputPrompt: (id: string, prompt: string) => void;
  onDeleteOutput: (id: string) => void;
  onDetailDownload?: (id: string) => void;
  onDetailSaveReference?: (id: string) => void;
  onDetailSavePrompt?: (promptText: string) => void;
  onAddLibraryMediaReference?: (payload: LibraryMediaReferencePayload) => void;
  onAddLibraryPromptReference?: (payload: LibraryPromptReferencePayload) => void;
  onDeleteMediaRowsFromWorkspace?: (rows: MediaFileRow[]) => void;
  mediaLibraryDetailSelectionTarget?: SharedMediaDetailSelectionTarget | null;
  onMediaLibraryDetailSelectionTargetChange?: (
    target: SharedMediaDetailSelectionTarget | null
  ) => void;
  projectId?: string | null;
  projectRouteRequested?: boolean;
  projectName?: string | null;
  onProjectNameCommit?: (value: string) => void;
  resolveMediaLibraryInternalDropItem?: (payload: InternalReferenceDragPayload) => Promise<{
    kind: "media" | "prompt";
    id: string;
  } | null>;
  resolveStyleLibraryInternalDrop?: ResolveInternalStyleDrop;
  onOpenMediaLibrary?: () => void;
  modelModalState: {
    isOpen: boolean;
    options: ModelOption[];
    resolveCreditsForModel?: (modelId: string) => number | null;
    onClose: () => void;
    onSelect: (value: string) => void;
    context?: ModelModalContext | null;
    onPresentationResolved?: (payload: {
      context: ModelModalContext | null;
      suppliedOptionCount: number;
      visibleOptionCount: number;
    }) => void;
  };
  handleReferenceGridFiles: (files: FileList) => void;
  triggerFilePicker: () => void;
  resolveCharacterDropReference?: ResolveCharacterDropReference;
  pendingCharacterUploadRequest?: CharacterPanelUploadRequest | null;
  onCharacterUploadRequestHandled?: (requestId: number) => void;
  createSelectedCharacterId?: string | null;
  onCreateSelectedCharacterIdChange?: (characterId: string | null) => void;
  resolveElementProfileImageDropSource?: ResolveInternalReferenceDrop;
  resolveVoiceChangerInternalReferenceSource?: ResolveVoiceChangerInternalReferenceSource;
  onSelectedStylePromptChange?: (stylePrompt: string | null) => void;
  onSelectedStyleContextChange?: (styleContext: StudioOutput["styleContext"] | null) => void;
};

export function AiStudioPageContent({
  sessionId = null,
  referenceGridFileInputRef,
  onFileBrowserSelection,
  uiError,
  uiNotice,
  onDismissUiError,
  onDismissUiNotice,
  balanceCredits,
  balanceLoading,
  visibleFailures,
  onDismissFailure,
  selectedTool,
  characterCreateRequestKey = 0,
  elementCreateRequestKey = 0,
  showCreateTools,
  onOpenProjects,
  onSelectTool,
  onToggleCreateTools,
  propertiesCreate,
  propertiesEditExpert,
  propertiesVideo,
  propertiesMusic,
  propertiesSoundEffects,
  propertiesVoices,
  refreshCharacterOptions,
  resolveCharacterAvatarUrlById,
  isTemplateView,
  referenceGridProps,
  studioPreviewProps,
  detailModalOutput,
  sharedDetailModalItem = null,
  isMediaStorageFull = false,
  onDetailClose,
  onUpdateOutputPrompt,
  onDeleteOutput,
  onDetailDownload,
  onDetailSaveReference,
  onDetailSavePrompt,
  onAddLibraryMediaReference,
  onAddLibraryPromptReference,
  onDeleteMediaRowsFromWorkspace,
  mediaLibraryDetailSelectionTarget = null,
  onMediaLibraryDetailSelectionTargetChange,
  projectId = null,
  projectRouteRequested = false,
  projectName,
  onProjectNameCommit,
  resolveMediaLibraryInternalDropItem,
  resolveStyleLibraryInternalDrop,
  onOpenMediaLibrary,
  modelModalState,
  handleReferenceGridFiles,
  triggerFilePicker,
  resolveCharacterDropReference,
  pendingCharacterUploadRequest = null,
  onCharacterUploadRequestHandled,
  createSelectedCharacterId = null,
  onCreateSelectedCharacterIdChange,
  resolveElementProfileImageDropSource,
  resolveVoiceChangerInternalReferenceSource,
  onSelectedStylePromptChange,
  onSelectedStyleContextChange,
}: AiStudioPageContentProps) {
  const visibleProjectName =
    typeof projectName === "string" && projectName.trim().length > 0 ? projectName.trim() : null;
  const resolvedReferenceGridFileInputRef = referenceGridFileInputRef;
  const resolvedCreateProperties = propertiesCreate;
  const resolvedStandardCreateProperties =
    resolvedCreateProperties.expertCreateMode === "standard"
      ? resolvedCreateProperties.standard
      : null;
  const resolvedPulseCreateProperties =
    resolvedCreateProperties.expertCreateMode === "pulse" ? resolvedCreateProperties.pulse : null;
  const resolvedReferenceGridProps = referenceGridProps;
  const selectedComingSoonTool = isComingSoonTool(selectedTool) ? selectedTool : null;
  const comingSoon = selectedComingSoonTool ? comingSoonCopy[selectedComingSoonTool] : null;
  const ComingSoonIcon = comingSoon ? comingSoon.icon : null;
  const referenceGridFileAccept = "image/*,video/*,audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga";
  const propertiesPanelKind = resolvePropertiesPanelKind(selectedTool);
  const showCreatePropertiesPanel = propertiesPanelKind === "create";
  const showExpertEditPanel = propertiesPanelKind === "edit";
  const showStylesPanelEligible = showExpertEditPanel || showCreatePropertiesPanel;
  const isPrimaryCharacterPanelOpen = isPrimaryCharacterTool(selectedTool);
  const isCharacterShellPanelOpen = isCharacterShellTool(selectedTool);
  const [isCanvasVisible, setIsCanvasVisible] = React.useState(false);
  const [panelVisibility, setPanelVisibility] = React.useState<PanelVisibilityState>(
    createInitialPanelVisibility
  );
  const [expandedRightRailTarget, setExpandedRightRailTarget] =
    React.useState<ExpandableRightRailHeaderButtonId | null>(null);
  const [selectedStyleId, setSelectedStyleId] = React.useState<string | null>(null);
  const [activeVoiceChangerSourceVideo, setActiveVoiceChangerSourceVideo] =
    React.useState<ActiveVoiceChangerSourceVideo | null>(null);
  const { voiceChangerSource, handleVoiceChangerSourceChange } = useVoiceChangerSourceController();
  const [selectedPresetId, setSelectedPresetId] = React.useState<ExpertEditPresetId | null>(null);
  const [uncontrolledExpertCreateMode, setUncontrolledExpertCreateMode] = React.useState<
    "standard" | "pulse"
  >("standard");
  const isExpertCreateModeControlled =
    resolvedCreateProperties.expertCreateMode != null &&
    resolvedCreateProperties.onExpertCreateModeChange != null;
  const expertCreateMode =
    resolvedCreateProperties.expertCreateMode ?? uncontrolledExpertCreateMode;
  const {
    handleDeleteStyle,
    handleReorderStyle,
    styleDetailsSaveError,
    stylesDeleteError,
    upsertStyleDetails,
    visibleStylesCatalog,
  } = useAiStudioStylesRuntime({
    selectedStyleId,
    setSelectedStyleId,
    onSelectedStylePromptChange,
    onSelectedStyleContextChange,
  });
  const isQuickSlotToggleAvailable = Boolean(
    resolvedReferenceGridProps.onAddCuratedReference &&
    resolvedReferenceGridProps.onRemoveCuratedReference &&
    resolvedReferenceGridProps.onReorderCuratedReference
  );
  const isStylesToggleAvailable = !isPrimaryCharacterPanelOpen && showStylesPanelEligible;
  const panelToggleAvailability = React.useMemo(
    () => ({
      quickSlot: isQuickSlotToggleAvailable,
      styles: isStylesToggleAvailable,
    }),
    [isQuickSlotToggleAvailable, isStylesToggleAvailable]
  );
  const effectivePanelVisibility = React.useMemo(() => {
    const baseVisibility = resolveEffectivePanelVisibility({
      panelVisibility,
      availability: panelToggleAvailability,
    });
    if (selectedTool === "styles") {
      return {
        quickSlot: false,
        referenceGrid: true,
        styles: false,
      };
    }
    return baseVisibility;
  }, [panelToggleAvailability, panelVisibility, selectedTool]);
  const isStylesPanelOpen = effectivePanelVisibility.styles;
  const headerShortcutStates = React.useMemo(
    () =>
      resolveHeaderShortcutStateMap({
        effectiveVisibility: effectivePanelVisibility,
        availability: panelToggleAvailability,
      }),
    [effectivePanelVisibility, panelToggleAvailability]
  );
  const visibleHeaderShortcutButtons = React.useMemo(() => AI_STUDIO_HEADER_SHORTCUT_BUTTONS, []);
  const expandedRightRailSnapshotRef = React.useRef<RightRailExpandedSnapshot | null>(null);
  const clearExpandedRightRailSession = React.useCallback(() => {
    expandedRightRailSnapshotRef.current = null;
    setExpandedRightRailTarget(null);
  }, []);
  const restoreExpandedRightRailLayout = React.useCallback(() => {
    const expandedSnapshot = expandedRightRailSnapshotRef.current;
    if (!expandedSnapshot) return;
    setIsCanvasVisible(expandedSnapshot.isCanvasVisible);
    setPanelVisibility(expandedSnapshot.panelVisibility);
    clearExpandedRightRailSession();
    onSelectTool(expandedSnapshot.selectedTool);
  }, [clearExpandedRightRailSession, onSelectTool]);
  const handleHeaderShortcutToggle = React.useCallback(
    (shortcutId: HeaderShortcutId) => {
      if (expandedRightRailTarget === shortcutId) {
        restoreExpandedRightRailLayout();
        return;
      }
      clearExpandedRightRailSession();
      setPanelVisibility((previous) => {
        return togglePanelVisibilityByShortcut({
          panelVisibility: previous,
          shortcutId,
          availability: panelToggleAvailability,
        });
      });
    },
    [
      clearExpandedRightRailSession,
      expandedRightRailTarget,
      panelToggleAvailability,
      restoreExpandedRightRailLayout,
    ]
  );
  const { activeCount } = useOutputCounts();
  React.useEffect(() => {
    if (selectedTool === "voice-changer") return;
    setActiveVoiceChangerSourceVideo(null);
  }, [selectedTool]);
  const isPerformanceDenseSession =
    FLAG_HIGH_DENSITY_SHELL_MODE && activeCount >= PERFORMANCE_DENSE_REFERENCE_COUNT;
  const minLeftWidthPx = isCharacterShellPanelOpen
    ? AI_SHELL_LEFT_CHARACTER_MIN_PX
    : isSoundWorkflow(selectedTool)
      ? AI_SHELL_LEFT_SOUND_MIN_PX
      : selectedTool === "video" || selectedTool === "kling"
        ? AI_SHELL_LEFT_VIDEO_MIN_PX
        : showCreatePropertiesPanel
          ? AI_SHELL_LEFT_CREATE_MIN_PX
          : showExpertEditPanel
            ? AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX
            : undefined;
  const maxLeftWidthPx = showCreatePropertiesPanel ? AI_SHELL_LEFT_CREATE_MAX_PX : undefined;
  const minRightWidthPx =
    selectedTool === "media-library"
      ? AI_SHELL_RIGHT_CANVAS_MIN_PX
      : selectedTool === "elements"
        ? AI_SHELL_RIGHT_ELEMENTS_MIN_PX
        : undefined;
  const defaultLeftRatio = isSoundWorkflow(selectedTool)
    ? 0.65
    : selectedTool === "character" || selectedTool === "elements"
      ? AI_SHELL_LEFT_CHARACTER_DEFAULT_RATIO
      : selectedTool === "video" || selectedTool === "kling"
        ? AI_SHELL_LEFT_VIDEO_DEFAULT_RATIO
        : undefined;
  const {
    shellRef,
    leftColumnRef,
    leftWidthPx,
    showDivider,
    isResizing,
    shellStyle,
    collapseToMin,
    resetToDefaultWidth,
    restoreWidth,
    expandToMax,
    dividerProps,
    rightColumnHidden,
  } = useAiStudioShellResize({
    enabled: Boolean(selectedTool),
    minLeftWidthPx,
    maxLeftWidthPx,
    minRightWidthPx,
    defaultLeftRatio,
    minWidthResetKey: projectId,
  });
  const mediaLibraryExpandedWidthRef = React.useRef<number | null>(null);
  const [isMediaLibraryPanelExpanded, setIsMediaLibraryPanelExpanded] = React.useState(false);
  const handleExpandMediaLibraryPanel = React.useCallback(() => {
    if (isMediaLibraryPanelExpanded) return;
    mediaLibraryExpandedWidthRef.current =
      typeof leftWidthPx === "number" && Number.isFinite(leftWidthPx) ? leftWidthPx : null;
    expandToMax();
    setIsMediaLibraryPanelExpanded(true);
  }, [expandToMax, isMediaLibraryPanelExpanded, leftWidthPx]);
  const handleCollapseMediaLibraryPanel = React.useCallback(() => {
    restoreWidth(mediaLibraryExpandedWidthRef.current);
    mediaLibraryExpandedWidthRef.current = null;
    setIsMediaLibraryPanelExpanded(false);
  }, [restoreWidth]);
  React.useEffect(() => {
    if (selectedTool === "media-library") return;
    mediaLibraryExpandedWidthRef.current = null;
    setIsMediaLibraryPanelExpanded(false);
  }, [selectedTool]);
  const previousSelectedToolForExpandedSessionRef = React.useRef<ToolId | null>(selectedTool);
  React.useEffect(() => {
    const previousSelectedToolForExpandedSession =
      previousSelectedToolForExpandedSessionRef.current;
    if (
      expandedRightRailTarget != null &&
      previousSelectedToolForExpandedSession !== selectedTool &&
      selectedTool !== null
    ) {
      clearExpandedRightRailSession();
    }
    previousSelectedToolForExpandedSessionRef.current = selectedTool;
  }, [clearExpandedRightRailSession, expandedRightRailTarget, selectedTool]);
  const effectiveRightColumnHidden = rightColumnHidden;
  const shellClassName = [
    "ai-shell",
    "ai-shell-motion-flat",
    selectedTool ? "" : "ai-shell-wide",
    showDivider ? "ai-shell-resizable" : "",
    showCreatePropertiesPanel ? "ai-shell-expert-create" : "",
    showExpertEditPanel ? "ai-shell-expert-edit" : "",
    isCharacterShellPanelOpen ? "ai-shell-character-open" : "",
    isPerformanceDenseSession ? "ai-shell-performance-dense" : "",
    isResizing ? "ai-shell-resizing" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const previousSelectedToolRef = React.useRef<ToolId | null>(null);
  const previousExpertCreateModeRef = React.useRef<"standard" | "pulse">(expertCreateMode);
  const previousSessionIdRef = React.useRef<string | null>(sessionId);
  React.useEffect(() => {
    const previousSelectedTool = previousSelectedToolRef.current;
    const previousExpertCreateMode = previousExpertCreateModeRef.current;
    const previousSessionId = previousSessionIdRef.current;
    const isCharacterShellToolSelected =
      selectedTool === "character" || selectedTool === "elements";
    const shouldResetForCharacterShellSelection =
      isCharacterShellToolSelected && previousSelectedTool !== selectedTool;
    if (shouldResetForCharacterShellSelection) {
      collapseToMin();
      previousSelectedToolRef.current = selectedTool;
      previousExpertCreateModeRef.current = expertCreateMode;
      previousSessionIdRef.current = sessionId;
      return;
    }
    const shouldCollapseForEditSelection = shouldCollapseAiShellOnExpertEditPanelSelect(
      previousSelectedTool,
      selectedTool
    );
    if (shouldCollapseForEditSelection) {
      collapseToMin();
      previousSelectedToolRef.current = selectedTool;
      previousExpertCreateModeRef.current = expertCreateMode;
      previousSessionIdRef.current = sessionId;
      return;
    }
    const shouldCollapseForStandardCreateSession = shouldCollapseCreateOnSessionChange({
      previousSessionId,
      nextSessionId: sessionId,
      nextTool: selectedTool,
      nextMode: expertCreateMode,
      createModeEnabled: showCreatePropertiesPanel,
    });
    if (shouldCollapseForStandardCreateSession) {
      collapseToMin();
      previousSelectedToolRef.current = selectedTool;
      previousExpertCreateModeRef.current = expertCreateMode;
      previousSessionIdRef.current = sessionId;
      return;
    }
    const expertCreateShellResizeAction = resolveCreateShellResizeAction({
      previousTool: previousSelectedTool,
      nextTool: selectedTool,
      previousMode: previousExpertCreateMode,
      nextMode: expertCreateMode,
      createModeEnabled: showCreatePropertiesPanel,
    });
    const isInitialSoundSelection = shouldCollapseAiShellOnInitialSoundSelection(
      previousSelectedTool,
      selectedTool
    );
    if (isInitialSoundSelection) {
      collapseToMin();
      previousSelectedToolRef.current = selectedTool;
      previousExpertCreateModeRef.current = expertCreateMode;
      previousSessionIdRef.current = sessionId;
      return;
    }
    const shouldResetForVideoSelection =
      previousSelectedTool !== selectedTool &&
      (selectedTool === "video" || selectedTool === "kling");
    if (
      shouldCollapseAiShellOnToolSelect(previousSelectedTool, selectedTool) ||
      shouldResetForVideoSelection ||
      expertCreateShellResizeAction != null
    ) {
      if (shouldResetForVideoSelection) {
        resetToDefaultWidth();
      } else {
        collapseToMin();
      }
    }
    previousSelectedToolRef.current = selectedTool;
    previousExpertCreateModeRef.current = expertCreateMode;
    previousSessionIdRef.current = sessionId;
  }, [
    collapseToMin,
    expertCreateMode,
    resetToDefaultWidth,
    sessionId,
    selectedTool,
    showCreatePropertiesPanel,
  ]);
  const rightColumnRef = React.useRef<HTMLDivElement | null>(null);
  const handleStylesPanelToggle = React.useCallback(() => {
    clearExpandedRightRailSession();
    setPanelVisibility((previous) => {
      return togglePanelVisibilityByShortcut({
        panelVisibility: previous,
        shortcutId: "styles",
        availability: panelToggleAvailability,
      });
    });
  }, [clearExpandedRightRailSession, panelToggleAvailability]);
  const handleExpertCreateModeChange = React.useCallback(
    (nextMode: "standard" | "pulse") => {
      if (expertCreateMode === nextMode) return;
      if (isExpertCreateModeControlled) {
        resolvedCreateProperties.onExpertCreateModeChange?.(nextMode);
        return;
      }
      setUncontrolledExpertCreateMode(nextMode);
    },
    [expertCreateMode, isExpertCreateModeControlled, resolvedCreateProperties]
  );
  const handleCanvasVisibilityToggle = React.useCallback(() => {
    if (expandedRightRailTarget === "canvas") {
      restoreExpandedRightRailLayout();
      return;
    }
    clearExpandedRightRailSession();
    setIsCanvasVisible((previous) => !previous);
  }, [clearExpandedRightRailSession, expandedRightRailTarget, restoreExpandedRightRailLayout]);
  const handleExpandedRightRailToggle = React.useCallback(
    (target: ExpandableRightRailHeaderButtonId) => {
      const expandedSnapshot = expandedRightRailSnapshotRef.current;
      if (expandedRightRailTarget === target && expandedSnapshot) {
        restoreExpandedRightRailLayout();
        return;
      }
      if (!expandedSnapshot) {
        expandedRightRailSnapshotRef.current = {
          selectedTool,
          isCanvasVisible,
          panelVisibility,
        };
      }
      const nextExpandedVisibility = resolveExpandedRightRailVisibility({
        target,
        availability: panelToggleAvailability,
      });
      setIsCanvasVisible(nextExpandedVisibility.isCanvasVisible);
      setPanelVisibility(nextExpandedVisibility.panelVisibility);
      onSelectTool(null);
      setExpandedRightRailTarget(target);
    },
    [
      expandedRightRailTarget,
      isCanvasVisible,
      onSelectTool,
      panelToggleAvailability,
      panelVisibility,
      restoreExpandedRightRailLayout,
      selectedTool,
    ]
  );
  const handleSelectedStyleIdChange = React.useCallback((styleId: string | null) => {
    setSelectedStyleId(styleId);
    setPanelVisibility((previous) => {
      if (!previous.styles) return previous;
      return {
        ...previous,
        styles: false,
      };
    });
  }, []);
  const handleToolSelection = React.useCallback(
    (tool: ToolId | null) => {
      clearExpandedRightRailSession();
      onSelectTool(tool);
    },
    [clearExpandedRightRailSession, onSelectTool]
  );
  const resolvedExpertEditProperties = React.useMemo(
    () => ({
      ...propertiesEditExpert,
      isStylesPanelOpen,
      onStylesPanelToggle: handleStylesPanelToggle,
      onOpenPresetsLibrary: () => handleToolSelection("presets"),
      selectedStyleId,
      stylesCatalog: visibleStylesCatalog,
    }),
    [
      handleToolSelection,
      handleStylesPanelToggle,
      isStylesPanelOpen,
      propertiesEditExpert,
      selectedStyleId,
      visibleStylesCatalog,
    ]
  );
  const createModeToggle = React.useMemo(
    () => <CreateModeToggle value={expertCreateMode} onChange={handleExpertCreateModeChange} />,
    [expertCreateMode, handleExpertCreateModeChange]
  );
  const resolvedStandardCreatePropertiesWithStyles = React.useMemo(
    () =>
      resolvedStandardCreateProperties
        ? {
            ...resolvedStandardCreateProperties,
            isStylesPanelOpen,
            onStylesPanelToggle: handleStylesPanelToggle,
            onOpenPresetsLibrary: () => handleToolSelection("presets"),
            selectedStyleId,
            stylesCatalog: visibleStylesCatalog,
            createModeToggle,
          }
        : null,
    [
      createModeToggle,
      handleToolSelection,
      handleStylesPanelToggle,
      isStylesPanelOpen,
      resolvedStandardCreateProperties,
      selectedStyleId,
      visibleStylesCatalog,
    ]
  );
  const resolvedPulseCreatePropertiesWithRuntime = React.useMemo(
    () =>
      resolvedPulseCreateProperties
        ? {
            ...resolvedPulseCreateProperties,
            onOpenPresetsLibrary: () => handleToolSelection("presets"),
            createModeToggle,
          }
        : null,
    [createModeToggle, handleToolSelection, resolvedPulseCreateProperties]
  );
  const resolvedReferenceGridPropsWithStylesPanel = React.useMemo(
    () => ({
      ...resolvedReferenceGridProps,
      railCanvasProps: isCanvasVisible ? resolvedReferenceGridProps.railCanvasProps : undefined,
      panelVisibility: effectivePanelVisibility,
      stylesPanel: {
        isOpen: isStylesPanelOpen,
        selectedStyleId,
        styles: visibleStylesCatalog,
        onSelectStyle: handleSelectedStyleIdChange,
      },
    }),
    [
      effectivePanelVisibility,
      handleSelectedStyleIdChange,
      isStylesPanelOpen,
      isCanvasVisible,
      resolvedReferenceGridProps,
      selectedStyleId,
      visibleStylesCatalog,
    ]
  );
  const presetsLibraryCatalog = React.useMemo(
    () =>
      resolveExpertEditPresetCatalog(
        propertiesEditExpert.customPresetOverrides,
        propertiesEditExpert.systemPresetDefinitions
      ),
    [propertiesEditExpert.customPresetOverrides, propertiesEditExpert.systemPresetDefinitions]
  );
  const handleSelectedPresetIdChange = React.useCallback((presetId: ExpertEditPresetId | null) => {
    setSelectedPresetId(presetId);
  }, []);
  const handlePresetOverrideSave = React.useCallback(
    (presetId: ExpertEditPresetId, override: ExpertEditPresetOverride): boolean => {
      const onCustomPresetOverridesChange = propertiesEditExpert.onCustomPresetOverridesChange;
      if (!onCustomPresetOverridesChange) return false;
      if (!isExpertEditCustomPresetId(presetId)) return false;
      const currentOverrides = propertiesEditExpert.customPresetOverrides ?? {};
      onCustomPresetOverridesChange({
        ...currentOverrides,
        [presetId]: {
          label: override.label,
          prompt: override.prompt,
        },
      });
      return true;
    },
    [propertiesEditExpert.customPresetOverrides, propertiesEditExpert.onCustomPresetOverridesChange]
  );
  const shouldReferenceGridOwnFileDrop = React.useCallback(
    (event: React.DragEvent<HTMLElement>): boolean =>
      doesReferenceGridOwnFileDrop(event, rightColumnRef.current),
    [rightColumnRef]
  );

  useVisibleErrorTelemetry({
    source: "client.ai_studio.ui_error_banner",
    scope: "app",
    severity: "medium",
    message: uiError,
    metadata: {
      selected_tool: selectedTool,
    },
  });

  useVisibleErrorTelemetry({
    source: "client.ai_studio.notice_banner",
    scope: "app",
    severity: "low",
    message: uiNotice,
    metadata: {
      selected_tool: selectedTool,
    },
  });

  const visibleFailureIds = React.useMemo(
    () => visibleFailures.map((item) => item.id).slice(0, 20),
    [visibleFailures]
  );

  useVisibleErrorTelemetry({
    source: "client.ai_studio.failure_stack",
    scope: "generation",
    severity: "medium",
    message:
      visibleFailures.length > 0
        ? `${visibleFailures.length} generation failure card(s) visible in UI.`
        : null,
    metadata: {
      selected_tool: selectedTool,
      failure_count: visibleFailures.length,
      failure_ids: visibleFailureIds,
    },
  });

  const createPropertiesPanelContent = React.useMemo(() => {
    const shouldRenderPulseCreateProperties =
      resolvedCreateProperties.expertCreateMode === "pulse" &&
      resolvedPulseCreatePropertiesWithRuntime;
    // eslint-disable-next-line react-hooks/refs -- Mode-owned panel props are pass-through render inputs; any nested refs are owned by the child panel.
    if (shouldRenderPulseCreateProperties) {
      return (
        <PulseCreatePropertiesPanel
          key="pulse-create-runtime"
          {...resolvedPulseCreatePropertiesWithRuntime}
        />
      );
    }
    // eslint-disable-next-line react-hooks/refs -- Mode-owned panel props are pass-through render inputs; any nested refs are owned by the child panel.
    if (!resolvedStandardCreatePropertiesWithStyles) return null;
    return (
      <StandardCreatePropertiesPanel
        key="standard-create-runtime"
        {...resolvedStandardCreatePropertiesWithStyles}
      />
    );
  }, [
    resolvedCreateProperties.expertCreateMode,
    resolvedPulseCreatePropertiesWithRuntime,
    resolvedStandardCreatePropertiesWithStyles,
  ]);
  const editPropertiesPanelContent = React.useMemo(
    () => <ExpertEditPanelView {...resolvedExpertEditProperties} />,
    [resolvedExpertEditProperties]
  );
  const videoPropertiesPanelContent = React.useMemo(
    () => <VideoPropertiesPanel {...propertiesVideo} />,
    [propertiesVideo]
  );
  const characterPropertiesPanelContent = React.useMemo(
    () => (
      <CharacterPanel
        createRequestKey={characterCreateRequestKey}
        externalUploadRequest={pendingCharacterUploadRequest}
        onExternalUploadRequestHandled={onCharacterUploadRequestHandled}
        projectId={projectId}
        projectRouteRequested={projectRouteRequested}
        selectedCharacterId={createSelectedCharacterId}
        onSelectedCharacterIdChange={onCreateSelectedCharacterIdChange}
        resolveCharacterDropReference={resolveCharacterDropReference}
        resolveMediaLibraryInternalDropItem={resolveMediaLibraryInternalDropItem}
        detailSelectionTarget={mediaLibraryDetailSelectionTarget}
        onDetailSelectionTargetChange={onMediaLibraryDetailSelectionTargetChange}
      />
    ),
    [
      characterCreateRequestKey,
      createSelectedCharacterId,
      onCharacterUploadRequestHandled,
      onCreateSelectedCharacterIdChange,
      pendingCharacterUploadRequest,
      mediaLibraryDetailSelectionTarget,
      onMediaLibraryDetailSelectionTargetChange,
      projectId,
      projectRouteRequested,
      resolveCharacterDropReference,
      resolveMediaLibraryInternalDropItem,
    ]
  );
  const presetsPropertiesPanelContent = React.useMemo(
    () => (
      <UnifiedPresetsLibraryPanel
        promptPresets={presetsLibraryCatalog}
        selectedPromptPresetId={selectedPresetId}
        onOpenCreateWorkflow={() => handleToolSelection("create")}
        onOpenEditWorkflow={() => handleToolSelection("edit")}
        onSelectPromptPreset={handleSelectedPresetIdChange}
        onSavePromptPresetOverride={handlePresetOverrideSave}
      />
    ),
    [
      handleToolSelection,
      handlePresetOverrideSave,
      handleSelectedPresetIdChange,
      presetsLibraryCatalog,
      selectedPresetId,
    ]
  );
  const elementsPropertiesPanelContent = React.useMemo(
    () => (
      <ElementsPanel
        createRequestKey={elementCreateRequestKey}
        projectId={projectId}
        resolveMediaLibraryInternalDropItem={resolveMediaLibraryInternalDropItem}
        resolveProfileImageDropSource={resolveElementProfileImageDropSource}
        detailSelectionTarget={mediaLibraryDetailSelectionTarget}
        onDetailSelectionTargetChange={onMediaLibraryDetailSelectionTargetChange}
      />
    ),
    [
      elementCreateRequestKey,
      mediaLibraryDetailSelectionTarget,
      onMediaLibraryDetailSelectionTargetChange,
      projectId,
      resolveElementProfileImageDropSource,
      resolveMediaLibraryInternalDropItem,
    ]
  );
  const stylesPropertiesPanelContent = React.useMemo(
    () => (
      <StylesLibraryPanel
        styles={visibleStylesCatalog}
        onReorderStyle={handleReorderStyle}
        onSaveStyleDetails={upsertStyleDetails}
        saveError={styleDetailsSaveError}
        onDeleteStyle={handleDeleteStyle}
        deleteError={stylesDeleteError}
        resolveInternalStyleDrop={resolveStyleLibraryInternalDrop}
      />
    ),
    [
      handleDeleteStyle,
      handleReorderStyle,
      resolveStyleLibraryInternalDrop,
      styleDetailsSaveError,
      stylesDeleteError,
      upsertStyleDetails,
      visibleStylesCatalog,
    ]
  );
  const mediaLibraryPropertiesPanelContent = React.useMemo(
    () =>
      onAddLibraryMediaReference && onAddLibraryPromptReference ? (
        <MediaLibraryPanel
          key={projectId ?? "no-project"}
          onSelectMedia={onAddLibraryMediaReference}
          onSelectPrompt={onAddLibraryPromptReference}
          projectId={projectId}
          projectName={projectName ?? null}
          onProjectNameCommit={onProjectNameCommit}
          isMediaLibraryPanelExpanded={isMediaLibraryPanelExpanded}
          onExpandMediaLibraryPanel={handleExpandMediaLibraryPanel}
          onCollapseMediaLibraryPanel={handleCollapseMediaLibraryPanel}
          resolveInternalDropItem={resolveMediaLibraryInternalDropItem}
          onDeleteMediaRowsFromWorkspace={onDeleteMediaRowsFromWorkspace}
          detailSelectionTarget={mediaLibraryDetailSelectionTarget}
          onDetailSelectionTargetChange={onMediaLibraryDetailSelectionTargetChange}
        />
      ) : (
        <p className="tiny subdued">Media Library panel is unavailable.</p>
      ),
    [
      onAddLibraryMediaReference,
      onAddLibraryPromptReference,
      onDeleteMediaRowsFromWorkspace,
      mediaLibraryDetailSelectionTarget,
      onMediaLibraryDetailSelectionTargetChange,
      projectId,
      handleCollapseMediaLibraryPanel,
      handleExpandMediaLibraryPanel,
      isMediaLibraryPanelExpanded,
      onProjectNameCommit,
      projectName,
      resolveMediaLibraryInternalDropItem,
    ]
  );
  const resolvePropertiesPanelContent = React.useCallback(
    (kind: typeof propertiesPanelKind) => {
      switch (kind) {
        case "create":
          return createPropertiesPanelContent;
        case "edit":
          return editPropertiesPanelContent;
        case "video":
          return videoPropertiesPanelContent;
        case "music":
          return <MusicPropertiesPanel {...propertiesMusic} />;
        case "sound":
          return <SoundPropertiesPanel onSelectTool={handleToolSelection} />;
        case "sound-effects":
          return <SoundEffectsPropertiesPanel {...propertiesSoundEffects} />;
        case "voices":
          return (
            <VoicesPropertiesPanel
              selectedTool={selectedTool}
              {...propertiesVoices}
              voiceChangerSource={voiceChangerSource}
              onVoiceChangerSourceChange={handleVoiceChangerSourceChange}
              onActiveVoiceChangerSourceVideoChange={(source) => {
                setActiveVoiceChangerSourceVideo(source);
                propertiesVoices?.onActiveVoiceChangerSourceVideoChange?.(source);
              }}
              resolveVoiceChangerInternalReferenceSource={
                resolveVoiceChangerInternalReferenceSource
              }
            />
          );
        case "character":
          return characterPropertiesPanelContent;
        case "presets":
          return presetsPropertiesPanelContent;
        case "elements":
          return elementsPropertiesPanelContent;
        case "styles":
          return stylesPropertiesPanelContent;
        case "media-library":
          return mediaLibraryPropertiesPanelContent;
        case "none":
        default:
          return null;
      }
    },
    [
      characterPropertiesPanelContent,
      createPropertiesPanelContent,
      elementsPropertiesPanelContent,
      editPropertiesPanelContent,
      handleToolSelection,
      handleVoiceChangerSourceChange,
      mediaLibraryPropertiesPanelContent,
      propertiesMusic,
      propertiesSoundEffects,
      propertiesVoices,
      resolveVoiceChangerInternalReferenceSource,
      presetsPropertiesPanelContent,
      selectedTool,
      stylesPropertiesPanelContent,
      voiceChangerSource,
      videoPropertiesPanelContent,
    ]
  );
  const memoizedPropertiesPanelContent = React.useMemo(
    () => resolvePropertiesPanelContent(propertiesPanelKind),
    [propertiesPanelKind, resolvePropertiesPanelContent]
  );
  const propertiesPanelContent = FLAG_PANEL_MEMOIZATION
    ? memoizedPropertiesPanelContent
    : resolvePropertiesPanelContent(propertiesPanelKind);
  const toolbarRail = FLAG_SHELL_BOUNDARY_SPLIT ? (
    <AiStudioToolbarRail
      selectedTool={selectedTool}
      showCreateTools={showCreateTools}
      onOpenProjects={onOpenProjects}
      onSelectTool={handleToolSelection}
      onToggleCreateTools={onToggleCreateTools}
    />
  ) : (
    <AiStudioToolbar
      selectedTool={selectedTool}
      showCreateTools={showCreateTools}
      onOpenProjects={onOpenProjects}
      onSelectTool={handleToolSelection}
      onToggleCreateTools={onToggleCreateTools}
    />
  );

  const {
    dropMode: rightColumnDropMode,
    handleDragEnterCapture: handleRightColumnDragEnterCapture,
    handleDragOverCapture: handleRightColumnDragOverCapture,
    handleDragLeaveCapture: handleRightColumnDragLeaveCapture,
    handleDropCapture: handleRightColumnDropCapture,
    handleShellDragOverCapture,
    handleShellDropCapture,
  } = useAiStudioShellDndController({
    shellRef: shellRef as React.RefObject<HTMLElement | null>,
    rightColumnRef: rightColumnRef as React.RefObject<HTMLElement | null>,
    resolveDropMode: (transfer) => resolveRightColumnDropMode(transfer) as RightColumnDropMode,
    resolveDropPayload: (transfer) => resolveRightColumnDropPayload(transfer),
    onDropFiles: handleReferenceGridFiles,
    onDropMediaReference: resolvedReferenceGridPropsWithStylesPanel.onPasteMediaReference,
    onDropLibraryMediaReference: onAddLibraryMediaReference,
    onDropLibraryPromptReference: onAddLibraryPromptReference,
    onDropTextReference: resolvedReferenceGridPropsWithStylesPanel.onPasteTextReference,
    useRafBackpressure: FLAG_SHELL_DECOUPLE && FLAG_DND_BACKPRESSURE,
    shouldOwnFileDrop: shouldReferenceGridOwnFileDrop,
    shouldBypassCapture: (event, context) =>
      shouldBypassRightRailShellCapture(event, rightColumnRef.current, context),
  });
  const detailModalContext =
    selectedTool === "voice-changer" &&
    detailModalOutput?.mode === "video" &&
    activeVoiceChangerSourceVideo &&
    (activeVoiceChangerSourceVideo.referenceOutputId === detailModalOutput.id ||
      (activeVoiceChangerSourceVideo.referenceMediaId != null &&
        detailModalOutput.savedMediaIds?.includes(activeVoiceChangerSourceVideo.referenceMediaId)))
      ? {
          activeVoiceChangerSourceVideo: {
            aspect: activeVoiceChangerSourceVideo.aspect,
          },
        }
      : null;
  return (
    <>
      <main
        className="page page-wide ai-studio-page"
        data-shell-boundary-split={FLAG_SHELL_BOUNDARY_SPLIT ? "on" : "off"}
        data-selected-tool={selectedTool ?? undefined}
      >
        <input
          ref={resolvedReferenceGridFileInputRef}
          type="file"
          accept={referenceGridFileAccept}
          multiple
          style={{ display: "none" }}
          onChange={onFileBrowserSelection}
        />

        <section className="ai-hero panel hero-banner ai-amber-hero">
          <div className="hero-text">
            <h1 className="ai-hero-title">AI Studio</h1>
            <div className="ai-credit-inline header-embedded">
              <span className="credit-label">Credits</span>
              <span className="credit-value">
                {balanceLoading
                  ? "…"
                  : balanceCredits != null
                    ? balanceCredits.toLocaleString()
                    : "—"}
              </span>
            </div>
          </div>
          {visibleProjectName ? (
            <div
              className="ai-hero-project-name"
              role="status"
              aria-live="polite"
              aria-label={`Current project: ${visibleProjectName}`}
              title={visibleProjectName}
            >
              <span className="ai-hero-project-name-text">{visibleProjectName}</span>
            </div>
          ) : null}
          <div className="hero-right">
            <div className="ai-hero-shortcut-cluster">
              <div className="ai-hero-shortcut-buttons" aria-label="AI Studio header shortcuts">
                {expandedRightRailTarget == null || expandedRightRailTarget === "canvas" ? (
                  <button
                    type="button"
                    className="ai-hero-shortcut-button"
                    aria-pressed={isCanvasVisible}
                    onClick={handleCanvasVisibilityToggle}
                    onDoubleClick={() => {
                      handleExpandedRightRailToggle("canvas");
                    }}
                  >
                    Canvas
                  </button>
                ) : null}
                {visibleHeaderShortcutButtons.map((shortcut) => {
                  if (expandedRightRailTarget != null && expandedRightRailTarget !== shortcut.id) {
                    return null;
                  }
                  const buttonState = headerShortcutStates[shortcut.id];
                  return (
                    <button
                      key={shortcut.id}
                      type="button"
                      className="ai-hero-shortcut-button"
                      aria-pressed={buttonState.pressed}
                      disabled={buttonState.disabled}
                      onClick={() => handleHeaderShortcutToggle(shortcut.id)}
                      onDoubleClick={() => {
                        handleExpandedRightRailToggle(shortcut.id);
                      }}
                    >
                      {shortcut.label}
                    </button>
                  );
                })}
              </div>
              {expandedRightRailTarget != null ? (
                <button
                  type="button"
                  className="ai-hero-shortcut-icon-button"
                  aria-label="Restore previous panel layout"
                  aria-pressed="true"
                  title="Restore previous panel layout"
                  onClick={restoreExpandedRightRailLayout}
                >
                  <Eye size={16} weight="regular" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <AiStudioAlertsStack
          uiError={uiError}
          uiNotice={uiNotice}
          visibleFailures={visibleFailures}
          onDismissUiError={onDismissUiError}
          onDismissUiNotice={onDismissUiNotice}
          onDismissFailure={onDismissFailure}
        />

        <div className={`ai-layout${isTemplateView ? " templates-active" : ""}`}>
          {toolbarRail}

          <div className="ai-content">
            <AiStudioShellFrame
              shellRef={shellRef as React.RefObject<HTMLElement>}
              leftColumnRef={leftColumnRef as React.RefObject<HTMLElement>}
              rightColumnRef={rightColumnRef}
              shellClassName={shellClassName}
              shellStyle={shellStyle}
              selectedTool={selectedTool}
              showDivider={showDivider}
              dividerProps={dividerProps}
              propertiesPanelKey={selectedTool ? propertiesPanelKind : null}
              rightColumnHidden={effectiveRightColumnHidden}
              propertiesPanelContent={propertiesPanelContent}
              rightColumnDropMode={rightColumnDropMode as RightColumnDropMode}
              onRightColumnDropCapture={handleRightColumnDropCapture}
              onRightColumnDragOverCapture={handleRightColumnDragOverCapture}
              onRightColumnDragEnterCapture={handleRightColumnDragEnterCapture}
              onRightColumnDragLeaveCapture={handleRightColumnDragLeaveCapture}
              onShellDragOverCapture={handleShellDragOverCapture}
              onShellDropCapture={handleShellDropCapture}
              referenceGridProps={resolvedReferenceGridPropsWithStylesPanel}
              studioPreviewProps={studioPreviewProps}
              handleReferenceGridFiles={handleReferenceGridFiles}
              triggerFilePicker={triggerFilePicker}
              onOpenMediaLibrary={onOpenMediaLibrary}
              showPreviewRail={expandedRightRailTarget == null}
            />
            {comingSoon ? (
              <section className="ai-coming-soon" aria-live="polite">
                <div
                  className="panel ai-panel ai-coming-soon-card"
                  data-tool={selectedComingSoonTool}
                >
                  <div className="ai-coming-soon-header">
                    <div className="ai-coming-soon-title-block">
                      <span className="ai-coming-soon-icon" aria-hidden="true">
                        {ComingSoonIcon ? <ComingSoonIcon size={22} weight="bold" /> : null}
                      </span>
                      <div>
                        <p className="eyebrow">AI Studio</p>
                        <h2 className="ai-coming-soon-title">{comingSoon.title}</h2>
                      </div>
                    </div>
                    <span className="ai-coming-soon-pill">Coming soon</span>
                  </div>
                  <p className="ai-coming-soon-summary">{comingSoon.summary}</p>
                  <p className="ai-coming-soon-detail">{comingSoon.detail}</p>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </main>
      <ModelModal
        isOpen={modelModalState.isOpen}
        onClose={modelModalState.onClose}
        onSelect={modelModalState.onSelect}
        options={modelModalState.options}
        resolveCreditsForModel={modelModalState.resolveCreditsForModel}
        context={modelModalState.context}
        onPresentationResolved={modelModalState.onPresentationResolved}
      />
      <DetailModal
        output={detailModalOutput}
        isMediaStorageFull={isMediaStorageFull}
        context={detailModalContext}
        projectId={projectId}
        onClose={onDetailClose}
        onUpdatePrompt={onUpdateOutputPrompt}
        onDeleteOutput={onDeleteOutput}
        onDownloadReference={onDetailDownload}
        onSaveReference={onDetailSaveReference}
        onSavePrompt={onDetailSavePrompt}
        refreshCharacterOptions={refreshCharacterOptions}
        resolveCharacterAvatarUrlById={resolveCharacterAvatarUrlById}
      />
      <SharedMediaDetailPreviewModal
        item={sharedDetailModalItem}
        onClose={onDetailClose}
        modalActivityId="ai-studio-shared-detail-preview-modal"
        backdropDataTestId="ai-studio-shared-detail-preview-backdrop"
        closeLabel="Close media detail"
      />
    </>
  );
}
