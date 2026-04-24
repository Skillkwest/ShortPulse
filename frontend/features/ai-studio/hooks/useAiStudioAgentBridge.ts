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
  AgentAttachment,
  AgentAssistantMessageEditRequest,
  AgentContext,
  AgentMessage,
  AgentPulseWorkflowSession,
} from "../../../prefabs/agent";
import {
  getStagedAgentPrompt,
  resolvePromptSourceBadge,
  type PromptOrigin,
} from "../logic/agentPromptOwnership";
import type {
  AiStudioSessionAgentMessageV1,
  AiStudioSessionAgentRuntimesV2,
} from "../logic/sessionSnapshot";
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
  expertCreateMode?: "standard" | "pulse";
  activePulsePresetId?: string | null;
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
  clearPulseRuntime?: () => void;
  trackAgentUiEvent: (message: string, data?: Record<string, unknown>) => void;
};

type AgentBridgeRuntimeState = {
  messages: AgentMessage[];
  input: string;
  attachments: AgentAttachment[];
  latestAgentPrompt: string | null;
  promptOrigin: PromptOrigin;
  chatModeEnabled: boolean;
  agentActions: AgentActions | undefined;
  isAgentChatOpen: boolean;
};

type AgentBridgeHydrationRuntime = AiStudioSessionHydrationPayload["agent"];

const createDefaultAgentBridgeRuntimeState = (
  defaultChatModeEnabled: boolean
): AgentBridgeRuntimeState => ({
  messages: [],
  input: "",
  attachments: [],
  latestAgentPrompt: null,
  promptOrigin: "manual",
  chatModeEnabled: defaultChatModeEnabled,
  agentActions: undefined,
  isAgentChatOpen: false,
});

const createAgentBridgeRuntimeStateFromHydration = (
  runtime: AgentBridgeHydrationRuntime
): AgentBridgeRuntimeState => ({
  messages: runtime.messages,
  input: runtime.input,
  attachments: [],
  latestAgentPrompt: runtime.latestAgentPrompt,
  promptOrigin: runtime.promptOrigin,
  chatModeEnabled: runtime.chatModeEnabled,
  agentActions: undefined,
  isAgentChatOpen: false,
});

