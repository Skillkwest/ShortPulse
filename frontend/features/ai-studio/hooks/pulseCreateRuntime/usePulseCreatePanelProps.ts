import type { DragEvent } from "react";
import type {
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
} from "../../../../prefabs/agent";
import type {
  CreatePulsePresetKind,
  CreatePulseResolvedPreset,
} from "../../components/create/createPulsePresets";
import type { CreatePulsePreferenceRuntimeValue } from "../../components/create/createPulsePreferenceRuntime";
import type { PulseCreatePropertiesPanelProps } from "../../components/create/PulseCreatePropertiesPanel";

type UsePulseCreatePanelPropsParams = {
  pulsePrompt: string;
  activePulsePresetKind: CreatePulsePresetKind | null;
  agentEnabled: boolean;
  agentBootstrapReady: boolean;
  agentMessages: AgentMessage[];
  agentInput: string;
  agentBusy: boolean;
  agentIsSending: boolean;
  agentUiBusy: boolean;
  agentAttachmentError: string | null;
  agentError?: string | null;
  stagedAgentPrompt?: string | null;
  agentAttachments: AgentAttachment[];
  isAgentDropActive: boolean;
  handleAgentInputChange: (value: string) => void;
  handleAgentSend: () => void;
  handleAgentAttachmentDrop: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragOver: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  handleRemoveAgentAttachment: (id: string) => void;
  handleClearAgentAttachments: () => void;
  handleAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  handlePulsePromptChange: (value: string) => void;
  createIsGenerating: boolean;
  handleClearAgentChat: () => void;
  handlePulsePresetRestart: (preset: CreatePulseResolvedPreset) => Promise<void>;
  pulsePreferenceRuntime?: CreatePulsePreferenceRuntimeValue;
};

/**
 * Pulse Create panel props.
 * Keeps Pulse-mode composer controls out of the shared page prop builder.
 */
export const buildPulseCreatePanelProps = ({
  pulsePrompt,
  activePulsePresetKind,
  agentEnabled,
  agentBootstrapReady,
  agentMessages,
  agentInput,
  agentBusy,
  agentIsSending,
  agentUiBusy,
  agentAttachmentError,
  agentError,
  stagedAgentPrompt,
  agentAttachments,
  isAgentDropActive,
  handleAgentInputChange,
  handleAgentSend,
  handleAgentAttachmentDrop,
  handleAgentAttachmentDragOver,
  handleAgentAttachmentDragEnter,
  handleAgentAttachmentDragLeave,
  handleRemoveAgentAttachment,
  handleClearAgentAttachments,
  handleAssistantMessageEdit,
  handlePulsePromptChange,
  createIsGenerating,
  handleClearAgentChat,
  handlePulsePresetRestart,
  pulsePreferenceRuntime,
}: UsePulseCreatePanelPropsParams): PulseCreatePropertiesPanelProps => {
  return {
    pulsePrompt,
    activePulsePresetKind,
    agentEnabled,
    agentBootstrapPending: !agentBootstrapReady,
    agentMessages,
    agentInput,
    agentIsSending: agentBusy,
    agentTransportSending: agentIsSending,
    agentUiBusy,
    agentError: agentAttachmentError ?? agentError ?? undefined,
    stagedPrompt: stagedAgentPrompt,
    stagedAttachments: agentAttachments,
    agentDropActive: isAgentDropActive,
    onAgentInputChange: handleAgentInputChange,
    onAgentSend: handleAgentSend,
    onAgentAttachmentDrop: handleAgentAttachmentDrop,
    onAgentAttachmentDragOver: handleAgentAttachmentDragOver,
    onAgentAttachmentDragEnter: handleAgentAttachmentDragEnter,
    onAgentAttachmentDragLeave: handleAgentAttachmentDragLeave,
    onRemoveAgentAttachment: handleRemoveAgentAttachment,
    onClearAgentAttachments: handleClearAgentAttachments,
    onAssistantMessageEdit: handleAssistantMessageEdit,
    onPulsePromptChange: handlePulsePromptChange,
    isPromptGenerating: createIsGenerating,
    onClearAgentChat: handleClearAgentChat,
    onPulsePresetRestart: handlePulsePresetRestart,
    pulsePreferenceRuntime,
  };
};
