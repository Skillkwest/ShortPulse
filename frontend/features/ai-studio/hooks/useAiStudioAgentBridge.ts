/**
 * AI Studio agent bridge hook.
 * Centralizes page-level agent wiring so the page composes a smaller surface.
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
import { useAiAgent } from "../../ai-agent/useAiAgent";
import type {
  AgentActions,
  AgentAssistantMessageEditRequest,
  AgentContext,
  AgentPulseWorkflowSession,
} from "../../../prefabs/agent";
import {
  getStagedAgentPrompt,
  resolvePromptSourceBadge,
  type PromptOrigin,
} from "../logic/agentPromptOwnership";
import { isEditPromptTool } from "../logic/promptTargeting";
import { useAiStudioAgentComposer } from "./useAiStudioAgentComposer";
import { useAiStudioAgentInteractions } from "./useAiStudioAgentInteractions";
import { useAiStudioAgentOrchestration } from "./useAiStudioAgentOrchestration";
import type { AgentModeHint } from "./agentOrchestration/types";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import { resolveAssistantMessageEditCommit } from "../../ai-agent/client/messageEditing";
import { readChatModeFromStorage, writeChatModeToStorage } from "../logic/chatModePreference";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";

type UseAiStudioAgentBridgeParams = {
  sessionId: string | null;
  mode: StudioMode;
  selectedTool: ToolId | null;
  prompt: string;
  setSharedPrompt: (value: string) => void;
  getAgentContext: (params: {
    lastAssistantMessage: string | null;
    selectedOverride?: StudioOutput | null;
    modeHint?: AgentModeHint;
  }) => AgentContext;
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
  setPulseWorkflowSession: Dispatch<SetStateAction<AgentPulseWorkflowSession | null>>;
  trackAgentUiEvent: (message: string, data?: Record<string, unknown>) => void;
};

type AgentBridgeSessionUiState = {
  sessionKey: string;
  latestAgentPrompt: string | null;
  promptOrigin: PromptOrigin;
  agentActions: AgentActions | undefined;
  isAgentChatOpen: boolean;
};

const createDefaultAgentBridgeSessionUiState = (sessionKey: string): AgentBridgeSessionUiState => ({
  sessionKey,
  latestAgentPrompt: null,
  promptOrigin: "manual",
  agentActions: undefined,
  isAgentChatOpen: false,
});

const resolveStateActionValue = <T>(value: SetStateAction<T>, current: T): T =>
  typeof value === "function" ? (value as (previousValue: T) => T)(current) : value;

/**
 * Returns agent state and handlers used by the AI Studio page.
 */
