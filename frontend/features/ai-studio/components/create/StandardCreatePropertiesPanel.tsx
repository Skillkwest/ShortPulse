/**
 * Create properties panel for AI Studio.
 * Handles prompt entry plus model/aspect controls for create workflows.
 */
import React, { useEffect, useMemo } from "react";
import type { AspectOption, StudioMode } from "../../types";
import type { AgentComposerDirectDropPayload } from "../../logic/agentComposerDirectDropPayload";
import type { CanvasTearOutComposerTargetRegistry } from "../../hooks/useAiStudioCanvasTearOutTargets";
import { aspectOptions, modelLogos } from "../../constants";
import type { ModelModalContext } from "../ModelModal";
import { AgentResponseInlineGenerateButton } from "../../../../prefabs/agent";
import type {
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
} from "../../../../prefabs/agent";
import { PromptStep } from "../PromptStep";
import { StandardCreateChatPanel } from "../promptStep/StandardCreateChatPanel";
import { ComposerPinButton } from "../shared/ComposerPinButton";
import { StylesControl } from "../StylesControl";
import { resolveCreateModelModalContext } from "../../logic/createModelModalContext";
import { deriveCreateSelectorViewState } from "../../logic/createSelectorState";
import { getModelConfig } from "../../logic/modelRegistry";
import { stripEditLabel } from "../../utils/modelLabels";
import { StandardCreatePanelView } from "./StandardCreatePanelView";
import {
  type CreateCharacterOption,
  type CreateCharacterLookOption,
  useCreateCharacterModeController,
} from "./useCreateCharacterModeController";
import type { ExpertEditStyleTile } from "../edit/expertEditStyles";
import { useAvatarResilience } from "../../hooks/useAvatarResilience";
import { CreateCharacterPickerModal } from "./CreateCharacterPickerModal";

export type { CreateMode } from "./createModeTypes";

export type StandardCreatePropertiesPanelProps = {
  mode: StudioMode;
  aspect: string;
  modelId: string | null;
  modelLabel: string;
  prompt: string;
  agentEnabled?: boolean;
  agentBootstrapPending?: boolean;
  agentMessages?: AgentMessage[];
  agentInput?: string;
  chatModeEnabled?: boolean;
  agentIsSending?: boolean;
  agentThinkingLabel?: string | null;
  agentError?: string;
  stagedPrompt?: string | null;
  assistantBubbleMedia?: Record<string, AgentOutputBubbleMediaState>;
  stagedAttachments?: AgentAttachment[];
  agentDropActive?: boolean;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
  onModelPickerClose?: () => void;
  onPromptChange: (value: string) => void;
  costCredits?: number | null;
  isPromptGenerating?: boolean;
  isGenerateDisabled?: boolean;
  guardrailReason?: string | null;
  onStepActionClick?: (step: "character" | "model" | "prompt" | "imageSettings") => void;
  onAgentInputChange?: (value: string) => void;
  onChatModeEnabledChange?: (value: boolean) => void;
  onAgentSend?: () => void;
  onAgentAttachmentDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentComposerDirectDrop?: (payload: AgentComposerDirectDropPayload) => void;
  onRemoveAgentAttachment?: (id: string) => void;
  onClearAgentAttachments?: () => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onGenerate: () => void;
  onClearAgentChat?: () => void;
  onPinPromptReference?: (text: string) => void;
  imageResolution?: string;
  onImageResolutionChange?: (value: string) => void;
  characterOptions?: CreateCharacterOption[];
  selectedCharacterId?: string;
  selectedCharacterLookId?: string;
  selectedCharacterLookLabel?: string | null;
  onSelectedCharacterIdChange?: (characterId: string, lookId: string) => void;
  onCreateCharacter?: () => void;
  isCharacterOptionsLoading?: boolean;
  characterModeEnabled?: boolean;
  onCharacterModeEnabledChange?: (value: boolean) => void;
  refreshCharacterOptions?: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  loadCharacterLookOptions?: (characterId: string) => Promise<CreateCharacterLookOption[]>;
  resolveCharacterAvatarUrlById?: (characterId: string | null | undefined) => string | null;
  isStylesPanelOpen?: boolean;
  onStylesPanelToggle?: () => void;
  selectedStyleId?: string | null;
  stylesCatalog?: readonly ExpertEditStyleTile[];
  createModeToggle?: React.ReactNode;
  onOpenPresetsLibrary?: () => void;
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
};

const EXPERT_CREATE_AGENT_INPUT_MAX_HEIGHT_PX = 520;

/**
 * Renders the Create tool controls.
 */
