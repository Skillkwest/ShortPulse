/**
 * AI Studio page layout (presentational only).
 * Receives a prepared view model from the page and renders toolbar, panels, previews, and system banners.
 */
import React from "react";
import Link from "next/link";
import { CloudArrowUp, Selection, UploadSimple, User } from "phosphor-react";
import { AiStudioToolbar } from "./AiStudioToolbar";
import { CanvasPanel } from "./CanvasPanel";
import { TextPropertiesPanel, ComposeSendCard } from "./TextPropertiesPanel";
import { DetailModal } from "./DetailModal";
import { ModelModal } from "./ModelModal";
import { ReferenceCanvas } from "./ReferenceCanvas";
import { ReferencePropertiesPanel } from "./ReferencePropertiesPanel";
import { StudioPreview } from "./StudioPreview";
import { CharacterPropertiesPanel } from "../../character/components/CharacterPropertiesPanel";
import { CharacterPanel } from "./CharacterPanel";
import { AgentChatPanel } from "../../../prefabs/agent";
import type { AgentActions, AgentMessage } from "../../ai-agent/types";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import type { PricingParams } from "../logic/pricingTypes";
import type { ReferenceCanvasProps } from "./ReferenceCanvas";

type FailureCard = Pick<StudioOutput, "id" | "model" | "modelId" | "prompt" | "errorMessage">;

type TextSectionProps = {
  mode: StudioMode;
  aspect: string;
  modelId: string | null;
  modelLabel: string;
  prompt: string;
  promptRef: React.RefObject<HTMLTextAreaElement>;
  agentEnabled: boolean;
  agentMessages: AgentMessage[];
  agentActions?: AgentActions;
  agentInput: string;
  agentIsSending: boolean;
  agentError?: string;
  stagedPrompt?: string | null;
  useReferenceImageIndicator: boolean;
  hasReferencePreview: boolean;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  costCredits?: number | null;
  isPromptGenerating: boolean;
  isGenerateDisabled: boolean;
  guardrailReason: string | null;
  shouldDisableSave: boolean;
  onStepActionClick?: (step: "mode" | "model" | "prompt") => void;
  onModeChange: (mode: StudioMode) => void;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (anchorId: string, target: HTMLElement) => void;
  onPromptChange: (value: string) => void;
  onToggleReferenceIndicator: () => void;
  onCloseAgentChat?: () => void;
  onAgentInputChange: (value: string) => void;
  onAgentSend: () => void;
  onAgentEnhanceSend?: () => void;
  onAgentApplyPrompt: (prompt: string) => void;
  onAgentSelectVariation: (prompt: string) => void;
  onAgentMessageClick: (message: AgentMessage) => void;
  onExpandChat: () => void;
  agentChatOpen: boolean;
  onGenerate: () => void;
  onSavePrompt: () => void;
  onOpenMediaLibrary?: () => void;
};

type CharacterSectionProps = React.ComponentProps<typeof CharacterPropertiesPanel>;

type ReferenceSectionProps = Omit<React.ComponentProps<typeof ReferencePropertiesPanel>, "title" | "subtitle"> & {
  variant: "image" | "video";
  onRegenerate: () => void;
  guardrailReason: string | null;
  costCredits?: number | null;
  isGenerateDisabled?: boolean;
};

type AgentChatProps = {
  isOpen: boolean;
  agentMessages: AgentMessage[];
  agentInput: string;
  agentActions?: AgentActions;
  agentIsSending: boolean;
  latestAgentPrompt: string | null;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onAddToGrid: () => void;
  onUsePrompt: () => void;
  onClose: () => void;
  onMessageClick?: (message: AgentMessage) => void;
  generateCost?: number | string | null;
};

