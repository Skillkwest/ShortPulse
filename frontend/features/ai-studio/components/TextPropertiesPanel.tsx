/**
 * Text properties panel for AI Studio.
 * Handles prompt entry, mode selection, and model/aspect choices for text-first generation.
 */
import React from "react";
import {
  CaretDown,
  ImageSquare,
  MagicWand,
  Trash,
  VideoCamera,
} from "phosphor-react";
import { AspectDropdown } from "./AspectDropdown";
import { StudioMode } from "../types";
import { modelLogos } from "../constants";
import { AgentSaveButton, AgentGenerateButton } from "../../../prefabs/agent";
import type { AgentActions, AgentMessage } from "../../../prefabs/agent";
import { PromptStep } from "./PromptStep";

type TextPropertiesPanelProps = {
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
  onStepActionClick?: (step: "mode" | "model" | "prompt") => void;
  agentChatOpen?: boolean;
  onAgentInputChange?: (value: string) => void;
  onAgentSend?: () => void;
  onAgentEnhanceSend?: () => void;
  onAgentMessageClick?: (message: AgentMessage) => void;
  onGenerate: () => void;
  onSavePrompt: () => void;
  onOpenMediaLibrary?: () => void;
  shouldDisableSave?: boolean;
  onCloseAgentChat?: () => void;
  onClearAgentChat?: () => void;
  beginnerMode?: boolean;
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
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  onSavePrompt: () => void;
  costCredits?: number | null;
  isPromptGenerating?: boolean;
  isGenerateDisabled?: boolean;
  guardrailReason?: string | null;
  shouldDisableSave?: boolean;
  beginnerMode?: boolean;
};

type StepHeaderActionButtonProps = {
  label: string;
  isCollapsed?: boolean;
  onClick: () => void;
};

const StepHeaderActionButton: React.FC<StepHeaderActionButtonProps> = ({ label, isCollapsed = false, onClick }) => {
  return (
    <button
      type="button"
      className="ghost-btn mini step-utility-btn"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-expanded={!isCollapsed}
    >
      <CaretDown size={16} weight="bold" aria-hidden />
    </button>
  );
};

const modeIconMap: Record<StudioMode, React.ComponentType<any>> = {
  text: MagicWand,
  image: ImageSquare,
  video: VideoCamera,
};

/**
 * Renders the Create tool controls.
 */
