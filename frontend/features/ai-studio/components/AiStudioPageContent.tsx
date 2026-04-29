/**
 * AI Studio page layout (presentational only).
 * Receives a prepared view model from the page and renders toolbar, panels, previews, and system banners.
 */
import React from "react";
import dynamic from "next/dynamic";
import { Eye, FlowArrow, Globe, type IconProps, SquaresFour, StackSimple } from "phosphor-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  EXPLICIT_CONTENT_FAILURE_DETAIL,
  isExplicitContentFailureMessage,
} from "../../../lib/explicitContentFailure";
import { AiStudioToolbar } from "./AiStudioToolbar";
import { AiStudioToolbarRail } from "./AiStudioToolbarRail";
import {
  ComposeSendCard,
  StandardCreatePropertiesPanel,
} from "./create/StandardCreatePropertiesPanel";
import type { PulseCreatePropertiesPanelProps } from "./create/PulseCreatePropertiesPanel";
import { DetailModal } from "./DetailModal";
import { ModelModal, type ModelModalContext } from "./ModelModal";
import { AiStudioShellFrame } from "./AiStudioShellFrame";
import { ExpertEditPanelView } from "./edit/ExpertEditPanelView";
import { EXPERT_EDIT_STYLE_CATALOG, type ExpertEditStyleTile } from "./edit/expertEditStyles";
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
import { useAiStudioShellResize } from "../hooks/useAiStudioShellResize";
import { useAiStudioShellDndController } from "../hooks/useAiStudioShellDndController";
import { useStylesLibraryDeletedStyleIdsPreference } from "../hooks/useStylesLibraryDeletedStyleIdsPreference";
import { useStylesLibraryPanelIdsPreference } from "../hooks/useStylesLibraryPanelIdsPreference";
import { useStylesLibraryStyleDetailsPreference } from "../hooks/useStylesLibraryStyleDetailsPreference";
import type { ResolveCharacterDropReference } from "../../character-manager/hooks/useCharacterManagerDroppedReferenceController";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import type { AiStudioReferenceGridContract } from "../hooks/contracts/pageContentContracts";
import type {
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
  AgentOutputGenerateInput,
} from "../../ai-agent/types";
import type { StudioOutput, ToolId } from "../types";
import type {
  LibraryMediaReferencePayload,
  LibraryPromptReferencePayload,
} from "../reference-grid/referenceGridTypes";
import { resolvePropertiesPanelKind } from "../logic/propertiesPanelRouting";
import { isCharacterShellTool, isPrimaryCharacterTool } from "../logic/primaryCharacterTool";
import {
  reorderStylesLibraryOrderedIds,
  resolveOrderedStylesCatalog,
} from "../logic/stylesLibraryCatalog";
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
  AI_SHELL_LEFT_EXPERT_CREATE_MAX_PX,
  AI_SHELL_LEFT_EXPERT_CREATE_MIN_PX,
  AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX,
  AI_SHELL_LEFT_SOUND_MIN_PX,
  AI_SHELL_LEFT_VIDEO_DEFAULT_RATIO,
  AI_SHELL_LEFT_VIDEO_MIN_PX,
  AI_SHELL_RIGHT_CANVAS_MIN_PX,
  AI_SHELL_RIGHT_ELEMENTS_MIN_PX,
  resolveExpertCreateShellResizeAction,
  shouldCollapseExpertCreateOnSessionChange,
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
import type { ResolveInternalStyleDrop } from "./style-creator/intake";

type FailureCard = Pick<
  StudioOutput,
  "id" | "model" | "modelId" | "prompt" | "errorMessage" | "errorMessageShort" | "errorDetail"
>;

const PulseCreatePropertiesPanel = dynamic<PulseCreatePropertiesPanelProps>(() =>
  import("./create/PulseCreatePropertiesPanel").then((module) => module.PulseCreatePropertiesPanel)
);

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

const getEventTargetElement = (target: EventTarget | null): Element | null => {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
};

type CreateSectionProps = React.ComponentProps<typeof StandardCreatePropertiesPanel> &
  Partial<PulseCreatePropertiesPanelProps>;
