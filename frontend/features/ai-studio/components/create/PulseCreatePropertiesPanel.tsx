/**
 * Pulse Create properties panel.
 * Owns the Pulse composer, chat presentation, and Pulse preset rail wiring.
 */
import React from "react";
import type {
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentPulseWorkflowSession,
} from "../../../../prefabs/agent";
import { PulsePromptStep } from "../PulsePromptStep";
import { PulseCreateChatPanel } from "../promptStep/PulseCreateChatPanel";
import type { PromptStepPulseLoadingState } from "../promptStep/types";
import type { AiStudioPulsePresetChangeOptions } from "../../hooks/useAiStudioCreateModeRuntime";
import { PulseCreatePanelView } from "./PulseCreatePanelView";
import type { AgentComposerDirectDropPayload } from "../../logic/agentComposerDirectDropPayload";
import type { CanvasTearOutComposerTargetRegistry } from "../../hooks/useAiStudioCanvasTearOutTargets";
import type { PulseChatHistoryPanelProps } from "./PulseChatHistoryPanel";
import type { CreatePulsePreferenceRuntimeValue } from "./createPulsePreferenceRuntime";
import type {
  CreatePulsePresetKind,
  CreatePulsePresetId,
  CreatePulsePresetStartResult,
  CreatePulseResolvedPreset,
} from "./createPulsePresets";
import { resolveCreatePulsePresetLabelById } from "./createPulsePresets";

const EXPERT_CREATE_PULSE_AGENT_INPUT_MAX_HEIGHT_PX = 280;
const PULSE_LOADING_TITLE = "Generating...";

export type PulseCreatePropertiesPanelProps = {
  pulsePrompt: string;
  agentEnabled?: boolean;
  agentBootstrapPending?: boolean;
  agentMessages?: AgentMessage[];
  agentInput?: string;
  agentIsSending?: boolean;
  agentTransportSending?: boolean;
  agentUiBusy?: boolean;
  agentError?: string;
  stagedPrompt?: string | null;
  stagedAttachments?: AgentAttachment[];
  agentDropActive?: boolean;
  onPulsePromptChange: (value: string) => void;
  isPromptGenerating?: boolean;
  onAgentInputChange?: (value: string) => void;
  onAgentSend?: () => void;
  onAgentAttachmentDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentComposerDirectDrop?: (payload: AgentComposerDirectDropPayload) => void;
  onRemoveAgentAttachment?: (id: string) => void;
  onClearAgentAttachments?: () => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onClearAgentChat?: () => void;
  createModeToggle?: React.ReactNode;
  activePulsePresetId?: CreatePulsePresetId | null;
  activePulsePresetLabel?: string | null;
  activePulsePresetKind?: CreatePulsePresetKind | null;
  hasActivePulseSession?: boolean;
  pulseWorkflowSession?: AgentPulseWorkflowSession | null;
  onActivePulsePresetIdChange?: (
    presetId: CreatePulsePresetId | null,
    options?: AiStudioPulsePresetChangeOptions
  ) => string | null | void;
  onPulsePresetStart?: (
    preset: CreatePulseResolvedPreset,
    options?: {
      pulseSessionInstanceId?: string | null;
      deferWorkflowSessionCommit?: boolean;
      allowInterruptCurrentPulse?: boolean;
    }
  ) => Promise<CreatePulsePresetStartResult | void> | CreatePulsePresetStartResult | void;
  onPulsePresetRestart?: (preset: CreatePulseResolvedPreset) => Promise<void> | void;
  onOpenPresetsLibrary?: () => void;
  pulsePreferenceRuntime?: CreatePulsePreferenceRuntimeValue;
  pulseChatHistory?: PulseChatHistoryPanelProps;
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
};

