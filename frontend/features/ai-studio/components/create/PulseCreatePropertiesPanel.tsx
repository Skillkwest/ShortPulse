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
import type {
  CreatePulsePresetId,
  CreatePulsePresetStartResult,
  CreatePulseResolvedPreset,
} from "./createPulsePresets";
import { resolveCreatePulsePresetLabelById } from "./createPulsePresets";

const EXPERT_CREATE_PULSE_AGENT_INPUT_MAX_HEIGHT_PX = 280;
const PULSE_LOADING_TITLE = "Generating...";

export type PulseCreatePropertiesPanelProps = {
  prompt: string;
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
  onPromptChange: (value: string) => void;
  costCredits?: number | null;
  isPromptGenerating?: boolean;
  isGenerateDisabled?: boolean;
  guardrailReason?: string | null;
  onAgentInputChange?: (value: string) => void;
  onAgentSend?: () => void;
  onAgentAttachmentDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onRemoveAgentAttachment?: (id: string) => void;
  onClearAgentAttachments?: () => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onGeneratePulseArtifact: () => void;
  onSavePrompt: (customPrompt?: string) => void;
  shouldDisableSave?: boolean;
  onClearAgentChat?: () => void;
  beginnerMode?: boolean;
  expertCreateUiEligible?: boolean;
  createModeToggle?: React.ReactNode;
  activePulsePresetId?: CreatePulsePresetId | null;
  activePulsePresetLabel?: string | null;
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
    }
  ) => Promise<CreatePulsePresetStartResult | void> | CreatePulsePresetStartResult | void;
  onOpenPresetsLibrary?: () => void;
};

export function PulseCreatePropertiesPanel({
  prompt,
  onPromptChange,
  costCredits = null,
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
  onRemoveAgentAttachment,
  onClearAgentAttachments,
  onAssistantMessageEdit,
  onSavePrompt,
  shouldDisableSave = false,
  isPromptGenerating = false,
  isGenerateDisabled = false,
  onClearAgentChat,
  createModeToggle = null,
  activePulsePresetId,
  activePulsePresetLabel = null,
  hasActivePulseSession = Boolean(activePulsePresetId),
  pulseWorkflowSession = null,
  onActivePulsePresetIdChange,
  onPulsePresetStart,
  onOpenPresetsLibrary,
  onGeneratePulseArtifact,
  guardrailReason,
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
    const stepLabel = pulseWorkflowSession?.currentStepLabel?.trim() || null;
    const hasPendingStartupStep =
      pulseWorkflowSession?.status === "running" && assistantMessageCount === 0;
    if (agentUiBusy || (agentTransportSending && hasPendingStartupStep)) {
      return {
        phase: "starting_pulse",
        title: PULSE_LOADING_TITLE,
        message: "Preparing your guided workflow...",
        presetLabel,
        stepLabel,
      };
    }
    if (agentTransportSending && assistantMessageCount > 0) {
      return {
        phase: "generating_step",
        title: PULSE_LOADING_TITLE,
        message: stepLabel
          ? `Building the next instruction for ${stepLabel}.`
          : "Building the next instruction for your workflow.",
        presetLabel,
        stepLabel,
      };
    }
    return null;
  }, [
    activePulsePresetId,
    activePulsePresetLabel,
    agentMessages,
    agentTransportSending,
    agentUiBusy,
    pulseWorkflowSession?.currentStepLabel,
    pulseWorkflowSession?.status,
  ]);

  const promptStepProps: React.ComponentProps<typeof PulsePromptStep> = {
    prompt,
    onPromptChange,
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
    onSavePrompt,
    isGenerating: isPromptGenerating,
    showGenerationThinkingInChat: false,
    shouldDisableSave,
    pulseLoadingState,
    chatOnly: true,
    chatPromptSaveButtonClassName: "create-chat-pin-btn",
    chatPromptSaveButtonUnstyled: true,
    stepNumber: "1",
    title: "Ask anything",
    subtitle: "",
    beginnerPinHelperText: "",
    isCollapsed: false,
    onToggleCollapse: () => {
      // Pulse expert mode keeps chat composer always open.
    },
    beginnerMode: false,
    className: "create-expert-prompt-step is-character-mode-off",
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
    agentInputCollapseOnBlur: true,
    composerLeadingContent: null,
  };

  return (
    <PulseCreatePanelView
      promptStepProps={promptStepProps}
      onGeneratePulseArtifact={onGeneratePulseArtifact}
      costCredits={costCredits}
      isPromptGenerating={isPromptGenerating}
      isGenerateDisabled={isGenerateDisabled}
      guardrailReason={guardrailReason}
      createModeToggle={createModeToggle}
      activePulsePresetId={activePulsePresetId}
      hasActivePulseSession={hasActivePulseSession}
      pulseWorkflowSession={pulseWorkflowSession}
      onActivePulsePresetIdChange={onActivePulsePresetIdChange}
      onPulsePresetStart={onPulsePresetStart}
      isPulseActivationBusy={agentIsSending}
      onOpenPresetsLibrary={onOpenPresetsLibrary}
    />
  );
}
