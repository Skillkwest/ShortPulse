/**
 * Standard Create agent runtime.
 * Owns Standard-only chat state, composer state, agent transport, prompt
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
import { standardCreateAgentRuntimeBinding } from "../hooks/createAgentRuntime/standardCreateAgentRuntimeBinding";
import type { AgentModeHint } from "../hooks/agentOrchestration/types";
import { runStandardCreateAgentSend } from "../hooks/agentOrchestration/runStandardCreateAgentSend";
import { useAiStudioAgentComposer } from "../hooks/useAiStudioAgentComposer";
import { useAiStudioAgentInteractions } from "../hooks/useAiStudioAgentInteractions";
import { projectAgentAttachmentToComposerImageAttachment } from "../logic/composerImageAttachment";
import { getStagedAgentPrompt, type PromptOrigin } from "../logic/agentPromptOwnership";
import { STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED } from "../logic/chatModeDefaults";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import type {
  AiStudioSessionAgentMessageV1,
  AiStudioSessionAgentV1,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import type { StandardCreatePageAgentRuntime } from "./contracts";

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
  projectId?: string | null;
  projectRouteRequested?: boolean;
  getAgentContext: StandardCreateAgentContextResolver;
  setStandardCreatePrompt: (value: string) => void;
  addAgentPromptReference: (promptText: string, title?: string) => void;
  editReferenceText: string;
  setEditReferenceText: (value: string) => void;
  videoReferenceText: string;
  setVideoReferenceText: (value: string) => void;
  findOutputById: (id: string) => StudioOutput | null;
  resolvePanelOutputPreviewUrl: (id: string | null | undefined) => string | null;
  resolveInternalImageDropSource?: ResolveInternalReferenceDrop;
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
  attachments: message.attachments?.map((attachment) => {
    const projectedImageAttachment =
      attachment.kind === "image"
        ? projectAgentAttachmentToComposerImageAttachment(attachment)
        : null;
    return {
      id: attachment.id,
      kind: attachment.kind,
      referenceId: attachment.referenceId ?? null,
      mediaId: attachment.mediaId ?? null,
      text: attachment.text ?? null,
      previewStoragePath: attachment.previewStoragePath ?? null,
      fullStoragePath: attachment.fullStoragePath ?? null,
      referenceUrl: attachment.referenceUrl ?? null,
      referenceRenderUrl: attachment.referenceRenderUrl ?? null,
      imageUrl: projectedImageAttachment?.preview.url ?? attachment.imageUrl ?? null,
      imageFallbackUrls:
        projectedImageAttachment?.preview.candidates.slice(1) ?? attachment.imageFallbackUrls,
      aspect: attachment.aspect ?? null,
      deliveryStatus: attachment.deliveryStatus,
      deliveryError: attachment.deliveryError ?? null,
    };
  }),
});

const resolveLinkedPromptReferenceIds = (attachments: AgentMessage["attachments"] = []): string[] =>
  Array.from(
    new Set(
      attachments
        .map((attachment) => attachment.referenceId)
        .filter((referenceId): referenceId is string => Boolean(referenceId))
    )
  );

const resolveRestoredStandardComposerPrompt = ({
  workspacePrompt,
  runtimeInput,
  chatModeEnabled,
}: {
  workspacePrompt: string;
  runtimeInput: string;
  chatModeEnabled: boolean;
}): { prompt: string; agentInput: string; promptOriginFallback: boolean } => {
  if (!chatModeEnabled) {
    return {
      prompt: workspacePrompt,
      agentInput: runtimeInput,
      promptOriginFallback: false,
    };
  }

  if (runtimeInput.trim().length > 0) {
    return {
      prompt: runtimeInput,
      agentInput: runtimeInput,
      promptOriginFallback: false,
    };
  }

  return {
    prompt: workspacePrompt,
    agentInput: workspacePrompt,
    promptOriginFallback: workspacePrompt.trim().length > 0,
  };
};

/**
 * Returns the Standard Create agent runtime.
 */
