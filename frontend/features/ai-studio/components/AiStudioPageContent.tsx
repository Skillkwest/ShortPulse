/**
 * AI Studio page layout (presentational only).
 * Receives a prepared view model from the page and renders toolbar, panels, previews, and system banners.
 */
import React from "react";
import Link from "next/link";
import {
  FolderSimple,
  FlowArrow,
  Globe,
  type IconProps,
  SquaresFour,
  StackSimple,
  UploadSimple,
} from "phosphor-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { AiStudioToolbar } from "./AiStudioToolbar";
import { TextPropertiesPanel, ComposeSendCard } from "./TextPropertiesPanel";
import { DetailModal } from "./DetailModal";
import { ModelModal, type ModelModalContext } from "./ModelModal";
import { ReferenceCanvas } from "./ReferenceCanvas";
import { EditPropertiesPanel } from "./EditPropertiesPanel";
import { StudioPreview } from "./StudioPreview";
import type { ModelOption } from "../constants";
import { CharacterPropertiesPanel } from "../../character/components/CharacterPropertiesPanel";
import { CharacterPanel } from "./CharacterPanel";
import { KlingComingSoonCard } from "./KlingComingSoonCard";
import { VideoPropertiesPanel } from "./VideoPropertiesPanel";
import { useAiStudioShellResize } from "../hooks/useAiStudioShellResize";
import { AgentChatPanel } from "../../../prefabs/agent";
import type { AgentActions, AgentAttachment, AgentMessage } from "../../ai-agent/types";
import type { StudioOutput, ToolId } from "../types";
import type { ReferenceCanvasProps } from "./ReferenceCanvas";
import { resolvePropertiesPanelKind } from "../logic/propertiesPanelRouting";
import { isPrimaryCharacterTool } from "../logic/primaryCharacterTool";
import {
  AI_SHELL_LEFT_CHARACTER_MIN_PX,
  AI_SHELL_LEFT_EXPERT_CREATE_MAX_PX,
  AI_SHELL_LEFT_EXPERT_CREATE_MIN_PX,
  shouldCollapseAiShellOnToolSelect,
} from "../logic/shellResize";

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

type RightColumnDropMode = "none" | "text" | "media";
type PastedMediaReference = { url: string; mimeType?: string | null };
type RightColumnDropPayload =
  | { kind: "none" }
  | { kind: "internal" }
  | { kind: "files"; files: FileList }
  | { kind: "media"; reference: PastedMediaReference }
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
  const fileCount = transfer.files?.length ?? 0;
  const hasFileType = types.includes("files");
  const hasTextLikeType = types.some(
    (type) =>
      type.includes("text") ||
      type.includes("plain") ||
      type.includes("prompt") ||
      type.includes("utf8")
  );
  if (types.includes("text/reference-id")) return "none";
  if (fileCount > 0) return "media";
  if (getDroppedMediaReference(transfer)) return "media";
  if (normalizeDroppedPromptText(transfer)) return "text";
  if (hasTextLikeType) return "text";
  if (types.length === 0 && fileCount === 0) return "text";
  // Some browsers report "Files" for custom text drags while exposing zero files.
  // Treat that as droppable so the right column stays pre-warmed.
  if (hasFileType && fileCount === 0) return "text";
  return "none";
};

const resolveRightColumnDropPayload = (transfer: DataTransfer): RightColumnDropPayload => {
  if (transfer.getData("text/reference-id")) return { kind: "internal" };
  const droppedFiles = transfer.files;
  if (droppedFiles && droppedFiles.length > 0) {
    return { kind: "files", files: droppedFiles };
  }
  const droppedMedia = getDroppedMediaReference(transfer);
  if (droppedMedia) {
    return { kind: "media", reference: droppedMedia };
  }
  const droppedPromptText = normalizeDroppedPromptText(transfer);
  if (droppedPromptText) {
    return { kind: "text", text: droppedPromptText };
  }
  return { kind: "none" };
};

type TextSectionProps = React.ComponentProps<typeof TextPropertiesPanel>;

type CharacterSectionProps = React.ComponentProps<typeof CharacterPropertiesPanel>;

type EditSectionProps = React.ComponentProps<typeof EditPropertiesPanel>;
type VideoSectionProps = React.ComponentProps<typeof VideoPropertiesPanel>;

type AgentChatProps = {
  isOpen: boolean;
  agentMessages: AgentMessage[];
  agentActions?: AgentActions;
  agentInput: string;
  agentIsSending: boolean;
  latestAgentPrompt: string | null;
  agentPrimarySource?: "agent" | "manual" | "reference";
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
  onGenerateFromOutputPrompt?: (prompt: string) => void;
  outputGenerateCostCredits?: number | null;
  disableOutputGenerate?: boolean;
};