export function TextPropertiesPanel({
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
  onStepActionClick,
  onAgentInputChange,
  onAgentSend,
  onAgentEnhanceSend,
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
  onCloseAgentChat,
  onClearAgentChat,
  beginnerMode = false,
}: TextPropertiesPanelProps) {


  const isTextMode = mode === "text";
  const shouldHidePromptStep = isTextMode && useReferenceImageIndicator;
  const showPromptInput = !shouldHidePromptStep;
  const promptStepNumber = "2";
  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;
  const primaryActionLabel = isTextMode ? "Send" : "Generate";
  const primaryActionBusyLabel = isTextMode ? "Sending…" : "Generating…";
  const isTextPromptMode = mode === "text";
  const [collapsedSteps, setCollapsedSteps] = React.useState<{ mode: boolean; model: boolean; prompt: boolean }>({
    mode: false,
    model: false,
    prompt: false,
  });

  const toggleStep = (step: "mode" | "model" | "prompt") => {
    setCollapsedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
    onStepActionClick?.(step);
  };

  const expandIfCollapsed = (step: "mode" | "model" | "prompt") => {
    setCollapsedSteps((prev) => {
      if (!prev[step]) {
        return prev;
      }
      const next = { ...prev, [step]: false };
      onStepActionClick?.(step);
      return next;
    });
  };

  return (
    <div className="tool-properties">
      <div className="tool-header">
        <p className="eyebrow">Text</p>
        <p className="subdued tiny helper-text">Generate new content using text prompts.</p>
      </div>
      <div
        className={`step-card ${collapsedSteps.mode ? "is-collapsed" : ""}`}
        onClick={() => expandIfCollapsed("mode")}
        role="group"
        aria-label="Select generation mode section"
      >
        <div className="step-card-header">
          {beginnerMode && <span className="step-badge">1</span>}
          <div className="step-header-copy">
            <p className="step-title">Select Generation Mode</p>
            <span className="step-subtitle tiny helper-text">Select the output type you want to generate. </span>
          </div>
          {!beginnerMode ? (
            <div className="step-header-actions">
              <StepHeaderActionButton
                label="Open generation mode options"
                isCollapsed={collapsedSteps.mode}
                onClick={() => toggleStep("mode")}
              />
            </div>
          ) : null}
        </div>
        {!collapsedSteps.mode ? (
          <div className="create-controls top-row mode-toggle-row" role="group" aria-label="Select generation mode">
            <button
              type="button"
              className={`ghost-btn small mode-toggle-btn ${mode === "text" ? "is-active" : ""}`}
              aria-pressed={mode === "text"}
              onClick={() => onModeChange("text")}
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
        ) : null}
      </div>
      <PromptStep
        stepNumber={promptStepNumber}
        title="Write your prompt"
        subtitle="Start typing your prompt or drag & drop a prompt from the reference grid."
        prompt={prompt}
        onPromptChange={onPromptChange}
        agentEnabled={agentEnabled}
        agentMessages={agentMessages}
        agentActions={agentActions}
        agentInput={agentInput}
        agentIsSending={agentIsSending}
        agentError={agentError}
        stagedPrompt={stagedPrompt}
        agentChatOpen={agentChatOpen}
        onAgentInputChange={onAgentInputChange}
        onAgentSend={onAgentSend}
        onAgentEnhanceSend={onAgentEnhanceSend}
        onAgentMessageClick={onAgentMessageClick}
        onExpandChat={onExpandChat}
        onCloseAgentChat={onCloseAgentChat}
        onClearAgentChat={onClearAgentChat}
        onSavePrompt={onSavePrompt}
        onOpenMediaLibrary={onOpenMediaLibrary}
        isCollapsed={collapsedSteps.prompt}
        onToggleCollapse={() => toggleStep("prompt")}
        isGenerating={isPromptGenerating}
        shouldDisableSave={shouldDisableSave}
        beginnerMode={beginnerMode}
        className={isTextMode ? "step2-text-mode" : ""}
      />
      {!isTextMode ? (
        <div
          className={`step-card ${collapsedSteps.model ? "is-collapsed" : ""}`}
          onClick={() => expandIfCollapsed("model")}
          role="group"
          aria-label="Choose frame and model section"
        >
          <div className="step-card-header">
            {beginnerMode && <span className="step-badge">3</span>}
            <div className="step-header-copy">
              <p className="step-title">Choose frame & model</p>
              <span className="step-subtitle tiny helper-text">Set the aspect ratio, then select the model.</span>
            </div>
            {!beginnerMode ? (
              <div className="step-header-actions">
                <StepHeaderActionButton
                  label="Open aspect ratio and model options"
                  isCollapsed={collapsedSteps.model}
                  onClick={() => toggleStep("model")}
                />
              </div>
            ) : null}
          </div>
          {!collapsedSteps.model ? (
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
          ) : null}
        </div>
      ) : null}
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
  onPromptChange,
  onGenerate,
  onSavePrompt,
  costCredits,
  isPromptGenerating = false,
  isGenerateDisabled = false,
  guardrailReason = null,
  shouldDisableSave = false,
  beginnerMode = false,
}: ComposeSendCardProps) {
  const primaryActionLabel = "Generate";
  const primaryActionBusyLabel = mode === "text" ? "Sending…" : "Generating…";
  const costValue = costCredits != null ? costCredits : "—";
  const promptThinking = agentIsSending || isPromptGenerating;

  return (
    <div className="step-card prompt-step">
      <div className="step-card-header">
        {beginnerMode && <span className="step-badge">3</span>}
        <div className="step-header-copy">
          {beginnerMode ? <p className="step-title">Generate</p> : null}
          <span className="step-subtitle tiny helper-text">Run generation with the current prompt and selections.</span>
        </div>
      </div>
      {isGenerateDisabled && guardrailReason ? (
        <div className="inline-error-hint" role="status">
          {guardrailReason}
        </div>
      ) : null}
      {agentEnabled && agentError ? <div className="inline-error-hint">{agentError}</div> : null}
      <div className="generate-actions-row">
        <AgentGenerateButton
          onClick={onGenerate}
          disabled={isGenerateDisabled || isPromptGenerating}
          isBusy={isPromptGenerating}
          cost={costValue}
        />
      </div>
    </div>
  );
}
