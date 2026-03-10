/**
 * AI Studio page layout (presentational only).
 * Receives a prepared view model from the page and renders toolbar, panels, previews, and system banners.
 */
import React from "react";
import { Eye, FlowArrow, Globe, type IconProps, SquaresFour, StackSimple } from "phosphor-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { AiStudioToolbar } from "./AiStudioToolbar";
import { AiStudioToolbarRail } from "./AiStudioToolbarRail";
import { CreatePropertiesPanel, ComposeSendCard } from "./CreatePropertiesPanel";
import { DetailModal } from "./DetailModal";
import { ModelModal, type ModelModalContext } from "./ModelModal";
import { AiStudioShellFrame } from "./AiStudioShellFrame";
import { EditPropertiesPanel } from "./EditPropertiesPanel";
import { ExpertEditPanelView } from "./edit/ExpertEditPanelView";
import { EXPERT_EDIT_STYLE_CATALOG, type ExpertEditStyleTile } from "./edit/expertEditStyles";
import { StudioPreview } from "./StudioPreview";
import type { ModelOption } from "../constants";
import { CharacterPanel } from "./CharacterPanel";
import { CanvasPropertiesPanel } from "./canvas/CanvasPropertiesPanel";
import { StylesLibraryPanel } from "./StylesLibraryPanel";
import { PresetsLibraryPanel } from "./PresetsLibraryPanel";
import { VideoPropertiesPanel } from "./VideoPropertiesPanel";
import { MediaLibraryPanel } from "./MediaLibraryPanel";
import { useAiStudioShellResize } from "../hooks/useAiStudioShellResize";
import { useAiStudioShellDndController } from "../hooks/useAiStudioShellDndController";
import { useStylesLibraryDeletedStyleIdsPreference } from "../hooks/useStylesLibraryDeletedStyleIdsPreference";
import { useStylesLibraryStyleDetailsPreference } from "../hooks/useStylesLibraryStyleDetailsPreference";
import type { ResolveCharacterDropReference } from "../../character-manager/components/CharacterManagerShell";
import type { CanvasPropertiesPanelProps } from "./canvas/useAiStudioCanvasWorkspaceState";
import type {
  AgentActions,
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
  AgentOutputGenerateInput,
} from "../../ai-agent/types";
import type { StudioOutput, ToolId } from "../types";
import type { ReferenceGridProps } from "./ReferenceGrid";
import { resolvePropertiesPanelKind } from "../logic/propertiesPanelRouting";
import { isPrimaryCharacterTool } from "../logic/primaryCharacterTool";
import { isCreateWorkflow } from "../logic/workflowIdentity";
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
  AI_SHELL_LEFT_CANVAS_DEFAULT_RATIO,
  AI_SHELL_LEFT_EXPERT_CREATE_MAX_PX,
  AI_SHELL_LEFT_EXPERT_CREATE_MIN_PX,
  AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX,
  AI_SHELL_RIGHT_CANVAS_MIN_PX,
  shouldCollapseAiShellOnToolSelect,
} from "../logic/shellResize";
import { useOutputCounts } from "../hooks/aiStudioOutputStore";
import {
  createInitialWorkflowPanelVisibility,
  resolveEffectivePanelVisibility,
  resolveHeaderShortcutStateMap,
  resolvePanelVisibilityWorkflowKey,
  toggleWorkflowPanelVisibilityByShortcut,
  type HeaderShortcutId,
  type WorkflowPanelVisibilityByWorkflow,
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
import type { InternalReferenceDragPayload } from "../utils/dragDrop";

type FailureCard = Pick<
  StudioOutput,
  "id" | "model" | "modelId" | "prompt" | "errorMessage" | "errorDetail"
>;

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
  { id: "canvas", label: "Canvas" },
  { id: "quick-slot-inventory", label: "Quick Slot Inventory" },
  { id: "reference-grid", label: "Reference Grid" },
  { id: "styles", label: "Styles" },
] as const;