export type AiStudioPageContentProps = {
  referenceCanvasFileInputRef: React.RefObject<HTMLInputElement>;
  onFileBrowserSelection: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uiError: string | null;
  uiNotice: string | null;
  characterError: string | null;
  onDismissUiError: () => void;
  onDismissUiNotice: () => void;
  onDismissCharacterError: () => void;
  beginnerMode: boolean;
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
  propertiesText: TextSectionProps;
  propertiesCharacter: CharacterSectionProps;
  propertiesImage: EditSectionProps;
  propertiesVideo: VideoSectionProps;
  isTemplateView: boolean;
  referenceCanvasProps: ReferenceCanvasProps;
  studioPreviewProps: React.ComponentProps<typeof StudioPreview>;
  detailModalOutput: StudioOutput | null;
  onDetailClose: () => void;
  onUpdateOutputPrompt: (id: string, prompt: string) => void;
  onDeleteOutput: (id: string) => void;
  onDetailDownload?: (id: string) => void;
  onDetailSavePrompt?: (promptText: string) => void;
  onOpenMediaLibrary?: () => void;
  modelModalState: {
    isOpen: boolean;
    position: { top: number; left: number } | null;
    options: ModelOption[];
    onClose: () => void;
    onSelect: (value: string) => void;
    anchorId?: string | null;
    context?: ModelModalContext | null;
  };
  agentChat: AgentChatProps;
  handleReferenceCanvasFiles: (files: FileList) => void;
  triggerFilePicker: () => void;
};

