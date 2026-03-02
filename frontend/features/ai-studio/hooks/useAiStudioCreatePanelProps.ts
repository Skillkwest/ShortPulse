/**
 * Create workflow panel-prop composition hook for AI Studio.
 * Keeps text/create panel wiring isolated from edit/video workflows.
 */
import { useMemo, type Dispatch, type DragEvent, type RefObject, type SetStateAction } from "react";
import type {
  AgentActions,
  AgentAttachment,
  AgentMessage,
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
  agentBusy: boolean;
  agentAttachmentError: string | null;
  agentError?: string | null;
  agentPrimarySource?: "agent" | "manual" | "reference";
  stagedAgentPrompt?: string | null;
  agentAttachments: AgentAttachment[];
  isAgentDropActive: boolean;
  handleAgentInputChange: (value: string) => void;
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
  savePromptReference: (customPrompt?: string) => void;
  characterOptions: Array<{ id: string; name: string; profileImageUrl?: string | null }>;
  selectedCharacterId: string;
  setSelectedCharacterId: Dispatch<SetStateAction<string>>;
  isCharacterOptionsLoading: boolean;
  isCharacterModeEnabled: boolean;
  setIsCharacterModeEnabled: Dispatch<SetStateAction<boolean>>;
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
  agentBusy,
  agentAttachmentError,
  agentError,
  agentPrimarySource,
  stagedAgentPrompt,
  agentAttachments,
  isAgentDropActive,
  handleAgentInputChange,
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
  savePromptReference,
  characterOptions,
  selectedCharacterId,
  setSelectedCharacterId,
  isCharacterOptionsLoading,
  isCharacterModeEnabled,
  setIsCharacterModeEnabled,
  imageResolution,
  setAspect,
  setImageResolution,
  beginnerMode,
  expertCreateUiEligible,
}: UseAiStudioCreatePanelPropsParams): AiStudioCreatePanelContract =>
  useMemo(
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
      agentIsSending: agentBusy,
      agentError: agentAttachmentError ?? agentError ?? undefined,
      agentPrimarySource,
      stagedPrompt: stagedAgentPrompt,
      stagedAttachments: agentAttachments,
      agentDropActive: isAgentDropActive,
      onAgentInputChange: handleAgentInputChange,
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
      costCredits: currentCostCredits,
      outputGenerateCostCredits: promptReferenceGenerateCostCredits,
      hasSufficientCreditsForOutputGenerate: hasSufficientCreditsForPromptReferenceGenerate,
      isGenerateDisabled: isGenerateDisabled || isGenerateClickLocked,
      guardrailReason: generationGuardrail,
      onExpandChat: handleExpandChat,
      onClearAgentChat: handleClearAgentChat,
      shouldDisableSave: useReferenceImageIndicator && mode === "text",
      onGenerate: handlePrimarySubmit,
      onSavePrompt: savePromptReference,
      agentChatOpen: isAgentChatOpen,
      characterOptions,
      selectedCharacterId,
      onSelectedCharacterIdChange: setSelectedCharacterId,
      isCharacterOptionsLoading,
      characterModeEnabled: isCharacterModeEnabled,
      onCharacterModeEnabledChange: setIsCharacterModeEnabled,
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
      agentBusy,
      agentEnabled,
      agentError,
      agentInput,
      agentMessages,
      agentPrimarySource,
      aspect,
      beginnerMode,
      characterOptions,
      currentCostCredits,
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
      handleAgentSelectVariation,
      handleAgentSend,
      handleClearAgentAttachments,
      handleClearAgentChat,
      handleExpandChat,
      handleGenerateFromAgentOutputPrompt,
      handleManualPromptChange,
      handleOpenModelModal,
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
      promptRef,
      promptReferenceGenerateCostCredits,
      savePromptReference,
      selectedCharacterId,
      setAspect,
      setImageResolution,
      setIsCharacterModeEnabled,
      setSelectedCharacterId,
      stagedAgentPrompt,
      toggleReferenceIndicator,
      useReferenceImageIndicator,
    ]
  );
