import { useCallback, useRef, useState } from "react";
import { normalizePromptText } from "../logic/agentPromptOwnership";
import { describeReferenceOutput } from "./agentOrchestration/describeReference";
import type {
  AgentSendOptions,
  UseAiStudioAgentOrchestrationParams,
} from "./agentOrchestration/types";
import type { PulsePresetStartHandler } from "./agentOrchestration/runPulsePresetStartRuntime";
import { useStandardCreatePromptEnhance } from "./agentOrchestration/useStandardCreatePromptEnhance";

const extractAgentResponseMessage = (response: unknown): string | null => {
  if (!response || typeof response !== "object") return null;
  const message = (response as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
};

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
  const [isReferencePromptEnhancing, setIsReferencePromptEnhancing] = useState(false);
  const [describeInFlightCount, setDescribeInFlightCount] = useState(0);
  const preparedImageUrlCacheRef = useRef(
    new Map<string, { safeUrl: string; expiresAtMs: number }>()
  );
  const notifyBootstrapPending = useCallback(() => {
    setUiNotice("Preparing chat. Try again in a moment.");
    trackAgentUiEvent("studio_agent_send_blocked_bootstrap_pending");
  }, [setUiNotice, trackAgentUiEvent]);
  const ensureStandardCreateSessionReady = useCallback(() => {
    if (runtimePolicy.kind === "standard") return true;
    setUiNotice("Use the Pulse workflow to continue.");
    trackAgentUiEvent("studio_agent_standard_action_blocked_in_pulse_mode");
    return false;
  }, [runtimePolicy, setUiNotice, trackAgentUiEvent]);
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
          selectedTool,
          setSharedPrompt,
          setPromptOrigin,
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
        latestAgentPrompt,
        setLatestAgentPrompt,
        setPulseWorkflowSession,
        selectedTool,
        setSharedPrompt,
        setPromptOrigin,
        sendToAgent,
        appendUserMessage,
        updateMessageById,
        getAgentContext,
        trackAgentUiEvent,
        lastAssistantMessage,
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
  const { isPromptRefining, handleAgentEnhanceSend } = useStandardCreatePromptEnhance({
    agentBootstrapReady,
    prompt,
    latestAgentPrompt,
    setLatestAgentPrompt,
    setSharedPrompt,
    setPromptOrigin,
    sendToAgent,
    getAgentContext,
    addAgentPromptReference,
    lastAssistantMessage,
    notifyBootstrapPending,
  });

  const handleReferencePromptEnhance = useCallback(async () => {
    if (!agentBootstrapReady) {
      notifyBootstrapPending();
      return;
    }
    if (!ensureStandardCreateSessionReady()) {
      return;
    }
    const isVideoPromptTool = selectedTool === "video" || selectedTool === "kling";
    const currentPrompt =
      (isVideoPromptTool ? videoReferenceText : editReferenceText)?.trim() ?? "";
    if (!currentPrompt || isReferencePromptEnhancing) return;
    setIsReferencePromptEnhancing(true);
    try {
      const context = getAgentContext({
        lastAssistantMessage,
        selectedOverride: null,
        includeActiveOutput: false,
        modeHint: "text",
      });
      const { response, actions, discarded } = await sendToAgent({
        text: currentPrompt,
        payloadText: currentPrompt,
        previousPrompt: latestAgentPrompt ?? null,
        context,
        isolateHistory: true,
        skipUserEcho: true,
      });
      if (discarded) {
        return;
      }
      const nextPrompt = normalizePromptText(
        actions?.applyPrompt ?? extractAgentResponseMessage(response)
      );
      if (nextPrompt) {
        if (isVideoPromptTool) {
          setVideoReferenceText(nextPrompt);
        } else {
          setEditReferenceText(nextPrompt);
        }
        setPromptOrigin("manual");
      }
    } finally {
      setIsReferencePromptEnhancing(false);
    }
  }, [
    agentBootstrapReady,
    editReferenceText,
    getAgentContext,
    isReferencePromptEnhancing,
    lastAssistantMessage,
    latestAgentPrompt,
    selectedTool,
    sendToAgent,
    setEditReferenceText,
    setPromptOrigin,
    setVideoReferenceText,
    videoReferenceText,
    ensureStandardCreateSessionReady,
    notifyBootstrapPending,
  ]);

  const handleDescribeReference = useCallback(
    async (outputId: string) =>
      describeReferenceOutput({
        outputId,
        agentBootstrapReady,
        aspect,
        model,
        latestAgentPrompt,
        lastAssistantMessage,
        notifyBootstrapPending,
        ensureSessionReady: ensureStandardCreateSessionReady,
        getOutputById,
        getAgentContext,
        sendToAgent,
        setOutputs,
        setActiveOutputId,
        setLatestAgentPrompt,
        setSharedPrompt,
        setPromptOrigin,
        setDescribeInFlightCount,
      }),
    [
      agentBootstrapReady,
      aspect,
      getOutputById,
      model,
      getAgentContext,
      lastAssistantMessage,
      latestAgentPrompt,
      sendToAgent,
      setActiveOutputId,
      setLatestAgentPrompt,
      setOutputs,
      setPromptOrigin,
      setSharedPrompt,
      ensureStandardCreateSessionReady,
      notifyBootstrapPending,
    ]
  );

  return {
    isPromptRefining,
    isReferencePromptEnhancing,
    describeInFlightCount,
    handleAgentSend,
    handlePulsePresetStart,
    handleAgentEnhanceSend,
    handleReferencePromptEnhance,
    handleDescribeReference,
  };
};
