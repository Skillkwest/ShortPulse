/**
 * Create properties panel for AI Studio.
 * Handles prompt entry plus model/aspect controls for create workflows.
 */
import Image from "next/image";
import React, { useEffect, useMemo } from "react";
import { X } from "phosphor-react";
import type { AspectOption, StudioMode } from "../types";
import { aspectOptions, modelLogos } from "../constants";
import type { ModelModalContext } from "./ModelModal";
import { AgentGenerateButton } from "../../../prefabs/agent";
import type {
  AgentActions,
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
  AgentOutputGenerateInput,
} from "../../../prefabs/agent";
import { PromptStep } from "./PromptStep";
import { deriveCreateSelectorViewState } from "../logic/createSelectorState";
import { getModelConfig } from "../logic/modelRegistry";
import { BeginnerCreatePanelView } from "./create/BeginnerCreatePanelView";
import { ExpertCreatePanelView } from "./create/ExpertCreatePanelView";
import {
  getCreateCharacterInitials,
  type CreateCharacterOption,
  useCreateCharacterModeController,
} from "./create/useCreateCharacterModeController";

export type CreatePropertiesPanelProps = {
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
  chatModeEnabled?: boolean;
  agentIsSending?: boolean;
  agentError?: string;
  agentPrimarySource?: "agent" | "manual" | "reference";
  stagedPrompt?: string | null;
  assistantBubbleMedia?: Record<string, AgentOutputBubbleMediaState>;
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
  outputGenerateCostCredits?: number | null;
  hasSufficientCreditsForOutputGenerate?: boolean;
  guardrailReason?: string | null;
  onExpandChat?: () => void;
  onStepActionClick?: (step: "character" | "model" | "prompt" | "imageSettings") => void;
  agentChatOpen?: boolean;
  onAgentInputChange?: (value: string) => void;
  onChatModeEnabledChange?: (value: boolean) => void;
  onAgentSend?: () => void;
  onAgentEnhanceSend?: () => void;
  onAgentAttachmentDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onRemoveAgentAttachment?: (id: string) => void;
  onClearAgentAttachments?: () => void;
  onAgentApplyPrompt?: (prompt: string) => void;
  onAgentSelectVariation?: (prompt: string) => void;
  onAgentDescribeTargets?: (targets: string[]) => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onGenerateFromAgentOutputPrompt?: (request: AgentOutputGenerateInput) => void;
  onGenerate: () => void;
  onSavePrompt: (customPrompt?: string) => void;
  shouldDisableSave?: boolean;
  onClearAgentChat?: () => void;
  beginnerMode?: boolean;
  expertCreateUiEligible?: boolean;
  imageResolution?: string;
  onImageResolutionChange?: (value: string) => void;
  characterOptions?: CreateCharacterOption[];
  selectedCharacterId?: string;
  onSelectedCharacterIdChange?: (value: string) => void;
  isCharacterOptionsLoading?: boolean;
  characterModeEnabled?: boolean;
  onCharacterModeEnabledChange?: (value: boolean) => void;
};

/**
 * @deprecated Use `CreatePropertiesPanelProps`.
 */
export type TextPropertiesPanelProps = CreatePropertiesPanelProps;

type ComposeSendCardProps = {
  agentEnabled?: boolean;
  agentError?: string;
  onGenerate: () => void;
  costCredits?: number | null;
  isPromptGenerating?: boolean;
  isGenerateDisabled?: boolean;
  beginnerMode?: boolean;
};

type CharacterPickerModalProps = {
  isOpen: boolean;
  characterModeEnabled: boolean;
  onClose: () => void;
  characterOptions: CreateCharacterOption[];
  selectedCharacterId: string;
  onSelectedCharacterIdChange?: (value: string) => void;
};