export const useStandardCreateAgentRuntime = ({
  sessionId,
  mode,
  selectedTool,
  prompt,
  projectId,
  projectRouteRequested,
  getAgentContext,
  setStandardCreatePrompt,
  addAgentPromptReference,
  editReferenceText,
  setEditReferenceText,
  videoReferenceText,
  setVideoReferenceText,
  findOutputById,
  resolvePanelOutputPreviewUrl,
  resolveInternalImageDropSource,
  aspect,
  model,
  setOutputs,
  setActiveOutputId,
  setUiNotice,
  trackAgentUiEvent,
}: UseStandardCreateAgentRuntimeParams): StandardCreatePageAgentRuntime => {
  void addAgentPromptReference;
  void editReferenceText;
  void setEditReferenceText;
  void videoReferenceText;
  void setVideoReferenceText;
  void projectId;
  void projectRouteRequested;
  void aspect;
  void model;
  void setOutputs;
  void setActiveOutputId;
  const agentFlag =
    process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === undefined ||
    process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === "true";
  const [agentSessionEnabled, setAgentSessionEnabled] = useState<boolean>(agentFlag);
  const agentEnabled = agentFlag && agentSessionEnabled;
  const agentBootstrapReady = Boolean(sessionId);
  const [agentUiBusy, setAgentUiBusy] = useState(false);
  const agentUiBusyRef = useRef(false);
  const [latestAgentPrompt, setLatestAgentPrompt] = useState<string | null>(null);
  const [promptOrigin, setPromptOrigin] = useState<PromptOrigin>("manual");
  const [chatModeEnabled, setChatModeEnabled] = useState<boolean>(
    STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED
  );
  const preparedImageUrlCacheRef = useRef<Map<string, { safeUrl: string; expiresAtMs: number }>>(
    new Map()
  );
  const standardAgentSessionNamespace = `ai-studio:${sessionId ?? "none"}::standard`;

  const activeAgent = useCreateAgentStateCore({
    enabled: agentEnabled,
    sessionNamespace: standardAgentSessionNamespace,
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
    resolveInternalImageDropSource,
  });
  const handleChatModeChange = useCallback(
    (value: boolean) => {
      if (value === chatModeEnabled) return;
      if (value) {
        setAgentInput(prompt);
      } else {
        setStandardCreatePrompt(agentInput);
      }
      setChatModeEnabled(value);
    },
    [
      agentInput,
      chatModeEnabled,
      prompt,
      setAgentInput,
      setChatModeEnabled,
      setStandardCreatePrompt,
    ]
  );
  const handleStandardAgentInputChange = useCallback(
    (value: string) => {
      handleAgentInputChange(value);
      setStandardCreatePrompt(value);
      setPromptOrigin("manual");
    },
    [handleAgentInputChange, setPromptOrigin, setStandardCreatePrompt]
  );

  const latestAssistantMessage = useMemo(
    () => [...agentMessages].reverse().find((msg) => msg.role === "assistant")?.content ?? null,
    [agentMessages]
  );
  const linkedPromptReferenceIds = useMemo(
    () => resolveLinkedPromptReferenceIds(agentAttachments),
    [agentAttachments]
  );
  const stagedAgentPrompt = getStagedAgentPrompt(promptOrigin, latestAgentPrompt);
  const notifyBootstrapPending = useCallback(() => {
    setUiNotice("Agent is still starting. Try again in a moment.");
  }, [setUiNotice]);
  const isPromptRefining = false;

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
      sendToAgent,
      setAgentAttachmentError,
      setAgentAttachments,
      setAgentInput,
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
      }
      trackAgentUiEvent("studio_agent_message_edit_committed", {
        message_id: messageId,
        content_length: commitContent.length,
      });
      return true;
    },
    [agentMessages, trackAgentUiEvent, updateMessageById]
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
    ({
      workspace,
      agentRuntimes,
    }: Pick<AiStudioSessionHydrationPayload, "workspace" | "agent" | "agentRuntimes">) => {
      if (workspace.expertCreateMode !== "standard") return;
      const standardRuntime = agentRuntimes.standard;
      const restoredComposerState = resolveRestoredStandardComposerPrompt({
        workspacePrompt: workspace.standardPrompt,
        runtimeInput: standardRuntime.input,
        chatModeEnabled: standardRuntime.chatModeEnabled,
      });
      replaceMessages(standardRuntime.messages);
      setAgentInput(restoredComposerState.agentInput);
      setAgentAttachments([]);
      setAgentAttachmentError(null);
      setStandardCreatePrompt(restoredComposerState.prompt);
      setLatestAgentPrompt(standardRuntime.latestAgentPrompt);
      setPromptOrigin(
        restoredComposerState.promptOriginFallback ? "manual" : standardRuntime.promptOrigin
      );
      setChatModeEnabled(standardRuntime.chatModeEnabled);
    },
    [
      replaceMessages,
      setAgentAttachmentError,
      setAgentAttachments,
      setAgentInput,
      setChatModeEnabled,
      setLatestAgentPrompt,
      setStandardCreatePrompt,
      setPromptOrigin,
    ]
  );

  const resetProjectAgentConversation = useCallback(() => {
    resetAgentChat();
    resetAgentComposer({ preserveInput: false, preserveAttachments: false });
    setLatestAgentPrompt(null);
    setPromptOrigin("manual");
    setChatModeEnabled(STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED);
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
    queueMicrotask(() => {
      setChatModeEnabled(STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED);
    });
  }, [sessionId]);

  useEffect(() => {
    resetAgentComposer({ preserveInput: true, preserveAttachments: false });
  }, [mode, resetAgentComposer, selectedTool, sessionId]);

  return {
    kind: "standard",
    agentEnabled,
    agentBootstrapReady,
    agentMessages,
    agentError,
    agentIsSending,
    agentUiBusy,
    agentBusy,
    agentInput,
    agentAttachmentError,
    agentAttachments,
    linkedPromptReferenceIds,
    isAgentDropActive,
    latestAgentPrompt,
    promptOrigin,
    persistedAgentRuntime,
    chatModeEnabled,
    setChatModeEnabled: handleChatModeChange,
    setPromptOrigin,
    stagedAgentPrompt,
    isPromptRefining,
    isReferencePromptEnhancing: false,
    describeInFlightCount: 0,
    handleAgentInputChange: handleStandardAgentInputChange,
    handleAgentSend,
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