export function PulseCreatePropertiesPanel({
  pulsePrompt,
  onPulsePromptChange,
  agentEnabled = false,
  agentBootstrapPending = false,
  agentMessages = [],
  agentInput = "",
  agentIsSending = false,
  agentTransportSending = false,
  agentUiBusy = false,
  agentError,
  stagedPrompt = null,
  stagedAttachments = [],
  agentDropActive = false,
  onAgentInputChange,
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
  onClearAgentChat,
  createModeToggle = null,
  activePulsePresetId,
  activePulsePresetLabel = null,
  hasActivePulseSession = Boolean(activePulsePresetId),
  pulseWorkflowSession = null,
  onActivePulsePresetIdChange,
  onPulsePresetStart,
  onPulsePresetRestart,
  onOpenPresetsLibrary,
  pulsePreferenceRuntime,
  pulseChatHistory,
  canvasTearOutTargetRegistry,
}: PulseCreatePropertiesPanelProps) {
  const pulseLoadingState = React.useMemo<PromptStepPulseLoadingState | null>(() => {
    if (!activePulsePresetId) {
      return null;
    }
    const presetLabel =
      activePulsePresetLabel?.trim() || resolveCreatePulsePresetLabelById(activePulsePresetId);
    const assistantMessageCount = agentMessages.filter(
      (message) => message.role === "assistant" && message.content.trim().length > 0
    ).length;
    const hasPendingStartupStep =
      pulseWorkflowSession?.status === "running" && assistantMessageCount === 0;
    const shouldShowStartupState =
      assistantMessageCount === 0 &&
      (agentUiBusy || agentTransportSending || agentIsSending || hasPendingStartupStep);
    if (shouldShowStartupState) {
      return {
        phase: "starting_pulse",
        title: PULSE_LOADING_TITLE,
        presetLabel,
      };
    }
    if ((agentTransportSending || agentIsSending) && assistantMessageCount > 0) {
      return {
        phase: "generating_step",
        title: PULSE_LOADING_TITLE,
        presetLabel,
      };
    }
    return null;
  }, [
    activePulsePresetId,
    activePulsePresetLabel,
    agentMessages,
    agentIsSending,
    agentTransportSending,
    agentUiBusy,
    pulseWorkflowSession?.status,
  ]);
  const promptStepProps: React.ComponentProps<typeof PulsePromptStep> = {
    prompt: pulsePrompt,
    onPromptChange: onPulsePromptChange,
    agentEnabled,
    agentBootstrapPending,
    agentMessages,
    agentInput,
    agentIsSending,
    agentError,
    stagedPrompt,
    stagedAttachments,
    agentDropActive,
    onAgentInputChange,
    onAgentSend,
    onAgentAttachmentDrop,
    onAgentAttachmentDragOver,
    onAgentAttachmentDragEnter,
    onAgentAttachmentDragLeave,
    onRemoveAgentAttachment,
    onClearAgentAttachments,
    onClearAgentChat,
    onAssistantMessageEdit,
    isGenerating: isPromptGenerating,
    showGenerationThinkingInChat: false,
    pulseLoadingState,
    chatOnly: true,
    stepNumber: "1",
    title: "Ask anything",
    subtitle: "",
    isCollapsed: false,
    onToggleCollapse: () => {
      // Pulse create mode keeps chat composer always open.
    },
    className: "create-composer-prompt-step is-character-mode-off",
    embedSendButtonInInput: true,
    hideAgentIntroMessage: true,
    agentAttachmentDropTarget: "input",
    hideInputDropHint: true,
    highlightLatestAssistantOnly: true,
    CreateChatPanel: PulseCreateChatPanel,
    useFlowComposerLayout: true,
    chatComposerOverlayEnabled: true,
    stackTrailingComposerControls: true,
    agentInputMaxHeightPx: EXPERT_CREATE_PULSE_AGENT_INPUT_MAX_HEIGHT_PX,
    agentInputCollapseOnBlur: false,
    hideHeader: true,
  };

  return (
    <PulseCreatePanelView
      promptStepProps={promptStepProps}
      canvasTearOutTargetRegistry={canvasTearOutTargetRegistry}
      onAgentComposerDirectDrop={onAgentComposerDirectDrop}
      isPromptGenerating={isPromptGenerating}
      createModeToggle={createModeToggle}
      activePulsePresetId={activePulsePresetId}
      hasActivePulseSession={hasActivePulseSession}
      pulseWorkflowSession={pulseWorkflowSession}
      onActivePulsePresetIdChange={onActivePulsePresetIdChange}
      onPulsePresetStart={onPulsePresetStart}
      onPulsePresetRestart={onPulsePresetRestart}
      isPulseActivationBusy={agentIsSending}
      onOpenPresetsLibrary={onOpenPresetsLibrary}
      pulsePreferenceRuntime={pulsePreferenceRuntime}
      pulseChatHistory={pulseChatHistory}
    />
  );
}