type EditExpertSectionProps = React.ComponentProps<typeof ExpertEditPanelView>;
type VideoSectionProps = React.ComponentProps<typeof VideoPropertiesPanel>;
const PERFORMANCE_DENSE_REFERENCE_COUNT = 40;
const FLAG_SHELL_DECOUPLE = PERF_FLAG_SHELL_DECOUPLE;
const FLAG_DND_BACKPRESSURE = PERF_FLAG_SHELL_DND_BACKPRESSURE;
const FLAG_PANEL_MEMOIZATION = PERF_FLAG_SHELL_PANEL_MEMOIZATION;
const FLAG_SHELL_BOUNDARY_SPLIT = PERF_FLAG_SHELL_BOUNDARY_SPLIT;
const FLAG_HIGH_DENSITY_SHELL_MODE = PERF_FLAG_SHELL_HIGH_DENSITY_MODE;

type AgentChatProps = {
  isOpen: boolean;
  agentMessages: AgentMessage[];
  agentInput: string;
  agentIsSending: boolean;
  latestAgentPrompt: string | null;
  assistantBubbleMedia?: Record<string, AgentOutputBubbleMediaState>;
  stagedAttachments: AgentAttachment[];
  agentDropActive: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onAddToGrid: () => void;
  onClose: () => void;
  onAttachmentDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onAttachmentDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onAttachmentDragEnter: (event: React.DragEvent<HTMLDivElement>) => void;
  onAttachmentDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onRemoveAttachment: (id: string) => void;
  onClearAttachments: () => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onGenerateFromOutputPrompt?: (request: AgentOutputGenerateInput) => void;
  outputGenerateCostCredits?: number | null;
  disableOutputGenerate?: boolean;
  outputGenerateGuardrailReason?: string | null;
};

