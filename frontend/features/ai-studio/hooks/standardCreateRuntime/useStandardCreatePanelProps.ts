import type { Dispatch, DragEvent, SetStateAction } from "react";
import type {
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
} from "../../../../prefabs/agent";
import type { ModelModalContext } from "../../components/ModelModal";
import type {
  CreateCharacterLookOption,
  CreateCharacterOption,
} from "../../components/create/useCreateCharacterModeController";
import type { StandardCreatePropertiesPanelProps } from "../../components/create/StandardCreatePropertiesPanel";
import type { ExpertEditStyleTile } from "../../components/edit/expertEditStyles";
import type { StudioMode } from "../../types";

type UseStandardCreatePanelPropsParams = {
  mode: StudioMode;
  aspect: string;
  model: string | null;
  currentModelLabel: string;
  prompt: string;
  agentEnabled: boolean;
  agentBootstrapReady: boolean;
  agentMessages: AgentMessage[];
  agentInput: string;
  chatModeEnabled: boolean;
  agentBusy: boolean;
  agentAttachmentError: string | null;
  agentError?: string | null;
  stagedAgentPrompt?: string | null;
  assistantBubbleMedia?: Record<string, AgentOutputBubbleMediaState>;
  agentAttachments: AgentAttachment[];
  isAgentDropActive: boolean;
  handleAgentInputChange: (value: string) => void;
  setChatModeEnabled: (value: boolean) => void;
  handleAgentSend: () => void;
  handleAgentAttachmentDrop: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragOver: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  handleRemoveAgentAttachment: (id: string) => void;
  handleClearAgentAttachments: () => void;
  handleAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  setAspect: (value: string) => void;
  handleOpenModelModal: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
  handleManualPromptChange: (value: string) => void;
  createIsGenerating: boolean;
  isPromptRefining: boolean;
  describeInFlightCount: number;
  createGenerateCostCredits: number | null;
  hasSufficientCreditsForPromptReferenceGenerate: boolean;
  isGenerateDisabled: boolean;
  generationGuardrail: string | null;
  handleClearAgentChat: () => void;
  handleStandardCreatePrimarySubmit: () => void;
  characterOptions: CreateCharacterOption[];
  selectedCharacterId: string;
  selectedCharacterLookId?: string;
  selectedCharacterLookLabel?: string | null;
  setSelectedCharacterId: (characterId: string, lookId: string) => void;
  onOpenCharacterLibrary?: () => void;
  isCharacterOptionsLoading: boolean;
  isCharacterModeEnabled: boolean;
  setIsCharacterModeEnabled: Dispatch<SetStateAction<boolean>>;
  refreshCharacterOptions?: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  loadCharacterLookOptions?: (characterId: string) => Promise<CreateCharacterLookOption[]>;
  resolveCharacterAvatarUrlById?: (characterId: string | null | undefined) => string | null;
  imageResolution: string;
  setImageResolution: Dispatch<SetStateAction<string>>;
  isStylesPanelOpen?: boolean;
  onStylesPanelToggle?: () => void;
  selectedStyleId?: string | null;
  stylesCatalog?: readonly ExpertEditStyleTile[];
  onOpenPresetsLibrary?: () => void;
};

/**
 * Standard Create panel props.
 * Keeps Standard composer controls out of the shared page prop builder.
 */
