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
  AgentPulseWorkflowSession,
} from "../../../prefabs/agent";
import { PromptStep } from "./PromptStep";
import { StylesControl } from "./StylesControl";
import { deriveCreateSelectorViewState } from "../logic/createSelectorState";
import { getModelConfig } from "../logic/modelRegistry";
import { BeginnerCreatePanelView } from "./create/BeginnerCreatePanelView";
import { ExpertCreatePanelView } from "./create/ExpertCreatePanelView";
import type {
  CreatePulsePresetId,
  CreatePulseResolvedPreset,
  CreatePulseSavedPreset,
} from "./create/createPulsePresets";
import { resolveCreatePulsePresetById } from "./create/createPulsePresets";
import {
  getCreateCharacterInitials,
  type CreateCharacterOption,
  useCreateCharacterModeController,
} from "./create/useCreateCharacterModeController";
import type { ExpertEditStyleTile } from "./edit/expertEditStyles";
import { useAvatarResilience } from "../hooks/useAvatarResilience";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

export type ExpertCreateMode = "standard" | "pulse";

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
  directOpenAiBypassEnabled?: boolean;
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
  isChatOffInlineGenerateDisabled?: boolean;
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
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onGenerateFromAgentOutputPrompt?: (request: AgentOutputGenerateInput) => void;
  onGenerate: () => void;
  onChatOffInlineGenerate: () => void;
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
  refreshCharacterOptions?: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  resolveCharacterAvatarUrlById?: (characterId: string | null | undefined) => string | null;
  isStylesPanelOpen?: boolean;
  onStylesPanelToggle?: () => void;
  selectedStyleId?: string | null;
  stylesCatalog?: readonly ExpertEditStyleTile[];
  expertCreateMode?: ExpertCreateMode;
  onExpertCreateModeChange?: (value: ExpertCreateMode) => void;
  activePulsePresetId?: CreatePulsePresetId | null;
  pulseWorkflowSession?: AgentPulseWorkflowSession | null;
  onActivePulsePresetIdChange?: (presetId: CreatePulsePresetId | null) => void;
  onPulsePresetStart?: (preset: CreatePulseResolvedPreset) => Promise<void> | void;
  onPulsePresetRestart?: (preset: CreatePulseResolvedPreset) => Promise<void> | void;
  selectedPulsePresetIds?: readonly CreatePulsePresetId[];
  onSelectedPulsePresetIdsChange?: (presetIds: CreatePulsePresetId[]) => void;
  savedPulsePresets?: readonly CreatePulseSavedPreset[];
  onSavedPulsePresetsChange?: (presets: CreatePulseSavedPreset[]) => void;
  onOpenPresetsLibrary?: () => void;
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
  guardrailReason?: string | null;
  beginnerMode?: boolean;
};

type CharacterPickerModalProps = {
  isOpen: boolean;
  characterModeEnabled: boolean;
  isCharacterOptionsLoading: boolean;
  onClose: () => void;
  characterOptions: CreateCharacterOption[];
  selectedCharacterId: string;
  onSelectedCharacterIdChange?: (value: string) => void;
  refreshCharacterOptions?: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  resolveCharacterAvatarUrlById?: (characterId: string | null | undefined) => string | null;
};

const EXPERT_CREATE_AGENT_INPUT_MAX_HEIGHT_PX = 520;

