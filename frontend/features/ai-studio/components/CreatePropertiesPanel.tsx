/**
 * Create properties panel for AI Studio.
 * Handles mode selection, aspect/model choices, and prompt entry for generation.
 */
import React from "react";
import { ArrowsOutSimple, CloudArrowUp, FloppyDisk, ImageSquare, MagicWand, PaperPlaneTilt, Sparkle, VideoCamera } from "phosphor-react";
import { AspectDropdown } from "./AspectDropdown";
import { StudioMode } from "../types";
import { modelLogos } from "../constants";
import { AgentChatPanel } from "../../ai-agent/components/AgentChatPanel";
import type { AgentActions, AgentMessage } from "../../ai-agent/types";

type CreatePropertiesPanelProps = {
  mode: StudioMode;
  aspect: string;
  modelId: string | null;
  modelLabel: string;
  prompt: string;
  promptRef: React.RefObject<HTMLTextAreaElement>;
  agentEnabled?: boolean;
  agentMessages?: AgentMessage[];
  agentActions?: AgentActions;
  agentInput?: string;
  agentIsSending?: boolean;
  agentError?: string;
  stagedPrompt?: string | null;
  useReferenceImageIndicator: boolean;
  hasReferencePreview: boolean;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  onModeChange: (mode: StudioMode) => void;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (anchorId: string, target: HTMLElement) => void;
  onPromptChange: (value: string) => void;
  onToggleReferenceIndicator: () => void;
  costCredits?: number | null;
  balanceCredits?: number | null;
  balanceLoading?: boolean;
  isPromptGenerating?: boolean;
  isGenerateDisabled?: boolean;
  guardrailReason?: string | null;
  onExpandChat?: () => void;
  agentChatOpen?: boolean;
  onAgentInputChange?: (value: string) => void;
  onAgentSend?: () => void;
  onAgentApplyPrompt?: (prompt: string) => void;
  onAgentSelectVariation?: (prompt: string) => void;
  onAgentMessageClick?: (message: AgentMessage) => void;
  onGenerate: () => void;
  onSavePrompt: () => void;
  onOpenMediaLibrary?: () => void;
  shouldDisableSave?: boolean;
};

type ComposeSendCardProps = {
  mode: StudioMode;
  agentEnabled?: boolean;
  agentMessages?: AgentMessage[];
  agentActions?: AgentActions;
  agentInput?: string;
  agentIsSending?: boolean;
  agentError?: string;
  promptRef: React.RefObject<HTMLTextAreaElement>;
  prompt: string;
  onAgentInputChange?: (value: string) => void;
  onAgentSend?: () => void;
  onAgentApplyPrompt?: (prompt: string) => void;
  onAgentSelectVariation?: (prompt: string) => void;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  onSavePrompt: () => void;
  costCredits?: number | null;
  isPromptGenerating?: boolean;
  isGenerateDisabled?: boolean;
  guardrailReason?: string | null;
  shouldDisableSave?: boolean;
};
const modeIconMap: Record<StudioMode, React.ComponentType<any>> = {
  enhance: MagicWand,
  image: ImageSquare,
  video: VideoCamera,
};

/**
 * Renders the Create tool controls.
 */