export const buildStandardCreatePanelProps = ({
  mode,
  aspect,
  model,
  currentModelLabel,
  prompt,
  agentEnabled,
  agentBootstrapReady,
  agentMessages,
  agentInput,
  chatModeEnabled,
  agentBusy,
  agentAttachmentError,
  agentError,
  stagedAgentPrompt,
  assistantBubbleMedia,
  agentAttachments,
  isAgentDropActive,
  handleAgentInputChange,
  setChatModeEnabled,
  handleAgentSend,
  handleAgentAttachmentDrop,
  handleAgentAttachmentDragOver,
  handleAgentAttachmentDragEnter,
  handleAgentAttachmentDragLeave,
  handleRemoveAgentAttachment,
  handleClearAgentAttachments,
  handleAssistantMessageEdit,
  isModelModalOpen,
  modelModalAnchor,
  setAspect,
  handleOpenModelModal,
  handleManualPromptChange,
  createIsGenerating,
  isPromptRefining,
  describeInFlightCount,
  createGenerateCostCredits,
  hasSufficientCreditsForPromptReferenceGenerate,
  isGenerateDisabled,
  generationGuardrail,
  handleClearAgentChat,
  handleStandardCreatePrimarySubmit,
  characterOptions,
  selectedCharacterId,
  selectedCharacterLookId,
  selectedCharacterLookLabel,
  setSelectedCharacterId,
  onOpenCharacterLibrary,
  isCharacterOptionsLoading,
  isCharacterModeEnabled,
  setIsCharacterModeEnabled,
  refreshCharacterOptions,
  loadCharacterLookOptions,
  resolveCharacterAvatarUrlById,
  imageResolution,
  setImageResolution,
  isStylesPanelOpen,
  onStylesPanelToggle,
  selectedStyleId,
  stylesCatalog,
  onOpenPresetsLibrary,
}: UseStandardCreatePanelPropsParams): StandardCreatePropertiesPanelProps => {
  const visibleComposerPrompt = (chatModeEnabled ? agentInput : prompt) ?? "";
  const hasVisibleComposerPrompt = visibleComposerPrompt.trim().length > 0;
  const isPrimaryGenerateDisabled = isGenerateDisabled || !hasVisibleComposerPrompt;
  const primaryGenerateGuardrailReason = isGenerateDisabled
    ? generationGuardrail
    : hasVisibleComposerPrompt
      ? generationGuardrail
      : "Enter a prompt to generate.";

  return {
    mode,
    aspect,
    modelId: model,
    modelLabel: currentModelLabel,
    prompt,
    agentEnabled,
    agentBootstrapPending: !agentBootstrapReady,
    agentMessages,
    agentInput,
    chatModeEnabled,
    agentIsSending: agentBusy,
    agentError: agentAttachmentError ?? agentError ?? undefined,
    stagedPrompt: stagedAgentPrompt,
    assistantBubbleMedia,
    stagedAttachments: agentAttachments,
    agentDropActive: isAgentDropActive,
    onAgentInputChange: handleAgentInputChange,
    onChatModeEnabledChange: setChatModeEnabled,
    onAgentSend: handleAgentSend,
    onAgentAttachmentDrop: handleAgentAttachmentDrop,
    onAgentAttachmentDragOver: handleAgentAttachmentDragOver,
    onAgentAttachmentDragEnter: handleAgentAttachmentDragEnter,
    onAgentAttachmentDragLeave: handleAgentAttachmentDragLeave,
    onRemoveAgentAttachment: handleRemoveAgentAttachment,
    onClearAgentAttachments: handleClearAgentAttachments,
    onAssistantMessageEdit: handleAssistantMessageEdit,
    isModelModalOpen,
    modelModalAnchor,
    onAspectChange: setAspect,
    onModelPickerOpen: handleOpenModelModal,
    onPromptChange: handleManualPromptChange,
    isPromptGenerating: createIsGenerating || isPromptRefining || describeInFlightCount > 0,
    costCredits: createGenerateCostCredits,
    hasSufficientCreditsForOutputGenerate: hasSufficientCreditsForPromptReferenceGenerate,
    isGenerateDisabled: isPrimaryGenerateDisabled,
    guardrailReason: primaryGenerateGuardrailReason,
    onClearAgentChat: handleClearAgentChat,
    onGenerate: handleStandardCreatePrimarySubmit,
    characterOptions,
    selectedCharacterId,
    selectedCharacterLookId,
    selectedCharacterLookLabel,
    onSelectedCharacterIdChange: setSelectedCharacterId,
    onOpenCharacterLibrary,
    isCharacterOptionsLoading,
    characterModeEnabled: isCharacterModeEnabled,
    onCharacterModeEnabledChange: setIsCharacterModeEnabled,
    refreshCharacterOptions,
    loadCharacterLookOptions,
    resolveCharacterAvatarUrlById,
    imageResolution,
    onImageResolutionChange: setImageResolution,
    isStylesPanelOpen,
    onStylesPanelToggle,
    selectedStyleId,
    stylesCatalog,
    onOpenPresetsLibrary,
  };
};
