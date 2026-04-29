import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { AgentContext, AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import type {
  CreatePulsePresetStartResult,
  CreatePulseResolvedPreset,
} from "../../components/create/createPulsePresets";
import type { PromptOrigin } from "../../logic/agentPromptOwnership";
import type { StudioOutput, ToolId } from "../../types";
import type { CreateAgentOrchestrationRuntimePolicy } from "./createAgentOrchestrationRuntimePolicy";
import type { AgentModeHint, AgentSendToAgent } from "./types";

type UsePulsePresetStartRuntimeParams = {
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
  setUiNotice: Dispatch<SetStateAction<string | null>>;
  setAgentAttachmentError: Dispatch<SetStateAction<string | null>>;
  trackAgentUiEvent: (message: string, data?: Record<string, unknown>) => void;
};

/**
 * Pulse Create owns preset activation. Standard orchestration should not carry
 * Pulse kickoff dependencies or workflow-start behavior.
 */
export const usePulsePresetStartRuntime = ({
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
  setUiNotice,
  setAgentAttachmentError,
  trackAgentUiEvent,
}: UsePulsePresetStartRuntimeParams) => {
  const notifyBootstrapPending = useCallback(() => {
    setUiNotice("Preparing chat. Try again in a moment.");
    trackAgentUiEvent("studio_agent_send_blocked_bootstrap_pending");
  }, [setUiNotice, trackAgentUiEvent]);

  return useCallback(
    async (
      preset: CreatePulseResolvedPreset,
      options?: {
        pulseSessionInstanceId?: string | null;
      }
    ): Promise<CreatePulsePresetStartResult> => {
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
    },
    [
      agentBootstrapReady,
      agentIsSending,
      agentSessionEnabled,
      agentUiBusyRef,
      getAgentContext,
      notifyBootstrapPending,
      resolvePulseSessionNamespace,
      runtimePolicy.pulseSessionInstanceId,
      selectedTool,
      sendToAgent,
      setAgentAttachmentError,
      setAgentSessionEnabled,
      setAgentUiBusy,
      setLatestAgentPrompt,
      setPromptOrigin,
      setPulseWorkflowSession,
      setSharedPrompt,
      trackAgentUiEvent,
    ]
  );
};