type AiStudioAlertsStackProps = {
  uiError: string | null;
  uiNotice: string | null;
  characterError: string | null;
  visibleFailures: FailureCard[];
  onDismissUiError: () => void;
  onDismissUiNotice: () => void;
  onDismissCharacterError: () => void;
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

const AiStudioAlertsStack = React.memo(function AiStudioAlertsStack({
  uiError,
  uiNotice,
  characterError,
  visibleFailures,
  onDismissUiError,
  onDismissUiNotice,
  onDismissCharacterError,
  onDismissFailure,
}: AiStudioAlertsStackProps) {
  const normalizedUiError = normalizeAlertText(uiError);
  const suppressUiErrorForFailureStack =
    normalizedUiError.length > 0 &&
    visibleFailures.some((item) => {
      const modelLabel = item.model || item.modelId || "Generation";
      const detail = item.errorDetail ?? item.errorMessage ?? "";
      const normalizedDetail = normalizeAlertText(detail);
      if (!normalizedDetail) return false;
      const normalizedModelLabel = normalizeAlertText(modelLabel);
      return (
        normalizedUiError === normalizedDetail ||
        normalizedUiError === `${normalizedModelLabel} failed: ${normalizedDetail}`
      );
    });
  const effectiveUiError = suppressUiErrorForFailureStack ? null : uiError;

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
      {characterError ? (
        <AiStudioAlertBanner
          message={characterError}
          variant="error"
          role="alert"
          live="assertive"
          onDismiss={onDismissCharacterError}
        />
      ) : null}
      {visibleFailures.length ? (
        <div className="ai-error-stack" role="alert" aria-live="polite">
          <ul className="ai-error-list">
            {visibleFailures.map((item) => {
              const modelLabel = item.model || item.modelId || "Generation";
              const isExplicitContentFailure =
                isExplicitContentFailureMessage(item.errorDetail) ||
                isExplicitContentFailureMessage(item.errorMessage) ||
                isExplicitContentFailureMessage(item.errorMessageShort);
              const failureMessage = isExplicitContentFailure
                ? EXPLICIT_CONTENT_FAILURE_DETAIL
                : (item.errorMessageShort ?? item.errorDetail ?? item.errorMessage);
              return (
                <li key={item.id} className="ai-error-row">
                  <div className="ai-error-row-copy">
                    <p className="ai-error-row-title">{modelLabel}</p>
                    <p className="ai-error-row-message">{failureMessage}</p>
                  </div>
                  <button
                    type="button"
                    className="ai-alert-banner__dismiss ai-error-row-dismiss"
                    onClick={() => onDismissFailure(item.id)}
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
  characterError: string | null;
  onDismissUiError: () => void;
  onDismissUiNotice: () => void;
  onDismissCharacterError: () => void;
  beginnerMode: boolean;
  showBeginnerModeToggle: boolean;
  onBeginnerModeChange: (value: boolean) => void;
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
  onDetailClose: () => void;
  onUpdateOutputPrompt: (id: string, prompt: string) => void;
  onDeleteOutput: (id: string) => void;
  onDetailDownload?: (id: string) => void;
  onDetailSaveReference?: (id: string) => void;
  onDetailSavePrompt?: (promptText: string) => void;
  onAddLibraryMediaReference?: (payload: LibraryMediaReferencePayload) => void;
  onAddLibraryPromptReference?: (payload: LibraryPromptReferencePayload) => void;
  projectId?: string | null;
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
  };
  agentChat: AgentChatProps;
  handleReferenceGridFiles: (files: FileList) => void;
  triggerFilePicker: () => void;
  resolveCharacterDropReference?: ResolveCharacterDropReference;
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
  characterError,
  onDismissUiError,
  onDismissUiNotice,
  onDismissCharacterError,
  beginnerMode,
  showBeginnerModeToggle,
  onBeginnerModeChange,
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
  onDetailClose,
  onUpdateOutputPrompt,
  onDeleteOutput,
  onDetailDownload,
  onDetailSaveReference,
  onDetailSavePrompt,
  onAddLibraryMediaReference,
  onAddLibraryPromptReference,
  projectId = null,
  projectName,
  onProjectNameCommit,
  resolveMediaLibraryInternalDropItem,
  resolveStyleLibraryInternalDrop,
  onOpenMediaLibrary,
  modelModalState,
  agentChat,
  handleReferenceGridFiles,
  triggerFilePicker,
  resolveCharacterDropReference,
  resolveElementProfileImageDropSource,
  resolveVoiceChangerInternalReferenceSource,
  onSelectedStylePromptChange,
  onSelectedStyleContextChange,
}: AiStudioPageContentProps) {
  const resolvedReferenceGridFileInputRef = referenceGridFileInputRef;
  const resolvedCreateProperties = propertiesCreate;
  const resolvedReferenceGridProps = referenceGridProps;
  const selectedComingSoonTool = isComingSoonTool(selectedTool) ? selectedTool : null;
  const comingSoon = selectedComingSoonTool ? comingSoonCopy[selectedComingSoonTool] : null;
  const ComingSoonIcon = comingSoon ? comingSoon.icon : null;
  const referenceGridFileAccept = isPrimaryCharacterTool(selectedTool)
    ? "image/*"
    : "image/*,video/*,audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga";
  const propertiesPanelKind = resolvePropertiesPanelKind(selectedTool);
  const showExpertCreatePanel = Boolean(
    propertiesPanelKind === "create" &&
    resolvedCreateProperties.expertCreateUiEligible &&
    !resolvedCreateProperties.beginnerMode
  );
  const showExpertEditPanel = propertiesPanelKind === "edit";
  const showStylesPanelEligible = showExpertEditPanel || showExpertCreatePanel;
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
    styleDetailsById,
    error: styleDetailsSaveError,
    upsertStyleDetails,
    deleteStyleDetails,
  } = useStylesLibraryStyleDetailsPreference();
  const {
    deletedStyleIds,
    error: stylesDeleteError,
    deleteStyleId,
  } = useStylesLibraryDeletedStyleIdsPreference();
  const { setStylePanelIds, removeStylePanelId, stylePanelIds } =
    useStylesLibraryPanelIdsPreference();
  const seededStyleIds = React.useMemo(
    () => new Set(EXPERT_EDIT_STYLE_CATALOG.map((style) => style.id)),
    []
  );
  const stylesCatalogWithOverrides = React.useMemo(() => {
    const resolveStyleName = (style: {
      style?: string;
      title?: string;
      referenceImageName?: string;
    }): string => {
      return (
        style.style?.trim() ||
        style.title?.trim() ||
        style.referenceImageName?.trim() ||
        "Custom Style"
      );
    };
    const baseStyleIds = new Set(EXPERT_EDIT_STYLE_CATALOG.map((style) => style.id));
    const overrideEntries = Object.entries(styleDetailsById);

    const overriddenBaseStyles = EXPERT_EDIT_STYLE_CATALOG.map((style) => {
      if (style.placeholder) return style;
      const styleDetails = styleDetailsById[style.id];
      if (!styleDetails) return style;
      const resolvedStyleName = resolveStyleName(styleDetails);
      const resolvedPreviewUrl = styleDetails.previewImageUrl.trim() || style.previewUrl;
      return {
        ...style,
        style: resolvedStyleName,
        title: resolvedStyleName,
        referenceImageName: styleDetails.referenceImageName.trim() || resolvedStyleName,
        stylePrompt: styleDetails.stylePrompt.trim(),
        previewUrl: resolvedPreviewUrl,
      };
    });

    const customStyleTiles: ExpertEditStyleTile[] = overrideEntries
      .filter(([styleId]) => !baseStyleIds.has(styleId))
      .map(([styleId, styleDetails]) => {
        const resolvedStyleName = resolveStyleName(styleDetails);
        return {
          id: styleId,
          style: resolvedStyleName,
          title: resolvedStyleName,
          referenceImageName: styleDetails.referenceImageName.trim() || resolvedStyleName,
          stylePrompt: styleDetails.stylePrompt.trim(),
          previewUrl: styleDetails.previewImageUrl.trim() || null,
          placeholder: false,
        };
      });

    return [...overriddenBaseStyles, ...customStyleTiles];
  }, [styleDetailsById]);
  const visibleStylesCatalog = React.useMemo(() => {
    const deletedIdSet = deletedStyleIds.length > 0 ? new Set(deletedStyleIds) : null;
    const filteredStyles =
      deletedIdSet == null
        ? stylesCatalogWithOverrides
        : stylesCatalogWithOverrides.filter((style) => !deletedIdSet.has(style.id));
    return resolveOrderedStylesCatalog(filteredStyles, stylePanelIds);
  }, [deletedStyleIds, stylePanelIds, stylesCatalogWithOverrides]);
  const handleDeleteStyle = React.useCallback(
    async (styleId: string): Promise<boolean> => {
      const normalizedStyleId = styleId.trim();
      if (!normalizedStyleId) return false;
      if (seededStyleIds.has(normalizedStyleId)) {
        return deleteStyleId(normalizedStyleId);
      }
      const deleted = await deleteStyleDetails(normalizedStyleId);
      if (!deleted) return false;
      void removeStylePanelId(normalizedStyleId);
      return true;
    },
    [deleteStyleDetails, deleteStyleId, removeStylePanelId, seededStyleIds]
  );
  const handleReorderStyle = React.useCallback(
    (sourceStyleId: string, targetStyleId: string) => {
      const nextOrder = reorderStylesLibraryOrderedIds(
        visibleStylesCatalog.map((style) => style.id),
        sourceStyleId,
        targetStyleId
      );
      void setStylePanelIds(nextOrder);
    },
    [setStylePanelIds, visibleStylesCatalog]
  );
  React.useEffect(() => {
    if (!selectedStyleId) return;
    const styleStillVisible = visibleStylesCatalog.some((style) => style.id === selectedStyleId);
    if (!styleStillVisible) {
      setSelectedStyleId(null);
    }
  }, [selectedStyleId, visibleStylesCatalog]);
  const selectedStylePrompt = React.useMemo(() => {
    if (!selectedStyleId) return null;
    const selectedStyle = visibleStylesCatalog.find((style) => style.id === selectedStyleId);
    const normalizedPrompt = selectedStyle?.stylePrompt?.trim() ?? "";
    return normalizedPrompt.length ? normalizedPrompt : null;
  }, [selectedStyleId, visibleStylesCatalog]);
  const selectedStyleContext = React.useMemo<StudioOutput["styleContext"] | null>(() => {
    if (!selectedStyleId) return null;
    const selectedStyle = visibleStylesCatalog.find((style) => style.id === selectedStyleId);
    if (!selectedStyle || selectedStyle.placeholder) return null;
    const styleName =
      selectedStyle.style?.trim() ||
      selectedStyle.title?.trim() ||
      selectedStyle.referenceImageName?.trim() ||
      null;
    const stylePrompt = selectedStyle.stylePrompt?.trim() || null;
    const stylePreviewImageUrl = selectedStyle.previewUrl?.trim() || null;
    if (!styleName && !stylePrompt) return null;
    return {
      applied: true,
      styleId: selectedStyle.id,
      styleName,
      stylePrompt,
      ...(stylePreviewImageUrl ? { stylePreviewImageUrl } : {}),
    };
  }, [selectedStyleId, visibleStylesCatalog]);
  React.useEffect(() => {
    onSelectedStylePromptChange?.(selectedStylePrompt);
  }, [onSelectedStylePromptChange, selectedStylePrompt]);
  React.useEffect(() => {
    onSelectedStyleContextChange?.(selectedStyleContext);
  }, [onSelectedStyleContextChange, selectedStyleContext]);
  const isPulseCreateMode = showExpertCreatePanel && expertCreateMode === "pulse";
  const isQuickSlotToggleAvailable = Boolean(
    resolvedReferenceGridProps.onAddCuratedReference &&
    resolvedReferenceGridProps.onRemoveCuratedReference &&
    resolvedReferenceGridProps.onReorderCuratedReference
  );
  const isStylesToggleAvailable =
    !isPrimaryCharacterPanelOpen && showStylesPanelEligible && !isPulseCreateMode;
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
        : showExpertCreatePanel
          ? AI_SHELL_LEFT_EXPERT_CREATE_MIN_PX
          : showExpertEditPanel
            ? AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX
            : undefined;
  const maxLeftWidthPx = showExpertCreatePanel ? AI_SHELL_LEFT_EXPERT_CREATE_MAX_PX : undefined;
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
    showExpertCreatePanel ? "ai-shell-expert-create" : "",
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
    const isEditToolSelected = selectedTool === "edit";
    const isCharacterShellToolSelected =
      selectedTool === "character" || selectedTool === "elements";
    const isSoundToolSelected = isSoundWorkflow(selectedTool);
    const shouldResetForCharacterShellSelection =
      isCharacterShellToolSelected && previousSelectedTool !== selectedTool;
    if (shouldResetForCharacterShellSelection) {
      collapseToMin();
      previousSelectedToolRef.current = selectedTool;
      previousExpertCreateModeRef.current = expertCreateMode;
      previousSessionIdRef.current = sessionId;
      return;
    }
    const shouldCollapseForEditSelection =
      isEditToolSelected && previousSelectedTool !== selectedTool;
    if (shouldCollapseForEditSelection) {
      collapseToMin();
      previousSelectedToolRef.current = selectedTool;
      previousExpertCreateModeRef.current = expertCreateMode;
      previousSessionIdRef.current = sessionId;
      return;
    }
    const shouldCollapseForStandardCreateSession = shouldCollapseExpertCreateOnSessionChange({
      previousSessionId,
      nextSessionId: sessionId,
      nextTool: selectedTool,
      nextMode: expertCreateMode,
      expertCreateEnabled: showExpertCreatePanel,
    });
    if (shouldCollapseForStandardCreateSession) {
      collapseToMin();
      previousSelectedToolRef.current = selectedTool;
      previousExpertCreateModeRef.current = expertCreateMode;
      previousSessionIdRef.current = sessionId;
      return;
    }
    const expertCreateShellResizeAction = resolveExpertCreateShellResizeAction({
      previousTool: previousSelectedTool,
      nextTool: selectedTool,
      previousMode: previousExpertCreateMode,
      nextMode: expertCreateMode,
      expertCreateEnabled: showExpertCreatePanel,
    });
    const isInitialSoundSelection =
      previousSelectedTool !== selectedTool &&
      isSoundToolSelected &&
      !isSoundWorkflow(previousSelectedTool);
    if (isInitialSoundSelection) {
      resetToDefaultWidth();
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
    showExpertCreatePanel,
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
  const resolvedCreatePropertiesWithStyles = React.useMemo(
    () => ({
      ...resolvedCreateProperties,
      isStylesPanelOpen,
      onStylesPanelToggle: handleStylesPanelToggle,
      onOpenPresetsLibrary: () => handleToolSelection("presets"),
      selectedStyleId,
      stylesCatalog: visibleStylesCatalog,
      expertCreateMode,
      onExpertCreateModeChange: handleExpertCreateModeChange,
    }),
    [
      expertCreateMode,
      handleExpertCreateModeChange,
      handleToolSelection,
      handleStylesPanelToggle,
      isStylesPanelOpen,
      resolvedCreateProperties,
      selectedStyleId,
      visibleStylesCatalog,
    ]
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
    () => resolveExpertEditPresetCatalog(propertiesEditExpert.customPresetOverrides),
    [propertiesEditExpert.customPresetOverrides]
  );
  const handleSelectedPresetIdChange = React.useCallback((presetId: ExpertEditPresetId | null) => {
    setSelectedPresetId(presetId);
  }, []);
  const handlePresetOverrideSave = React.useCallback(
    (presetId: ExpertEditPresetId, override: ExpertEditPresetOverride): boolean => {
      const onCustomPresetOverridesChange = propertiesEditExpert.onCustomPresetOverridesChange;
      if (!onCustomPresetOverridesChange) return false;
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
  const isTargetInsideQuickSlot = React.useCallback((target: EventTarget | null): boolean => {
    const element = getEventTargetElement(target);
    return Boolean(element?.closest(".reference-curated-section"));
  }, []);

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
    source: "client.ai_studio.character_error_banner",
    scope: "app",
    severity: "medium",
    message: characterError,
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
    if (showExpertCreatePanel && expertCreateMode === "pulse") {
      return (
        <PulseCreatePropertiesPanel
          {...(resolvedCreatePropertiesWithStyles as PulseCreatePropertiesPanelProps)}
        />
      );
    }
    return (
      <>
        <StandardCreatePropertiesPanel {...resolvedCreatePropertiesWithStyles} />
        {!showExpertCreatePanel ? (
          <ComposeSendCard
            {...resolvedCreatePropertiesWithStyles}
            onGenerate={resolvedCreatePropertiesWithStyles.onGenerate}
          />
        ) : null}
      </>
    );
  }, [expertCreateMode, resolvedCreatePropertiesWithStyles, showExpertCreatePanel]);
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
        beginnerMode={beginnerMode}
        createRequestKey={characterCreateRequestKey}
        resolveCharacterDropReference={resolveCharacterDropReference}
      />
    ),
    [beginnerMode, characterCreateRequestKey, resolveCharacterDropReference]
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
      />
    ),
    [
      elementCreateRequestKey,
      projectId,
      resolveElementProfileImageDropSource,
      resolveMediaLibraryInternalDropItem,
    ]
  );
  const stylesPropertiesPanelContent = React.useMemo(
    () => (
      <StylesLibraryPanel
        styles={visibleStylesCatalog}
        selectedStyleId={selectedStyleId}
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
      selectedStyleId,
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
        />
      ) : (
        <p className="tiny subdued">Media Library panel is unavailable.</p>
      ),
    [
      onAddLibraryMediaReference,
      onAddLibraryPromptReference,
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
          return <SoundPropertiesPanel />;
        case "sound-effects":
          return <SoundEffectsPropertiesPanel {...propertiesSoundEffects} />;
        case "voices":
          return (
            <VoicesPropertiesPanel
              selectedTool={selectedTool}
              {...propertiesVoices}
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
      mediaLibraryPropertiesPanelContent,
      propertiesMusic,
      propertiesSoundEffects,
      propertiesVoices,
      resolveVoiceChangerInternalReferenceSource,
      presetsPropertiesPanelContent,
      selectedTool,
      stylesPropertiesPanelContent,
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
      beginnerMode={beginnerMode}
      showBeginnerModeToggle={showBeginnerModeToggle}
      onOpenProjects={onOpenProjects}
      onSelectTool={handleToolSelection}
      onToggleCreateTools={onToggleCreateTools}
      onBeginnerModeChange={onBeginnerModeChange}
    />
  ) : (
    <AiStudioToolbar
      selectedTool={selectedTool}
      showCreateTools={showCreateTools}
      beginnerMode={beginnerMode}
      showBeginnerModeToggle={showBeginnerModeToggle}
      onOpenProjects={onOpenProjects}
      onSelectTool={handleToolSelection}
      onToggleCreateTools={onToggleCreateTools}
      onToggleBeginnerMode={onBeginnerModeChange}
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
    shouldBypassCapture: (event, context) => {
      const payloadKind = context.payload?.kind;
      if (isTargetInsideQuickSlot(event.target)) {
        if (payloadKind === "libraryMedia" || payloadKind === "libraryPrompt") {
          return true;
        }
        return false;
      }
      return false;
    },
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
        data-beginner-mode={beginnerMode ? "on" : "off"}
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
          characterError={characterError}
          visibleFailures={visibleFailures}
          onDismissUiError={onDismissUiError}
          onDismissUiNotice={onDismissUiNotice}
          onDismissCharacterError={onDismissCharacterError}
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
              agentChat={agentChat}
              referenceGridProps={resolvedReferenceGridPropsWithStylesPanel}
              studioPreviewProps={studioPreviewProps}
              handleReferenceGridFiles={handleReferenceGridFiles}
              triggerFilePicker={triggerFilePicker}
              onOpenMediaLibrary={onOpenMediaLibrary}
              beginnerMode={beginnerMode}
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
      />
      <DetailModal
        output={detailModalOutput}
        context={detailModalContext}
        onClose={onDetailClose}
        onUpdatePrompt={onUpdateOutputPrompt}
        onDeleteOutput={onDeleteOutput}
        onDownloadReference={onDetailDownload}
        onSaveReference={onDetailSaveReference}
        onSavePrompt={onDetailSavePrompt}
        refreshCharacterOptions={refreshCharacterOptions}
        resolveCharacterAvatarUrlById={resolveCharacterAvatarUrlById}
      />
    </>
  );
}
