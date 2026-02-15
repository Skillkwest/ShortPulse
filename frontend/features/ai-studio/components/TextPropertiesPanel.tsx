/**
 * Text properties panel for AI Studio.
 * Handles prompt entry plus model/aspect controls for text-to-image generation.
 */
import Image from "next/image";
import React, { useEffect, useMemo } from "react";
import { CaretDown, X } from "phosphor-react";
import { AspectDropdown } from "./AspectDropdown";
import { AspectOption, StudioMode } from "../types";
import { aspectOptions, modelLogos } from "../constants";
import type { ModelModalContext } from "./ModelModal";
import { AgentGenerateButton } from "../../../prefabs/agent";
import type { AgentActions, AgentAttachment, AgentMessage } from "../../../prefabs/agent";
import { PromptStep } from "./PromptStep";
import {
  MODEL_DEFAULT_IMAGE_RESOLUTION,
  clampImageResolutionForModel,
  getImageResolutionOptions,
} from "../logic/imageResolution";
import { getModelConfig } from "../logic/modelRegistry";

const CHARACTER_MODE_UI_MODEL_LABEL = "Pulse Character";
const CHARACTER_MODE_UI_MODEL_LOGO = "/tiny%20logo.png";

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
  agentPrimarySource?: "agent" | "manual" | "reference";
  stagedPrompt?: string | null;
  stagedAttachments?: AgentAttachment[];
  agentDropActive?: boolean;
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
  onAgentAttachmentDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onRemoveAgentAttachment?: (id: string) => void;
  onClearAgentAttachments?: () => void;
  onAgentApplyPrompt?: (prompt: string) => void;
  onAgentSelectVariation?: (prompt: string) => void;
  onAgentUseQuestion?: (question: string) => void;
  onAgentDescribeTargets?: (targets: string[]) => void;
  onGenerate: () => void;
  onSavePrompt: (customPrompt?: string) => void;
  shouldDisableSave?: boolean;
  onClearAgentChat?: () => void;
  beginnerMode?: boolean;
  imageResolution?: string;
  onImageResolutionChange?: (value: string) => void;
  characterOptions?: Array<{ id: string; name: string; profileImageUrl?: string | null }>;
  selectedCharacterId?: string;
  onSelectedCharacterIdChange?: (value: string) => void;
  isCharacterOptionsLoading?: boolean;
  characterModeEnabled?: boolean;
  onCharacterModeEnabledChange?: (value: boolean) => void;
};

