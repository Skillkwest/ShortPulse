import { useCallback, useRef, useState } from "react";
import { normalizePromptText } from "../logic/agentPromptOwnership";
import { describeReferenceOutput } from "./agentOrchestration/describeReference";
import type { UseAiStudioAgentOrchestrationParams } from "./agentOrchestration/types";
import { useCreateAgentOrchestrationRuntime } from "./agentOrchestration/useCreateAgentOrchestrationRuntime";
import { usePulseCreateAgentSend } from "./agentOrchestration/usePulseCreateAgentSend";
import { usePulsePresetStartRuntime } from "./agentOrchestration/usePulsePresetStartRuntime";
import { useStandardCreateAgentSend } from "./agentOrchestration/useStandardCreateAgentSend";
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
  const orchestrationRuntime = useCreateAgentOrchestrationRuntime({
    runtimePolicy,
    setPulseWorkflowSession,
    setUiNotice,
    setAgentAttachmentError,
    trackAgentUiEvent,
  });
  const handlePulsePresetStart = usePulsePresetStartRuntime({
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
  });
  const handleStandardAgentSend = useStandardCreateAgentSend({
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
  });

  const handlePulseAgentSend = usePulseCreateAgentSend({
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
  });
  const handleAgentSend =
    runtimePolicy.kind === "standard" ? handleStandardAgentSend : handlePulseAgentSend;
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
    if (!orchestrationRuntime.ensureSessionReady()) {
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
        selectedOverride: orchestrationRuntime.resolveSelectedOverride(undefined),
        includeActiveOutput: orchestrationRuntime.includeActiveOutput,
        modeHint: "text",
      });
      const { response, actions, workflowSession, discarded } = await sendToAgent({
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
      await orchestrationRuntime.captureWorkflowSession(workflowSession);
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
    orchestrationRuntime,
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
        ensurePulseSessionReady: orchestrationRuntime.ensureSessionReady,
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
      orchestrationRuntime.ensureSessionReady,
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