type AiStudioPageContentProps = {
  referenceCanvasFileInputRef: React.RefObject<HTMLInputElement>;
  onFileBrowserSelection: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uiError: string | null;
  characterError: string | null;
  onDismissUiError: () => void;
  onDismissCharacterError: () => void;
  beginnerMode: boolean;
  onBeginnerModeChange: (value: boolean) => void;
  balanceCredits: number | null;
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
  propertiesImage: ReferenceSectionProps;
  propertiesVideo: ReferenceSectionProps;
  isTemplateView: boolean;
  referenceCanvasProps: ReferenceCanvasProps;
  studioPreviewProps: React.ComponentProps<typeof StudioPreview>;
  detailModalOutput: StudioOutput | null;
  onDetailClose: () => void;
  onUpdateOutputPrompt: (id: string, prompt: string) => void;
  modelModalState: {
    isOpen: boolean;
    position: { top: number; left: number } | null;
    options: { value: string; label: string; mediaType?: string | null }[];
    onClose: () => void;
    onSelect: (value: string) => void;
  };
  agentChat: AgentChatProps;
  handleReferenceCanvasFiles: (files: FileList) => void;
  triggerFilePicker: () => void;
};

export function AiStudioPageContent({
  referenceCanvasFileInputRef,
  onFileBrowserSelection,
  uiError,
  characterError,
  onDismissUiError,
  onDismissCharacterError,
  beginnerMode,
  onBeginnerModeChange,
  balanceCredits,
  balanceLoading,
  visibleFailures,
  onDismissFailure,
  onInspectFailure,
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
  modelModalState,
  agentChat,
  handleReferenceCanvasFiles,
  triggerFilePicker,
}: AiStudioPageContentProps) {
  void propertiesCharacter;
  const renderProperties = () => {
    switch (selectedTool) {
      case "create":
      case "text":
        return (
          <>
            <TextPropertiesPanel
              {...propertiesText}
              agentChatOpen={agentChat.isOpen}
              onAgentEnhanceSend={propertiesText.onAgentEnhanceSend}
            />
            <ComposeSendCard
              {...propertiesText}
              onGenerate={propertiesText.onGenerate}
              onSavePrompt={propertiesText.onSavePrompt}
              shouldDisableSave={propertiesText.shouldDisableSave}
            />
          </>
        );
      case "character":
        return <CharacterPanel />;
      case "image":
        return (
          <ReferencePropertiesPanel
            title="Image"
            subtitle="Generate images using reference inputs."
            {...propertiesImage}
          />
        );
      case "video":
        return (
          <ReferencePropertiesPanel
            title="Video"
            subtitle="Animate still images using reference inputs and prompts."
            {...propertiesVideo}
          />
        );
      case "edit":
        return (
          <div style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <Selection size={24} weight="bold" color="#fbbf24" />
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Edit</h3>
            </div>
            <p style={{ color: "var(--ai-card-text)", fontSize: "14px", lineHeight: "1.5", margin: 0 }}>
              Advanced editing tools for precise control over your generated content. Refine, adjust, and perfect your creations with intuitive selection and modification tools.
            </p>
            <div
              style={{
                marginTop: "24px",
                padding: "16px",
                borderRadius: "10px",
                background: "rgba(251, 191, 36, 0.08)",
                border: "1px solid rgba(251, 191, 36, 0.2)",
              }}
            >
              <p style={{ color: "var(--ai-card-text)", fontSize: "13px", margin: 0, fontStyle: "italic" }}>
                Edit tools coming soon.
              </p>
            </div>
          </div>
        );
      case "canvas":
        return <CanvasPanel />;
      default:
        return null;
    }
  };

  return (
    <>
      <main className="page page-wide ai-studio-page" data-beginner-mode={beginnerMode ? "on" : "off"}>
        <input
          ref={referenceCanvasFileInputRef}
          type="file"
          accept="image/*"
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
                {balanceLoading ? "…" : balanceCredits != null ? balanceCredits.toLocaleString() : "—"}
              </span>
            </div>
          </div>
        </section>

        {visibleFailures.length ? (
          <div className="ai-error-stack" role="alert" aria-live="polite">
            <div className="ai-error-stack-header">
              <div>
                <p className="eyebrow">Generation issues</p>
                <p className="tiny subdued">We could not finish these runs. Inspect, adjust the model, then try again.</p>
              </div>
              <span className="error-count-pill">{visibleFailures.length}</span>
            </div>
            <div className="ai-error-card-grid">
              {visibleFailures.map((item) => {
                const modelLabel = item.model || item.modelId || "Generation";
                const promptPreview = item.prompt.length > 140 ? `${item.prompt.slice(0, 140)}…` : item.prompt;
                const isNanoBanana =
                  (item.modelId ?? "").toLowerCase().includes("nano-banana") ||
                  (item.model ?? "").toLowerCase().includes("nano banana");
                return (
                  <div key={item.id} className="ai-error-card">
                    <div className="ai-error-card-body">
                      <p className="ai-error-card-title">{modelLabel} failed</p>
                      <p className="ai-error-card-message">{item.errorMessage}</p>
                      <p className="ai-error-card-meta">
                        Prompt: <span className="ai-error-card-prompt">{promptPreview}</span>
                      </p>
                      {isNanoBanana ? (
                        <p className="ai-error-card-hint">
                          Nano Banana is unstable right now. Try FLUX.2 Pro or Seedream 4.5 instead.
                        </p>
                      ) : null}
                    </div>
                    <div className="ai-error-card-actions">
                      <button type="button" className="ghost-btn mini" onClick={() => onInspectFailure(item.id)}>
                        Inspect
                      </button>
                      <button type="button" className="ghost-btn mini" onClick={() => onDismissFailure(item.id)}>
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
            <section className={`ai-shell ${selectedTool ? "" : "ai-shell-wide"}`}>
              {selectedTool ? <aside className="panel ai-panel ai-properties">{renderProperties()}</aside> : null}

              {agentChat.isOpen ? (
                <div className="ai-preview-column reference-column">
                  <div className="preview-column-header">
                    <div>
                      <p className="eyebrow">Agent Chat</p>
                      <p className="tiny subdued helper-text">Click a chat bubble to add that text to the reference grid as a new prompt.</p>
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
                      <button type="button" className="ghost-btn mini agent-chat-close-btn" onClick={agentChat.onClose} aria-label="Close agent chat">
                        ×
                      </button>
                    </div>
                  </div>
                  <AgentChatPanel
                    messages={agentChat.agentMessages}
                    input={agentChat.agentInput}
                    sendLabel="Send"
                    isSending={agentChat.agentIsSending}
                    onInputChange={agentChat.onInputChange}
                    onSend={agentChat.onSend}
                    onGenerate={agentChat.onAddToGrid}
                    generateCost={propertiesText.costCredits}
                    onMessageClick={agentChat.onMessageClick}
                    beginnerMode={beginnerMode}
                  />
                </div>
              ) : (
                <>
                  <div className="ai-preview-column reference-column">
                    <div className="preview-column-header">
                      <div>
                        <p className="eyebrow">Reference Grid</p>
                        <p className="tiny subdued helper-text">Double-click a reference to expand.</p>
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
                        <Link href="/media-library" className="ghost-btn mini preview-media-btn">
                          <CloudArrowUp size={14} weight="regular" />
                          Media library
                        </Link>
                      </div>
                    </div>
                    <ReferenceCanvas
                      {...referenceCanvasProps}
                      onDropFiles={handleReferenceCanvasFiles}
                      onTriggerFileSelect={triggerFilePicker}
                    />
                  </div>

                  <StudioPreview {...studioPreviewProps} onDropFiles={handleReferenceCanvasFiles} onTriggerFileSelect={triggerFilePicker} />
                </>
              )}
            </section>
          </div>
        </div>
      </main>
      <ModelModal
        isOpen={modelModalState.isOpen}
        position={modelModalState.position}
        onClose={modelModalState.onClose}
        onSelect={modelModalState.onSelect}
        options={modelModalState.options}
      />
      <DetailModal
        output={detailModalOutput}
        onClose={onDetailClose}
        onUpdatePrompt={onUpdateOutputPrompt}
      />
    </>
  );
}