type ComposeSendCardProps = {
  agentEnabled?: boolean;
  agentError?: string;
  onGenerate: () => void;
  costCredits?: number | null;
  isPromptGenerating?: boolean;
  isGenerateDisabled?: boolean;
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

const getCharacterInitials = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
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
  agentPrimarySource = "manual",
  stagedPrompt = null,
  stagedAttachments = [],
  agentDropActive = false,
  onExpandChat,
  onStepActionClick,
  onAgentInputChange,
  onAgentSend,
  onAgentEnhanceSend,
  onAgentMessageClick,
  onAgentAttachmentDrop,
  onAgentAttachmentDragOver,
  onAgentAttachmentDragEnter,
  onAgentAttachmentDragLeave,
  onRemoveAgentAttachment,
  onClearAgentAttachments,
  onAgentApplyPrompt,
  onAgentSelectVariation,
  onAgentUseQuestion,
  onAgentDescribeTargets,
  agentChatOpen = false,
  onSavePrompt,
  shouldDisableSave = false,
  isPromptGenerating = false,
  onClearAgentChat,
  beginnerMode = false,
  imageResolution,
  onImageResolutionChange,
  characterOptions = [],
  selectedCharacterId = "",
  onSelectedCharacterIdChange,
  isCharacterOptionsLoading = false,
  characterModeEnabled = true,
  onCharacterModeEnabledChange,
}: TextPropertiesPanelProps) {
  const promptStepNumber = beginnerMode ? "2" : "1";
  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;
  const effectiveModelLabel = characterModeEnabled ? CHARACTER_MODE_UI_MODEL_LABEL : modelLabel;
  const effectiveModelLogoSrc = characterModeEnabled ? CHARACTER_MODE_UI_MODEL_LOGO : modelLogoSrc;
  const useUnoptimizedModelLogo =
    characterModeEnabled && effectiveModelLogoSrc === CHARACTER_MODE_UI_MODEL_LOGO;
  const isModelPickerLockedByCharacterMode = characterModeEnabled;
  const modelConfig = useMemo(() => (modelId ? getModelConfig(modelId) : null), [modelId]);
  const aspectOptionsForModel: AspectOption[] = useMemo(() => {
    if (modelConfig?.allowedAspects?.length) {
      return aspectOptions.filter((opt) => modelConfig.allowedAspects.includes(opt.value));
    }
    return aspectOptions;
  }, [modelConfig]);
  const [collapsedSteps, setCollapsedSteps] = React.useState<{
    model: boolean;
    prompt: boolean;
  }>({
    model: false,
    prompt: false,
  });
  const [isCharacterPickerOpen, setIsCharacterPickerOpen] = React.useState(false);

  const toggleStep = (step: "model" | "prompt") => {
    setCollapsedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
    onStepActionClick?.(step);
  };

  const handleCreateModelOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    const context: ModelModalContext | null = "text-image";
    onModelPickerOpen("create-model", event.currentTarget, context);
  };

  const expandIfCollapsed = (step: "model" | "prompt") => {
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
  const hasCharacterOptions = characterOptions.length > 0;
  const characterSelectDisabled =
    isCharacterOptionsLoading || !hasCharacterOptions || !characterModeEnabled;
  const characterSelectPlaceholder = !characterModeEnabled
    ? "Character mode is off"
    : isCharacterOptionsLoading
      ? "Loading characters..."
      : hasCharacterOptions
        ? "Choose Character"
        : "No characters available";
  const selectedCharacterOption = useMemo(
    () => characterOptions.find((option) => option.id === selectedCharacterId) ?? null,
    [characterOptions, selectedCharacterId]
  );

  // Auto-clamp invalid image resolution values when switching image models.
  useEffect(() => {
    if (!onImageResolutionChange) return;
    if (imageResolutionValue !== imageResolution) {
      onImageResolutionChange(imageResolutionValue);
    }
  }, [imageResolution, imageResolutionValue, onImageResolutionChange]);

  useEffect(() => {
    if (!isCharacterPickerOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsCharacterPickerOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isCharacterPickerOpen]);

  return (
    <div className="tool-properties text-properties-panel">
      <div className="tool-header">
        <p className="eyebrow">Create</p>
      </div>
      <div
        className="step-card character-step-card"
        role="group"
        aria-label="Character mode section"
      >
        <div className="step-card-header">
          {beginnerMode ? <span className="step-badge">1</span> : null}
          <div className="step-header-copy">
            <p className="step-title">
              Character Mode
              {!characterModeEnabled ? (
                <span className="step-title-optional">(Optional)</span>
              ) : null}
            </p>
            <span className="step-subtitle tiny helper-text">
              Select one of your Character Manager profiles.
            </span>
          </div>
          <div
            className={`step-header-actions character-header-actions ${
              !characterModeEnabled ? "character-header-actions--mode-off" : ""
            }`}
          >
            <div className="character-mode-row">
              <button
                type="button"
                className={`audio-toggle character-mode-toggle ${characterModeEnabled ? "is-active" : ""}`}
                aria-pressed={characterModeEnabled}
                aria-label={
                  characterModeEnabled ? "Disable character mode" : "Enable character mode"
                }
                onClick={() => {
                  onCharacterModeEnabledChange?.(!characterModeEnabled);
                  onStepActionClick?.("character");
                }}
              >
                <span className="audio-toggle-track" aria-hidden="true">
                  <span className="audio-toggle-dot" />
                </span>
              </button>
            </div>
            <div
              className={`character-picker-row ${characterModeEnabled ? "is-visible" : "is-hidden"}`}
              aria-hidden={!characterModeEnabled}
            >
              <button
                type="button"
                className={`model-picker-btn character-picker-trigger ${
                  !selectedCharacterOption ? "is-empty" : ""
                } ${isCharacterPickerOpen ? "is-open" : ""}`}
                aria-haspopup="dialog"
                aria-expanded={isCharacterPickerOpen}
                aria-label="Open character picker"
                disabled={characterSelectDisabled}
                onClick={() => setIsCharacterPickerOpen(true)}
              >
                <div className="model-picker-row">
                  <span className="character-picker-trigger-value">
                    {selectedCharacterOption?.profileImageUrl ? (
                      <Image
                        src={selectedCharacterOption.profileImageUrl}
                        alt={`${selectedCharacterOption.name} profile`}
                        className="character-picker-trigger-avatar"
                        width={24}
                        height={24}
                        unoptimized
                      />
                    ) : selectedCharacterOption ? (
                      <span className="character-picker-trigger-avatar character-picker-trigger-avatar--fallback">
                        {getCharacterInitials(selectedCharacterOption.name)}
                      </span>
                    ) : null}
                    <span className="model-picker-name">
                      {selectedCharacterOption?.name ?? characterSelectPlaceholder}
                    </span>
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
      {isCharacterPickerOpen && characterModeEnabled ? (
        <>
          <div
            className="model-modal-backdrop character-picker-backdrop"
            onClick={() => setIsCharacterPickerOpen(false)}
          />
          <div
            className="model-modal character-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Choose character"
          >
            <div className="model-modal-header">
              <div className="model-modal-title-group">
                <h3 className="model-modal-title">Character Picker</h3>
                <p className="model-modal-subtitle">
                  Select a character profile from Character Manager.
                </p>
              </div>
              <button
                type="button"
                className="ghost-btn mini model-modal-close"
                aria-label="Close character picker"
                onClick={() => setIsCharacterPickerOpen(false)}
              >
                <X size={16} weight="bold" />
              </button>
            </div>
            <div className="model-modal-scroll">
              {characterOptions.length > 0 ? (
                <div className="character-picker-grid" role="list" aria-label="Character options">
                  {characterOptions.map((option) => {
                    const isActive = option.id === selectedCharacterId;
                    return (
                      <article
                        key={option.id}
                        role="listitem"
                        className={`character-list-card character-picker-card ${
                          isActive ? "is-active" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="character-list-select-btn"
                          aria-pressed={isActive}
                          onClick={() => {
                            onSelectedCharacterIdChange?.(option.id);
                            setIsCharacterPickerOpen(false);
                          }}
                        >
                          <div className="character-list-main">
                            <span className="character-list-avatar" aria-hidden="true">
                              {option.profileImageUrl ? (
                                <Image
                                  src={option.profileImageUrl}
                                  alt=""
                                  className="character-list-avatar-image"
                                  width={44}
                                  height={44}
                                  unoptimized
                                />
                              ) : (
                                <span className="character-list-avatar-initials">
                                  {getCharacterInitials(option.name)}
                                </span>
                              )}
                            </span>
                            <div className="character-list-copy">
                              <p className="metric-label tiny">
                                {isActive ? "Selected" : "Character"}
                              </p>
                              <p className="character-list-name">{option.name}</p>
                            </div>
                          </div>
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="tiny subdued character-picker-empty">
                  No character profiles available.
                </p>
              )}
            </div>
          </div>
        </>
      ) : null}
      <PromptStep
        stepNumber={promptStepNumber}
        title="Build Your Prompt"
        subtitle="Describe what you want to make. Enter to send, Shift+Enter for a new line."
        beginnerSubtitle="Send simple prompts to the agent to be refined into a high quality text prompt."
        prompt={prompt}
        onPromptChange={onPromptChange}
        agentEnabled={agentEnabled}
        agentMessages={agentMessages}
        agentActions={agentActions}
        agentInput={agentInput}
        agentIsSending={agentIsSending}
        agentError={agentError}
        agentPrimaryPrompt={prompt}
        agentPrimarySource={agentPrimarySource}
        stagedPrompt={stagedPrompt}
        stagedAttachments={stagedAttachments}
        agentDropActive={agentDropActive}
        agentChatOpen={agentChatOpen}
        onAgentInputChange={onAgentInputChange}
        onAgentSend={onAgentSend}
        onAgentEnhanceSend={onAgentEnhanceSend}
        onAgentMessageClick={onAgentMessageClick}
        onAgentAttachmentDrop={onAgentAttachmentDrop}
        onAgentAttachmentDragOver={onAgentAttachmentDragOver}
        onAgentAttachmentDragEnter={onAgentAttachmentDragEnter}
        onAgentAttachmentDragLeave={onAgentAttachmentDragLeave}
        onRemoveAgentAttachment={onRemoveAgentAttachment}
        onClearAgentAttachments={onClearAgentAttachments}
        onExpandChat={onExpandChat}
        onClearAgentChat={onClearAgentChat}
        onAgentApplyPrompt={onAgentApplyPrompt}
        onAgentSelectVariation={onAgentSelectVariation}
        onAgentUseQuestion={onAgentUseQuestion}
        onAgentDescribeTargets={onAgentDescribeTargets}
        onSavePrompt={onSavePrompt}
        isCollapsed={collapsedSteps.prompt}
        onToggleCollapse={() => toggleStep("prompt")}
        isGenerating={isPromptGenerating}
        shouldDisableSave={shouldDisableSave}
        beginnerMode={beginnerMode}
        chatOnly
        beginnerPinHelperText="Click this button to pin your prompt to the reference grid."
        chatPromptSaveButtonClassName="create-chat-pin-btn"
        chatPromptSaveButtonUnstyled
      />
      <div
        className={`step-card ${collapsedSteps.model ? "is-collapsed" : ""}`}
        onClick={() => expandIfCollapsed("model")}
        role="group"
        aria-label="Choose frame and model section"
      >
        <div className="step-card-header">
          {beginnerMode && <span className="step-badge">3</span>}
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
                className={`model-picker-btn ${!modelId ? "is-empty" : ""} ${isModelModalOpen && modelModalAnchor === "create-model" ? "is-open" : ""} ${
                  isModelPickerLockedByCharacterMode ? "is-locked" : ""
                }`}
                data-model-anchor="create-model"
                disabled={isModelPickerLockedByCharacterMode}
                aria-label={
                  isModelPickerLockedByCharacterMode
                    ? "Model locked while character mode is enabled"
                    : "Open model picker"
                }
                onClick={handleCreateModelOpen}
              >
                <div className="model-picker-row">
                  <span className="model-picker-value">
                    {effectiveModelLogoSrc ? (
                      <Image
                        className="model-chip-logo-img"
                        src={effectiveModelLogoSrc}
                        alt=""
                        aria-hidden
                        width={80}
                        height={20}
                        unoptimized={useUnoptimizedModelLogo}
                      />
                    ) : null}
                    <span className="model-picker-name">{effectiveModelLabel}</span>
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
          className="step-card image-settings-card image-settings-card--inline"
          role="group"
          aria-label="Choose image resolution section"
        >
          <div className="step-card-header">
            <div className="step-header-copy">
              <p className="step-title">Choose Image Resolution</p>
            </div>
            <div className="step-header-actions">
              <div className="fixed-select image-settings-header-select">
                <select
                  className="model-select"
                  aria-label="Image resolution"
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
          </div>
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
        {beginnerMode && <span className="step-badge">4</span>}
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
