/**
 * Standard Create panel contract.
 * Converts Standard-only runtime state into Standard panel props without
 * reintroducing a mixed Standard/Pulse panel seam.
 */
import type { Dispatch, DragEvent, SetStateAction } from "react";
import type {
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
} from "../../../../prefabs/agent";
import type { ModelModalContext } from "../../components/ModelModal";
import type { AgentComposerDirectDropPayload } from "../../logic/agentComposerDirectDropPayload";
import type {
  CreateCharacterLookOption,
  CreateCharacterOption,
} from "../../components/create/useCreateCharacterModeController";
import type { StandardCreatePropertiesPanelProps } from "../../components/create/StandardCreatePropertiesPanel";
import type { ExpertEditStyleTile } from "../../components/edit/expertEditStyles";
import type { StudioMode, ToolId } from "../../types";
import {
  resolveStandardCreatePrimaryActionDecision,
  type StandardCreatePrimaryActionNoopReason,
} from "./standardCreatePrimaryActionPolicy";

export type BuildStandardCreatePanelPropsParams = {
  mode: StudioMode;
  selectedTool: ToolId | null;
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
  handleAgentComposerDirectDrop: (payload: AgentComposerDirectDropPayload) => void;
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
  handleCloseModelModal: () => void;
  handleManualPromptChange: (value: string) => void;
  createIsGenerating: boolean;
  isPromptRefining: boolean;
  describeInFlightCount: number;
  createGenerateCostCredits: number | null;
  isGenerateDisabled: boolean;
  generationGuardrail: string | null;
  handleClearAgentChat: () => void;
  handleStandardCreatePrimarySubmit: () => void;
  characterOptions: CreateCharacterOption[];
  selectedCharacterId: string;
  selectedCharacterLookId?: string;
  selectedCharacterLookLabel?: string | null;
  setSelectedCharacterId: (characterId: string, lookId: string) => void;
  onCreateCharacter?: () => void;
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
  onPinPromptReference?: (text: string) => void;
};

/**
 * Builds Standard Create panel props from Standard-owned runtime state.
 */
export const buildStandardCreatePanelProps = ({
  mode,
  selectedTool,
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
  handleAgentComposerDirectDrop,
  handleRemoveAgentAttachment,
  handleClearAgentAttachments,
  handleAssistantMessageEdit,
  isModelModalOpen,
  modelModalAnchor,
  setAspect,
  handleOpenModelModal,
  handleCloseModelModal,
  handleManualPromptChange,
  createIsGenerating,
  isPromptRefining,
  describeInFlightCount,
  createGenerateCostCredits,
  isGenerateDisabled,
  generationGuardrail,
  handleClearAgentChat,
  handleStandardCreatePrimarySubmit,
  characterOptions,
  selectedCharacterId,
  selectedCharacterLookId,
  selectedCharacterLookLabel,
  setSelectedCharacterId,
  onCreateCharacter,
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
  onPinPromptReference,
}: BuildStandardCreatePanelPropsParams): StandardCreatePropertiesPanelProps => {
  const primaryActionDecision = resolveStandardCreatePrimaryActionDecision({
    enabled: true,
    isGenerateDisabled,
    selectedTool,
    chatModeEnabled,
    agentInput,
    prompt,
    createGenerateCostCredits,
    agentAttachments,
  });
  const isPrimaryGenerateDisabled = primaryActionDecision.kind === "noop";
  const resolvePrimaryGuardrailReason = (
    reason: StandardCreatePrimaryActionNoopReason
  ): string | null => {
    switch (reason) {
      case "upstream_disabled":
        return generationGuardrail;
      case "image_attachment_failed":
        return "Attached image failed to prepare. Remove it or retry the attachment.";
      case "image_attachment_preparing":
        return null;
      case "empty_visible_prompt":
        // Keep the CTA disabled for an empty composer, but do not surface
        // inline helper copy that reintroduces the removed empty-state warning.
        return null;
      case "disabled":
      default:
        return generationGuardrail;
    }
  };
  const guardrailReason =
    primaryActionDecision.kind === "noop"
      ? resolvePrimaryGuardrailReason(primaryActionDecision.reason)
      : generationGuardrail;

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
    onAgentComposerDirectDrop: handleAgentComposerDirectDrop,
    onRemoveAgentAttachment: handleRemoveAgentAttachment,
    onClearAgentAttachments: handleClearAgentAttachments,
    onAssistantMessageEdit: handleAssistantMessageEdit,
    isModelModalOpen,
    modelModalAnchor,
    onAspectChange: setAspect,
    onModelPickerOpen: handleOpenModelModal,
    onModelPickerClose: handleCloseModelModal,
    onPromptChange: handleManualPromptChange,
    isPromptGenerating: createIsGenerating || isPromptRefining || describeInFlightCount > 0,
    costCredits: createGenerateCostCredits,
    isGenerateDisabled: isPrimaryGenerateDisabled,
    guardrailReason,
    onClearAgentChat: handleClearAgentChat,
    onGenerate: handleStandardCreatePrimarySubmit,
    characterOptions,
    selectedCharacterId,
    selectedCharacterLookId,
    selectedCharacterLookLabel,
    onSelectedCharacterIdChange: setSelectedCharacterId,
    onCreateCharacter,
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
    onPinPromptReference,
  };
};
