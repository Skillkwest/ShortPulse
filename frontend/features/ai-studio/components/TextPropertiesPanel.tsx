/**
 * Text properties panel for AI Studio.
 * Handles prompt entry plus model/aspect controls for text-to-image generation.
 */
import Image from "next/image";
import React, { useEffect, useMemo } from "react";
import { CaretDown } from "phosphor-react";
import { AspectDropdown } from "./AspectDropdown";
import { AspectOption, StudioMode } from "../types";
import { aspectOptions, modelLogos } from "../constants";
import type { ModelModalContext } from "./ModelModal";
import { AgentGenerateButton } from "../../../prefabs/agent";
import type { AgentActions, AgentMessage } from "../../../prefabs/agent";
import { PromptStep } from "./PromptStep";
import {
  MODEL_DEFAULT_IMAGE_RESOLUTION,
  clampImageResolutionForModel,
  getImageResolutionOptions,
} from "../logic/imageResolution";
import { getModelConfig } from "../logic/modelRegistry";

const PREBUILT_CHARACTER_OWNER_OPTIONS = [
  { value: "ava", label: "Ava Mercer" },
  { value: "liam", label: "Liam Park" },
  { value: "zoe", label: "Zoe Bennett" },
  { value: "noah", label: "Noah Carter" },
  { value: "mia", label: "Mia Chen" },
];

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
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
  onPromptChange: (value: string) => void;
  onToggleReferenceIndicator: () => void;
  costCredits?: number | null;
  balanceCredits?: number | null;
  balanceLoading?: boolean;
  isPromptGenerating?: boolean;
  isGenerateDisabled?: boolean;
  guardrailReason?: string | null;
  onExpandChat?: () => void;
  onStepActionClick?: (step: "character" | "model" | "prompt" | "imageSettings") => void;
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
  imageResolution?: string;
  onImageResolutionChange?: (value: string) => void;
};