const createPersistedAgentRuntimeSnapshot = (
  runtime: AgentBridgeRuntimeState
): AiStudioSessionAgentRuntimesV2["standard"] => ({
  messages: runtime.messages.map(
    (message): AiStudioSessionAgentMessageV1 => ({
      id: message.id ?? null,
      role: message.role,
      content: message.content,
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
    })
  ),
  input: runtime.input,
  latestAgentPrompt: runtime.latestAgentPrompt,
  promptOrigin: runtime.promptOrigin,
  chatModeEnabled: runtime.chatModeEnabled,
  pulseWorkflowSession: null,
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
  expertCreateMode = "standard",
  activePulsePresetId = null,
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
  clearPulseRuntime,
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
  const [defaultChatModeEnabled] = useState(chatModeEnabled);

  const setChatModeEnabled = useCallback((value: boolean) => {
    setChatModeEnabledState(value);
    if (typeof window !== "undefined") {
      writeChatModeToStorage(value, window.localStorage);
    }
  }, []);

  const agentRuntimeScopeKey =
    expertCreateMode === "pulse" ? `pulse:${activePulsePresetId ?? "none"}` : "standard";
  const agentBridgeSessionKey = `${sessionId ?? "none"}::${agentRuntimeScopeKey}`;

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
    sessionNamespace: `ai-studio:${agentBridgeSessionKey}`,
    directOpenAiBypassEnabled:
      chatModeEnabled &&
      directOpenAiBypassEnabledByConfig &&
      (selectedTool === "create" || selectedTool === "text"),
  });

  const [agentUiBusy, setAgentUiBusy] = useState(false);
  const agentUiBusyRef = useRef(false);
  const agentBusy = agentIsSending || agentUiBusy;
  const [agentBridgeRuntimeStateBySessionKey, setAgentBridgeRuntimeStateBySessionKey] = useState<
    Record<string, AgentBridgeRuntimeState>
  >({});
  const createDefaultRuntimeState = useCallback(
    () => createDefaultAgentBridgeRuntimeState(defaultChatModeEnabled),
    [defaultChatModeEnabled]
  );
  const activeAgentBridgeSessionUiState = useMemo(
    () => agentBridgeRuntimeStateBySessionKey[agentBridgeSessionKey] ?? createDefaultRuntimeState(),
    [agentBridgeRuntimeStateBySessionKey, agentBridgeSessionKey, createDefaultRuntimeState]
  );
  const updateAgentBridgeSessionUiState = useCallback(
    (updater: (current: AgentBridgeRuntimeState) => AgentBridgeRuntimeState) => {
      setAgentBridgeRuntimeStateBySessionKey((current) => {
        const activeState = current[agentBridgeSessionKey] ?? createDefaultRuntimeState();
        const nextState = updater(activeState);
        if (nextState === activeState) return current;
        return {
          ...current,
          [agentBridgeSessionKey]: nextState,
        };
      });
    },
    [agentBridgeSessionKey, createDefaultRuntimeState]
  );
  const updateAgentBridgeSessionUiStateField = useCallback(
    <Key extends keyof Omit<AgentBridgeRuntimeState, "messages" | "input" | "attachments">>(
      field: Key,
      value: SetStateAction<AgentBridgeRuntimeState[Key]>
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
  const pendingRuntimeHydrationKeyRef = useRef<string | null>(null);
  const persistedAgentRuntimes = useMemo(
    () => ({
      standard: createPersistedAgentRuntimeSnapshot(
        agentBridgeRuntimeStateBySessionKey[`${sessionId ?? "none"}::standard`] ??
          createDefaultRuntimeState()
      ),
      pulsePresetId: activePulsePresetId,
      pulse: createPersistedAgentRuntimeSnapshot(
        activePulsePresetId
          ? (agentBridgeRuntimeStateBySessionKey[
              `${sessionId ?? "none"}::pulse:${activePulsePresetId}`
            ] ?? createDefaultRuntimeState())
          : createDefaultRuntimeState()
      ),
    }),
    [activePulsePresetId, agentBridgeRuntimeStateBySessionKey, createDefaultRuntimeState, sessionId]
  );

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

  useEffect(() => {
    const pulseSessionKeyPrefix = `${sessionId ?? "none"}::pulse:`;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Active Pulse changes must drop stale Pulse-only runtime snapshots immediately.
    setAgentBridgeRuntimeStateBySessionKey((current) => {
      let changed = false;
      const nextEntries = Object.entries(current).filter(([key]) => {
        const isPulseEntry = key.startsWith(pulseSessionKeyPrefix);
        if (!isPulseEntry) return true;
        const shouldKeep =
          expertCreateMode === "pulse" &&
          key === agentBridgeSessionKey &&
          activePulsePresetId !== null;
        if (!shouldKeep) {
          changed = true;
        }
        return shouldKeep;
      });
      if (!changed) return current;
      return Object.fromEntries(nextEntries);
    });
  }, [activePulsePresetId, agentBridgeSessionKey, expertCreateMode, sessionId]);

  useEffect(() => {
    const activeRuntimeState =
      agentBridgeRuntimeStateBySessionKey[agentBridgeSessionKey] ?? createDefaultRuntimeState();
    pendingRuntimeHydrationKeyRef.current = agentBridgeSessionKey;
    replaceMessages(activeRuntimeState.messages);
    setAgentInput(activeRuntimeState.input);
    setAgentAttachmentError(null);
    setAgentAttachments(activeRuntimeState.attachments);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Runtime scope changes intentionally hydrate bridge-owned UI state into the active hook instances.
    setLatestAgentPrompt(activeRuntimeState.latestAgentPrompt);
    setPromptOrigin(activeRuntimeState.promptOrigin);
    setChatModeEnabled(activeRuntimeState.chatModeEnabled);
    setAgentActions(activeRuntimeState.agentActions);
    setIsAgentChatOpen(activeRuntimeState.isAgentChatOpen);
  }, [
    agentBridgeRuntimeStateBySessionKey,
    agentBridgeSessionKey,
    createDefaultRuntimeState,
    replaceMessages,
    setAgentActions,
    setAgentAttachmentError,
    setAgentAttachments,
    setAgentInput,
    setChatModeEnabled,
    setIsAgentChatOpen,
    setLatestAgentPrompt,
    setPromptOrigin,
  ]);

  useEffect(() => {
    if (pendingRuntimeHydrationKeyRef.current === agentBridgeSessionKey) {
      pendingRuntimeHydrationKeyRef.current = null;
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The active runtime snapshot must track live bridge state as the user edits within the current scope.
    updateAgentBridgeSessionUiState((current) => {
      if (
        current.messages === agentMessages &&
        current.input === agentInput &&
        current.attachments === agentAttachments &&
        current.latestAgentPrompt === latestAgentPrompt &&
        current.promptOrigin === promptOrigin &&
        current.chatModeEnabled === chatModeEnabled &&
        current.agentActions === agentActions &&
        current.isAgentChatOpen === isAgentChatOpen
      ) {
        return current;
      }
      return {
        messages: agentMessages,
        input: agentInput,
        attachments: agentAttachments,
        latestAgentPrompt,
        promptOrigin,
        chatModeEnabled,
        agentActions,
        isAgentChatOpen,
      };
    });
  }, [
    agentActions,
    agentAttachments,
    agentBridgeSessionKey,
    agentInput,
    agentMessages,
    chatModeEnabled,
    isAgentChatOpen,
    latestAgentPrompt,
    promptOrigin,
    updateAgentBridgeSessionUiState,
  ]);

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
    expertCreateMode,
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
    clearPulseRuntime,
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
    ({
      workspace,
      agent,
      agentRuntimes,
    }: Pick<AiStudioSessionHydrationPayload, "workspace" | "agent" | "agentRuntimes">) => {
      const sessionKeyPrefix = `${sessionId ?? "none"}::`;
      const nextStateBySessionKey: Record<string, AgentBridgeRuntimeState> = {
        [`${sessionKeyPrefix}standard`]: createAgentBridgeRuntimeStateFromHydration(
          agentRuntimes.standard
        ),
      };
      const pulsePresetId = agentRuntimes.pulsePresetId ?? workspace.activePulsePresetId;
      if (pulsePresetId) {
        nextStateBySessionKey[`${sessionKeyPrefix}pulse:${pulsePresetId}`] =
          createAgentBridgeRuntimeStateFromHydration(agentRuntimes.pulse);
      }

      setAgentBridgeRuntimeStateBySessionKey((current) => {
        const nextEntries = Object.entries(current).filter(
          ([key]) => !key.startsWith(sessionKeyPrefix)
        );
        return {
          ...Object.fromEntries(nextEntries),
          ...nextStateBySessionKey,
        };
      });
      setPulseWorkflowSession(agent.pulseWorkflowSession);
      setAgentActions(undefined);
      setAgentAttachmentError(null);
      setAgentAttachments([]);
    },
    [
      sessionId,
      setAgentActions,
      setAgentAttachmentError,
      setAgentAttachments,
      setPulseWorkflowSession,
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
    persistedAgentRuntimes,
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
