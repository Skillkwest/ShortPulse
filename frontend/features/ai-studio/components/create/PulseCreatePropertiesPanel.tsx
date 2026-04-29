/**
 * Pulse Create properties panel.
 * Owns the Pulse composer, chat presentation, and Pulse preset rail wiring.
 */
import React from "react";
import type {
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
  AgentPulseWorkflowSession,
} from "../../../../prefabs/agent";
import { PulsePromptStep } from "../PulsePromptStep";
import type { ModelModalContext } from "../ModelModal";
import { PulseCreateChatPanel } from "../promptStep/PulseCreateChatPanel";
import type { PromptStepPulseLoadingState } from "../promptStep/types";
import type { StudioMode } from "../../types";
import type { AiStudioPulsePresetChangeOptions } from "../../hooks/useAiStudioCreateModeRuntime";
import { PulseCreatePanelView } from "./PulseCreatePanelView";
import type { ExpertCreateMode } from "./createModeTypes";
import type {
  CreatePulsePresetId,
  CreatePulsePresetStartResult,
  CreatePulseResolvedPreset,
} from "./createPulsePresets";
import { resolveCreatePulsePresetLabelById } from "./createPulsePresets";

const EXPERT_CREATE_PULSE_AGENT_INPUT_MAX_HEIGHT_PX = 280;
const PULSE_LOADING_TITLE = "Generating...";

export type PulseCreatePropertiesPanelProps = {
  mode: StudioMode;
  aspect: string;
  modelId: string | null;
  modelLabel: string;
  prompt: string;
  agentEnabled?: boolean;
  agentBootstrapPending?: boolean;
  agentMessages?: AgentMessage[];
  agentInput?: string;
  chatModeEnabled?: boolean;
  directOpenAiBypassEnabled?: boolean;
  agentIsSending?: boolean;
  agentTransportSending?: boolean;
  agentUiBusy?: boolean;
  agentError?: string;
  stagedPrompt?: string | null;
  assistantBubbleMedia?: Record<string, AgentOutputBubbleMediaState>;
  stagedAttachments?: AgentAttachment[];
  agentDropActive?: boolean;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
  onPromptChange: (value: string) => void;
  costCredits?: number | null;
  isPromptGenerating?: boolean;
  isGenerateDisabled?: boolean;
  guardrailReason?: string | null;
  onAgentInputChange?: (value: string) => void;
  onAgentSend?: () => void;
  onAgentEnhanceSend?: () => void;
  onAgentAttachmentDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onRemoveAgentAttachment?: (id: string) => void;
  onClearAgentAttachments?: () => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onGenerate: () => void;
  onSavePrompt: (customPrompt?: string) => void;
  shouldDisableSave?: boolean;
  onClearAgentChat?: () => void;
  beginnerMode?: boolean;
  expertCreateUiEligible?: boolean;
  expertCreateMode?: ExpertCreateMode;
  onExpertCreateModeChange?: (value: ExpertCreateMode) => void;
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
  directOpenAiBypassEnabled = false,
  agentIsSending = false,
  agentTransportSending = false,
  agentUiBusy = false,
  agentError,
  stagedPrompt = null,
  assistantBubbleMedia,
  stagedAttachments = [],
  agentDropActive = false,
  onAgentInputChange,
  onAgentSend,
  onAgentEnhanceSend,
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
  expertCreateMode,
  onExpertCreateModeChange,
  activePulsePresetId,
  activePulsePresetLabel = null,
  hasActivePulseSession = Boolean(activePulsePresetId),
  pulseWorkflowSession = null,
  onActivePulsePresetIdChange,
  onPulsePresetStart,
  onOpenPresetsLibrary,
  onGenerate,
  guardrailReason,
}: PulseCreatePropertiesPanelProps) {
  const [uncontrolledExpertCreateMode, setUncontrolledExpertCreateMode] =
    React.useState<ExpertCreateMode>("pulse");
  const resolvedExpertCreateMode = expertCreateMode ?? uncontrolledExpertCreateMode;
  const handleExpertCreateModeChange = React.useCallback(
    (value: ExpertCreateMode) => {
      setUncontrolledExpertCreateMode(value);
      onExpertCreateModeChange?.(value);
    },
    [onExpertCreateModeChange]
  );
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
    assistantBubbleMedia,
    stagedAttachments,
    agentDropActive,
    onAgentInputChange,
    chatModeEnabled: true,
    onChatModeEnabledChange: undefined,
    directOpenAiBypassEnabled,
    onAgentSend,
    onAgentEnhanceSend,
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
    disableOutputGenerate: false,
    outputGenerateGuardrailReason: null,
    hideOutputGenerateControls: true,
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
    useAgentResponseInlineGeneratePrefab: true,
    highlightLatestAssistantOnly: true,
    CreateChatPanel: PulseCreateChatPanel,
    useFlowComposerLayout: true,
    chatComposerOverlayEnabled: true,
    stackTrailingComposerControls: true,
    agentInputMaxHeightPx: EXPERT_CREATE_PULSE_AGENT_INPUT_MAX_HEIGHT_PX,
    agentInputCollapseOnBlur: true,
    hideChatModeToggle: true,
    composerLeadingContent: null,
  };

  return (
    <PulseCreatePanelView
      promptStepProps={promptStepProps}
      onGenerate={onGenerate}
      costCredits={costCredits}
      isPromptGenerating={isPromptGenerating}
      isGenerateDisabled={isGenerateDisabled}
      guardrailReason={guardrailReason}
      expertCreateMode={resolvedExpertCreateMode}
      onExpertCreateModeChange={handleExpertCreateModeChange}
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
