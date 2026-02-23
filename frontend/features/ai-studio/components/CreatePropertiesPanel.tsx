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
import type { AgentActions, AgentAttachment, AgentMessage } from "../../../prefabs/agent";
import { PromptStep } from "./PromptStep";
import {
  MODEL_DEFAULT_IMAGE_RESOLUTION,
  clampImageResolutionForModel,
  getImageResolutionOptions,
} from "../logic/imageResolution";
import { getModelConfig } from "../logic/modelRegistry";
import { BeginnerCreatePanelView } from "./create/BeginnerCreatePanelView";
import { ExpertCreatePanelView } from "./create/ExpertCreatePanelView";

const CHARACTER_MODE_UI_MODEL_LABEL = "Pulse Character";
const CHARACTER_MODE_UI_MODEL_LOGO = "/tiny-logo.png";

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
  onModelIdChange?: (value: string | null) => void;
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
  onGenerateFromAgentOutputPrompt?: (prompt: string) => void;
  onGenerate: () => void;
  onSavePrompt: (customPrompt?: string) => void;
  shouldDisableSave?: boolean;
  onClearAgentChat?: () => void;
  beginnerMode?: boolean;
  expertCreateUiEligible?: boolean;
  imageResolution?: string;
  onImageResolutionChange?: (value: string) => void;
  characterOptions?: Array<{ id: string; name: string; profileImageUrl?: string | null }>;
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

const getCharacterInitials = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
};

type CharacterPickerModalProps = {
  isOpen: boolean;
  characterModeEnabled: boolean;
  onClose: () => void;
  characterOptions: Array<{ id: string; name: string; profileImageUrl?: string | null }>;
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
                              {getCharacterInitials(option.name)}
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
  onModelIdChange,
  onPromptChange,
  costCredits = null,
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
  onAgentAttachmentDrop,
  onAgentAttachmentDragOver,
  onAgentAttachmentDragEnter,
  onAgentAttachmentDragLeave,
  onRemoveAgentAttachment,
  onClearAgentAttachments,
  onAgentApplyPrompt,
  onAgentSelectVariation,
  onAgentDescribeTargets,
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
  const openCharacterPicker = React.useCallback(() => {
    setIsCharacterPickerOpen(true);
  }, []);
  const closeCharacterPicker = React.useCallback(() => {
    setIsCharacterPickerOpen(false);
  }, []);

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

  const handleCharacterModeEnabledToggle = React.useCallback(() => {
    const nextCharacterModeEnabled = !characterModeEnabled;
    if (showExpertView && characterModeEnabled && !nextCharacterModeEnabled) {
      onModelIdChange?.(null);
    }
    if (!nextCharacterModeEnabled) {
      closeCharacterPicker();
    }
    onCharacterModeEnabledChange?.(nextCharacterModeEnabled);
    onStepActionClick?.("character");
  }, [
    characterModeEnabled,
    closeCharacterPicker,
    onCharacterModeEnabledChange,
    onModelIdChange,
    onStepActionClick,
    showExpertView,
  ]);

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
  const characterStepSubtitle = beginnerMode
    ? "Toggle on character mode then select your character."
    : "Select one of your Character Manager profiles.";
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
  const selectedCharacterName = selectedCharacterOption?.name ?? characterSelectPlaceholder;
  const selectedCharacterProfileImageUrl = selectedCharacterOption?.profileImageUrl ?? null;
  const selectedCharacterInitials = selectedCharacterOption
    ? getCharacterInitials(selectedCharacterOption.name)
    : null;
  const isCreateToolInPromptOnlyMode = mode === "text";
  const disableOutputGenerate =
    isCreateToolInPromptOnlyMode ||
    isGenerateDisabled ||
    isPromptGenerating ||
    (characterModeEnabled ? !selectedCharacterId : !modelId) ||
    !hasSufficientCreditsForOutputGenerate;

  // Auto-clamp invalid image resolution values when switching image models.
  useEffect(() => {
    if (!onImageResolutionChange) return;
    if (imageResolutionValue !== imageResolution) {
      onImageResolutionChange(imageResolutionValue);
    }
  }, [imageResolution, imageResolutionValue, onImageResolutionChange]);

  useEffect(() => {
    if (!characterModeEnabled && isCharacterPickerOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- keep picker state aligned immediately when character mode is externally disabled.
      closeCharacterPicker();
    }
  }, [characterModeEnabled, closeCharacterPicker, isCharacterPickerOpen]);

  useEffect(() => {
    if (!isCharacterPickerOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeCharacterPicker();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeCharacterPicker, isCharacterPickerOpen]);

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
    stagedAttachments,
    agentDropActive,
    agentChatOpen,
    onAgentInputChange,
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
    onGenerateOutputPrompt: onGenerateFromAgentOutputPrompt,
    onSavePrompt,
    isGenerating: isPromptGenerating,
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
          selectedCharacterName={selectedCharacterName}
          selectedCharacterProfileImageUrl={selectedCharacterProfileImageUrl}
          selectedCharacterInitials={selectedCharacterInitials}
          isCharacterPickerOpen={isCharacterPickerOpen}
          modelId={modelId}
          isModelModalOpen={isModelModalOpen}
          modelModalAnchor={modelModalAnchor}
          isModelPickerLockedByCharacterMode={isModelPickerLockedByCharacterMode}
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
          selectedCharacterName={selectedCharacterName}
          selectedCharacterProfileImageUrl={selectedCharacterProfileImageUrl}
          selectedCharacterInitials={selectedCharacterInitials}
          isCharacterPickerOpen={isCharacterPickerOpen}
          collapsedModel={collapsedSteps.model}
          onToggleModel={() => toggleStep("model")}
          onExpandModel={() => expandIfCollapsed("model")}
          modelId={modelId}
          isModelModalOpen={isModelModalOpen}
          modelModalAnchor={modelModalAnchor}
          isModelPickerLockedByCharacterMode={isModelPickerLockedByCharacterMode}
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
