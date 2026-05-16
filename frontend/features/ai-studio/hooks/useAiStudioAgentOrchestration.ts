import { useCallback, useRef } from "react";
import type {
  AgentSendOptions,
  UseAiStudioAgentOrchestrationParams,
} from "./agentOrchestration/types";
import type { PulsePresetStartHandler } from "./agentOrchestration/runPulsePresetStartRuntime";

export const useAiStudioAgentOrchestration = ({
  agentIsSending,
  agentBootstrapReady,
  agentUiBusyRef,
  setAgentUiBusy,
  agentSessionEnabled,
  setAgentSessionEnabled,
  agentInput,
  setAgentInput,
  agentAttachments,
  setAgentAttachments,
  setAgentAttachmentError,
  prompt,
  latestAgentPrompt,
  setLatestAgentPrompt,
  setPulseWorkflowSession,
  selectedTool,
  setSharedPrompt,
  setPromptOrigin,
  sendToAgent,
  appendUserMessage,
  updateMessageById,
  removeMessageById,
  getAgentContext,
  trackAgentUiEvent,
  addAgentPromptReference,
  editReferenceText,
  setEditReferenceText,
  videoReferenceText,
  setVideoReferenceText,
  getOutputById,
  aspect,
  model,
  setOutputs,
  setActiveOutputId,
  lastAssistantMessage,
  setUiNotice,
  runtimePolicy,
  resolvePulseSessionNamespace,
}: UseAiStudioAgentOrchestrationParams) => {
  void addAgentPromptReference;
  void editReferenceText;
  void setEditReferenceText;
  void videoReferenceText;
  void setVideoReferenceText;
  void getOutputById;
  void aspect;
  void model;
  void setOutputs;
  void setActiveOutputId;
  void lastAssistantMessage;
  const isReferencePromptEnhancing = false;
  const describeInFlightCount = 0;
  const preparedImageUrlCacheRef = useRef(
    new Map<string, { safeUrl: string; expiresAtMs: number }>()
  );
  const notifyBootstrapPending = useCallback(() => {
    setUiNotice("Preparing chat. Try again in a moment.");
    trackAgentUiEvent("studio_agent_send_blocked_bootstrap_pending");
  }, [setUiNotice, trackAgentUiEvent]);
  const handleDisabledStandardHelperAction = useCallback(async () => {
    if (!agentBootstrapReady) {
      notifyBootstrapPending();
      return;
    }
    if (runtimePolicy.kind !== "standard") {
      setUiNotice("Use Pulse mode to continue.");
      trackAgentUiEvent("studio_agent_standard_action_blocked_in_pulse_mode");
      return;
    }
    setUiNotice("This helper is unavailable in Standard mode.");
    trackAgentUiEvent("studio_agent_standard_helper_disabled");
  }, [agentBootstrapReady, notifyBootstrapPending, runtimePolicy, setUiNotice, trackAgentUiEvent]);
  const handlePulsePresetStart = useCallback<PulsePresetStartHandler>(
    async (preset, options) => {
      const { runPulsePresetStartRuntime } =
        await import("./agentOrchestration/runPulsePresetStartRuntime");
      return runPulsePresetStartRuntime({
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
  const handleAgentSend = useCallback(
    async (
      textOverride?: string,
      options?: AgentSendOptions
    ): Promise<{ prompt: string; referenceTitle?: string | null } | void> => {
      if (runtimePolicy.kind === "standard") {
        const { runStandardCreateAgentSend } =
          await import("./agentOrchestration/runStandardCreateAgentSend");
        return runStandardCreateAgentSend({
          agentIsSending,
          agentBootstrapReady,
          agentUiBusyRef,
          setAgentUiBusy,
          agentSessionEnabled,
          setAgentSessionEnabled,
          agentInput,
          setAgentInput,
          agentAttachments,
          setAgentAttachments,
          setAgentAttachmentError,
          prompt,
          latestAgentPrompt,
          setLatestAgentPrompt,
          sendToAgent,
          appendUserMessage,
          updateMessageById,
          getAgentContext,
          trackAgentUiEvent,
          lastAssistantMessage,
          notifyBootstrapPending,
          preparedImageUrlCacheRef,
          textOverride,
          options,
        });
      }

      const { runPulseCreateAgentSend } =
        await import("./agentOrchestration/runPulseCreateAgentSend");
      return runPulseCreateAgentSend({
        agentIsSending,
        agentBootstrapReady,
        agentUiBusyRef,
        setAgentUiBusy,
        agentSessionEnabled,
        setAgentSessionEnabled,
        agentInput,
        setAgentInput,
        agentAttachments,
        setAgentAttachments,
        setAgentAttachmentError,
        prompt,
        setLatestAgentPrompt,
        setPulseWorkflowSession,
        selectedTool,
        setSharedPrompt,
        setPromptOrigin,
        sendToAgent,
        appendUserMessage,
        updateMessageById,
        removeMessageById,
        getAgentContext,
        trackAgentUiEvent,
        setUiNotice,
        runtimePolicy,
        notifyBootstrapPending,
        preparedImageUrlCacheRef,
        textOverride,
        options,
      });
    },
    [
      agentAttachments,
      agentBootstrapReady,
      agentInput,
      agentIsSending,
      agentSessionEnabled,
      agentUiBusyRef,
      appendUserMessage,
      getAgentContext,
      lastAssistantMessage,
      latestAgentPrompt,
      notifyBootstrapPending,
      preparedImageUrlCacheRef,
      prompt,
      removeMessageById,
      runtimePolicy,
      selectedTool,
      sendToAgent,
      setAgentAttachmentError,
      setAgentAttachments,
      setAgentInput,
      setAgentSessionEnabled,
      setAgentUiBusy,
      setLatestAgentPrompt,
      setPromptOrigin,
      setPulseWorkflowSession,
      setSharedPrompt,
      setUiNotice,
      trackAgentUiEvent,
      updateMessageById,
    ]
  );
  const handleAgentEnhanceSend = handleDisabledStandardHelperAction;
  const handleReferencePromptEnhance = handleDisabledStandardHelperAction;
  const handleDescribeReference = useCallback(
    async (_outputId: string) => {
      await handleDisabledStandardHelperAction();
    },
    [handleDisabledStandardHelperAction]
  );

  return {
    isPromptRefining: false,
    isReferencePromptEnhancing,
    describeInFlightCount,
    handleAgentSend,
    handlePulsePresetStart,
    handleAgentEnhanceSend,
    handleReferencePromptEnhance,
    handleDescribeReference,
  };
};