export function CreatePropertiesPanel({
  mode,
  aspect,
  modelId,
  modelLabel,
  prompt,
  promptRef,
  useReferenceImageIndicator,
  hasReferencePreview,
  isModelModalOpen,
  modelModalAnchor,
  onModeChange,
  onAspectChange,
  onModelPickerOpen,
  onPromptChange,
  onToggleReferenceIndicator,
  agentEnabled = false,
  agentMessages = [],
  agentActions,
  agentInput = "",
  agentIsSending = false,
  agentError,
  stagedPrompt = null,
  onExpandChat,
  onAgentInputChange,
  onAgentSend,
  onAgentApplyPrompt,
  onAgentSelectVariation,
  onAgentMessageClick,
  agentChatOpen = false,
  onSavePrompt,
  onOpenMediaLibrary,
  shouldDisableSave = false,
  onGenerate,
  costCredits,
  balanceCredits,
  balanceLoading,
  isPromptGenerating = false,
  isGenerateDisabled = false,
  guardrailReason = null,
}: CreatePropertiesPanelProps) {
  const isEnhanceMode = mode === "enhance";
  const shouldHidePromptStep = isEnhanceMode && useReferenceImageIndicator;
  const showPromptInput = !shouldHidePromptStep;
  const promptStepNumber = isEnhanceMode ? "2" : "3";
  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;
  const primaryActionLabel = isEnhanceMode ? "Send" : "Generate";
  const primaryActionBusyLabel = isEnhanceMode ? "Sending…" : "Generating…";
  const [promptMode, setPromptMode] = React.useState<"enhanced" | "chat">("enhanced");
  const canExpandChat = agentMessages.length > 0;

  return (
    <div className="tool-properties">
      <div className="tool-header">
        <p className="eyebrow">Create</p>
        <p className="subdued tiny helper-text">Generate new content using text input.</p>
      </div>
      <div className="step-card">
        <div className="step-card-header">
          <span className="step-badge">1</span>
          <div className="step-header-copy">
            <p className="step-title">Select Generation Mode</p>
            <span className="step-subtitle tiny helper-text">Select the output type you want to generate. </span>
          </div>
        </div>
        <div className="create-controls top-row mode-toggle-row" role="group" aria-label="Select generation mode">
          <button
            type="button"
            className={`ghost-btn small mode-toggle-btn ${mode === "enhance" ? "is-active" : ""}`}
            aria-pressed={mode === "enhance"}
            onClick={() => onModeChange("enhance")}
          >
            Text Prompt
          </button>
          <button
            type="button"
            className={`ghost-btn small mode-toggle-btn ${mode === "image" ? "is-active" : ""}`}
            aria-pressed={mode === "image"}
            onClick={() => onModeChange("image")}
          >
            Image
          </button>
          <button
            type="button"
            className={`ghost-btn small mode-toggle-btn ${mode === "video" ? "is-active" : ""}`}
            aria-pressed={mode === "video"}
            onClick={() => onModeChange("video")}
          >
            Video
          </button>
        </div>
      </div>
      {!isEnhanceMode ? (
        <div className="step-card">
          <div className="step-card-header">
            <span className="step-badge">2</span>
            <div className="step-header-copy">
              <p className="step-title">Choose frame & model</p>
              <span className="step-subtitle tiny helper-text">Set the aspect ratio, then select the model.</span>
            </div>
          </div>
          <div className="create-controls dual-controls">
            <div className="control-row compact">
              <label className="input-label">Aspect ratio</label>
              <AspectDropdown aspect={aspect} onSelect={onAspectChange} />
            </div>
            <div className="control-row compact">
              <label className="input-label">Model</label>
              <button
                type="button"
                className={`model-picker-btn ${isModelModalOpen && modelModalAnchor === "create-model" ? "is-open" : ""}`}
                data-model-anchor="create-model"
                onClick={(event) => onModelPickerOpen("create-model", event.currentTarget)}
              >
                <div className="model-picker-row">
                  <span className="model-picker-value">
                    {modelLogoSrc ? <img className="model-chip-logo-img" src={modelLogoSrc} alt="" aria-hidden /> : null}
                    {modelLabel}
                  </span>
                  <span className="model-chip-pill model-picker-pill">
                    <span aria-hidden="true" className="model-chip-icon">✦</span>
                    <span className="model-chip-credits">{costCredits != null ? costCredits : "—"}</span>
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="step-card prompt-step">
        <div className="step-card-header">
          <span className="step-badge">{promptStepNumber}</span>
          <div className="step-header-copy">
            <p className="step-title">Write your prompt</p>
            <span className="step-subtitle tiny helper-text">
              Draft the prompt you want to use, or switch to Chat to have the agent craft one for you.
            </span>
          </div>
        </div>
        {agentEnabled ? (
          <div className="prompt-mode-row">
            <div className="prompt-mode-toggle-row prompt-mode-toggle-standalone" role="group" aria-label="Prompt options">
              <button
                type="button"
                className={`ghost-btn small mode-toggle-btn ${promptMode === "enhanced" ? "is-active" : ""}`}
                aria-pressed={promptMode === "enhanced"}
                onClick={() => setPromptMode("enhanced")}
              >
                Enhance prompt
              </button>
              <button
                type="button"
                className={`ghost-btn small mode-toggle-btn ${promptMode === "chat" ? "is-active" : ""}`}
                aria-pressed={promptMode === "chat"}
                onClick={() => setPromptMode("chat")}
              >
                Chat
              </button>
            </div>
            {onExpandChat ? (
              <button
                type="button"
                className="ghost-btn mini prompt-expand-btn"
                onClick={canExpandChat ? onExpandChat : undefined}
                aria-label="Expand chat"
                disabled={!canExpandChat}
                aria-disabled={!canExpandChat}
              >
                <ArrowsOutSimple size={20} weight="bold" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
        {agentEnabled ? (
          promptMode === "chat" ? (
            agentChatOpen ? null : (
              <>
                {agentMessages.length > 0 || stagedPrompt ? (
                  <div className="agent-chat-wrapper">
                    <AgentChatPanel
                      messages={agentMessages}
                      input={agentInput}
                      actions={agentActions}
                      sendLabel={primaryActionLabel}
                      isSending={agentIsSending}
                      showInput={false}
                      showActions={true}
                      onInputChange={(value) => onAgentInputChange?.(value)}
                      onSend={onAgentSend ?? (() => {})}
                      onApplyPrompt={onAgentApplyPrompt}
                      onSelectVariation={onAgentSelectVariation}
                      onMessageClick={onAgentMessageClick}
                    />
                  </div>
                ) : null}
                <div className="step2-input-row">
                  <textarea
                    className="prompt-input agent-step-textarea"
                    value={agentInput}
                    onChange={(event) => onAgentInputChange?.(event.target.value)}
                    rows={3}
                    placeholder="Tell the agent what you want or ask it to describe a reference."
                  />
                  <button
                    type="button"
                    className="primary-btn agent-send-btn step2-send-btn"
                    onClick={onAgentSend ?? (() => {})}
                    disabled={agentIsSending}
                  >
                    <PaperPlaneTilt size={20} weight="bold" aria-hidden />
                  </button>
                </div>
              </>
            )
          ) : (
            <>
              <div className="step2-input-row enhanced-mode">
                <textarea
                  className="prompt-input agent-step-textarea enhanced-prompt-input"
                  value={prompt}
                  onChange={(event) => onPromptChange(event.target.value)}
                  rows={6}
                  placeholder="Describe what you want, then enhance it."
                />
              </div>
              <div className="enhanced-actions-row">
                <div className="ai-control-actions">
                  <button type="button" className="ghost-btn mini preview-media-btn" onClick={onOpenMediaLibrary}>
                    <CloudArrowUp size={12} weight="regular" /> Media library
                  </button>
                  <button type="button" className="ghost-btn mini" onClick={onSavePrompt} disabled={shouldDisableSave}>
                    <FloppyDisk size={12} weight="regular" /> Save prompt
                  </button>
                </div>
                <button
                  type="button"
                  className="primary-btn enhanced-generate-btn"
                  onClick={onGenerate}
                  disabled={isGenerateDisabled || isPromptGenerating}
                >
                  <Sparkle size={18} weight="fill" aria-hidden /> {isPromptGenerating ? primaryActionBusyLabel : "Generate"}
                </button>
              </div>
            </>
          )
        ) : (
          <div className="prompt-placeholder helper-text">
            <p className="prompt-placeholder-highlight">Image to Text Mode is active.</p>
            <p>The selected image will generate the prompt automatically.</p>
          </div>
        )}
        {agentEnabled && agentError ? <div className="inline-error-hint">{agentError}</div> : null}
      </div>
    </div>
  );
}

export function ComposeSendCard({
  mode,
  agentEnabled = false,
  agentMessages = [],
  agentActions,
  agentInput = "",
  agentIsSending = false,
  agentError,
  promptRef,
  prompt,
  onAgentInputChange,
  onAgentSend,
  onAgentApplyPrompt,
  onAgentSelectVariation,
  onPromptChange,
  onGenerate,
  onSavePrompt,
  costCredits,
  isPromptGenerating = false,
  isGenerateDisabled = false,
  guardrailReason = null,
  shouldDisableSave = false,
}: ComposeSendCardProps) {
  const primaryActionLabel = mode === "enhance" ? "Send" : "Generate";
  const primaryActionBusyLabel = mode === "enhance" ? "Sending…" : "Generating…";

  return (
    <div className="step-card prompt-step">
      <div className="step-card-header">
        <span className="step-badge">3</span>
        <div className="step-header-copy">
          <p className="step-title">Compose & Send</p>
          <span className="step-subtitle tiny helper-text">Write your message or prompt, send to the agent, or generate.</span>
        </div>
      </div>
      {isGenerateDisabled && guardrailReason ? (
        <div className="inline-error-hint" role="status">
          {guardrailReason}
        </div>
      ) : null}
      {agentEnabled && agentError ? <div className="inline-error-hint">{agentError}</div> : null}

      <div className="step3-input-row">
        <textarea
          ref={promptRef}
          className="prompt-input"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={4}
          placeholder="Describe what you want to create"
        />
      </div>

      <div className="compose-actions-row">
        <div className="compose-meta">
          <span className="tiny subdued">Cost</span>
          <span className="tiny credit-chip">{costCredits != null ? `${costCredits} credits` : "—"}</span>
          {agentEnabled && agentMessages.length ? (
            <span className="tiny subdued">Agent ready</span>
          ) : null}
        </div>
        <div className="compose-buttons">
          <button
            type="button"
            className="ghost-btn small"
            onClick={onAgentSend ?? (() => {})}
            disabled={agentEnabled ? agentIsSending : true}
            aria-disabled={!agentEnabled}
          >
            <PaperPlaneTilt size={16} weight="bold" aria-hidden /> {agentIsSending ? primaryActionBusyLabel : primaryActionLabel}
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={onGenerate}
            disabled={isGenerateDisabled || isPromptGenerating}
          >
            {isPromptGenerating ? primaryActionBusyLabel : primaryActionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