export function StandardCreatePropertiesPanel({
  mode,
  aspect,
  modelId,
  modelLabel,
  prompt,
  isModelModalOpen,
  modelModalAnchor,
  onAspectChange,
  onModelPickerOpen,
  onModelPickerClose,
  onPromptChange,
  costCredits = null,
  agentEnabled = false,
  agentBootstrapPending = false,
  agentMessages = [],
  agentInput = "",
  chatModeEnabled = false,
  agentIsSending = false,
  agentThinkingLabel = null,
  agentError,
  stagedPrompt = null,
  assistantBubbleMedia,
  stagedAttachments = [],
  agentDropActive = false,
  onStepActionClick,
  onAgentInputChange,
  onChatModeEnabledChange,
  onAgentSend,
  onAgentAttachmentDrop,
  onAgentAttachmentDragOver,
  onAgentAttachmentDragEnter,
  onAgentAttachmentDragLeave,
  onAgentComposerDirectDrop,
  onRemoveAgentAttachment,
  onClearAgentAttachments,
  onAssistantMessageEdit,
  isPromptGenerating = false,
  isGenerateDisabled = false,
  guardrailReason = null,
  onClearAgentChat,
  imageResolution,
  onImageResolutionChange,
  characterOptions = [],
  selectedCharacterId = "",
  selectedCharacterLookId = "",
  selectedCharacterLookLabel = null,
  onSelectedCharacterIdChange,
  onCreateCharacter,
  isCharacterOptionsLoading = false,
  characterModeEnabled = true,
  onCharacterModeEnabledChange,
  refreshCharacterOptions,
  loadCharacterLookOptions,
  resolveCharacterAvatarUrlById,
  isStylesPanelOpen = false,
  onStylesPanelToggle,
  selectedStyleId = null,
  stylesCatalog,
  createModeToggle = null,
  canvasTearOutTargetRegistry,
  onGenerate,
  onPinPromptReference,
}: StandardCreatePropertiesPanelProps) {
  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;
  const effectiveModelLabel = stripEditLabel(modelLabel);
  const effectiveModelLogoSrc = modelLogoSrc;
  const useUnoptimizedModelLogo = false;
  const modelConfig = useMemo(() => (modelId ? getModelConfig(modelId) : null), [modelId]);
  const aspectOptionsForModel: AspectOption[] = useMemo(() => {
    if (modelConfig?.allowedAspects?.length) {
      return aspectOptions.filter((opt) => modelConfig.allowedAspects.includes(opt.value));
    }
    return aspectOptions;
  }, [modelConfig]);
  const { resolveAvatarUrl, clearAvatarFailure, handleAvatarError } = useAvatarResilience({
    surfaceId: "create-character-picker-trigger",
  });
  const handleCharacterPickerOpenRefresh = React.useCallback(() => {
    void refreshCharacterOptions?.();
  }, [refreshCharacterOptions]);
  const {
    isCharacterPickerOpen,
    openCharacterPicker,
    closeCharacterPicker,
    handleCharacterModeEnabledToggle,
    characterSelectDisabled,
    selectedCharacterName,
    selectedCharacterDisplayName,
    selectedCharacterProfileImageUrl,
    selectedCharacterInitials,
  } = useCreateCharacterModeController({
    characterModeEnabled,
    characterOptions,
    selectedCharacterId,
    selectedCharacterLookLabel,
    isCharacterOptionsLoading,
    onCharacterPickerOpen: handleCharacterPickerOpenRefresh,
    onCharacterModeEnabledChange,
    onStepActionClick,
  });
  const shouldHideCreateControlSet = chatModeEnabled;
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

  const handleCreateModelOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    const context: ModelModalContext | null = resolveCreateModelModalContext({
      expertCreateMode: "standard",
      isCharacterModeEnabled: characterModeEnabled,
    });
    onModelPickerOpen("create-model", event.currentTarget, context);
    onStepActionClick?.("model");
  };

  const selectorViewState = useMemo(
    () =>
      deriveCreateSelectorViewState({
        mode,
        modelId,
        isModelModalOpen,
        modelModalAnchor,
        isGenerateDisabled,
        characterModeEnabled,
        selectedCharacterId,
        imageResolution,
      }),
    [
      characterModeEnabled,
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
  } = selectorViewState;
  // Auto-clamp invalid image resolution values when switching image models.
  useEffect(() => {
    if (!onImageResolutionChange) return;
    if (imageResolutionValue !== imageResolution) {
      onImageResolutionChange(imageResolutionValue);
    }
  }, [imageResolution, imageResolutionValue, onImageResolutionChange]);

  useEffect(() => {
    if (!shouldHideCreateControlSet) return;
    if (isCharacterPickerOpen) {
      closeCharacterPicker();
    }
    if (isStylesPanelOpen) {
      onStylesPanelToggle?.();
    }
    if (isModelModalOpen && modelModalAnchor === "create-model") {
      onModelPickerClose?.();
    }
  }, [
    closeCharacterPicker,
    isCharacterPickerOpen,
    isModelModalOpen,
    isStylesPanelOpen,
    modelModalAnchor,
    onModelPickerClose,
    onStylesPanelToggle,
    shouldHideCreateControlSet,
  ]);
  const handleUseAssistantMessageAsPrompt = React.useCallback(
    ({ prompt: nextPrompt }: { messageId: string; prompt: string }) => {
      const promptText = nextPrompt.trim();
      if (!promptText) return;
      if (chatModeEnabled) {
        onChatModeEnabledChange?.(false);
      }
      onPromptChange(promptText);
    },
    [chatModeEnabled, onChatModeEnabledChange, onPromptChange]
  );

  const sharedPromptStepProps = {
    prompt,
    onPromptChange,
    agentEnabled,
    agentBootstrapPending,
    agentMessages,
    agentInput,
    agentIsSending,
    agentThinkingLabel: agentThinkingLabel ?? undefined,
    agentError,
    stagedPrompt,
    assistantBubbleMedia,
    stagedAttachments,
    agentDropActive,
    onAgentInputChange,
    chatModeEnabled,
    onChatModeEnabledChange,
    hideChatModeToggle: true,
    onAgentSend,
    onAgentAttachmentDrop,
    onAgentAttachmentDragOver,
    onAgentAttachmentDragEnter,
    onAgentAttachmentDragLeave,
    onRemoveAgentAttachment,
    onClearAgentAttachments,
    onClearAgentChat,
    onAssistantMessageEdit,
    onUseAssistantMessageAsPrompt: handleUseAssistantMessageAsPrompt,
    isGenerating: isPromptGenerating,
    showGenerationThinkingInChat: false,
    chatOnly: true,
  } satisfies Omit<
    React.ComponentProps<typeof PromptStep>,
    "stepNumber" | "isCollapsed" | "onToggleCollapse"
  >;

  const promptStepProps: React.ComponentProps<typeof PromptStep> = {
    ...sharedPromptStepProps,
    stepNumber: "1",
    title: "Ask anything",
    subtitle: "",
    isCollapsed: false,
    onToggleCollapse: () => {
      // Standard Create keeps the chat composer always open.
    },
    className: `create-composer-prompt-step ${
      characterModeEnabled ? "is-character-mode-on" : "is-character-mode-off"
    }`,
    embedSendButtonInInput: true,
    hideAgentIntroMessage: true,
    agentAttachmentDropTarget: "input",
    hideInputDropHint: true,
    highlightLatestAssistantOnly: true,
    CreateChatPanel: StandardCreateChatPanel,
    chatComposerOverlayEnabled: true,
    stackTrailingComposerControls: true,
    hideChatComposerHint: true,
    agentInputMaxHeightPx: EXPERT_CREATE_AGENT_INPUT_MAX_HEIGHT_PX,
    agentInputCollapseOnBlur: false,
    hideChatModeToggle: false,
    composerLeadingContent: shouldHideCreateControlSet ? null : (
      <div className="create-composer-inline-leading-controls">
        <StylesControl
          isOpen={isStylesPanelOpen}
          selectedStyleId={selectedStyleId}
          styles={stylesCatalog}
          onToggle={onStylesPanelToggle}
        />
        <div className="create-composer-inline-generate">
          <AgentResponseInlineGenerateButton
            onClick={onGenerate}
            costCredits={costCredits}
            disabled={isGenerateDisabled}
          />
        </div>
      </div>
    ),
    composerTrailingContent: shouldHideCreateControlSet ? null : (
      <ComposerPinButton
        text={prompt}
        onPinTextReference={onPinPromptReference}
        className="create-composer-pin-button"
      />
    ),
  };

  return (
    <>
      <StandardCreatePanelView
        promptStepProps={promptStepProps}
        canvasTearOutTargetRegistry={canvasTearOutTargetRegistry}
        onAgentComposerDirectDrop={onAgentComposerDirectDrop}
        characterModeEnabled={characterModeEnabled}
        onCharacterModeEnabledToggle={handleCharacterModeEnabledToggle}
        onCharacterPickerOpen={openCharacterPicker}
        characterSelectDisabled={characterSelectDisabled}
        isCharacterSelectionEmpty={isCharacterSelectionEmpty}
        selectedCharacterName={selectedCharacterName}
        selectedCharacterDisplayName={selectedCharacterDisplayName}
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
        showCreateControlSet={!shouldHideCreateControlSet}
        shouldShowImageResolutionCard={shouldShowImageResolutionCard}
        imageResolutionValue={imageResolutionValue}
        imageResolutionOptions={imageResolutionOptions}
        onImageResolutionChange={(value) => {
          onImageResolutionChange?.(value);
          onStepActionClick?.("imageSettings");
        }}
        guardrailReason={guardrailReason}
        createModeToggle={createModeToggle}
      />
      <CreateCharacterPickerModal
        isOpen={isCharacterPickerOpen}
        characterModeEnabled={characterModeEnabled}
        isCharacterOptionsLoading={isCharacterOptionsLoading}
        onClose={closeCharacterPicker}
        characterOptions={characterOptions}
        selectedCharacterId={selectedCharacterId}
        selectedCharacterLookId={selectedCharacterLookId}
        onSelectedCharacterIdChange={onSelectedCharacterIdChange}
        onCreateCharacter={onCreateCharacter}
        refreshCharacterOptions={refreshCharacterOptions}
        loadCharacterLookOptions={loadCharacterLookOptions}
        resolveCharacterAvatarUrlById={resolveCharacterAvatarUrlById}
      />
    </>
  );
}
