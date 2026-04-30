/**
 * Standard Create agent runtime.
 * Owns Standard-only chat state, composer state, direct agent transport, prompt
 * enhancement, and persisted runtime snapshots.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  AgentAssistantMessageEditRequest,
  AgentContext,
  AgentMessage,
} from "../../../prefabs/agent";
import { useCreateAgentStateCore } from "../../ai-agent/useCreateAgentStateCore";
import { resolveAssistantMessageEditCommit } from "../../ai-agent/client/messageEditing";
import { standardCreateAgentRuntimeBinding } from "../hooks/agentBridgeRuntime/standardCreateAgentRuntimeBinding";
import type { AgentModeHint } from "../hooks/agentOrchestration/types";
import { runStandardCreateAgentSend } from "../hooks/agentOrchestration/runStandardCreateAgentSend";
import { useStandardCreatePromptEnhance } from "../hooks/agentOrchestration/useStandardCreatePromptEnhance";
import { useAiStudioAgentComposer } from "../hooks/useAiStudioAgentComposer";
import { useAiStudioAgentInteractions } from "../hooks/useAiStudioAgentInteractions";
import { getStagedAgentPrompt, type PromptOrigin } from "../logic/agentPromptOwnership";
import type {
  AiStudioSessionAgentMessageV1,
  AiStudioSessionAgentV1,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import type { StudioMode, StudioOutput, ToolId } from "../types";

type StandardCreateAgentContextResolver = (params: {
  lastAssistantMessage: string | null;
  selectedOverride?: StudioOutput | null;
  modeHint?: AgentModeHint;
}) => AgentContext;

type UseStandardCreateAgentRuntimeParams = {
  sessionId: string | null;
  mode: StudioMode;
  selectedTool: ToolId | null;
  prompt: string;
  chatModeEnabled: boolean;
  setChatModeEnabled: Dispatch<SetStateAction<boolean>>;
  getAgentContext: StandardCreateAgentContextResolver;
  setSharedPrompt: (value: string) => void;
  addAgentPromptReference: (promptText: string, title?: string) => void;
  editReferenceText: string;
  setEditReferenceText: (value: string) => void;
  videoReferenceText: string;
  setVideoReferenceText: (value: string) => void;
  findOutputById: (id: string) => StudioOutput | null;
  resolvePanelOutputPreviewUrl: (id: string | null | undefined) => string | null;
  aspect: string;
  model: string | null;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setActiveOutputId: Dispatch<SetStateAction<string | null>>;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
  trackAgentUiEvent: (message: string, data?: Record<string, unknown>) => void;
};

const canUseAssistantMessageAsPrompt = (message: AgentMessage): boolean =>
  message.role === "assistant" &&
  message.canUseAsPrompt === true &&
  typeof message.outputPrompt === "string" &&
  message.outputPrompt.trim().length > 0;

const serializeMessageForSnapshot = (message: AgentMessage): AiStudioSessionAgentMessageV1 => ({
  id: message.id ?? null,
  role: message.role,
  content: message.content,
  ...(typeof message.outputPrompt === "string" || message.outputPrompt === null
    ? { outputPrompt: message.outputPrompt }
    : {}),
  ...(typeof message.canUseAsPrompt === "boolean"
    ? { canUseAsPrompt: message.canUseAsPrompt }
    : {}),
  ...(message.outcomeClass ? { outcomeClass: message.outcomeClass } : {}),
  ...(message.reasonCode ? { reasonCode: message.reasonCode } : {}),
  ...(message.decision ? { decision: message.decision } : {}),
  attachments: message.attachments?.map((attachment) => ({
    id: attachment.id,
    kind: attachment.kind,
    referenceId: attachment.referenceId ?? null,
    text: attachment.text ?? null,
    imageUrl: attachment.imageUrl ?? null,
    aspect: attachment.aspect ?? null,
    deliveryStatus: attachment.deliveryStatus,
    deliveryError: attachment.deliveryError ?? null,
  })),
});

/**
 * Returns the Standard Create agent runtime.
 */
