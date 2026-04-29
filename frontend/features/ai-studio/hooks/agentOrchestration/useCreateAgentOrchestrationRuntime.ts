import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import type { AgentContext, AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import type { CreateAgentOrchestrationRuntimePolicy } from "./createAgentOrchestrationRuntimePolicy";

type UseCreateAgentOrchestrationRuntimeParams = {
  runtimePolicy: CreateAgentOrchestrationRuntimePolicy;
  setPulseWorkflowSession: Dispatch<SetStateAction<AgentPulseWorkflowSession | null>>;
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
  setPulseWorkflowSession,
  setUiNotice,
  setAgentAttachmentError,
  trackAgentUiEvent,
}: UseCreateAgentOrchestrationRuntimeParams) => {
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

  const hasRequiredRequestContext = useCallback(
    (context: AgentContext): boolean => {
      if (runtimePolicy.kind !== "pulse") return true;
      if (runtimePolicy.resolveWorkflowPulse(context)) return true;
      setUiNotice("Pulse context is unavailable. Start the Pulse again.");
      trackAgentUiEvent("studio_agent_send_blocked_missing_pulse_context");
      return false;
    },
    [runtimePolicy, setUiNotice, trackAgentUiEvent]
  );

  return useMemo(
    () => ({
      includeActiveOutput: runtimePolicy.includeActiveOutput,
      pulseSessionInstanceId: runtimePolicy.pulseSessionInstanceId,
      resolveSelectedOverride: runtimePolicy.resolveSelectedOverride,
      hasPromptApplyPulseContext: runtimePolicy.hasPromptApplyPulseContext,
      ensureSessionReady,
      blockInvalidUserInput,
      hasRequiredRequestContext,
      prepareUserInputRequestContext,
      captureWorkflowSession,
    }),
    [
      blockInvalidUserInput,
      captureWorkflowSession,
      ensureSessionReady,
      hasRequiredRequestContext,
      prepareUserInputRequestContext,
      runtimePolicy,
    ]
  );
};
