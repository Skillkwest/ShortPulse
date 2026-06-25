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
import type { AgentComposerDirectDropPayload } from "../../logic/agentComposerDirectDropPayload";
import type { PulseChatHistoryPanelProps } from "../../components/create/PulseChatHistoryPanel";
import type { CreatePulsePreferenceRuntimeValue } from "../../components/create/createPulsePreferenceRuntime";
import type { PulseCreatePropertiesPanelProps } from "../../components/create/PulseCreatePropertiesPanel";

type UsePulseCreatePanelPropsParams = {
  pulsePrompt: string;
  activePulsePresetId: string | null;
  activePulsePresetLabel: string | null;
  activePulsePresetKind: CreatePulsePresetKind | null;
  hasActivePulseSession: boolean;
  pulseWorkflowSession: PulseCreatePropertiesPanelProps["pulseWorkflowSession"];
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
  handleAgentComposerDirectDrop: (payload: AgentComposerDirectDropPayload) => void;
  handleRemoveAgentAttachment: (id: string) => void;
  handleClearAgentAttachments: () => void;
  handleAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  handlePulsePromptChange: (value: string) => void;
  createIsGenerating: boolean;
  handleClearAgentChat: () => void;
  handleActivePulsePresetIdChange: PulseCreatePropertiesPanelProps["onActivePulsePresetIdChange"];
  handlePulsePresetStart: PulseCreatePropertiesPanelProps["onPulsePresetStart"];
  handlePulsePresetRestart: (preset: CreatePulseResolvedPreset) => Promise<void>;
  pulsePreferenceRuntime?: CreatePulsePreferenceRuntimeValue;
  pulseChatHistory?: PulseChatHistoryPanelProps;
};

/**
 * Pulse Create panel props.
 * Keeps Pulse-mode composer controls out of the shared page prop builder.
 */
export const buildPulseCreatePanelProps = ({
  pulsePrompt,
  activePulsePresetId,
  activePulsePresetLabel,
  activePulsePresetKind,
  hasActivePulseSession,
  pulseWorkflowSession,
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
  handleAgentComposerDirectDrop,
  handleRemoveAgentAttachment,
  handleClearAgentAttachments,
  handleAssistantMessageEdit,
  handlePulsePromptChange,
  createIsGenerating,
  handleClearAgentChat,
  handleActivePulsePresetIdChange,
  handlePulsePresetStart,
  handlePulsePresetRestart,
  pulsePreferenceRuntime,
  pulseChatHistory,
}: UsePulseCreatePanelPropsParams): PulseCreatePropertiesPanelProps => {
  return {
    pulsePrompt,
    activePulsePresetId,
    activePulsePresetLabel,
    activePulsePresetKind,
    hasActivePulseSession,
    pulseWorkflowSession,
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
    onAgentComposerDirectDrop: handleAgentComposerDirectDrop,
    onRemoveAgentAttachment: handleRemoveAgentAttachment,
    onClearAgentAttachments: handleClearAgentAttachments,
    onAssistantMessageEdit: handleAssistantMessageEdit,
    onPulsePromptChange: handlePulsePromptChange,
    isPromptGenerating: createIsGenerating,
    onClearAgentChat: handleClearAgentChat,
    onActivePulsePresetIdChange: handleActivePulsePresetIdChange,
    onPulsePresetStart: handlePulsePresetStart,
    onPulsePresetRestart: handlePulsePresetRestart,
    pulsePreferenceRuntime,
    pulseChatHistory,
  };
};