export const useStandardCreateAgentRuntime = ({
  sessionId,
  mode,
  selectedTool,
  prompt,
  chatModeEnabled,
  setChatModeEnabled,
  getAgentContext,
  setSharedPrompt,
  addAgentPromptReference,
  editReferenceText,
  setEditReferenceText,
  videoReferenceText,
  setVideoReferenceText,
  findOutputById,
  resolvePanelOutputPreviewUrl,
  aspect,
  model,
  setOutputs,
  setActiveOutputId,
  setUiNotice,
  trackAgentUiEvent,
}: UseStandardCreateAgentRuntimeParams) => {
  void editReferenceText;
  void setEditReferenceText;
  void videoReferenceText;
  void setVideoReferenceText;
  void aspect;
  void model;
  void setOutputs;
  void setActiveOutputId;
  const agentFlag =
    process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === undefined ||
    process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === "true";
  const directOpenAiBypassEnabledByConfig =
    process.env.NEXT_PUBLIC_STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED === "true";
  const directOpenAiBypassEnabled = directOpenAiBypassEnabledByConfig;
  const [agentSessionEnabled, setAgentSessionEnabled] = useState<boolean>(agentFlag);
  const agentEnabled = agentFlag && agentSessionEnabled;
  const agentBootstrapReady = Boolean(sessionId);
  const [agentUiBusy, setAgentUiBusy] = useState(false);
  const agentUiBusyRef = useRef(false);
  const [latestAgentPrompt, setLatestAgentPrompt] = useState<string | null>(null);
  const [promptOrigin, setPromptOrigin] = useState<PromptOrigin>("manual");
  const preparedImageUrlCacheRef = useRef<Map<string, { safeUrl: string; expiresAtMs: number }>>(
    new Map()
  );
  const standardAgentSessionNamespace = `ai-studio:${sessionId ?? "none"}::standard`;
  const shouldMirrorAssistantPromptToSharedPrompt =
    selectedTool === "create" || selectedTool === "text";

  const activeAgent = useCreateAgentStateCore({
    enabled: agentEnabled,
    sessionNamespace: standardAgentSessionNamespace,
    directOpenAiBypassEnabled: chatModeEnabled && directOpenAiBypassEnabled,
    requestRuntimeMode: "standard",
    allowSessionNamespaceOverride: false,
    sessionNamespaceOverrideErrorText:
      "Standard agent cannot send to an override session namespace.",
    buildAgentContext: standardCreateAgentRuntimeBinding.buildAgentContext,
    sendAgentTurn: standardCreateAgentRuntimeBinding.sendAgentTurn,
    resolveTransportSuccess: standardCreateAgentRuntimeBinding.resolveTransportSuccess,
  });
  const {
    messages: agentMessages,
    isSending: agentIsSending,
    error: agentError,
    send: sendToAgent,
    appendUserMessage,
    updateMessageById,
    replaceMessages,
    reset: resetAgentChat,
  } = activeAgent;
  const agentBusy = agentIsSending || agentUiBusy;

  const ensureAgentSession = useCallback(() => {
    if (agentFlag) setAgentSessionEnabled(true);
  }, [agentFlag]);

  const {
    agentInput,
    setAgentInput,
    handleAgentInputChange,
    agentAttachmentError,
    setAgentAttachmentError,
    agentAttachments,
    setAgentAttachments,
    isAgentDropActive,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleAgentAttachmentDrop,
    handleRemoveAgentAttachment,
    handleClearAgentAttachments,
    resetAgentComposer,
  } = useAiStudioAgentComposer({
    agentSessionEnabled,
    ensureAgentSession,
    findOutputById,
    resolveOutputPreviewUrlById: (id) => resolvePanelOutputPreviewUrl(id),
  });

  const latestAssistantMessage = useMemo(
    () => [...agentMessages].reverse().find((msg) => msg.role === "assistant")?.content ?? null,
    [agentMessages]
  );
  const stagedAgentPrompt = getStagedAgentPrompt(promptOrigin, latestAgentPrompt);
  const notifyBootstrapPending = useCallback(() => {
    setUiNotice("Agent is still starting. Try again in a moment.");
  }, [setUiNotice]);

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
    lastAssistantMessage: latestAssistantMessage,
    notifyBootstrapPending,
  });

  const handleAgentSend = useCallback(
    async (
      textOverride?: string,
      options?: { captureResult?: boolean; selectedOverride?: StudioOutput | null }
    ) =>
      runStandardCreateAgentSend({
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
        lastAssistantMessage: latestAssistantMessage,
        notifyBootstrapPending,
        preparedImageUrlCacheRef,
        textOverride,
        options,
      }),
    [
      agentAttachments,
      agentBootstrapReady,
      agentInput,
      agentIsSending,
      agentSessionEnabled,
      appendUserMessage,
      getAgentContext,
      latestAgentPrompt,
      latestAssistantMessage,
      notifyBootstrapPending,
      prompt,
      selectedTool,
      sendToAgent,
      setAgentAttachmentError,
      setAgentAttachments,
      setAgentInput,
      setPromptOrigin,
      setSharedPrompt,
      trackAgentUiEvent,
      updateMessageById,
    ]
  );

  const { handleClearAgentChat } = useAiStudioAgentInteractions({
    setLatestAgentPrompt,
    setPromptOrigin,
    trackAgentUiEvent,
    resetAgentChat,
    resetAgentComposer,
  });

  const handleAssistantMessageEdit = useCallback(
    ({ messageId, content }: AgentAssistantMessageEditRequest): boolean => {
      const targetMessage = agentMessages.find(
        (message) => message.id === messageId && message.role === "assistant"
      );
      if (!targetMessage) return false;

      const commitContent = resolveAssistantMessageEditCommit({
        currentContent: targetMessage.content,
        nextContent: content,
      });
      if (!commitContent) return false;

      const canCommitAsPrompt = canUseAssistantMessageAsPrompt(targetMessage);
      const didUpdate = updateMessageById(messageId, (message) =>
        message.role === "assistant"
          ? {
              ...message,
              content: commitContent,
              ...(canCommitAsPrompt ? { outputPrompt: commitContent } : {}),
            }
          : message
      );
      if (!didUpdate) return false;

      const latestEditableAssistantId = [...agentMessages]
        .reverse()
        .find((message) => canUseAssistantMessageAsPrompt(message))?.id;
      if (latestEditableAssistantId === messageId) {
        setLatestAgentPrompt(commitContent);
        setPromptOrigin("agent");
        if (shouldMirrorAssistantPromptToSharedPrompt) {
          setSharedPrompt(commitContent);
        }
      }
      trackAgentUiEvent("studio_agent_message_edit_committed", {
        message_id: messageId,
        content_length: commitContent.length,
      });
      return true;
    },
    [
      agentMessages,
      shouldMirrorAssistantPromptToSharedPrompt,
      setSharedPrompt,
      trackAgentUiEvent,
      updateMessageById,
    ]
  );

  const persistedAgentRuntime = useMemo<AiStudioSessionAgentV1>(
    () => ({
      messages: agentMessages.map(serializeMessageForSnapshot),
      input: agentInput,
      latestAgentPrompt,
      promptOrigin,
      chatModeEnabled,
    }),
    [agentInput, agentMessages, chatModeEnabled, latestAgentPrompt, promptOrigin]
  );

  const hydrateFromSessionAgentSnapshot = useCallback(
    ({ agentRuntimes }: Pick<AiStudioSessionHydrationPayload, "agent" | "agentRuntimes">) => {
      const standardRuntime = agentRuntimes.standard;
      replaceMessages(standardRuntime.messages);
      setAgentInput(standardRuntime.input);
      setAgentAttachments([]);
      setAgentAttachmentError(null);
      setLatestAgentPrompt(standardRuntime.latestAgentPrompt);
      setPromptOrigin(standardRuntime.promptOrigin);
      setChatModeEnabled(standardRuntime.chatModeEnabled);
    },
    [
      replaceMessages,
      setAgentAttachmentError,
      setAgentAttachments,
      setAgentInput,
      setChatModeEnabled,
      setLatestAgentPrompt,
      setPromptOrigin,
    ]
  );

  const resetProjectAgentConversation = useCallback(() => {
    resetAgentChat();
    resetAgentComposer({ preserveInput: false, preserveAttachments: false });
    setLatestAgentPrompt(null);
    setPromptOrigin("manual");
    setChatModeEnabled(true);
    setAgentAttachmentError(null);
    setAgentAttachments([]);
  }, [
    resetAgentChat,
    resetAgentComposer,
    setAgentAttachmentError,
    setAgentAttachments,
    setChatModeEnabled,
  ]);

  useEffect(() => {
    resetAgentComposer({ preserveInput: true, preserveAttachments: false });
  }, [mode, resetAgentComposer, selectedTool, sessionId]);

  return {
    agentEnabled,
    agentBootstrapReady,
    directOpenAiBypassEnabled,
    agentMessages,
    agentError,
    agentIsSending,
    agentUiBusy,
    agentBusy,
    agentInput,
    agentAttachmentError,
    agentAttachments,
    isAgentDropActive,
    latestAgentPrompt,
    promptOrigin,
    persistedAgentRuntime,
    chatModeEnabled,
    setChatModeEnabled,
    setPromptOrigin,
    stagedAgentPrompt,
    isPromptRefining,
    isReferencePromptEnhancing: false,
    describeInFlightCount: isPromptRefining ? 1 : 0,
    handleAgentInputChange,
    handleAgentSend,
    handleAgentEnhanceSend,
    handleReferencePromptEnhance: handleAgentEnhanceSend,
    resetProjectAgentConversation,
    hydrateFromSessionAgentSnapshot,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleAgentAttachmentDrop,
    handleRemoveAgentAttachment,
    handleClearAgentAttachments,
    handleAssistantMessageEdit,
    handleClearAgentChat,
  };
};
