import {
  useCallback,
  useMemo,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { AgentContext, AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import type {
  CreatePulsePresetStartResult,
  CreatePulseResolvedPreset,
} from "../../components/create/createPulsePresets";
import type { PromptOrigin } from "../../logic/agentPromptOwnership";
import type { StudioOutput, ToolId } from "../../types";
import type { CreateAgentOrchestrationRuntimePolicy } from "./createAgentOrchestrationRuntimePolicy";
import type { AgentModeHint, AgentSendToAgent } from "./types";

type UseCreateAgentOrchestrationRuntimeParams = {
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
 * Runtime adapter for Create agent orchestration.
 * Standard behavior is inert; Pulse workflow state and request shaping stay behind Pulse-owned modules.
 */
export const useCreateAgentOrchestrationRuntime = ({
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
}: UseCreateAgentOrchestrationRuntimeParams) => {
  const notifyBootstrapPending = useCallback(() => {
    setUiNotice("Preparing chat. Try again in a moment.");
    trackAgentUiEvent("studio_agent_send_blocked_bootstrap_pending");
  }, [setUiNotice, trackAgentUiEvent]);

  const notifyPulseSelectionRequired = useCallback(() => {
    setUiNotice("Select a Pulse to start.");
    trackAgentUiEvent("studio_agent_send_blocked_no_active_pulse_session");
  }, [setUiNotice, trackAgentUiEvent]);

  const ensureSessionReady = useCallback(() => {
    if (runtimePolicy.kind !== "pulse") return true;
    if (runtimePolicy.hasActivePulseSession) return true;
    notifyPulseSelectionRequired();
    return false;
  }, [notifyPulseSelectionRequired, runtimePolicy]);

  const blockInvalidUserInput = useCallback(
    async ({
      context,
      hasImageAttachment,
    }: {
      context: AgentContext;
      hasImageAttachment: boolean;
    }): Promise<boolean> => {
      if (runtimePolicy.kind !== "pulse") return false;
      const { resolvePulseImageIntakeBlock } = await import("./pulseSendRuntime");
      const pulseImageIntakeBlock = resolvePulseImageIntakeBlock({
        context,
        hasImageAttachment,
      });
      if (!pulseImageIntakeBlock) return false;
      setUiNotice(pulseImageIntakeBlock);
      setAgentAttachmentError(pulseImageIntakeBlock);
      trackAgentUiEvent("studio_agent_send_blocked_pulse_image_required");
      return true;
    },
    [runtimePolicy, setAgentAttachmentError, setUiNotice, trackAgentUiEvent]
  );

  const captureWorkflowSession = useCallback(
    async (workflowSession?: AgentPulseWorkflowSession | null): Promise<void> => {
      if (runtimePolicy.kind !== "pulse") return;
      const { capturePulseWorkflowSession } = await import("./pulseSendRuntime");
      capturePulseWorkflowSession({ workflowSession, setPulseWorkflowSession });
    },
    [runtimePolicy, setPulseWorkflowSession]
  );

  const prepareUserInputRequestContext = useCallback(
    async ({
      context,
      userInput,
    }: {
      context: AgentContext;
      userInput: string;
    }): Promise<AgentContext> => {
      if (runtimePolicy.kind !== "pulse") return context;
      const { buildPulseRequestContextForUserInput } = await import("./pulseSendRuntime");
      const pulseRequest = buildPulseRequestContextForUserInput({
        context,
        workflowPulse: runtimePolicy.resolveWorkflowPulse(context),
        userInput,
      });
      await captureWorkflowSession(pulseRequest.pendingWorkflowSession);
      return pulseRequest.requestContext;
    },
    [captureWorkflowSession, runtimePolicy]
  );

  const handlePulsePresetStart = useCallback(
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
      runtimePolicy,
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

  return useMemo(
    () => ({
      includeActiveOutput: runtimePolicy.includeActiveOutput,
      pulseSessionInstanceId: runtimePolicy.pulseSessionInstanceId,
      resolveSelectedOverride: runtimePolicy.resolveSelectedOverride,
      hasPromptApplyPulseContext: runtimePolicy.hasPromptApplyPulseContext,
      ensureSessionReady,
      blockInvalidUserInput,
      prepareUserInputRequestContext,
      captureWorkflowSession,
      handlePulsePresetStart,
    }),
    [
      blockInvalidUserInput,
      captureWorkflowSession,
      ensureSessionReady,
      handlePulsePresetStart,
      prepareUserInputRequestContext,
      runtimePolicy,
    ]
  );
};
