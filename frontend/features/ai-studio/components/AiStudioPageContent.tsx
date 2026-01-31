/**
 * AI Studio page layout (presentational only).
 * Receives a prepared view model from the page and renders toolbar, panels, previews, and system banners.
 */
import React from "react";
import Link from "next/link";
import { CloudArrowUp, UploadSimple } from "phosphor-react";
import { AiStudioToolbar } from "./AiStudioToolbar";
import { CreatePropertiesPanel, ComposeSendCard } from "./CreatePropertiesPanel";
import { DetailModal } from "./DetailModal";
import { EnhancePropertiesPanel } from "./EnhancePropertiesPanel";
import { ModelModal } from "./ModelModal";
import { ReferenceCanvas } from "./ReferenceCanvas";
import { RecreatePropertiesPanel } from "./RecreatePropertiesPanel";
import { StudioPreview } from "./StudioPreview";
import { CharacterPropertiesPanel } from "../../character/components/CharacterPropertiesPanel";
import { CharacterPreview } from "../../character/components/CharacterPreview";
import { AgentChatPanel } from "../../ai-agent/components/AgentChatPanel";
import type { AgentActions, AgentMessage } from "../../ai-agent/types";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import type { PricingParams } from "../logic/pricingTypes";
import type { ReferenceCanvasProps } from "./ReferenceCanvas";

type FailureCard = Pick<StudioOutput, "id" | "model" | "modelId" | "prompt" | "errorMessage">;

type CreateSectionProps = {
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
  onModeChange: (mode: StudioMode) => void;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (anchorId: string, target: HTMLElement) => void;
  onPromptChange: (value: string) => void;
  onToggleReferenceIndicator: () => void;
  onAgentInputChange: (value: string) => void;
  onAgentSend: () => void;
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

type RecreateSectionProps = Omit<React.ComponentProps<typeof RecreatePropertiesPanel>, "title" | "subtitle"> & {
  variant: "image-to-image" | "image-to-video";
  onRegenerate: () => void;
  guardrailReason: string | null;
  costCredits?: number | null;
  isGenerateDisabled?: boolean;
};

type EnhanceSectionProps = React.ComponentProps<typeof EnhancePropertiesPanel>;

type AgentChatProps = {
  isOpen: boolean;
  agentMessages: AgentMessage[];
  agentInput: string;
  agentActions?: AgentActions;
  agentIsSending: boolean;
  latestAgentPrompt: string | null;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onApplyPrompt: (prompt: string) => void;
  onSelectVariation: (prompt: string) => void;
  onAddToGrid: () => void;
  onUsePrompt: () => void;
  onClose: () => void;
  onMessageClick?: (message: AgentMessage) => void;
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
  showEditTools: boolean;
  onSelectTool: (tool: ToolId | null) => void;
  onToggleEditTools: (value: boolean) => void;
  propertiesCreate: CreateSectionProps;
  propertiesCharacter: CharacterSectionProps;
  propertiesRecreate: RecreateSectionProps;
  propertiesRecreateVideo: RecreateSectionProps;
  propertiesEnhance: EnhanceSectionProps;
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
  showEditTools,
  onSelectTool,
  onToggleEditTools,
  propertiesCreate,
  propertiesCharacter,
  propertiesRecreate,
  propertiesRecreateVideo,
  propertiesEnhance,
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
  const renderProperties = () => {
    switch (selectedTool) {
      case "create":
        return (
        <>
          <CreatePropertiesPanel
            {...propertiesCreate}
            agentChatOpen={agentChat.isOpen}
          />
          {propertiesCreate.mode !== "enhance" ? (
            <ComposeSendCard
              {...propertiesCreate}
              onGenerate={propertiesCreate.onGenerate}
              onSavePrompt={propertiesCreate.onSavePrompt}
              shouldDisableSave={propertiesCreate.shouldDisableSave}
            />
          ) : null}
        </>
        );
      case "character":
        return <CharacterPropertiesPanel {...propertiesCharacter} />;
      case "image-to-image":
        return (
          <RecreatePropertiesPanel
            title="Image to Image"
            subtitle="Recreate images using references."
            {...propertiesRecreate}
          />
        );
      case "image-to-video":
        return (
          <RecreatePropertiesPanel
            title="Image to Video"
            subtitle="Animate still images using references and prompts."
            {...propertiesRecreateVideo}
          />
        );
      case "enhance":
        return <EnhancePropertiesPanel {...propertiesEnhance} />;
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

        {uiError || characterError ? (
          <div className="ai-error-banner" role="alert">
            <div className="ai-error-text">
              <strong>Error:</strong> {uiError ?? characterError}
            </div>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={uiError ? onDismissUiError : onDismissCharacterError}
              aria-label="Dismiss error"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <section className="ai-hero panel hero-banner ai-amber-hero">
          <div className="hero-text">
            <p className="eyebrow">AI Studio</p>
            <p className="tiny subdued helper-text">Prompt, generate, preview, and save from a single space.</p>
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
            showEditTools={showEditTools}
            beginnerMode={beginnerMode}
            onSelectTool={onSelectTool}
            onToggleEditTools={onToggleEditTools}
            onToggleBeginnerMode={onBeginnerModeChange}
          />

          <div className="ai-content">
            <section className={`ai-shell ${selectedTool ? "" : "ai-shell-wide"}`}>
              {selectedTool ? <aside className="panel ai-panel ai-properties">{renderProperties()}</aside> : null}

              {selectedTool === "character" ? (
                <div className="ai-preview-column reference-column">
                  <CharacterPreview
                    identity={propertiesCharacter.identity}
                    results={propertiesCharacter.results}
                    onUploadClick={triggerFilePicker}
                  />
                </div>
              ) : agentChat.isOpen ? (
                <div className="ai-preview-column reference-column">
                  <div className="preview-column-header">
                    <div>
                      <p className="eyebrow">Agent Chat</p>
                      <p className="tiny subdued helper-text">Iterate with the agent, then add to the grid.</p>
                    </div>
                    <div className="preview-header-actions">
                      <button type="button" className="ghost-btn mini" onClick={agentChat.onUsePrompt} disabled={!agentChat.latestAgentPrompt}>
                        Use prompt
                      </button>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={agentChat.onAddToGrid}
                        disabled={!agentChat.latestAgentPrompt}
                      >
                        Add to grid
                      </button>
                      <button type="button" className="ghost-btn mini" onClick={agentChat.onClose}>
                        Close
                      </button>
                    </div>
                  </div>
                  <AgentChatPanel
                    messages={agentChat.agentMessages}
                    input={agentChat.agentInput}
                    actions={agentChat.agentActions}
                    sendLabel="Send"
                    isSending={agentChat.agentIsSending}
                    onInputChange={agentChat.onInputChange}
                    onSend={agentChat.onSend}
                    onApplyPrompt={agentChat.onApplyPrompt}
                    onSelectVariation={agentChat.onSelectVariation}
                    onMessageClick={agentChat.onMessageClick}
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
