/**
 * Create workflow panel-prop composition hook for AI Studio.
 * Keeps text/create panel wiring isolated from edit/video workflows.
 */
import { useMemo, type Dispatch, type DragEvent, type RefObject, type SetStateAction } from "react";
import type {
  AgentActions,
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
  AgentOutputGenerateInput,
} from "../../ai-agent/types";
import type { StudioMode, StudioOutput } from "../types";
import type { AiStudioCreatePanelContract } from "./contracts/pageContentContracts";

type UseAiStudioCreatePanelPropsParams = {
  mode: StudioMode;
  aspect: string;
  model: string | null;
  currentModelLabel: string;
  prompt: string;
  promptRef: RefObject<HTMLTextAreaElement>;
  agentEnabled: boolean;
  agentMessages: AgentMessage[];
  agentActions?: AgentActions;
  agentInput: string;
  chatModeEnabled: boolean;
  agentAssistToggleAvailable: boolean;
  agentAssistEnabled: boolean;
  agentBusy: boolean;
  agentAttachmentError: string | null;
  agentError?: string | null;
  agentPrimarySource?: "agent" | "manual" | "reference";
  stagedAgentPrompt?: string | null;
  assistantBubbleMedia?: Record<string, AgentOutputBubbleMediaState>;
  agentAttachments: AgentAttachment[];
  isAgentDropActive: boolean;
  handleAgentInputChange: (value: string) => void;
  setChatModeEnabled: (value: boolean) => void;
  setAgentAssistEnabled: (value: boolean) => void;
  handleAgentSend: () => void;
  handleAgentEnhanceSend: () => void;
  handleAgentAttachmentDrop: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragOver: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  handleRemoveAgentAttachment: (id: string) => void;
  handleClearAgentAttachments: () => void;
  handleAgentApplyPrompt: (promptText: string) => void;
  handleAgentSelectVariation: (promptText: string) => void;
  handleAgentDescribeTargets: (targets: string[]) => void;
  handleAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  handleGenerateFromAgentOutputPrompt: (request: AgentOutputGenerateInput) => void;
  useReferenceImageIndicator: boolean;
  activeOutput: StudioOutput | null;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  handleOpenModelModal: (
    anchorId: string,
    target: HTMLElement,
    context?:
      | "reference-image"
      | "reference-video"
      | "reference-keyframes"
      | "text-image"
      | "text-video"
      | null
  ) => void;
  handleManualPromptChange: (value: string) => void;
  toggleReferenceIndicator: () => void;
  isPromptGenerating: boolean;
  isPromptRefining: boolean;
  describeInFlightCount: number;
  currentCostCredits: number | null;
  promptReferenceGenerateCostCredits: number | null;
  hasSufficientCreditsForPromptReferenceGenerate: boolean;
  isGenerateDisabled: boolean;
  isGenerateClickLocked: boolean;
  generationGuardrail: string | null;
  handleExpandChat: () => void;
  handleClearAgentChat: () => void;
  isAgentChatOpen: boolean;
  handlePrimarySubmit: () => void;
  handleChatOffInlineGenerate: () => void;
  savePromptReference: (customPrompt?: string) => void;
  characterOptions: Array<{ id: string; name: string; profileImageUrl?: string | null }>;
  selectedCharacterId: string;
  setSelectedCharacterId: Dispatch<SetStateAction<string>>;
  isCharacterOptionsLoading: boolean;
  isCharacterModeEnabled: boolean;
  setIsCharacterModeEnabled: Dispatch<SetStateAction<boolean>>;
  refreshCharacterOptions: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  resolveCharacterAvatarUrlById: (characterId: string | null | undefined) => string | null;
  imageResolution: string;
  setAspect: (value: string) => void;
  setImageResolution: Dispatch<SetStateAction<string>>;
  beginnerMode: boolean;
  expertCreateUiEligible: boolean;
};

/**
 * Builds props for the create/text properties panel.
 */
