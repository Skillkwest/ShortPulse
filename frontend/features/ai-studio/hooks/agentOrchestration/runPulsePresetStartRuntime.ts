import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { AgentContext, AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import type {
  CreatePulsePresetStartResult,
  CreatePulseResolvedPreset,
} from "../../components/create/createPulsePresets";
import type { PromptOrigin } from "../../logic/agentPromptOwnership";
import type { StudioOutput, ToolId } from "../../types";
import type { CreateAgentOrchestrationRuntimePolicy } from "./createAgentOrchestrationRuntimePolicy";
import type { AgentModeHint, AgentSendToAgent } from "./types";

export type PulsePresetStartHandler = (
  preset: CreatePulseResolvedPreset,
  options?: {
    pulseSessionInstanceId?: string | null;
    deferWorkflowSessionCommit?: boolean;
    activationIsCurrent?: () => boolean;
  }
) => Promise<CreatePulsePresetStartResult>;

export type RunPulsePresetStartRuntimeParams = {
  runtimePolicy: CreateAgentOrchestrationRuntimePolicy;
  agentBootstrapReady: boolean;
  agentIsSending: boolean;
  agentSessionEnabled: boolean;
  agentUiBusyRef: MutableRefObject<boolean>;
  selectedTool: ToolId | null;
  getAgentContext: (params: {
    lastAssistantMessage: string | null;
    selectedOverride?: StudioOutput | null;
    modeHint?: AgentModeHint;
    includeActiveOutput?: boolean;
  }) => AgentContext;
  sendToAgent: AgentSendToAgent;
  resolvePulseSessionNamespace?: (presetId: string, pulseSessionInstanceId?: string) => string;
  setAgentSessionEnabled: Dispatch<SetStateAction<boolean>>;
  setAgentUiBusy: Dispatch<SetStateAction<boolean>>;
  setLatestAgentPrompt: Dispatch<SetStateAction<string | null>>;
  setPulseWorkflowSession: Dispatch<SetStateAction<AgentPulseWorkflowSession | null>>;
  setSharedPrompt: (value: string) => void;
  setPromptOrigin: Dispatch<SetStateAction<PromptOrigin>>;
  setAgentAttachmentError: Dispatch<SetStateAction<string | null>>;
  trackAgentUiEvent: (message: string, data?: Record<string, unknown>) => void;
  preset: CreatePulseResolvedPreset;
  options?: {
    pulseSessionInstanceId?: string | null;
    deferWorkflowSessionCommit?: boolean;
    activationIsCurrent?: () => boolean;
  };
  notifyBootstrapPending: () => void;
};

/**
 * Executes Pulse Create preset activation. Standard orchestration should not
 * carry Pulse kickoff dependencies or workflow-start behavior.
 */
export const runPulsePresetStartRuntime = async ({
  runtimePolicy,
  agentBootstrapReady,
  agentIsSending,
  agentSessionEnabled,
  agentUiBusyRef,
  selectedTool,
  getAgentContext,
  sendToAgent,
  resolvePulseSessionNamespace,
  setAgentSessionEnabled,
  setAgentUiBusy,
  setLatestAgentPrompt,
  setPulseWorkflowSession,
  setSharedPrompt,
  setPromptOrigin,
  setAgentAttachmentError,
  trackAgentUiEvent,
  preset,
  options,
  notifyBootstrapPending,
}: RunPulsePresetStartRuntimeParams): Promise<CreatePulsePresetStartResult> => {
  const { startPulsePreset } = await import("./pulsePresetStart");
  return startPulsePreset({
    preset,
    options,
    agentBootstrapReady,
    agentIsSending,
    agentSessionEnabled,
    agentUiBusyRef,
    latestAgentPrompt: null,
    lastAssistantMessage: null,
    selectedTool,
    pulseSessionInstanceId: runtimePolicy.pulseSessionInstanceId,
    resolvePulseSessionNamespace,
    getAgentContext,
    notifyBootstrapPending,
    sendToAgent,
    trackAgentUiEvent,
    setAgentSessionEnabled,
    setAgentAttachmentError,
    setAgentUiBusy,
    setPulseWorkflowSession,
    setLatestAgentPrompt,
    setSharedPrompt,
    setPromptOrigin,
  });
};