type RightColumnDropMode = "none" | "text" | "media";
type PastedMediaReference = { url: string; mimeType?: string | null };
type LibraryMediaReferencePayload = {
  id: string;
  url: string;
  fileType: "image" | "video";
  originFolderId?: string | null;
  filename?: string | null;
  promptText?: string | null;
  source?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  previewUrl?: string | null;
  fullUrl?: string | null;
};
type LibraryPromptReferencePayload = {
  id: string;
  promptText: string;
  originFolderId?: string | null;
  title?: string | null;
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
const DROPPED_VIDEO_URL_PATTERN = /\.(m4v|mov|mp4|ogg|ogv|webm)(?:[?#].*)?$/i;

const parseDropUrlCandidate = (value: string): string | null => {
  const candidate = value.trim();
  if (!candidate || (typeof window !== "undefined" && candidate === window.location.href))
    return null;
  if (/^data:(image|video)\//i.test(candidate)) return candidate;
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
  if (/^data:(image|video)\//i.test(promptText)) return null;
  if (DROPPED_IMAGE_URL_PATTERN.test(promptText) || DROPPED_VIDEO_URL_PATTERN.test(promptText)) {
    return null;
  }
  return promptText;
};

const resolveRightColumnDropMode = (
  transfer: DataTransfer | null | undefined
): RightColumnDropMode => {
  if (!transfer) return "none";
  const types = Array.from(transfer.types || []).map((type) => type.toLowerCase());
  const libraryDragTypes = getMediaLibraryDragTypes().map((type) => type.toLowerCase());
  const fileCount = transfer.files?.length ?? 0;
  const hasFileType = types.includes("files");
  const hasLibraryDragType = libraryDragTypes.some((type) => types.includes(type));
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
  if (types.includes("text/reference-id")) return "none";
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
  if (transfer.getData("text/reference-id")) return { kind: "internal" };
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

type CreateSectionProps = React.ComponentProps<typeof CreatePropertiesPanel>;
type EditSectionProps = React.ComponentProps<typeof EditPropertiesPanel>;
type EditExpertSectionProps = React.ComponentProps<typeof ExpertEditPanelView>;
type VideoSectionProps = React.ComponentProps<typeof VideoPropertiesPanel>;
type CanvasSectionProps = CanvasPropertiesPanelProps;
const PERFORMANCE_DENSE_REFERENCE_COUNT = 40;
const FLAG_SHELL_DECOUPLE = PERF_FLAG_SHELL_DECOUPLE;
const FLAG_DND_BACKPRESSURE = PERF_FLAG_SHELL_DND_BACKPRESSURE;
const FLAG_PANEL_MEMOIZATION = PERF_FLAG_SHELL_PANEL_MEMOIZATION;
const FLAG_SHELL_BOUNDARY_SPLIT = PERF_FLAG_SHELL_BOUNDARY_SPLIT;
const FLAG_HIGH_DENSITY_SHELL_MODE = PERF_FLAG_SHELL_HIGH_DENSITY_MODE;

type AgentChatProps = {
  isOpen: boolean;
  agentMessages: AgentMessage[];
  agentActions?: AgentActions;
  agentInput: string;
  agentIsSending: boolean;
  latestAgentPrompt: string | null;
  agentPrimarySource?: "agent" | "manual" | "reference";
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
  onAgentApplyPrompt?: (prompt: string) => void;
  onAgentSelectVariation?: (prompt: string) => void;
  onAgentDescribeTargets?: (targets: string[]) => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onGenerateFromOutputPrompt?: (request: AgentOutputGenerateInput) => void;
  outputGenerateCostCredits?: number | null;
  disableOutputGenerate?: boolean;
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
  return (
    <>
      {uiError ? (
        <AiStudioAlertBanner
          message={uiError}
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
          <div className="ai-error-stack-header">
            <p className="eyebrow" style={{ margin: 0, fontSize: "11px", opacity: 0.8 }}>
              Generation issues
            </p>
            <span className="error-count-pill">{visibleFailures.length}</span>
          </div>
          <div className="ai-error-card-grid">
            {visibleFailures.map((item) => {
              const modelLabel = item.model || item.modelId || "Generation";
              return (
                <div key={item.id} className="ai-error-card">
                  <div className="ai-error-card-body">
                    <p className="ai-error-card-title">{modelLabel}</p>
                    <p className="ai-error-card-message">{item.errorDetail ?? item.errorMessage}</p>
                    <p className="ai-error-card-meta">
                      Prompt: <span className="ai-error-card-prompt">{item.prompt}</span>
                    </p>
                  </div>
                  <div className="ai-error-card-actions">
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => onDismissFailure(item.id)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
});

export type AiStudioPageContentProps = {
  referenceGridFileInputRef: React.RefObject<HTMLInputElement>;
  /**
   * @deprecated Use `referenceGridFileInputRef`.
   */
  referenceCanvasFileInputRef?: React.RefObject<HTMLInputElement>;
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
  showCreateTools: boolean;
  onSelectTool: (tool: ToolId | null) => void;
  onToggleCreateTools: (value: boolean) => void;
  propertiesCreate: CreateSectionProps;
  /**
   * @deprecated Use `propertiesCreate`.
   */
  propertiesText?: CreateSectionProps;
  propertiesImage: EditSectionProps;
  propertiesEditExpert: EditExpertSectionProps;
  propertiesVideo: VideoSectionProps;
  propertiesCanvas: CanvasSectionProps;
  railCanvasProps?: CanvasSectionProps;
  isTemplateView: boolean;
  referenceGridProps: ReferenceGridProps;
  /**
   * @deprecated Use `referenceGridProps`.
   */
  referenceCanvasProps?: ReferenceGridProps;
  studioPreviewProps: React.ComponentProps<typeof StudioPreview>;
  detailModalOutput: StudioOutput | null;
  onDetailClose: () => void;
  onUpdateOutputPrompt: (id: string, prompt: string) => void;
  onDeleteOutput: (id: string) => void;
  onDetailDownload?: (id: string) => void;
  onDetailSavePrompt?: (promptText: string) => void;
  onAddLibraryMediaReference?: (payload: LibraryMediaReferencePayload) => void;
  onAddLibraryPromptReference?: (payload: LibraryPromptReferencePayload) => void;
  resolveMediaLibraryInternalDropItem?: (payload: InternalReferenceDragPayload) => Promise<{
    kind: "media" | "prompt";
    id: string;
  } | null>;
  onOpenMediaLibrary?: () => void;
  modelModalState: {
    isOpen: boolean;
    position: { top: number; left: number } | null;
    options: ModelOption[];
    resolveCreditsForModel?: (modelId: string) => number | null;
    onClose: () => void;
    onSelect: (value: string) => void;
    anchorId?: string | null;
    context?: ModelModalContext | null;
  };
  agentChat: AgentChatProps;
  handleReferenceGridFiles: (files: FileList) => void;
  /**
   * @deprecated Use `handleReferenceGridFiles`.
   */
  handleReferenceCanvasFiles?: (files: FileList) => void;
  triggerFilePicker: () => void;
  resolveCharacterDropReference?: ResolveCharacterDropReference;
  onSelectedStylePromptChange?: (stylePrompt: string | null) => void;
};

export function AiStudioPageContent({
  referenceGridFileInputRef,
  referenceCanvasFileInputRef,
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
  showCreateTools,
  onSelectTool,
  onToggleCreateTools,
  propertiesCreate,
  propertiesText,
  propertiesImage,
  propertiesEditExpert,
  propertiesVideo,
  propertiesCanvas,
  railCanvasProps,
  isTemplateView,
  referenceGridProps,
  referenceCanvasProps,
  studioPreviewProps,
  detailModalOutput,
  onDetailClose,
  onUpdateOutputPrompt,
  onDeleteOutput,
  onDetailDownload,
  onDetailSavePrompt,
  onAddLibraryMediaReference,
  onAddLibraryPromptReference,
  resolveMediaLibraryInternalDropItem,
  onOpenMediaLibrary,
  modelModalState,
  agentChat,
  handleReferenceGridFiles,
  handleReferenceCanvasFiles,
  triggerFilePicker,
  resolveCharacterDropReference,
  onSelectedStylePromptChange,
}: AiStudioPageContentProps) {
  const resolvedReferenceGridFileInputRef =
    referenceGridFileInputRef ?? referenceCanvasFileInputRef;
  const resolvedCreateProperties = propertiesCreate ?? propertiesText;
  const resolvedReferenceGridProps = referenceGridProps ?? referenceCanvasProps;
  const resolvedHandleReferenceGridFiles = handleReferenceGridFiles ?? handleReferenceCanvasFiles;
  const selectedComingSoonTool = isComingSoonTool(selectedTool) ? selectedTool : null;
  const comingSoon = selectedComingSoonTool ? comingSoonCopy[selectedComingSoonTool] : null;
  const ComingSoonIcon = comingSoon ? comingSoon.icon : null;
  const referenceGridFileAccept = isPrimaryCharacterTool(selectedTool)
    ? "image/*"
    : "image/*,video/*";
  const propertiesPanelKind = resolvePropertiesPanelKind(selectedTool);
  const showExpertCreatePanel = Boolean(
    propertiesPanelKind === "create" &&
    resolvedCreateProperties.expertCreateUiEligible &&
    !resolvedCreateProperties.beginnerMode
  );
  const showExpertEditPanel =
    propertiesPanelKind === "edit" && propertiesEditExpert.expertEditEligible;
  const showStylesPanelEligible = showExpertEditPanel || showExpertCreatePanel;
  const isPrimaryCharacterPanelOpen = isPrimaryCharacterTool(selectedTool);
  const [panelVisibilityByWorkflow, setPanelVisibilityByWorkflow] =
    React.useState<WorkflowPanelVisibilityByWorkflow>(createInitialWorkflowPanelVisibility);
  const [selectedStyleId, setSelectedStyleId] = React.useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = React.useState<ExpertEditPresetId | null>(null);
  const {
    styleDetailsById,
    error: styleDetailsSaveError,
    upsertStyleDetails,
  } = useStylesLibraryStyleDetailsPreference();
  const {
    deletedStyleIds,
    error: stylesDeleteError,
    deleteStyleId,
  } = useStylesLibraryDeletedStyleIdsPreference();
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
        styleProfile: styleDetails.styleProfile,
        extractionMeta: styleDetails.extractionMeta,
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
          styleProfile: styleDetails.styleProfile,
          extractionMeta: styleDetails.extractionMeta,
          previewUrl: styleDetails.previewImageUrl.trim() || null,
          placeholder: false,
        };
      });

    return [...overriddenBaseStyles, ...customStyleTiles];
  }, [styleDetailsById]);
  const visibleStylesCatalog = React.useMemo(() => {
    if (deletedStyleIds.length === 0) return stylesCatalogWithOverrides;
    const deletedIdSet = new Set(deletedStyleIds);
    return stylesCatalogWithOverrides.filter((style) => !deletedIdSet.has(style.id));
  }, [deletedStyleIds, stylesCatalogWithOverrides]);
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
  React.useEffect(() => {
    onSelectedStylePromptChange?.(selectedStylePrompt);
  }, [onSelectedStylePromptChange, selectedStylePrompt]);
  const workflowPanelVisibilityKey = resolvePanelVisibilityWorkflowKey(selectedTool);
  const workflowPanelVisibility = panelVisibilityByWorkflow[workflowPanelVisibilityKey];
  const isQuickSlotToggleAvailable = Boolean(
    resolvedReferenceGridProps.onAddCuratedReference &&
    resolvedReferenceGridProps.onRemoveCuratedReference &&
    resolvedReferenceGridProps.onReorderCuratedReference
  );
  const isCanvasToggleAvailable =
    !isPrimaryCharacterPanelOpen && Boolean(railCanvasProps) && selectedTool !== "canvas";
  const isStylesToggleAvailable = !isPrimaryCharacterPanelOpen && showStylesPanelEligible;
  const panelToggleAvailability = React.useMemo(
    () => ({
      canvas: isCanvasToggleAvailable,
      quickSlot: isQuickSlotToggleAvailable,
      styles: isStylesToggleAvailable,
    }),
    [isCanvasToggleAvailable, isQuickSlotToggleAvailable, isStylesToggleAvailable]
  );
  const effectivePanelVisibility = React.useMemo(() => {
    if (isPrimaryCharacterPanelOpen) {
      return {
        canvas: false,
        quickSlot: isQuickSlotToggleAvailable,
        referenceGrid: true,
        styles: false,
      };
    }
    const baseVisibility = resolveEffectivePanelVisibility({
      workflowVisibility: workflowPanelVisibility,
      availability: panelToggleAvailability,
    });
    if (selectedTool === "styles") {
      return {
        canvas: false,
        quickSlot: false,
        referenceGrid: true,
        styles: false,
      };
    }
    return baseVisibility;
  }, [
    isPrimaryCharacterPanelOpen,
    isQuickSlotToggleAvailable,
    panelToggleAvailability,
    selectedTool,
    workflowPanelVisibility,
  ]);
  const isStylesPanelOpen = effectivePanelVisibility.styles;
  const headerShortcutStates = React.useMemo(
    () =>
      resolveHeaderShortcutStateMap({
        effectiveVisibility: effectivePanelVisibility,
        availability: panelToggleAvailability,
      }),
    [effectivePanelVisibility, panelToggleAvailability]
  );
  const handleHeaderShortcutToggle = React.useCallback(
    (shortcutId: HeaderShortcutId) => {
      setPanelVisibilityByWorkflow((previous) => {
        return toggleWorkflowPanelVisibilityByShortcut({
          byWorkflow: previous,
          workflowKey: workflowPanelVisibilityKey,
          shortcutId,
          availability: panelToggleAvailability,
        });
      });
    },
    [panelToggleAvailability, workflowPanelVisibilityKey]
  );
  const { activeCount } = useOutputCounts();
  const isPerformanceDenseSession =
    FLAG_HIGH_DENSITY_SHELL_MODE && activeCount >= PERFORMANCE_DENSE_REFERENCE_COUNT;
  const minLeftWidthPx = isPrimaryCharacterPanelOpen
    ? AI_SHELL_LEFT_CHARACTER_MIN_PX
    : showExpertCreatePanel
      ? AI_SHELL_LEFT_EXPERT_CREATE_MIN_PX
      : showExpertEditPanel
        ? AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX
        : undefined;
  const maxLeftWidthPx = showExpertCreatePanel ? AI_SHELL_LEFT_EXPERT_CREATE_MAX_PX : undefined;
  const minRightWidthPx = selectedTool === "canvas" ? AI_SHELL_RIGHT_CANVAS_MIN_PX : undefined;
  const defaultLeftRatio =
    selectedTool === "canvas" ? AI_SHELL_LEFT_CANVAS_DEFAULT_RATIO : undefined;
  const {
    shellRef,
    leftColumnRef,
    showDivider,
    isResizing,
    shellStyle,
    collapseToMin,
    dividerProps,
    rightColumnHidden,
  } = useAiStudioShellResize({
    enabled: Boolean(selectedTool),
    minLeftWidthPx,
    maxLeftWidthPx,
    minRightWidthPx,
    defaultLeftRatio,
  });
  const shellClassName = [
    "ai-shell",
    selectedTool ? "" : "ai-shell-wide",
    showDivider ? "ai-shell-resizable" : "",
    showExpertCreatePanel ? "ai-shell-expert-create" : "",
    isPrimaryCharacterPanelOpen ? "ai-shell-character-open" : "",
    isPerformanceDenseSession ? "ai-shell-performance-dense" : "",
    isResizing ? "ai-shell-resizing" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const previousSelectedToolRef = React.useRef<ToolId | null>(selectedTool);
  React.useEffect(() => {
    const previousSelectedTool = previousSelectedToolRef.current;
    // Expert Create should always open at its minimum left width when Create is selected.
    const isCreateToolSelected = isCreateWorkflow(selectedTool);
    const shouldCollapseForExpertCreateSelection = showExpertCreatePanel && isCreateToolSelected;
    const isInitialCanvasSelection = previousSelectedTool == null && selectedTool === "canvas";
    if (
      (!isInitialCanvasSelection &&
        shouldCollapseAiShellOnToolSelect(previousSelectedTool, selectedTool)) ||
      shouldCollapseForExpertCreateSelection
    ) {
      collapseToMin();
    }
    previousSelectedToolRef.current = selectedTool;
  }, [collapseToMin, selectedTool, showExpertCreatePanel]);
  const rightColumnRef = React.useRef<HTMLDivElement | null>(null);
  const handleStylesPanelToggle = React.useCallback(() => {
    setPanelVisibilityByWorkflow((previous) => {
      return toggleWorkflowPanelVisibilityByShortcut({
        byWorkflow: previous,
        workflowKey: workflowPanelVisibilityKey,
        shortcutId: "styles",
        availability: panelToggleAvailability,
      });
    });
  }, [panelToggleAvailability, workflowPanelVisibilityKey]);
  const handleSelectedStyleIdChange = React.useCallback(
    (styleId: string | null) => {
      setSelectedStyleId(styleId);
      setPanelVisibilityByWorkflow((previous) => {
        const workflowState = previous[workflowPanelVisibilityKey];
        if (!workflowState?.styles) return previous;
        return {
          ...previous,
          [workflowPanelVisibilityKey]: {
            ...workflowState,
            styles: false,
          },
        };
      });
    },
    [workflowPanelVisibilityKey]
  );
  const resolvedExpertEditProperties = React.useMemo(
    () => ({
      ...propertiesEditExpert,
      isStylesPanelOpen,
      onStylesPanelToggle: handleStylesPanelToggle,
      selectedStyleId,
      stylesCatalog: visibleStylesCatalog,
    }),
    [
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
      selectedStyleId,
      stylesCatalog: visibleStylesCatalog,
    }),
    [
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
  const isTargetInsideRailCanvas = React.useCallback((target: EventTarget | null): boolean => {
    const rightColumnNode = rightColumnRef.current;
    if (!rightColumnNode || !(target instanceof Node)) return false;
    const railCanvasViewport = rightColumnNode.querySelector('[data-canvas-instance="rail"]');
    return railCanvasViewport instanceof HTMLElement ? railCanvasViewport.contains(target) : false;
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

  const panelRegistry = React.useMemo(
    () => ({
      create: (
        <>
          <CreatePropertiesPanel
            {...resolvedCreatePropertiesWithStyles}
            agentChatOpen={agentChat.isOpen}
            onAgentEnhanceSend={resolvedCreatePropertiesWithStyles.onAgentEnhanceSend}
          />
          {!showExpertCreatePanel ? (
            <ComposeSendCard
              {...resolvedCreatePropertiesWithStyles}
              onGenerate={resolvedCreatePropertiesWithStyles.onGenerate}
            />
          ) : null}
        </>
      ),
      edit: showExpertEditPanel ? (
        <ExpertEditPanelView {...resolvedExpertEditProperties} />
      ) : (
        <EditPropertiesPanel {...propertiesImage} />
      ),
      video: <VideoPropertiesPanel {...propertiesVideo} />,
      canvas: <CanvasPropertiesPanel {...propertiesCanvas} />,
      character: (
        <CharacterPanel
          beginnerMode={beginnerMode}
          resolveCharacterDropReference={resolveCharacterDropReference}
        />
      ),
      presets: (
        <PresetsLibraryPanel
          presets={presetsLibraryCatalog}
          selectedPresetId={selectedPresetId}
          onSelectPreset={handleSelectedPresetIdChange}
          onSavePresetOverride={handlePresetOverrideSave}
        />
      ),
      styles: (
        <StylesLibraryPanel
          styles={visibleStylesCatalog}
          selectedStyleId={selectedStyleId}
          onSaveStyleDetails={upsertStyleDetails}
          saveError={styleDetailsSaveError}
          onDeleteStyle={deleteStyleId}
          deleteError={stylesDeleteError}
        />
      ),
      "media-library":
        onAddLibraryMediaReference && onAddLibraryPromptReference ? (
          <MediaLibraryPanel
            onSelectMedia={onAddLibraryMediaReference}
            onSelectPrompt={onAddLibraryPromptReference}
            resolveInternalDropItem={resolveMediaLibraryInternalDropItem}
          />
        ) : (
          <p className="tiny subdued">Media Library panel is unavailable.</p>
        ),
      none: null,
    }),
    [
      agentChat.isOpen,
      beginnerMode,
      propertiesImage,
      propertiesCanvas,
      resolvedCreatePropertiesWithStyles,
      resolvedExpertEditProperties,
      resolveCharacterDropReference,
      propertiesVideo,
      showExpertEditPanel,
      showExpertCreatePanel,
      presetsLibraryCatalog,
      selectedPresetId,
      handleSelectedPresetIdChange,
      handlePresetOverrideSave,
      selectedStyleId,
      upsertStyleDetails,
      styleDetailsSaveError,
      deleteStyleId,
      stylesDeleteError,
      visibleStylesCatalog,
      onAddLibraryMediaReference,
      onAddLibraryPromptReference,
      resolveMediaLibraryInternalDropItem,
    ]
  );
  const resolvePanelFromRegistry = React.useCallback(
    (kind: keyof typeof panelRegistry) => panelRegistry[kind],
    [panelRegistry]
  );
  const memoizedPropertiesPanelContent = React.useMemo(
    () => resolvePanelFromRegistry(propertiesPanelKind),
    [propertiesPanelKind, resolvePanelFromRegistry]
  );
  const propertiesPanelContent = FLAG_PANEL_MEMOIZATION
    ? memoizedPropertiesPanelContent
    : resolvePanelFromRegistry(propertiesPanelKind);
  const toolbarRail = FLAG_SHELL_BOUNDARY_SPLIT ? (
    <AiStudioToolbarRail
      selectedTool={selectedTool}
      showCreateTools={showCreateTools}
      beginnerMode={beginnerMode}
      showBeginnerModeToggle={showBeginnerModeToggle}
      onSelectTool={onSelectTool}
      onToggleCreateTools={onToggleCreateTools}
      onBeginnerModeChange={onBeginnerModeChange}
    />
  ) : (
    <AiStudioToolbar
      selectedTool={selectedTool}
      showCreateTools={showCreateTools}
      beginnerMode={beginnerMode}
      showBeginnerModeToggle={showBeginnerModeToggle}
      onSelectTool={onSelectTool}
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
    onDropFiles: resolvedHandleReferenceGridFiles,
    onDropMediaReference: resolvedReferenceGridPropsWithStylesPanel.onPasteMediaReference,
    onDropLibraryMediaReference: onAddLibraryMediaReference,
    onDropLibraryPromptReference: onAddLibraryPromptReference,
    onDropTextReference: resolvedReferenceGridPropsWithStylesPanel.onPasteTextReference,
    useRafBackpressure: FLAG_SHELL_DECOUPLE && FLAG_DND_BACKPRESSURE,
    shouldBypassCapture: (event, context) => {
      if (!isTargetInsideRailCanvas(event.target)) return false;
      const payloadKind = context.payload?.kind;
      if (payloadKind === "text" || payloadKind === "internal") return true;
      if (context.dropMode === "text") return true;
      return false;
    },
  });

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
                {AI_STUDIO_HEADER_SHORTCUT_BUTTONS.map((shortcut) => {
                  const buttonState = headerShortcutStates[shortcut.id];
                  return (
                    <button
                      key={shortcut.id}
                      type="button"
                      className="ai-hero-shortcut-button"
                      aria-pressed={buttonState.pressed}
                      disabled={buttonState.disabled}
                      onClick={() => handleHeaderShortcutToggle(shortcut.id)}
                    >
                      {shortcut.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="ai-hero-shortcut-icon-button"
                aria-label="Styles visibility"
              >
                <Eye size={16} weight="regular" aria-hidden="true" />
              </button>
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
              rightColumnHidden={rightColumnHidden}
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
              railCanvasProps={railCanvasProps}
              studioPreviewProps={studioPreviewProps}
              handleReferenceGridFiles={resolvedHandleReferenceGridFiles}
              triggerFilePicker={triggerFilePicker}
              onOpenMediaLibrary={onOpenMediaLibrary}
              beginnerMode={beginnerMode}
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
        position={modelModalState.position}
        onClose={modelModalState.onClose}
        onSelect={modelModalState.onSelect}
        options={modelModalState.options}
        resolveCreditsForModel={modelModalState.resolveCreditsForModel}
        anchorId={modelModalState.anchorId}
        context={modelModalState.context}
      />
      <DetailModal
        output={detailModalOutput}
        onClose={onDetailClose}
        onUpdatePrompt={onUpdateOutputPrompt}
        onDeleteOutput={onDeleteOutput}
        onDownloadReference={onDetailDownload}
        onSavePrompt={onDetailSavePrompt}
      />
    </>
  );
}