export const useAiStudioAgentBridge = ({
  sessionId,
  mode,
  selectedTool,
  prompt,
  setSharedPrompt,
  getAgentContext,
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
  setPulseWorkflowSession,
  trackAgentUiEvent,
}: UseAiStudioAgentBridgeParams) => {
  const agentFlag =
    process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === undefined ||
    process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === "true";
  const directOpenAiBypassEnabledByConfig =
    process.env.NEXT_PUBLIC_STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED === "true";
  const [agentSessionEnabled, setAgentSessionEnabled] = useState<boolean>(agentFlag);
  const agentEnabled = agentFlag && agentSessionEnabled;
  const directOpenAiBypassEnabled = directOpenAiBypassEnabledByConfig;
  const [chatModeEnabled, setChatModeEnabledState] = useState(() => {
    if (typeof window === "undefined") return true;
    return readChatModeFromStorage(window.localStorage);
  });

  const setChatModeEnabled = useCallback((value: boolean) => {
    setChatModeEnabledState(value);
    if (typeof window !== "undefined") {
      writeChatModeToStorage(value, window.localStorage);
    }
  }, []);

  const {
    messages: agentMessages,
    isSending: agentIsSending,
    error: agentError,
    send: sendToAgent,
    appendUserMessage,
    updateMessageById,
    replaceMessages,
    reset: resetAgentChat,
  } = useAiAgent({
    enabled: agentEnabled,
    sessionNamespace: `ai-studio:${sessionId ?? "none"}`,
    directOpenAiBypassEnabled:
      chatModeEnabled &&
      directOpenAiBypassEnabledByConfig &&
      (selectedTool === "create" || selectedTool === "text"),
  });

  const [agentUiBusy, setAgentUiBusy] = useState(false);
  const agentUiBusyRef = useRef(false);
  const agentBusy = agentIsSending || agentUiBusy;
  const agentBridgeSessionKey = `${sessionId ?? "none"}`;
  const [agentBridgeSessionUiState, setAgentBridgeSessionUiState] =
    useState<AgentBridgeSessionUiState>(() =>
      createDefaultAgentBridgeSessionUiState(agentBridgeSessionKey)
    );
  const resolveActiveAgentBridgeSessionUiState = useCallback(
    (state: AgentBridgeSessionUiState): AgentBridgeSessionUiState =>
      state.sessionKey === agentBridgeSessionKey
        ? state
        : createDefaultAgentBridgeSessionUiState(agentBridgeSessionKey),
    [agentBridgeSessionKey]
  );
  const activeAgentBridgeSessionUiState = useMemo(
    () => resolveActiveAgentBridgeSessionUiState(agentBridgeSessionUiState),
    [agentBridgeSessionUiState, resolveActiveAgentBridgeSessionUiState]
  );
  const updateAgentBridgeSessionUiState = useCallback(
    (updater: (current: AgentBridgeSessionUiState) => AgentBridgeSessionUiState) => {
      setAgentBridgeSessionUiState((current) =>
        updater(resolveActiveAgentBridgeSessionUiState(current))
      );
    },
    [resolveActiveAgentBridgeSessionUiState]
  );
  const updateAgentBridgeSessionUiStateField = useCallback(
    <Key extends keyof Omit<AgentBridgeSessionUiState, "sessionKey">>(
      field: Key,
      value: SetStateAction<AgentBridgeSessionUiState[Key]>
    ) => {
      updateAgentBridgeSessionUiState((current) => {
        const nextValue = resolveStateActionValue(value, current[field]);
        if (current[field] === nextValue) return current;
        return {
          ...current,
          [field]: nextValue,
        };
      });
    },
    [updateAgentBridgeSessionUiState]
  );
  const setLatestAgentPrompt: Dispatch<SetStateAction<string | null>> = useCallback(
    (value) => updateAgentBridgeSessionUiStateField("latestAgentPrompt", value),
    [updateAgentBridgeSessionUiStateField]
  );
  const setPromptOrigin: Dispatch<SetStateAction<PromptOrigin>> = useCallback(
    (value) => updateAgentBridgeSessionUiStateField("promptOrigin", value),
    [updateAgentBridgeSessionUiStateField]
  );
  const setAgentActions: Dispatch<SetStateAction<AgentActions | undefined>> = useCallback(
    (value) => updateAgentBridgeSessionUiStateField("agentActions", value),
    [updateAgentBridgeSessionUiStateField]
  );
  const setIsAgentChatOpen: Dispatch<SetStateAction<boolean>> = useCallback(
    (value) => updateAgentBridgeSessionUiStateField("isAgentChatOpen", value),
    [updateAgentBridgeSessionUiStateField]
  );
  const { agentActions, isAgentChatOpen, latestAgentPrompt, promptOrigin } =
    activeAgentBridgeSessionUiState;

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
    linkedPromptReferenceIds,
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
    resolveOutputPreviewUrlById: resolvePanelOutputPreviewUrl,
  });

  const latestAssistantMessage = useMemo(
    () => [...agentMessages].reverse().find((msg) => msg.role === "assistant")?.content ?? null,
    [agentMessages]
  );
  const agentPrimarySource = resolvePromptSourceBadge(promptOrigin);
  const stagedAgentPrompt = getStagedAgentPrompt(promptOrigin, latestAgentPrompt);
  const editPromptToolSelected = isEditPromptTool(selectedTool);

  const {
    isPromptRefining,
    isReferencePromptEnhancing,
    describeInFlightCount,
    handleAgentSend,
    handlePulsePresetStart,
    handleAgentEnhanceSend,
    handleReferencePromptEnhance,
  } = useAiStudioAgentOrchestration({
    agentIsSending,
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
    setAgentActions,
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
    getOutputById: findOutputById,
    aspect,
    model,
    setOutputs,
    setActiveOutputId,
    lastAssistantMessage: latestAssistantMessage,
    setUiNotice,
  });

  const {
    handleAgentApplyPrompt,
    handleExpandChat,
    handleAgentAddToGrid,
    handleClearAgentChat,
    handleCloseAgentChat,
  } = useAiStudioAgentInteractions({
    editPromptToolSelected,
    setSharedPrompt,
    setLatestAgentPrompt,
    setPromptOrigin,
    trackAgentUiEvent,
    addAgentPromptReference,
    setIsAgentChatOpen,
    agentSessionEnabled,
    setAgentSessionEnabled,
    latestAgentPrompt,
    resetAgentChat,
    resetAgentComposer,
    setAgentActions,
    setPulseWorkflowSession,
  });

  useEffect(() => {
    resetAgentComposer({ preserveInput: true, preserveAttachments: false });
  }, [mode, resetAgentComposer, selectedTool, sessionId]);

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

      const didUpdate = updateMessageById(messageId, (message) =>
        message.role === "assistant" ? { ...message, content: commitContent } : message
      );
      if (didUpdate) {
        trackAgentUiEvent("studio_agent_message_edit_committed", {
          message_id: messageId,
          content_length: commitContent.length,
        });
      }
      return didUpdate;
    },
    [agentMessages, trackAgentUiEvent, updateMessageById]
  );

  const hydrateFromSessionAgentSnapshot = useCallback(
    (agentSnapshot: AiStudioSessionHydrationPayload["agent"]) => {
      replaceMessages(agentSnapshot.messages);
      setAgentInput(agentSnapshot.input);
      setLatestAgentPrompt(agentSnapshot.latestAgentPrompt);
      setPromptOrigin(agentSnapshot.promptOrigin);
      setChatModeEnabled(agentSnapshot.chatModeEnabled);
      setPulseWorkflowSession(agentSnapshot.pulseWorkflowSession);
      setAgentActions(undefined);
      setAgentAttachmentError(null);
      setAgentAttachments([]);
    },
    [
      replaceMessages,
      setAgentInput,
      setLatestAgentPrompt,
      setPromptOrigin,
      setChatModeEnabled,
      setPulseWorkflowSession,
      setAgentActions,
      setAgentAttachmentError,
      setAgentAttachments,
    ]
  );

  return {
    agentEnabled,
    directOpenAiBypassEnabled,
    agentMessages,
    agentError,
    agentBusy,
    agentInput,
    agentAttachmentError,
    agentAttachments,
    linkedPromptReferenceIds,
    isAgentDropActive,
    agentActions,
    isAgentChatOpen,
    latestAgentPrompt,
    promptOrigin,
    chatModeEnabled,
    setChatModeEnabled,
    setPromptOrigin,
    agentPrimarySource,
    stagedAgentPrompt,
    isPromptRefining,
    isReferencePromptEnhancing,
    describeInFlightCount,
    handleAgentInputChange,
    handleAgentSend,
    handlePulsePresetStart,
    handleAgentEnhanceSend,
    handleReferencePromptEnhance,
    hydrateFromSessionAgentSnapshot,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleAgentAttachmentDrop,
    handleRemoveAgentAttachment,
    handleClearAgentAttachments,
    handleAgentApplyPrompt,
    handleAssistantMessageEdit,
    handleExpandChat,
    handleAgentAddToGrid,
    handleClearAgentChat,
    handleCloseAgentChat,
  };
};