const CharacterPickerModal = ({
  isOpen,
  characterModeEnabled,
  onClose,
  characterOptions,
  selectedCharacterId,
  onSelectedCharacterIdChange,
}: CharacterPickerModalProps) => {
  if (!isOpen || !characterModeEnabled) {
    return null;
  }

  return (
    <>
      <div className="model-modal-backdrop character-picker-backdrop" onClick={onClose} />
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
            onClick={onClose}
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
                    className={`character-list-card character-picker-card ${isActive ? "is-active" : ""}`}
                  >
                    <button
                      type="button"
                      className="character-list-select-btn"
                      aria-pressed={isActive}
                      onClick={() => {
                        onSelectedCharacterIdChange?.(option.id);
                        onClose();
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
                              {getCreateCharacterInitials(option.name)}
                            </span>
                          )}
                        </span>
                        <div className="character-list-copy">
                          <p className="metric-label tiny">{isActive ? "Selected" : "Character"}</p>
                          <p className="character-list-name">{option.name}</p>
                        </div>
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="tiny subdued character-picker-empty">No character profiles available.</p>
          )}
        </div>
      </div>
    </>
  );
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
  isModelModalOpen,
  modelModalAnchor,
  onAspectChange,
  onModelPickerOpen,
  onPromptChange,
  costCredits = null,
  agentEnabled = false,
  agentMessages = [],
  agentActions,
  agentInput = "",
  chatModeEnabled = true,
  agentIsSending = false,
  agentError,
  agentPrimarySource = "manual",
  stagedPrompt = null,
  assistantBubbleMedia,
  stagedAttachments = [],
  agentDropActive = false,
  onExpandChat,
  onStepActionClick,
  onAgentInputChange,
  onChatModeEnabledChange,
  onAgentSend,
  onAgentEnhanceSend,
  onAgentAttachmentDrop,
  onAgentAttachmentDragOver,
  onAgentAttachmentDragEnter,
  onAgentAttachmentDragLeave,
  onRemoveAgentAttachment,
  onClearAgentAttachments,
  onAgentApplyPrompt,
  onAgentSelectVariation,
  onAgentDescribeTargets,
  onAssistantMessageEdit,
  onGenerateFromAgentOutputPrompt,
  agentChatOpen = false,
  onSavePrompt,
  shouldDisableSave = false,
  isPromptGenerating = false,
  isGenerateDisabled = false,
  outputGenerateCostCredits = null,
  hasSufficientCreditsForOutputGenerate = true,
  onClearAgentChat,
  beginnerMode = false,
  expertCreateUiEligible = false,
  imageResolution,
  onImageResolutionChange,
  characterOptions = [],
  selectedCharacterId = "",
  onSelectedCharacterIdChange,
  isCharacterOptionsLoading = false,
  characterModeEnabled = true,
  onCharacterModeEnabledChange,
  onGenerate,
}: CreatePropertiesPanelProps) {
  const showExpertView = Boolean(expertCreateUiEligible && !beginnerMode);
  const promptStepNumber = beginnerMode ? "2" : "1";
  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;
  const effectiveModelLabel = modelLabel;
  const effectiveModelLogoSrc = modelLogoSrc;
  const useUnoptimizedModelLogo = false;
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
  const {
    characterStepSubtitle,
    isCharacterPickerOpen,
    openCharacterPicker,
    closeCharacterPicker,
    handleCharacterModeEnabledToggle,
    characterSelectDisabled,
    isCharacterSelectionEmpty,
    selectedCharacterName,
    selectedCharacterProfileImageUrl,
    selectedCharacterInitials,
  } = useCreateCharacterModeController({
    beginnerMode,
    characterModeEnabled,
    characterOptions,
    selectedCharacterId,
    isCharacterOptionsLoading,
    onCharacterModeEnabledChange,
    onStepActionClick,
  });

  const toggleStep = (step: "model" | "prompt") => {
    setCollapsedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
    onStepActionClick?.(step);
  };

  const handleCreateModelOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    const context: ModelModalContext | null = "text-image";
    onModelPickerOpen("create-model", event.currentTarget, context);
    onStepActionClick?.("model");
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

  const selectorViewState = useMemo(
    () =>
      deriveCreateSelectorViewState({
        mode,
        modelId,
        isModelModalOpen,
        modelModalAnchor,
        isGenerateDisabled,
        hasSufficientCreditsForOutputGenerate,
        characterModeEnabled,
        selectedCharacterId,
        imageResolution,
      }),
    [
      characterModeEnabled,
      hasSufficientCreditsForOutputGenerate,
      imageResolution,
      isGenerateDisabled,
      isModelModalOpen,
      mode,
      modelId,
      modelModalAnchor,
      selectedCharacterId,
    ]
  );
  const {
    imageResolutionOptions,
    imageResolutionValue,
    shouldShowImageResolutionCard,
    isModelSelectionEmpty,
    isCreateModelPickerOpen,
    disableOutputGenerate,
  } = selectorViewState;

  // Auto-clamp invalid image resolution values when switching image models.
  useEffect(() => {
    if (!onImageResolutionChange) return;
    if (imageResolutionValue !== imageResolution) {
      onImageResolutionChange(imageResolutionValue);
    }
  }, [imageResolution, imageResolutionValue, onImageResolutionChange]);

  const sharedPromptStepProps = {
    prompt,
    onPromptChange,
    agentEnabled,
    agentMessages,
    agentActions,
    agentInput,
    agentIsSending,
    agentError,
    agentPrimaryPrompt: prompt,
    agentPrimarySource,
    stagedPrompt,
    assistantBubbleMedia,
    stagedAttachments,
    agentDropActive,
    agentChatOpen,
    onAgentInputChange,
    chatModeEnabled,
    onChatModeEnabledChange,
    onAgentSend,
    onAgentEnhanceSend,
    onAgentAttachmentDrop,
    onAgentAttachmentDragOver,
    onAgentAttachmentDragEnter,
    onAgentAttachmentDragLeave,
    onRemoveAgentAttachment,
    onClearAgentAttachments,
    onExpandChat,
    onClearAgentChat,
    onAgentApplyPrompt,
    onAgentSelectVariation,
    onAgentDescribeTargets,
    onAssistantMessageEdit,
    onGenerateOutputPrompt: onGenerateFromAgentOutputPrompt,
    onSavePrompt,
    isGenerating: isPromptGenerating,
    showGenerationThinkingInChat: false,
    shouldDisableSave,
    disableOutputGenerate,
    outputGenerateCostCredits,
    chatOnly: true,
    chatPromptSaveButtonClassName: "create-chat-pin-btn",
    chatPromptSaveButtonUnstyled: true,
  } satisfies Omit<
    React.ComponentProps<typeof PromptStep>,
    "stepNumber" | "isCollapsed" | "onToggleCollapse"
  >;

  const beginnerPromptStepProps: React.ComponentProps<typeof PromptStep> = {
    ...sharedPromptStepProps,
    stepNumber: promptStepNumber,
    title: "Build Your Prompt",
    subtitle: "Describe what you want to make. Enter to send, Shift+Enter for a new line.",
    beginnerSubtitle:
      "Send simple prompts to the agent to be refined into a high quality text prompt.",
    beginnerPinHelperText: "Click this button to pin your prompt to the reference grid.",
    isCollapsed: collapsedSteps.prompt,
    onToggleCollapse: () => toggleStep("prompt"),
    beginnerMode,
  };

  const expertPromptStepProps: React.ComponentProps<typeof PromptStep> = {
    ...sharedPromptStepProps,
    stepNumber: "1",
    title: "Ask anything",
    subtitle: "",
    beginnerPinHelperText: "",
    isCollapsed: false,
    onToggleCollapse: () => {
      // Expert mode keeps chat composer always open.
    },
    beginnerMode: false,
    className: `create-expert-prompt-step ${
      characterModeEnabled ? "is-character-mode-on" : "is-character-mode-off"
    }`,
    embedSendButtonInInput: true,
    hideAgentIntroMessage: true,
    agentAttachmentDropTarget: "input",
    highlightLatestAssistantOnly: true,
    agentInputMaxHeightPx: 132,
  };

  return (
    <>
      {showExpertView ? (
        <ExpertCreatePanelView
          promptStepProps={expertPromptStepProps}
          onGenerate={onGenerate}
          costCredits={costCredits}
          isPromptGenerating={isPromptGenerating}
          isGenerateDisabled={isGenerateDisabled}
          characterModeEnabled={characterModeEnabled}
          onCharacterModeEnabledToggle={handleCharacterModeEnabledToggle}
          onCharacterPickerOpen={openCharacterPicker}
          characterSelectDisabled={characterSelectDisabled}
          isCharacterSelectionEmpty={isCharacterSelectionEmpty}
          selectedCharacterName={selectedCharacterName}
          selectedCharacterProfileImageUrl={selectedCharacterProfileImageUrl}
          selectedCharacterInitials={selectedCharacterInitials}
          isCharacterPickerOpen={isCharacterPickerOpen}
          isCreateModelPickerOpen={isCreateModelPickerOpen}
          isModelSelectionEmpty={isModelSelectionEmpty}
          onCreateModelOpen={handleCreateModelOpen}
          effectiveModelLogoSrc={effectiveModelLogoSrc}
          useUnoptimizedModelLogo={useUnoptimizedModelLogo}
          effectiveModelLabel={effectiveModelLabel}
          aspect={aspect}
          aspectOptionsForModel={aspectOptionsForModel}
          onAspectChange={onAspectChange}
          shouldShowImageResolutionCard={shouldShowImageResolutionCard}
          imageResolutionValue={imageResolutionValue}
          imageResolutionOptions={imageResolutionOptions}
          onImageResolutionChange={(value) => {
            onImageResolutionChange?.(value);
            onStepActionClick?.("imageSettings");
          }}
        />
      ) : (
        <BeginnerCreatePanelView
          beginnerMode={beginnerMode}
          promptStepProps={beginnerPromptStepProps}
          characterStepSubtitle={characterStepSubtitle}
          characterModeEnabled={characterModeEnabled}
          onCharacterModeEnabledToggle={handleCharacterModeEnabledToggle}
          onCharacterPickerOpen={openCharacterPicker}
          characterSelectDisabled={characterSelectDisabled}
          isCharacterSelectionEmpty={isCharacterSelectionEmpty}
          selectedCharacterName={selectedCharacterName}
          selectedCharacterProfileImageUrl={selectedCharacterProfileImageUrl}
          selectedCharacterInitials={selectedCharacterInitials}
          isCharacterPickerOpen={isCharacterPickerOpen}
          collapsedModel={collapsedSteps.model}
          onToggleModel={() => toggleStep("model")}
          onExpandModel={() => expandIfCollapsed("model")}
          isCreateModelPickerOpen={isCreateModelPickerOpen}
          isModelSelectionEmpty={isModelSelectionEmpty}
          onCreateModelOpen={handleCreateModelOpen}
          effectiveModelLogoSrc={effectiveModelLogoSrc}
          useUnoptimizedModelLogo={useUnoptimizedModelLogo}
          effectiveModelLabel={effectiveModelLabel}
          aspect={aspect}
          aspectOptionsForModel={aspectOptionsForModel}
          onAspectChange={onAspectChange}
          shouldShowImageResolutionCard={shouldShowImageResolutionCard}
          imageResolutionValue={imageResolutionValue}
          imageResolutionOptions={imageResolutionOptions}
          onImageResolutionChange={(value) => {
            onImageResolutionChange?.(value);
            onStepActionClick?.("imageSettings");
          }}
        />
      )}
      <CharacterPickerModal
        isOpen={isCharacterPickerOpen}
        characterModeEnabled={characterModeEnabled}
        onClose={closeCharacterPicker}
        characterOptions={characterOptions}
        selectedCharacterId={selectedCharacterId}
        onSelectedCharacterIdChange={onSelectedCharacterIdChange}
      />
    </>
  );
}

/**
 * @deprecated Use `CreatePropertiesPanel`.
 */
export const TextPropertiesPanel = CreatePropertiesPanel;

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