export const useAiStudioCreatePanelProps = ({
  mode,
  aspect,
  model,
  currentModelLabel,
  prompt,
  promptRef,
  agentEnabled,
  agentMessages,
  agentActions,
  agentInput,
  chatModeEnabled,
  agentAssistToggleAvailable,
  agentAssistEnabled,
  agentBusy,
  agentAttachmentError,
  agentError,
  agentPrimarySource,
  stagedAgentPrompt,
  assistantBubbleMedia,
  agentAttachments,
  isAgentDropActive,
  handleAgentInputChange,
  setChatModeEnabled,
  setAgentAssistEnabled,
  handleAgentSend,
  handleAgentEnhanceSend,
  handleAgentAttachmentDrop,
  handleAgentAttachmentDragOver,
  handleAgentAttachmentDragEnter,
  handleAgentAttachmentDragLeave,
  handleRemoveAgentAttachment,
  handleClearAgentAttachments,
  handleAgentApplyPrompt,
  handleAgentSelectVariation,
  handleAgentDescribeTargets,
  handleAssistantMessageEdit,
  handleGenerateFromAgentOutputPrompt,
  useReferenceImageIndicator,
  activeOutput,
  isModelModalOpen,
  modelModalAnchor,
  handleOpenModelModal,
  handleManualPromptChange,
  toggleReferenceIndicator,
  isPromptGenerating,
  isPromptRefining,
  describeInFlightCount,
  currentCostCredits,
  promptReferenceGenerateCostCredits,
  hasSufficientCreditsForPromptReferenceGenerate,
  isGenerateDisabled,
  isGenerateClickLocked,
  generationGuardrail,
  handleExpandChat,
  handleClearAgentChat,
  isAgentChatOpen,
  handlePrimarySubmit,
  handleChatOffInlineGenerate,
  savePromptReference,
  characterOptions,
  selectedCharacterId,
  setSelectedCharacterId,
  isCharacterOptionsLoading,
  isCharacterModeEnabled,
  setIsCharacterModeEnabled,
  refreshCharacterOptions,
  resolveCharacterAvatarUrlById,
  imageResolution,
  setAspect,
  setImageResolution,
  beginnerMode,
  expertCreateUiEligible,
}: UseAiStudioCreatePanelPropsParams): AiStudioCreatePanelContract => {
  const createGenerateCostCredits =
    mode === "text" && !chatModeEnabled
      ? (promptReferenceGenerateCostCredits ?? currentCostCredits)
      : currentCostCredits;

  return useMemo(
    () => ({
      mode,
      aspect,
      modelId: model,
      modelLabel: currentModelLabel,
      prompt,
      promptRef,
      agentEnabled,
      agentMessages,
      agentActions,
      agentInput,
      chatModeEnabled,
      agentAssistToggleAvailable,
      agentAssistEnabled,
      agentIsSending: agentBusy,
      agentError: agentAttachmentError ?? agentError ?? undefined,
      agentPrimarySource,
      stagedPrompt: stagedAgentPrompt,
      assistantBubbleMedia,
      stagedAttachments: agentAttachments,
      agentDropActive: isAgentDropActive,
      onAgentInputChange: handleAgentInputChange,
      onChatModeEnabledChange: setChatModeEnabled,
      onAgentAssistEnabledChange: setAgentAssistEnabled,
      onAgentSend: handleAgentSend,
      onAgentEnhanceSend: handleAgentEnhanceSend,
      onAgentAttachmentDrop: handleAgentAttachmentDrop,
      onAgentAttachmentDragOver: handleAgentAttachmentDragOver,
      onAgentAttachmentDragEnter: handleAgentAttachmentDragEnter,
      onAgentAttachmentDragLeave: handleAgentAttachmentDragLeave,
      onRemoveAgentAttachment: handleRemoveAgentAttachment,
      onClearAgentAttachments: handleClearAgentAttachments,
      onAgentApplyPrompt: handleAgentApplyPrompt,
      onAgentSelectVariation: handleAgentSelectVariation,
      onAgentDescribeTargets: handleAgentDescribeTargets,
      onAssistantMessageEdit: handleAssistantMessageEdit,
      onGenerateFromAgentOutputPrompt: handleGenerateFromAgentOutputPrompt,
      useReferenceImageIndicator,
      hasReferencePreview: Boolean(activeOutput?.previewUrl),
      isModelModalOpen,
      modelModalAnchor,
      onAspectChange: setAspect,
      onModelPickerOpen: handleOpenModelModal,
      onPromptChange: handleManualPromptChange,
      onToggleReferenceIndicator: toggleReferenceIndicator,
      isPromptGenerating: isPromptGenerating || isPromptRefining || describeInFlightCount > 0,
      costCredits: createGenerateCostCredits,
      outputGenerateCostCredits: promptReferenceGenerateCostCredits,
      hasSufficientCreditsForOutputGenerate: hasSufficientCreditsForPromptReferenceGenerate,
      isGenerateDisabled: isGenerateDisabled || isGenerateClickLocked,
      guardrailReason: generationGuardrail,
      onExpandChat: handleExpandChat,
      onClearAgentChat: handleClearAgentChat,
      shouldDisableSave: useReferenceImageIndicator && mode === "text",
      onGenerate: handlePrimarySubmit,
      onChatOffInlineGenerate: handleChatOffInlineGenerate,
      onSavePrompt: savePromptReference,
      agentChatOpen: isAgentChatOpen,
      characterOptions,
      selectedCharacterId,
      onSelectedCharacterIdChange: setSelectedCharacterId,
      isCharacterOptionsLoading,
      characterModeEnabled: isCharacterModeEnabled,
      onCharacterModeEnabledChange: setIsCharacterModeEnabled,
      refreshCharacterOptions,
      resolveCharacterAvatarUrlById,
      imageResolution,
      onImageResolutionChange: setImageResolution,
      beginnerMode,
      expertCreateUiEligible,
    }),
    [
      activeOutput?.previewUrl,
      agentActions,
      agentAttachmentError,
      agentAttachments,
      agentAssistEnabled,
      agentAssistToggleAvailable,
      agentBusy,
      chatModeEnabled,
      agentEnabled,
      agentError,
      agentInput,
      agentMessages,
      agentPrimarySource,
      assistantBubbleMedia,
      aspect,
      beginnerMode,
      characterOptions,
      createGenerateCostCredits,
      currentModelLabel,
      describeInFlightCount,
      expertCreateUiEligible,
      generationGuardrail,
      handleAgentApplyPrompt,
      handleAgentAttachmentDragEnter,
      handleAgentAttachmentDragLeave,
      handleAgentAttachmentDragOver,
      handleAgentAttachmentDrop,
      handleAgentDescribeTargets,
      handleAgentEnhanceSend,
      handleAgentInputChange,
      handleAssistantMessageEdit,
      handleAgentSelectVariation,
      handleAgentSend,
      setAgentAssistEnabled,
      handleClearAgentAttachments,
      handleClearAgentChat,
      handleExpandChat,
      handleGenerateFromAgentOutputPrompt,
      handleManualPromptChange,
      handleOpenModelModal,
      handleChatOffInlineGenerate,
      handlePrimarySubmit,
      handleRemoveAgentAttachment,
      hasSufficientCreditsForPromptReferenceGenerate,
      imageResolution,
      isAgentChatOpen,
      isAgentDropActive,
      isCharacterModeEnabled,
      isCharacterOptionsLoading,
      isGenerateClickLocked,
      isGenerateDisabled,
      isModelModalOpen,
      isPromptGenerating,
      isPromptRefining,
      mode,
      model,
      modelModalAnchor,
      prompt,
      promptReferenceGenerateCostCredits,
      promptRef,
      savePromptReference,
      selectedCharacterId,
      setChatModeEnabled,
      setAspect,
      setImageResolution,
      setIsCharacterModeEnabled,
      setSelectedCharacterId,
      refreshCharacterOptions,
      resolveCharacterAvatarUrlById,
      stagedAgentPrompt,
      toggleReferenceIndicator,
      useReferenceImageIndicator,
    ]
  );
};
