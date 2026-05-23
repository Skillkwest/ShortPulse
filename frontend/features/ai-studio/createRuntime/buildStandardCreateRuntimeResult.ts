/**
 * Standard Create runtime result composer.
 * Converts Standard-owned state/actions into Standard panel props without
 * accepting Pulse fields or mode-switching inputs.
 */
import type {
  StandardCreateAgentRuntimeActions,
  StandardCreateAgentRuntimeState,
  StandardCreateRuntimeProps,
  StandardCreateRuntimeResult,
} from "./contracts";
import { buildStandardCreatePanelProps } from "../hooks/standardCreateRuntime/useStandardCreatePanelProps";

/**
 * Builds the Standard Create runtime result from Standard-only inputs.
 */
export const buildStandardCreateRuntimeResult = ({
  props,
  agentRuntime,
  actions,
}: {
  props: StandardCreateRuntimeProps;
  agentRuntime: StandardCreateAgentRuntimeState;
  actions: StandardCreateAgentRuntimeActions;
}): StandardCreateRuntimeResult => ({
  kind: "standard",
  agentRuntime,
  actions,
  panelProps: buildStandardCreatePanelProps({
    mode: props.mode,
    aspect: props.aspect,
    model: props.model,
    currentModelLabel: props.currentModelLabel,
    prompt: props.prompt,
    agentEnabled: agentRuntime.agentEnabled,
    agentBootstrapReady: agentRuntime.agentBootstrapReady,
    agentMessages: agentRuntime.agentMessages,
    agentInput: agentRuntime.agentInput,
    chatModeEnabled: agentRuntime.chatModeEnabled,
    agentBusy: agentRuntime.agentBusy,
    agentAttachmentError: agentRuntime.agentAttachmentError,
    agentError: agentRuntime.agentError,
    stagedAgentPrompt: agentRuntime.stagedAgentPrompt,
    assistantBubbleMedia: agentRuntime.assistantBubbleMedia,
    agentAttachments: agentRuntime.agentAttachments,
    isAgentDropActive: agentRuntime.isAgentDropActive,
    handleAgentInputChange: actions.onAgentInputChange,
    setChatModeEnabled: actions.onChatModeChange,
    handleAgentSend: actions.onAgentSend,
    handleAgentAttachmentDrop: actions.onAgentAttachmentDrop,
    handleAgentAttachmentDragOver: actions.onAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter: actions.onAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave: actions.onAgentAttachmentDragLeave,
    handleRemoveAgentAttachment: actions.onRemoveAgentAttachment,
    handleClearAgentAttachments: actions.onClearAgentAttachments,
    handleAssistantMessageEdit: actions.onAssistantMessageEdit,
    isModelModalOpen: props.isModelModalOpen,
    modelModalAnchor: props.modelModalAnchor,
    setAspect: props.onAspectChange,
    handleOpenModelModal: props.onModelPickerOpen,
    handleManualPromptChange: props.onPromptChange,
    createIsGenerating: props.createIsGenerating,
    isPromptRefining: props.isPromptRefining,
    describeInFlightCount: props.describeInFlightCount,
    createGenerateCostCredits: props.createGenerateCostCredits,
    isGenerateDisabled: props.isGenerateDisabled,
    generationGuardrail: props.generationGuardrail,
    handleClearAgentChat: actions.onClearAgentChat,
    handleStandardCreatePrimarySubmit: actions.onPrimarySubmit,
    characterOptions: props.characterOptions,
    selectedCharacterId: props.selectedCharacterId,
    selectedCharacterLookId: props.selectedCharacterLookId,
    selectedCharacterLookLabel: props.selectedCharacterLookLabel,
    setSelectedCharacterId: props.onSelectedCharacterChange,
    onCreateCharacter: props.onCreateCharacter,
    isCharacterOptionsLoading: props.isCharacterOptionsLoading,
    isCharacterModeEnabled: props.isCharacterModeEnabled,
    setIsCharacterModeEnabled: props.onCharacterModeChange,
    refreshCharacterOptions: props.onRefreshCharacterOptions,
    loadCharacterLookOptions: props.onLoadCharacterLookOptions,
    resolveCharacterAvatarUrlById: props.resolveCharacterAvatarUrlById,
    imageResolution: props.imageResolution,
    setImageResolution: props.onImageResolutionChange,
    isStylesPanelOpen: props.isStylesPanelOpen,
    onStylesPanelToggle: props.onStylesPanelToggle,
    selectedStyleId: props.selectedStyleId,
    stylesCatalog: props.stylesCatalog,
    onOpenPresetsLibrary: props.onOpenPresetsLibrary,
  }),
});