const CharacterPickerModal = ({
  isOpen,
  characterModeEnabled,
  isCharacterOptionsLoading,
  onClose,
  characterOptions,
  selectedCharacterId,
  onSelectedCharacterIdChange,
  refreshCharacterOptions,
  resolveCharacterAvatarUrlById,
}: CharacterPickerModalProps) => {
  const { resolveAvatarUrl, clearAvatarFailure, handleAvatarError } = useAvatarResilience({
    surfaceId: "create-character-picker-list",
  });
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);
  const refreshNow = React.useCallback(async () => {
    if (!refreshCharacterOptions) return;
    setRefreshError(null);
    setIsRefreshing(true);
    try {
      await refreshCharacterOptions();
    } catch {
      setRefreshError("Unable to refresh character profiles.");
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCharacterOptions]);

  React.useEffect(() => {
    if (!isOpen || !characterModeEnabled) return;
    void refreshNow();
  }, [characterModeEnabled, isOpen, refreshNow]);
  useAiStudioModalActivity("create-character-picker-modal", isOpen && characterModeEnabled);

  if (!isOpen || !characterModeEnabled) {
    return null;
  }

  return (
    <AiStudioModalLayer>
      <>
        <div className="model-modal-backdrop ai-character-picker-backdrop" onClick={onClose} />
        <div
          className="model-modal ai-character-picker-modal"
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
              <div className="ai-character-picker-grid" role="list" aria-label="Character options">
                {characterOptions.map((option) => {
                  const isActive = option.id === selectedCharacterId;
                  const resolvedAvatarUrl = resolveAvatarUrl(
                    option.id,
                    resolveCharacterAvatarUrlById?.(option.id) ?? option.profileImageUrl ?? null
                  );
                  return (
                    <article
                      key={option.id}
                      role="listitem"
                      className={`ai-character-list-card ai-character-picker-card ${
                        isActive ? "is-active" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="ai-character-list-select-btn"
                        aria-pressed={isActive}
                        onClick={() => {
                          onSelectedCharacterIdChange?.(option.id);
                          onClose();
                        }}
                      >
                        <div className="ai-character-list-main">
                          <span className="ai-character-list-avatar" aria-hidden="true">
                            {resolvedAvatarUrl ? (
                              <Image
                                src={resolvedAvatarUrl}
                                alt=""
                                className="ai-character-list-avatar-image"
                                width={44}
                                height={44}
                                unoptimized
                                onLoad={() => {
                                  clearAvatarFailure(option.id);
                                }}
                                onError={() => {
                                  void handleAvatarError({
                                    avatarId: option.id,
                                    recoverAvatarUrl: async () => {
                                      const refreshedOptions = await refreshCharacterOptions?.();
                                      const refreshedAvatarUrl =
                                        refreshedOptions?.find((item) => item.id === option.id)
                                          ?.profileImageUrl ?? null;
                                      return (
                                        refreshedAvatarUrl?.trim() ??
                                        resolveCharacterAvatarUrlById?.(option.id) ??
                                        null
                                      );
                                    },
                                  });
                                }}
                              />
                            ) : (
                              <span className="ai-character-list-avatar-initials">
                                {getCreateCharacterInitials(option.name)}
                              </span>
                            )}
                          </span>
                          <div className="ai-character-list-copy">
                            <p className="metric-label tiny">
                              {isActive ? "Selected" : "Character"}
                            </p>
                            <p className="ai-character-list-name">{option.name}</p>
                          </div>
                        </div>
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : isCharacterOptionsLoading || isRefreshing ? (
              <p className="tiny subdued ai-character-picker-empty">
                Loading character profiles...
              </p>
            ) : refreshError ? (
              <div className="ai-character-picker-empty">
                <p className="tiny">{refreshError}</p>
                <button type="button" className="ghost-btn mini" onClick={() => void refreshNow()}>
                  Retry
                </button>
              </div>
            ) : (
              <p className="tiny subdued ai-character-picker-empty">
                No character profiles available.
              </p>
            )}
          </div>
        </div>
      </>
    </AiStudioModalLayer>
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
  directOpenAiBypassEnabled = false,
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
  onAssistantMessageEdit,
  onGenerateFromAgentOutputPrompt,
  agentChatOpen = false,
  onSavePrompt,
  shouldDisableSave = false,
  isPromptGenerating = false,
  isGenerateDisabled = false,
  isChatOffInlineGenerateDisabled = false,
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
  refreshCharacterOptions,
  resolveCharacterAvatarUrlById,
  isStylesPanelOpen = false,
  onStylesPanelToggle,
  selectedStyleId = null,
  stylesCatalog,
  expertCreateMode,
  onExpertCreateModeChange,
  activePulsePresetId,
  pulseWorkflowSession = null,
  onActivePulsePresetIdChange,
  onPulsePresetStart,
  onPulsePresetRestart,
  selectedPulsePresetIds,
  onSelectedPulsePresetIdsChange,
  savedPulsePresets,
  onSavedPulsePresetsChange,
  onOpenPresetsLibrary,
  onGenerate,
  onChatOffInlineGenerate,
  guardrailReason,
}: CreatePropertiesPanelProps) {
  const showExpertView = Boolean(expertCreateUiEligible && !beginnerMode);
  const isPulseCreateMode = showExpertView && expertCreateMode === "pulse";
  const effectiveChatModeEnabled = isPulseCreateMode ? true : chatModeEnabled;
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
  const { resolveAvatarUrl, clearAvatarFailure, handleAvatarError } = useAvatarResilience({
    surfaceId: "create-character-picker-trigger",
  });
  const handleCharacterPickerOpenRefresh = React.useCallback(() => {
    void refreshCharacterOptions?.();
  }, [refreshCharacterOptions]);
  const {
    characterStepSubtitle,
    isCharacterPickerOpen,
    openCharacterPicker,
    closeCharacterPicker,
    handleCharacterModeEnabledToggle,
    characterSelectDisabled,
    selectedCharacterName,
    selectedCharacterProfileImageUrl,
    selectedCharacterInitials,
  } = useCreateCharacterModeController({
    beginnerMode,
    characterModeEnabled,
    characterOptions,
    selectedCharacterId,
    isCharacterOptionsLoading,
    onCharacterPickerOpen: handleCharacterPickerOpenRefresh,
    onCharacterModeEnabledChange,
    onStepActionClick,
  });
  const selectedCharacterAvatarUrl = resolveAvatarUrl(
    selectedCharacterId,
    resolveCharacterAvatarUrlById?.(selectedCharacterId) ?? selectedCharacterProfileImageUrl ?? null
  );
  const isCharacterSelectionEmpty = !selectedCharacterAvatarUrl && !selectedCharacterInitials;
  const handleSelectedCharacterAvatarError = React.useCallback(() => {
    void handleAvatarError({
      avatarId: selectedCharacterId,
      recoverAvatarUrl: async () => {
        const refreshedOptions = await refreshCharacterOptions?.();
        const refreshedAvatarUrl =
          refreshedOptions?.find((item) => item.id === selectedCharacterId)?.profileImageUrl ??
          null;
        return (
          refreshedAvatarUrl?.trim() ?? resolveCharacterAvatarUrlById?.(selectedCharacterId) ?? null
        );
      },
    });
  }, [
    handleAvatarError,
    refreshCharacterOptions,
    resolveCharacterAvatarUrlById,
    selectedCharacterId,
  ]);
  const handleSelectedCharacterAvatarLoad = React.useCallback(() => {
    clearAvatarFailure(selectedCharacterId);
  }, [clearAvatarFailure, selectedCharacterId]);

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
  const activeWorkflowPulsePreset = useMemo(() => {
    if (expertCreateMode !== "pulse" || !activePulsePresetId) return null;
    const resolvedPreset = resolveCreatePulsePresetById(activePulsePresetId, savedPulsePresets);
    if (!resolvedPreset || resolvedPreset.runtimeMode !== "workflow_gpt") return null;
    return resolvedPreset;
  }, [activePulsePresetId, expertCreateMode, savedPulsePresets]);
  const activeWorkflowPulseSession = useMemo(() => {
    if (!activeWorkflowPulsePreset || !pulseWorkflowSession) return null;
    return pulseWorkflowSession.presetId === activeWorkflowPulsePreset.presetId
      ? pulseWorkflowSession
      : null;
  }, [activeWorkflowPulsePreset, pulseWorkflowSession]);
  const activeWorkflowPulseStatus = useMemo(() => {
    if (!activeWorkflowPulsePreset) return null;
    if (!activeWorkflowPulseSession) return "Ready to guide";
    switch (activeWorkflowPulseSession.status) {
      case "running":
        return "Running next step";
      case "awaiting_input":
        return "Awaiting your reply";
      case "completed":
        return "Completed";
      default:
        return "Ready to guide";
    }
  }, [activeWorkflowPulsePreset, activeWorkflowPulseSession]);
  const activeWorkflowPulseStep = useMemo(() => {
    if (!activeWorkflowPulsePreset) return null;
    if (activeWorkflowPulseSession?.currentStepLabel?.trim()) {
      return activeWorkflowPulseSession.currentStepLabel.trim();
    }
    if (
      typeof activeWorkflowPulseSession?.currentStepIndex === "number" &&
      Number.isFinite(activeWorkflowPulseSession.currentStepIndex) &&
      activeWorkflowPulseSession.currentStepIndex > 0
    ) {
      return `Step ${Math.trunc(activeWorkflowPulseSession.currentStepIndex)}`;
    }
    return null;
  }, [activeWorkflowPulsePreset, activeWorkflowPulseSession]);
  const activeWorkflowPulsePreview = useMemo(() => {
    if (!activeWorkflowPulsePreset) return null;
    const sessionArtifact = activeWorkflowPulseSession?.lastArtifact?.trim() ?? "";
    if (activeWorkflowPulseSession?.status === "completed" && sessionArtifact.length > 0) {
      return {
        label: "Final artifact",
        content: sessionArtifact,
      };
    }
    const sessionPrompt = activeWorkflowPulseSession?.currentStepPrompt?.trim() ?? "";
    if (sessionPrompt.length > 0) {
      return {
        label: activeWorkflowPulseSession?.status === "idle" ? "First step" : "Current step",
        content: sessionPrompt,
      };
    }
    const starterMessage = activeWorkflowPulsePreset.starterAssistantMessage?.trim() ?? "";
    if (starterMessage.length > 0) {
      return {
        label: "First step",
        content: starterMessage,
      };
    }
    return null;
  }, [activeWorkflowPulsePreset, activeWorkflowPulseSession]);
  const handleApplyWorkflowArtifact = React.useCallback(() => {
    const artifact = activeWorkflowPulseSession?.lastArtifact?.trim() ?? "";
    if (!artifact) return;
    onAgentApplyPrompt?.(artifact);
  }, [activeWorkflowPulseSession, onAgentApplyPrompt]);
  const handleRestartWorkflowPulse = React.useCallback(async () => {
    if (!activeWorkflowPulsePreset) return;
    if (onPulsePresetRestart) {
      await onPulsePresetRestart(activeWorkflowPulsePreset);
      return;
    }
    if (!onPulsePresetStart || !onClearAgentChat) return;
    onClearAgentChat?.();
    await onPulsePresetStart(activeWorkflowPulsePreset);
  }, [activeWorkflowPulsePreset, onClearAgentChat, onPulsePresetRestart, onPulsePresetStart]);
  const activeWorkflowPulseBanner = activeWorkflowPulsePreset ? (
    <div
      className="create-expert-workflow-session-banner"
      role="status"
      aria-live="polite"
      aria-label="Active pulse session"
    >
      <div className="create-expert-workflow-session-banner-header">
        <div className="create-expert-workflow-session-banner-copy">
          <p className="create-expert-workflow-session-banner-eyebrow">Active Pulse</p>
          <h3 className="create-expert-workflow-session-banner-title">
            {activeWorkflowPulsePreset.label}
          </h3>
        </div>
      </div>
      <div className="create-expert-workflow-session-banner-badges">
        <span className="create-expert-workflow-session-banner-badge">Guided Pulse</span>
        {activeWorkflowPulseStep ? (
          <span className="create-expert-workflow-session-banner-badge">
            {activeWorkflowPulseStep}
          </span>
        ) : null}
        {activeWorkflowPulseStatus ? (
          <span className="create-expert-workflow-session-banner-badge">
            {activeWorkflowPulseStatus}
          </span>
        ) : null}
      </div>
      <p className="create-expert-workflow-session-banner-summary">
        {activeWorkflowPulsePreset.description?.trim() ||
          "This Pulse stays in guided mode and drives the chat one step at a time."}
      </p>
      <p className="create-expert-workflow-session-banner-note">
        Switching or deactivating this Pulse starts a fresh guided session.
      </p>
      {activeWorkflowPulsePreview ? (
        <p className="create-expert-workflow-session-banner-preview">
          <span className="create-expert-workflow-session-banner-preview-label">
            {activeWorkflowPulsePreview.label}
          </span>
          <span>{activeWorkflowPulsePreview.content}</span>
        </p>
      ) : null}
      {activeWorkflowPulseSession?.status === "completed" &&
      (((activeWorkflowPulseSession.lastArtifact?.trim().length ?? 0) > 0 && onAgentApplyPrompt) ||
        onPulsePresetRestart ||
        (onPulsePresetStart && onClearAgentChat)) ? (
        <div className="create-expert-workflow-session-banner-actions">
          {(activeWorkflowPulseSession.lastArtifact?.trim().length ?? 0) > 0 &&
          onAgentApplyPrompt ? (
            <button
              type="button"
              className="create-expert-workflow-session-banner-action"
              onClick={handleApplyWorkflowArtifact}
            >
              Use artifact
            </button>
          ) : null}
          {onPulsePresetRestart || (onPulsePresetStart && onClearAgentChat) ? (
            <button
              type="button"
              className="create-expert-workflow-session-banner-action"
              onClick={() => {
                void handleRestartWorkflowPulse();
              }}
            >
              Restart workflow
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null;

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
    chatModeEnabled: effectiveChatModeEnabled,
    onChatModeEnabledChange: isPulseCreateMode ? undefined : onChatModeEnabledChange,
    directOpenAiBypassEnabled,
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
    onAssistantMessageEdit,
    onGenerateOutputPrompt: onGenerateFromAgentOutputPrompt,
    chatModeInlineGenerate: {
      onGenerate: onChatOffInlineGenerate,
      disabled: isChatOffInlineGenerateDisabled,
      ariaLabel: "Generate with current prompt",
    },
    onSavePrompt,
    isGenerating: isPromptGenerating,
    showGenerationThinkingInChat: false,
    shouldDisableSave,
    disableOutputGenerate,
    outputGenerateCostCredits,
    outputGenerateGuardrailReason: disableOutputGenerate ? guardrailReason : null,
    hideOutputGenerateControls: isPulseCreateMode,
    chatSessionBanner: activeWorkflowPulseBanner,
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
    hideInputDropHint: true,
    useAgentResponseInlineGeneratePrefab: true,
    highlightLatestAssistantOnly: true,
    assistantMessagePresentation: isPulseCreateMode ? "pulse_guided" : "default",
    chatComposerOverlayEnabled: true,
    stackTrailingComposerControls: true,
    agentInputMaxHeightPx: EXPERT_CREATE_AGENT_INPUT_MAX_HEIGHT_PX,
    agentInputCollapseOnBlur: true,
    hideChatModeToggle: isPulseCreateMode,
    composerLeadingContent: isPulseCreateMode ? null : (
      <StylesControl
        isOpen={isStylesPanelOpen}
        selectedStyleId={selectedStyleId}
        styles={stylesCatalog}
        onToggle={onStylesPanelToggle}
      />
    ),
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
          guardrailReason={guardrailReason}
          characterModeEnabled={characterModeEnabled}
          onCharacterModeEnabledToggle={handleCharacterModeEnabledToggle}
          onCharacterPickerOpen={openCharacterPicker}
          characterSelectDisabled={characterSelectDisabled}
          isCharacterSelectionEmpty={isCharacterSelectionEmpty}
          selectedCharacterName={selectedCharacterName}
          selectedCharacterProfileImageUrl={selectedCharacterAvatarUrl}
          selectedCharacterInitials={selectedCharacterInitials}
          onSelectedCharacterAvatarError={handleSelectedCharacterAvatarError}
          onSelectedCharacterAvatarLoad={handleSelectedCharacterAvatarLoad}
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
          expertCreateMode={expertCreateMode}
          onExpertCreateModeChange={onExpertCreateModeChange}
          activePulsePresetId={activePulsePresetId}
          onActivePulsePresetIdChange={onActivePulsePresetIdChange}
          onPulsePresetStart={onPulsePresetStart}
          selectedPulsePresetIds={selectedPulsePresetIds}
          onSelectedPulsePresetIdsChange={onSelectedPulsePresetIdsChange}
          savedPulsePresets={savedPulsePresets}
          onSavedPulsePresetsChange={onSavedPulsePresetsChange}
          onOpenPresetsLibrary={onOpenPresetsLibrary}
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
          selectedCharacterProfileImageUrl={selectedCharacterAvatarUrl}
          selectedCharacterInitials={selectedCharacterInitials}
          onSelectedCharacterAvatarError={handleSelectedCharacterAvatarError}
          onSelectedCharacterAvatarLoad={handleSelectedCharacterAvatarLoad}
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
        isCharacterOptionsLoading={isCharacterOptionsLoading}
        onClose={closeCharacterPicker}
        characterOptions={characterOptions}
        selectedCharacterId={selectedCharacterId}
        onSelectedCharacterIdChange={onSelectedCharacterIdChange}
        refreshCharacterOptions={refreshCharacterOptions}
        resolveCharacterAvatarUrlById={resolveCharacterAvatarUrlById}
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
  guardrailReason,
  beginnerMode = false,
}: ComposeSendCardProps) {
  const costValue = costCredits != null ? costCredits : "—";
  const inlineGuardrailReason = guardrailReason;

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
        {isGenerateDisabled && inlineGuardrailReason ? (
          <div className="inline-warning-hint">{inlineGuardrailReason}</div>
        ) : null}
        {agentEnabled && agentError ? <div className="inline-error-hint">{agentError}</div> : null}
      </div>
    </div>
  );
}