export function AiStudioPageContent({
  referenceCanvasFileInputRef,
  onFileBrowserSelection,
  uiError,
  uiNotice,
  characterError,
  onDismissUiError,
  onDismissUiNotice,
  onDismissCharacterError,
  beginnerMode,
  onBeginnerModeChange,
  balanceCredits,
  pendingHoldCredits,
  balanceLoading,
  visibleFailures,
  onDismissFailure,
  selectedTool,
  showCreateTools,
  onSelectTool,
  onToggleCreateTools,
  propertiesText,
  propertiesCharacter,
  propertiesImage,
  propertiesVideo,
  isTemplateView,
  referenceCanvasProps,
  studioPreviewProps,
  detailModalOutput,
  onDetailClose,
  onUpdateOutputPrompt,
  onDeleteOutput,
  onDetailDownload,
  onDetailSavePrompt,
  onOpenMediaLibrary,
  modelModalState,
  agentChat,
  handleReferenceCanvasFiles,
  triggerFilePicker,
}: AiStudioPageContentProps) {
  void propertiesCharacter;
  const selectedComingSoonTool = isComingSoonTool(selectedTool) ? selectedTool : null;
  const comingSoon = selectedComingSoonTool ? comingSoonCopy[selectedComingSoonTool] : null;
  const ComingSoonIcon = comingSoon ? comingSoon.icon : null;
  const referenceCanvasFileAccept = isPrimaryCharacterTool(selectedTool)
    ? "image/*"
    : "image/*,video/*";
  const propertiesPanelKind = resolvePropertiesPanelKind(selectedTool);
  const showExpertCreatePanel = Boolean(
    propertiesPanelKind === "text" &&
    propertiesText.expertCreateUiEligible &&
    !propertiesText.beginnerMode
  );
  const isPrimaryCharacterPanelOpen = isPrimaryCharacterTool(selectedTool);
  const minLeftWidthPx = isPrimaryCharacterPanelOpen
    ? AI_SHELL_LEFT_CHARACTER_MIN_PX
    : showExpertCreatePanel
      ? AI_SHELL_LEFT_EXPERT_CREATE_MIN_PX
      : undefined;
  const maxLeftWidthPx = showExpertCreatePanel ? AI_SHELL_LEFT_EXPERT_CREATE_MAX_PX : undefined;
  const {
    shellRef,
    leftColumnRef,
    showDivider,
    isResizing,
    shellStyle,
    collapseToMin,
    dividerProps,
  } = useAiStudioShellResize({
    enabled: Boolean(selectedTool),
    minLeftWidthPx,
    maxLeftWidthPx,
  });
  const shellClassName = [
    "ai-shell",
    selectedTool ? "" : "ai-shell-wide",
    showDivider ? "ai-shell-resizable" : "",
    showExpertCreatePanel ? "ai-shell-expert-create" : "",
    isPrimaryCharacterPanelOpen ? "ai-shell-character-open" : "",
    isResizing ? "ai-shell-resizing" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const previousSelectedToolRef = React.useRef<ToolId | null>(selectedTool);
  React.useEffect(() => {
    const previousSelectedTool = previousSelectedToolRef.current;
    if (shouldCollapseAiShellOnToolSelect(previousSelectedTool, selectedTool)) {
      collapseToMin();
    }
    previousSelectedToolRef.current = selectedTool;
  }, [collapseToMin, selectedTool]);
  const rightColumnRef = React.useRef<HTMLDivElement | null>(null);
  const rightColumnDragDepthRef = React.useRef(0);
  const [rightColumnDropMode, setRightColumnDropMode] = React.useState<RightColumnDropMode>("none");
  const clearRightColumnDropState = React.useCallback(() => {
    rightColumnDragDepthRef.current = 0;
    setRightColumnDropMode("none");
  }, []);

  const renderProperties = () => {
    switch (propertiesPanelKind) {
      case "text":
        return (
          <>
            <TextPropertiesPanel
              {...propertiesText}
              agentChatOpen={agentChat.isOpen}
              onAgentEnhanceSend={propertiesText.onAgentEnhanceSend}
            />
            {!showExpertCreatePanel ? (
              <ComposeSendCard {...propertiesText} onGenerate={propertiesText.onGenerate} />
            ) : null}
          </>
        );
      case "character":
        return <CharacterPanel beginnerMode={beginnerMode} />;
      case "edit":
        return <EditPropertiesPanel {...propertiesImage} />;
      case "video":
        return <VideoPropertiesPanel {...propertiesVideo} />;
      case "kling":
        return <KlingComingSoonCard />;
      case "canvas":
        return <CharacterPanel beginnerMode={beginnerMode} />;
      default:
        return null;
    }
  };

  const handleRightColumnDragEnterCapture = (event: React.DragEvent<HTMLElement>) => {
    const nextMode = resolveRightColumnDropMode(event.dataTransfer);
    if (nextMode === "none") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    rightColumnDragDepthRef.current += 1;
    setRightColumnDropMode((currentMode) => (currentMode === nextMode ? currentMode : nextMode));
  };

  const handleRightColumnDragOverCapture = (event: React.DragEvent<HTMLElement>) => {
    const nextMode = resolveRightColumnDropMode(event.dataTransfer);
    if (nextMode === "none") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setRightColumnDropMode((currentMode) => (currentMode === nextMode ? currentMode : nextMode));
  };

  const handleRightColumnDragLeaveCapture = (event: React.DragEvent<HTMLElement>) => {
    if (rightColumnDropMode === "none") return;
    event.preventDefault();
    rightColumnDragDepthRef.current = Math.max(0, rightColumnDragDepthRef.current - 1);
    if (rightColumnDragDepthRef.current === 0) {
      setRightColumnDropMode("none");
    }
  };

  const handleRightColumnDropCapture = (event: React.DragEvent<HTMLElement>) => {
    const dropPayload = resolveRightColumnDropPayload(event.dataTransfer);
    if (dropPayload.kind === "none" || dropPayload.kind === "internal") {
      clearRightColumnDropState();
      return;
    }
    if (dropPayload.kind === "files") {
      event.preventDefault();
      event.stopPropagation();
      handleReferenceCanvasFiles(dropPayload.files);
      clearRightColumnDropState();
      return;
    }
    if (dropPayload.kind === "media" && referenceCanvasProps.onPasteMediaReference) {
      event.preventDefault();
      event.stopPropagation();
      referenceCanvasProps.onPasteMediaReference(dropPayload.reference);
      clearRightColumnDropState();
      return;
    }
    if (dropPayload.kind === "text" && referenceCanvasProps.onPasteTextReference) {
      event.preventDefault();
      event.stopPropagation();
      referenceCanvasProps.onPasteTextReference(dropPayload.text);
      clearRightColumnDropState();
      return;
    }
    clearRightColumnDropState();
  };

  const shouldHandleShellRightColumnFallback = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const rightColumnNode = rightColumnRef.current;
      const shellNode = shellRef.current;
      if (!rightColumnNode || !shellNode) return false;
      if (event.target instanceof Node && rightColumnNode.contains(event.target)) return false;
      const shellRect = shellNode.getBoundingClientRect();
      const rightRect = rightColumnNode.getBoundingClientRect();
      const { clientX, clientY } = event;
      return (
        clientX >= rightRect.left &&
        clientX <= rightRect.right &&
        clientY >= shellRect.top &&
        clientY <= shellRect.bottom
      );
    },
    [shellRef]
  );

  const handleShellDragOverCapture = (event: React.DragEvent<HTMLElement>) => {
    if (!shouldHandleShellRightColumnFallback(event)) return;
    handleRightColumnDragOverCapture(event);
  };

  const handleShellDropCapture = (event: React.DragEvent<HTMLElement>) => {
    if (!shouldHandleShellRightColumnFallback(event)) return;
    handleRightColumnDropCapture(event);
  };

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const handleDocumentDragTermination = () => {
      clearRightColumnDropState();
    };
    document.addEventListener("dragend", handleDocumentDragTermination);
    document.addEventListener("drop", handleDocumentDragTermination);
    return () => {
      document.removeEventListener("dragend", handleDocumentDragTermination);
      document.removeEventListener("drop", handleDocumentDragTermination);
    };
  }, [clearRightColumnDropState]);

  return (
    <>
      <main
        className="page page-wide ai-studio-page"
        data-beginner-mode={beginnerMode ? "on" : "off"}
        data-selected-tool={selectedTool ?? undefined}
      >
        <input
          ref={referenceCanvasFileInputRef}
          type="file"
          accept={referenceCanvasFileAccept}
          multiple
          style={{ display: "none" }}
          onChange={onFileBrowserSelection}
        />

        <section className="ai-hero panel hero-banner ai-amber-hero">
          <div className="hero-text">
            <h1 className="ai-hero-title">AI Studio</h1>
          </div>
          <div className="hero-right">
            <div className="ai-credit-inline header-embedded">
              <span className="credit-label">Credits</span>
              <span className="credit-value">
                {balanceLoading
                  ? "…"
                  : balanceCredits != null
                    ? balanceCredits.toLocaleString()
                    : "—"}
              </span>
              {pendingHoldCredits != null ? (
                <span className="credit-hold-value tiny helper-text">
                  Pending holds: {pendingHoldCredits.toLocaleString()}
                </span>
              ) : null}
              <Link
                href="/profile?section=account"
                className="header-profile-link"
                aria-label="Account settings"
              >
                <span className="header-profile-avatar">KI</span>
              </Link>
            </div>
          </div>
        </section>

        {uiError ? (
          <div
            className="panel ai-panel"
            role="alert"
            aria-live="assertive"
            style={{ marginTop: 12, padding: 12 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <p className="tiny" style={{ margin: 0 }}>
                {uiError}
              </p>
              <button type="button" className="ghost-btn mini" onClick={onDismissUiError}>
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
        {uiNotice ? (
          <div
            className="panel ai-panel"
            role="status"
            aria-live="polite"
            style={{ marginTop: 12, padding: 12 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <p className="tiny" style={{ margin: 0 }}>
                {uiNotice}
              </p>
              <button type="button" className="ghost-btn mini" onClick={onDismissUiNotice}>
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
        {characterError ? (
          <div
            className="panel ai-panel"
            role="alert"
            aria-live="assertive"
            style={{ marginTop: 12, padding: 12 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <p className="tiny" style={{ margin: 0 }}>
                {characterError}
              </p>
              <button type="button" className="ghost-btn mini" onClick={onDismissCharacterError}>
                Dismiss
              </button>
            </div>
          </div>
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
                      <p className="ai-error-card-message">
                        {item.errorDetail ?? item.errorMessage}
                      </p>
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

        <div className={`ai-layout${isTemplateView ? " templates-active" : ""}`}>
          <AiStudioToolbar
            selectedTool={selectedTool}
            showCreateTools={showCreateTools}
            beginnerMode={beginnerMode}
            onSelectTool={onSelectTool}
            onToggleCreateTools={onToggleCreateTools}
            onToggleBeginnerMode={onBeginnerModeChange}
            showOnboardingSteps={beginnerMode}
          />

          <div className="ai-content">
            <section
              ref={shellRef}
              className={shellClassName}
              style={shellStyle}
              onDragOverCapture={handleShellDragOverCapture}
              onDropCapture={handleShellDropCapture}
            >
              {selectedTool ? (
                <aside ref={leftColumnRef} className="panel ai-panel ai-properties">
                  {renderProperties()}
                </aside>
              ) : null}
              {showDivider ? (
                <button type="button" className="ai-shell-divider" {...dividerProps} />
              ) : null}
              <div
                ref={rightColumnRef}
                className={`ai-shell-right${rightColumnDropMode !== "none" ? " is-drop-overlay-active" : ""}`}
                onDropCapture={handleRightColumnDropCapture}
                onDragOverCapture={handleRightColumnDragOverCapture}
                onDragEnterCapture={handleRightColumnDragEnterCapture}
                onDragLeaveCapture={handleRightColumnDragLeaveCapture}
              >
                {agentChat.isOpen ? (
                  <div className="ai-preview-column reference-column">
                    <div className="reference-column-sticky">
                      <div className="preview-column-header">
                        <div>
                          <p className="eyebrow">Agent Chat</p>
                          <p className="tiny subdued helper-text">
                            Drag a chat bubble into the reference grid to add that text as a new
                            prompt card.
                          </p>
                        </div>
                        <div className="preview-header-actions">
                          <button
                            type="button"
                            className="ghost-btn mini"
                            onClick={agentChat.onAddToGrid}
                            disabled={!agentChat.latestAgentPrompt}
                          >
                            Add to grid
                          </button>
                          <button
                            type="button"
                            className="ghost-btn mini agent-chat-close-btn"
                            onClick={agentChat.onClose}
                            aria-label="Close agent chat"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      <AgentChatPanel
                        messages={agentChat.agentMessages}
                        introMessage={{
                          id: "agent-intro",
                          role: "system",
                          content:
                            "Hey, I'm your studio agent. Tell me what you want to create (subject, style, mood, framing) and I'll turn it into a generation-ready prompt.",
                        }}
                        input={agentChat.agentInput}
                        sendLabel="Send"
                        isSending={agentChat.agentIsSending}
                        showPromptActions
                        showPrimaryPromptStatus={false}
                        agentActions={agentChat.agentActions}
                        primaryPrompt={agentChat.latestAgentPrompt}
                        primarySource={agentChat.agentPrimarySource}
                        stagedAttachments={agentChat.stagedAttachments}
                        isDropActive={agentChat.agentDropActive}
                        onDrop={agentChat.onAttachmentDrop}
                        onDragOver={agentChat.onAttachmentDragOver}
                        onDragEnter={agentChat.onAttachmentDragEnter}
                        onDragLeave={agentChat.onAttachmentDragLeave}
                        onRemoveAttachment={agentChat.onRemoveAttachment}
                        onClearAttachments={agentChat.onClearAttachments}
                        onInputChange={agentChat.onInputChange}
                        onSend={agentChat.onSend}
                        onAgentApplyPrompt={agentChat.onAgentApplyPrompt}
                        onAgentSelectVariation={agentChat.onAgentSelectVariation}
                        onAgentDescribeTargets={agentChat.onAgentDescribeTargets}
                        onGenerateOutputPrompt={agentChat.onGenerateFromOutputPrompt}
                        outputGenerateCostCredits={agentChat.outputGenerateCostCredits}
                        disableOutputGenerate={agentChat.disableOutputGenerate}
                        beginnerMode={beginnerMode}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="ai-preview-column reference-column">
                      <div className="reference-column-sticky">
                        <div className="preview-column-header">
                          <div>
                            <p className="eyebrow">Reference Grid</p>
                            <p className="tiny subdued helper-text">
                              Double-click a reference to expand.
                            </p>
                          </div>
                          <div className="preview-header-actions">
                            <button
                              type="button"
                              className="ghost-btn mini preview-media-btn reference-grid-add-files-btn"
                              onClick={triggerFilePicker}
                            >
                              <UploadSimple size={14} weight="regular" />
                              Add files
                            </button>
                            <button
                              type="button"
                              className="ghost-btn mini preview-media-btn reference-grid-media-library-btn"
                              onClick={onOpenMediaLibrary}
                            >
                              <FolderSimple size={14} weight="regular" />
                              <span>Media library</span>
                            </button>
                          </div>
                        </div>
                        <ReferenceCanvas
                          {...referenceCanvasProps}
                          onDropFiles={handleReferenceCanvasFiles}
                          onTriggerFileSelect={triggerFilePicker}
                          selectedTool={selectedTool}
                          onOpenMediaLibrary={onOpenMediaLibrary}
                        />
                      </div>
                    </div>

                    <StudioPreview
                      {...studioPreviewProps}
                      onDropFiles={handleReferenceCanvasFiles}
                      onTriggerFileSelect={triggerFilePicker}
                      onOpenMediaLibrary={onOpenMediaLibrary}
                    />
                  </>
                )}
                {rightColumnDropMode !== "none" ? (
                  <div
                    className="ai-right-drop-overlay"
                    data-drop-mode={rightColumnDropMode}
                    aria-hidden="true"
                    onDrop={handleRightColumnDropCapture}
                    onDragOver={handleRightColumnDragOverCapture}
                    onDragEnter={handleRightColumnDragEnterCapture}
                    onDragLeave={handleRightColumnDragLeaveCapture}
                  />
                ) : null}
              </div>
            </section>
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
