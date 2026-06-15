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
import type { AgentAssistantMessageEditRequest, AgentContext } from "../../../prefabs/agent";
import { useCreateAgentStateCore } from "../../ai-agent/useCreateAgentStateCore";
import { resolveAssistantMessageEditCommit } from "../../ai-agent/client/messageEditing";
import { standardCreateAgentRuntimeBinding } from "../hooks/createAgentRuntime/standardCreateAgentRuntimeBinding";
import type { AgentModeHint } from "../hooks/agentOrchestration/types";
import { runStandardCreateAgentSend } from "../hooks/agentOrchestration/runStandardCreateAgentSend";
import { useAiStudioAgentComposer } from "../hooks/useAiStudioAgentComposer";
import { useAiStudioAgentInteractions } from "../hooks/useAiStudioAgentInteractions";
import { getStagedAgentPrompt, type PromptOrigin } from "../logic/agentPromptOwnership";
import { STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED } from "../logic/chatModeDefaults";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import type { AiStudioSessionAgentV1 } from "../logic/sessionSnapshot";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import type { StandardCreatePageAgentRuntime } from "./contracts";
import type { CreateRuntimeAgentHydrationPayload } from "./sessionAgentHydrationBoundary";
import {
  buildStandardSessionMemory,
  createPersistedStandardAgentRuntime,
} from "./standardMemory/standardSessionMemory";
import { resolveStandardTranscriptWindow } from "./standardMemory/standardTranscriptWindow";
import {
  canUseAssistantMessageAsPrompt,
  resolveLinkedPromptReferenceIds,
} from "./agentRuntimeShared";
import {
  resolveRestoredStandardComposerState,
  resolveStandardChatModeTransition,
} from "./standardPanel/standardCreateComposerState";

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
  getAgentContext: StandardCreateAgentContextResolver;
  setStandardCreatePrompt: (value: string) => void;
  findOutputById: (id: string) => StudioOutput | null;
  resolvePanelOutputPreviewUrl: (id: string | null | undefined) => string | null;
  resolveInternalImageDropSource?: ResolveInternalReferenceDrop;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
  trackAgentUiEvent: (message: string, data?: Record<string, unknown>) => void;
};

/**
 * Returns the Standard Create agent runtime.
 */
export const useStandardCreateAgentRuntime = ({
  sessionId,
  mode,
  selectedTool,
  prompt,
  getAgentContext,
  setStandardCreatePrompt,
  findOutputById,
  resolvePanelOutputPreviewUrl,
  resolveInternalImageDropSource,
  setUiNotice,
  trackAgentUiEvent,
}: UseStandardCreateAgentRuntimeParams): StandardCreatePageAgentRuntime => {
  const agentFlag =
    process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === undefined ||
    process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === "true";
  const [agentSessionEnabled, setAgentSessionEnabled] = useState<boolean>(agentFlag);
  const agentEnabled = agentFlag && agentSessionEnabled;
  const agentBootstrapReady = Boolean(sessionId);
  const [agentUiBusy, setAgentUiBusy] = useState(false);
  const [agentOnlineLookupPending, setAgentOnlineLookupPending] = useState(false);
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
    resolveRequestHistory: resolveStandardTranscriptWindow,
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
    removeMessageById,
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
    acceptAgentComposerDropPayload,
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
      const transition = resolveStandardChatModeTransition({
        currentChatModeEnabled: chatModeEnabled,
        nextChatModeEnabled: value,
        prompt,
        agentInput,
      });
      if (!transition) return;
      if (value) {
        setAgentInput(transition.nextAgentInput);
      } else {
        setStandardCreatePrompt(transition.nextPrompt);
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
  const prepareForWorkflowReload = useCallback(() => {
    setChatModeEnabled(false);
    setPromptOrigin("manual");
  }, [setChatModeEnabled, setPromptOrigin]);

  const latestAssistantMessage = useMemo(
    () => [...agentMessages].reverse().find((msg) => msg.role === "assistant")?.content ?? null,
    [agentMessages]
  );
  const linkedPromptReferenceIds = useMemo(
    () => resolveLinkedPromptReferenceIds(agentAttachments),
    [agentAttachments]
  );
  const standardSessionMemory = useMemo(
    () =>
      buildStandardSessionMemory({
        messages: agentMessages,
        latestPromptArtifact: latestAgentPrompt,
        promptOrigin,
        attachments: agentAttachments,
      }),
    [agentAttachments, agentMessages, latestAgentPrompt, promptOrigin]
  );
  const stagedAgentPrompt = getStagedAgentPrompt(promptOrigin, latestAgentPrompt);
  const notifyBootstrapPending = useCallback(() => {
    setUiNotice("Agent is still starting. Try again in a moment.");
  }, [setUiNotice]);
  const isPromptRefining = false;

  const handleAgentSend = useCallback(
    async (textOverride?: string, options?: { captureResult?: boolean }) =>
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
        setLatestAgentPrompt,
        sendToAgent,
        appendUserMessage,
        updateMessageById,
        removeMessageById,
        getAgentContext,
        standardSessionMemory,
        trackAgentUiEvent,
        lastAssistantMessage: latestAssistantMessage,
        notifyBootstrapPending,
        preparedImageUrlCacheRef,
        setAgentOnlineLookupPending,
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
      latestAssistantMessage,
      notifyBootstrapPending,
      prompt,
      removeMessageById,
      sendToAgent,
      setAgentAttachmentError,
      setAgentAttachments,
      setAgentInput,
      trackAgentUiEvent,
      updateMessageById,
      standardSessionMemory,
      setAgentOnlineLookupPending,
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
    () =>
      createPersistedStandardAgentRuntime({
        messages: agentMessages,
        input: agentInput,
        latestPromptArtifact: latestAgentPrompt,
        promptOrigin,
        chatModeEnabled,
      }),
    [agentInput, agentMessages, chatModeEnabled, latestAgentPrompt, promptOrigin]
  );

  const hydrateFromSessionAgentSnapshot = useCallback(
    ({ workspace, agentRuntimes }: CreateRuntimeAgentHydrationPayload) => {
      const standardRuntime = agentRuntimes.standard;
      const restoredComposerState = resolveRestoredStandardComposerState({
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
    agentThinkingLabel: agentOnlineLookupPending ? "Researching online…" : null,
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
    prepareForWorkflowReload,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleAgentAttachmentDrop,
    acceptAgentComposerDropPayload,
    handleRemoveAgentAttachment,
    handleClearAgentAttachments,
    handleAssistantMessageEdit,
    handleClearAgentChat,
  };
};