type ComposeSendCardProps = {
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

const StepHeaderActionButton: React.FC<StepHeaderActionButtonProps> = ({
  label,
  isCollapsed = false,
  onClick,
}) => {
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

/**
 * Renders the Create tool controls.
 */
export function TextPropertiesPanel({
  aspect,
  modelId,
  modelLabel,
  prompt,
  isModelModalOpen,
  modelModalAnchor,
  onAspectChange,
  onModelPickerOpen,
  onPromptChange,
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
  isPromptGenerating = false,
  onCloseAgentChat,
  onClearAgentChat,
  beginnerMode = false,
  imageResolution,
  onImageResolutionChange,
}: TextPropertiesPanelProps) {
  const promptStepNumber = beginnerMode ? "1" : "2";
  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;
  const modelConfig = useMemo(() => (modelId ? getModelConfig(modelId) : null), [modelId]);
  const aspectOptionsForModel: AspectOption[] = useMemo(() => {
    if (modelConfig?.allowedAspects?.length) {
      return aspectOptions.filter((opt) => modelConfig.allowedAspects.includes(opt.value));
    }
    return aspectOptions;
  }, [modelConfig]);
  const [selectedCharacterOwner, setSelectedCharacterOwner] = React.useState<string>("");
  const [collapsedSteps, setCollapsedSteps] = React.useState<{
    model: boolean;
    prompt: boolean;
    imageSettings: boolean;
  }>({
    model: false,
    prompt: false,
    imageSettings: false,
  });

  const toggleStep = (step: "model" | "prompt" | "imageSettings") => {
    setCollapsedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
    onStepActionClick?.(step);
  };

  const handleCreateModelOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    const context: ModelModalContext | null = "text-image";
    onModelPickerOpen("create-model", event.currentTarget, context);
  };

  const expandIfCollapsed = (step: "model" | "prompt" | "imageSettings") => {
    setCollapsedSteps((prev) => {
      if (!prev[step]) {
        return prev;
      }
      const next = { ...prev, [step]: false };
      onStepActionClick?.(step);
      return next;
    });
  };

  const imageResolutionOptions = useMemo(() => getImageResolutionOptions(modelId), [modelId]);
  const imageResolutionValue = useMemo(
    () => clampImageResolutionForModel(modelId, imageResolution),
    [imageResolution, modelId]
  );
  const shouldShowImageResolutionCard = useMemo(() => {
    if (imageResolutionOptions.length !== 1) return true;
    return imageResolutionOptions[0]?.value !== MODEL_DEFAULT_IMAGE_RESOLUTION;
  }, [imageResolutionOptions]);

  // Auto-clamp invalid image resolution values when switching image models.
  useEffect(() => {
    if (!onImageResolutionChange) return;
    if (imageResolutionValue !== imageResolution) {
      onImageResolutionChange(imageResolutionValue);
    }
  }, [imageResolution, imageResolutionValue, onImageResolutionChange]);

  return (
    <div className="tool-properties text-properties-panel">
      {!beginnerMode ? (
        <div
          className="step-card character-step-card"
          role="group"
          aria-label="Choose character section"
        >
          <div className="step-card-header">
            <div className="step-header-copy">
              <p className="step-title">Choose Character</p>
              <span className="step-subtitle tiny helper-text">
                Select a user with pre-created character profiles.
              </span>
            </div>
            <div className="step-header-actions">
              <div className="fixed-select character-owner-header">
                <select
                  className="model-select character-owner-header-select"
                  aria-label="Character owner"
                  value={selectedCharacterOwner}
                  onChange={(event) => setSelectedCharacterOwner(event.target.value)}
                >
                  <option value="" disabled>
                    Choose Character
                  </option>
                  {PREBUILT_CHARACTER_OWNER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <PromptStep
        stepNumber={promptStepNumber}
        title="Build Your Prompt"
        subtitle="Describe what you want to make. Enter to send, Shift+Enter for a new line."
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
        chatOnly
      />
      <div
        className={`step-card ${collapsedSteps.model ? "is-collapsed" : ""}`}
        onClick={() => expandIfCollapsed("model")}
        role="group"
        aria-label="Choose frame and model section"
      >
        <div className="step-card-header">
          {beginnerMode && <span className="step-badge">2</span>}
          <div className="step-header-copy">
            <p className="step-title">Choose Frame & Model</p>
            <span className="step-subtitle tiny helper-text">
              Select the model, then choose the aspect ratio.
            </span>
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
          <div className="create-controls frame-model-controls">
            <div className="control-row compact">
              <label className="input-label">Model</label>
              <button
                type="button"
                className={`model-picker-btn ${!modelId ? "is-empty" : ""} ${isModelModalOpen && modelModalAnchor === "create-model" ? "is-open" : ""}`}
                data-model-anchor="create-model"
                onClick={handleCreateModelOpen}
              >
                <div className="model-picker-row">
                  <span className="model-picker-value">
                    {modelLogoSrc ? (
                      <Image
                        className="model-chip-logo-img"
                        src={modelLogoSrc}
                        alt=""
                        aria-hidden
                        width={80}
                        height={20}
                      />
                    ) : null}
                    <span className="model-picker-name">{modelLabel}</span>
                  </span>
                </div>
              </button>
            </div>
            <div className="control-row compact">
              <label className="input-label">Aspect ratio</label>
              <AspectDropdown
                aspect={aspect}
                onSelect={onAspectChange}
                options={aspectOptionsForModel}
              />
            </div>
          </div>
        ) : null}
      </div>
      {!beginnerMode && shouldShowImageResolutionCard ? (
        <div
          className={`step-card image-settings-card ${collapsedSteps.imageSettings ? "is-collapsed" : ""}`}
          onClick={() => expandIfCollapsed("imageSettings")}
          role="group"
          aria-label="Choose image resolution section"
        >
          <div className="step-card-header">
            <div className="step-header-copy">
              <p className="step-title">Choose Image Resolution</p>
              <span className="step-subtitle tiny helper-text">
                Select the model-specific image resolution setting.
              </span>
            </div>
            <div className="step-header-actions">
              <StepHeaderActionButton
                label="Open image resolution settings"
                isCollapsed={collapsedSteps.imageSettings}
                onClick={() => toggleStep("imageSettings")}
              />
            </div>
          </div>
          {!collapsedSteps.imageSettings ? (
            <div className="create-controls image-settings-controls">
              <div className="control-row compact fixed-select">
                <label className="input-label">Resolution</label>
                <select
                  className="model-select"
                  value={imageResolutionValue}
                  onChange={(event) => onImageResolutionChange?.(event.target.value)}
                >
                  {imageResolutionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ComposeSendCard({
  agentEnabled = false,
  agentError,
  onGenerate,
  costCredits,
  isPromptGenerating = false,
  isGenerateDisabled = false,
  beginnerMode = false,
}: ComposeSendCardProps) {
  const costValue = costCredits != null ? costCredits : "—";

  return (
    <div className="step-card prompt-step generate-step-card">
      <div className="step-card-header">
        {beginnerMode && <span className="step-badge">3</span>}
        <div className="step-header-copy">
          {beginnerMode ? <p className="step-title">Generate</p> : null}
          <span className="step-subtitle tiny helper-text">
            Run generation with the current prompt and selections.
          </span>
        </div>
      </div>
      <div className="create-controls single-control">
        <AgentGenerateButton
          onClick={onGenerate}
          disabled={isGenerateDisabled || isPromptGenerating}
          isBusy={isPromptGenerating}
          cost={costValue}
        />
        {/* Guardrail warning intentionally hidden; disabled button communicates state. */}
        {agentEnabled && agentError ? <div className="inline-error-hint">{agentError}</div> : null}
      </div>
    </div>
  );
}
