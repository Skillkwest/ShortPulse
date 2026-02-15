/**
 * AI Studio page layout (presentational only).
 * Receives a prepared view model from the page and renders toolbar, panels, previews, and system banners.
 */
import React from "react";
import Link from "next/link";
import {
  CloudArrowUp,
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
  onMessageClick?: (message: AgentMessage) => void;
  onAgentApplyPrompt?: (prompt: string) => void;
  onAgentSelectVariation?: (prompt: string) => void;
  onAgentUseQuestion?: (question: string) => void;
  onAgentDescribeTargets?: (targets: string[]) => void;
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
  const referenceCanvasFileAccept = selectedTool === "character" ? "image/*" : "image/*,video/*";
  const { shellRef, leftColumnRef, showDivider, isResizing, shellStyle, dividerProps } =
    useAiStudioShellResize({
      enabled: Boolean(selectedTool),
    });
  const shellClassName = [
    "ai-shell",
    selectedTool ? "" : "ai-shell-wide",
    showDivider ? "ai-shell-resizable" : "",
    isResizing ? "ai-shell-resizing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const renderProperties = () => {
    switch (resolvePropertiesPanelKind(selectedTool)) {
      case "text":
        return (
          <>
            <TextPropertiesPanel
              {...propertiesText}
              agentChatOpen={agentChat.isOpen}
              onAgentEnhanceSend={propertiesText.onAgentEnhanceSend}
            />
            <ComposeSendCard {...propertiesText} onGenerate={propertiesText.onGenerate} />
          </>
        );
      case "character":
        return <CharacterPanel />;
      case "edit":
        return <EditPropertiesPanel {...propertiesImage} />;
      case "video":
        return <VideoPropertiesPanel {...propertiesVideo} />;
      case "kling":
        return <KlingComingSoonCard />;
      case "canvas":
        return <CharacterPanel />;
      default:
        return null;
    }
  };

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
            <p className="eyebrow">AI Studio</p>
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
            <section ref={shellRef} className={shellClassName} style={shellStyle}>
              {selectedTool ? (
                <aside ref={leftColumnRef} className="panel ai-panel ai-properties">
                  {renderProperties()}
                </aside>
              ) : null}
              {showDivider ? (
                <button type="button" className="ai-shell-divider" {...dividerProps} />
              ) : null}
              <div className="ai-shell-right">
                {agentChat.isOpen ? (
                  <div className="ai-preview-column reference-column">
                    <div className="reference-column-sticky">
                      <div className="preview-column-header">
                        <div>
                          <p className="eyebrow">Agent Chat</p>
                          <p className="tiny subdued helper-text">
                            Click a chat bubble to add that text to the reference grid as a new
                            prompt.
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
                        onMessageClick={agentChat.onMessageClick}
                        onAgentApplyPrompt={agentChat.onAgentApplyPrompt}
                        onAgentSelectVariation={agentChat.onAgentSelectVariation}
                        onAgentUseQuestion={agentChat.onAgentUseQuestion}
                        onAgentDescribeTargets={agentChat.onAgentDescribeTargets}
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
                              className="ghost-btn mini preview-media-btn"
                              onClick={triggerFilePicker}
                            >
                              <UploadSimple size={14} weight="regular" />
                              Add files
                            </button>
                            <button
                              type="button"
                              className="ghost-btn mini preview-media-btn"
                              onClick={onOpenMediaLibrary}
                            >
                              <CloudArrowUp size={14} weight="regular" />
                              Media library
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
