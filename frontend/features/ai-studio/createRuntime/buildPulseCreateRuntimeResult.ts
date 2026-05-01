/**
 * Pulse Create runtime result composer.
 * Converts Pulse-owned workflow state/actions into Pulse panel props without
 * accepting Standard chat-mode or direct-generation controls.
 */
import type {
  PulseCreateAgentRuntimeActions,
  PulseCreateAgentRuntimeState,
  PulseCreateRuntimeProps,
  PulseCreateRuntimeResult,
} from "./contracts";
import { buildPulseCreatePanelProps } from "../hooks/pulseCreateRuntime/usePulseCreatePanelProps";

/**
 * Builds the Pulse Create runtime result from Pulse-only inputs.
 */
export const buildPulseCreateRuntimeResult = ({
  props,
  agentRuntime,
  actions,
}: {
  props: PulseCreateRuntimeProps;
  agentRuntime: PulseCreateAgentRuntimeState;
  actions: PulseCreateAgentRuntimeActions;
}): PulseCreateRuntimeResult => ({
  kind: "pulse",
  agentRuntime,
  actions,
  panelProps: buildPulseCreatePanelProps({
    pulsePrompt: props.pulsePrompt,
    agentEnabled: agentRuntime.agentEnabled,
    agentBootstrapReady: agentRuntime.agentBootstrapReady,
    agentMessages: agentRuntime.agentMessages,
    agentInput: agentRuntime.agentInput,
    agentBusy: agentRuntime.agentBusy,
    agentIsSending: agentRuntime.agentIsSending,
    agentUiBusy: agentRuntime.agentUiBusy,
    agentAttachmentError: agentRuntime.agentAttachmentError,
    agentError: agentRuntime.agentError,
    stagedAgentPrompt: agentRuntime.stagedAgentPrompt,
    agentAttachments: agentRuntime.agentAttachments,
    isAgentDropActive: agentRuntime.isAgentDropActive,
    handleAgentInputChange: actions.onAgentInputChange,
    handleAgentSend: actions.onAgentSend,
    handleAgentAttachmentDrop: actions.onAgentAttachmentDrop,
    handleAgentAttachmentDragOver: actions.onAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter: actions.onAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave: actions.onAgentAttachmentDragLeave,
    handleRemoveAgentAttachment: actions.onRemoveAgentAttachment,
    handleClearAgentAttachments: actions.onClearAgentAttachments,
    handleAssistantMessageEdit: actions.onAssistantMessageEdit,
    handlePulsePromptChange: props.onPulsePromptChange,
    createIsGenerating: props.createIsGenerating,
    currentCostCredits: props.currentCostCredits,
    isGenerateDisabled: props.isGenerateDisabled,
    generationGuardrail: props.generationGuardrail,
    handleClearAgentChat: actions.onClearAgentChat,
    handlePulseCreatePrimarySubmit: actions.onGenerateArtifact,
    savePromptReference: props.onSavePromptReference,
    expertCreateUiEligible: props.expertCreateUiEligible,
    pulsePreferenceRuntime: props.pulsePreferenceRuntime,
  }),
});
