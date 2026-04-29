/**
 * AI Studio agent bridge hook.
 * Centralizes page-level agent wiring so the page composes a smaller surface.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useCreateAgentStateCore } from "../../ai-agent/useCreateAgentStateCore";
import type {
  AgentApiRequest,
  AgentAttachment,
  AgentAssistantMessageEditRequest,
  AgentContext,
  AgentMessage,
  AgentPulseWorkflowSession,
} from "../../../prefabs/agent";
import { getStagedAgentPrompt, type PromptOrigin } from "../logic/agentPromptOwnership";
import type {
  AiStudioSessionAgentMessageV1,
  AiStudioSessionAgentRuntimesV2,
} from "../logic/sessionSnapshot";
import { useAiStudioAgentComposer } from "./useAiStudioAgentComposer";
import { useAiStudioAgentInteractions } from "./useAiStudioAgentInteractions";
import { useAiStudioAgentOrchestration } from "./useAiStudioAgentOrchestration";
import type { AgentModeHint } from "./agentOrchestration/types";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import type { CreatePulseResolvedPreset } from "../components/create/createPulsePresets";
import { resolveAssistantMessageEditCommit } from "../../ai-agent/client/messageEditing";
import { readChatModeFromStorage, writeChatModeToStorage } from "../logic/chatModePreference";
import { resolveCreateAgentBridgeRuntime } from "./agentBridgeRuntime/createAgentBridgeRuntime";
import { resolveCreateAgentOrchestrationRuntimePolicy } from "./agentOrchestration/createAgentOrchestrationRuntimePolicy";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import type { CreateAgentRuntimeBinding } from "./agentBridgeRuntime/createAgentRuntimeBinding";

type UseAiStudioAgentBridgeParams = {
  projectId?: string | null;
  projectRouteRequested?: boolean;
  sessionId: string | null;
  mode: StudioMode;
  selectedTool: ToolId | null;
  expertCreateMode?: "standard" | "pulse";
  activePulsePresetId?: string | null;
  pulseSessionInstanceId?: string | null;
  pulseWorkflowSession?: AgentPulseWorkflowSession | null;
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
  restartPulse?: () => { presetId: string; sessionInstanceId: string } | null;
  trackAgentUiEvent: (message: string, data?: Record<string, unknown>) => void;
};

type AgentBridgeRuntimeState = {
  messages: AgentMessage[];
  input: string;
  attachments: AgentAttachment[];
  latestAgentPrompt: string | null;
  promptOrigin: PromptOrigin;
  chatModeEnabled: boolean;
  isAgentChatOpen: boolean;
};

type PendingRuntimeHydration = {
  key: string;
  state: AgentBridgeRuntimeState;
  previousKey: string | null;
};

type AgentBridgeHydrationRuntime = AiStudioSessionHydrationPayload["agent"];

let standardRuntimeBindingPromise: Promise<CreateAgentRuntimeBinding> | null = null;
let pulseRuntimeBindingPromise: Promise<CreateAgentRuntimeBinding> | null = null;

const loadStandardCreateAgentRuntimeBinding = () => {
  standardRuntimeBindingPromise ??=
    import("./agentBridgeRuntime/standardCreateAgentRuntimeBinding").then(
      (module) => module.standardCreateAgentRuntimeBinding
    );
  return standardRuntimeBindingPromise;
};

const loadPulseCreateAgentRuntimeBinding = () => {
  pulseRuntimeBindingPromise ??= import("./agentBridgeRuntime/pulseCreateAgentRuntimeBinding").then(
    (module) => module.pulseCreateAgentRuntimeBinding
  );
  return pulseRuntimeBindingPromise;
};

const canUseAssistantMessageAsPrompt = (message: AgentMessage): boolean =>
  message.role === "assistant" &&
  message.canUseAsPrompt === true &&
  typeof message.outputPrompt === "string" &&
  message.outputPrompt.trim().length > 0;

const createDefaultAgentBridgeRuntimeState = (
  defaultChatModeEnabled: boolean
): AgentBridgeRuntimeState => ({
  messages: [],
  input: "",
  attachments: [],
  latestAgentPrompt: null,
  promptOrigin: "manual",
  chatModeEnabled: defaultChatModeEnabled,
  isAgentChatOpen: false,
});

const createAgentBridgeRuntimeStateFromHydration = (
  runtime: AgentBridgeHydrationRuntime,
  options?: {
    forceChatModeEnabled?: boolean;
  }
): AgentBridgeRuntimeState => ({
  messages: runtime.messages,
  input: runtime.input,
  attachments: [],
  latestAgentPrompt: runtime.latestAgentPrompt,
  promptOrigin: runtime.promptOrigin,
  chatModeEnabled: options?.forceChatModeEnabled ?? runtime.chatModeEnabled,
  isAgentChatOpen: false,
});

const createPersistedAgentRuntimeSnapshot = (
  runtime: AgentBridgeRuntimeState,
  options?: {
    forceChatModeEnabled?: boolean;
  }
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
  chatModeEnabled: options?.forceChatModeEnabled ?? runtime.chatModeEnabled,
  pulseWorkflowSession: null,
});

const resolveStateActionValue = <T>(value: SetStateAction<T>, current: T): T =>
  typeof value === "function" ? (value as (previousValue: T) => T)(current) : value;

const areAgentAttachmentsEqual = (
  left: AgentAttachment[] | undefined,
  right: AgentAttachment[] | undefined
): boolean => {
  if (left === right) return true;
  const leftList = left ?? [];
  const rightList = right ?? [];
  if (leftList.length !== rightList.length) return false;
  return leftList.every((attachment, index) => {
    const other = rightList[index];
    return (
      attachment.id === other?.id &&
      attachment.kind === other?.kind &&
      (attachment.referenceId ?? null) === (other?.referenceId ?? null) &&
      (attachment.text ?? null) === (other?.text ?? null) &&
      (attachment.imageUrl ?? null) === (other?.imageUrl ?? null) &&
      (attachment.aspect ?? null) === (other?.aspect ?? null) &&
      (attachment.deliveryStatus ?? null) === (other?.deliveryStatus ?? null) &&
      (attachment.deliveryError ?? null) === (other?.deliveryError ?? null)
    );
  });
};

const areAgentMessagesEqual = (left: AgentMessage[], right: AgentMessage[]): boolean => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((message, index) => {
    const other = right[index];
    return (
      message.id === other?.id &&
      message.role === other?.role &&
      message.content === other?.content &&
      (message.outputPrompt ?? null) === (other?.outputPrompt ?? null) &&
      (message.canUseAsPrompt ?? null) === (other?.canUseAsPrompt ?? null) &&
      (message.outcomeClass ?? null) === (other?.outcomeClass ?? null) &&
      (message.reasonCode ?? null) === (other?.reasonCode ?? null) &&
      (message.decision ?? null) === (other?.decision ?? null) &&
      areAgentAttachmentsEqual(message.attachments, other?.attachments)
    );
  });
};

const isAgentBridgeRuntimeStateEqual = (
  left: AgentBridgeRuntimeState,
  right: AgentBridgeRuntimeState
): boolean =>
  areAgentMessagesEqual(left.messages, right.messages) &&
  left.input === right.input &&
  areAgentAttachmentsEqual(left.attachments, right.attachments) &&
  left.latestAgentPrompt === right.latestAgentPrompt &&
  left.promptOrigin === right.promptOrigin &&
  left.chatModeEnabled === right.chatModeEnabled &&
  left.isAgentChatOpen === right.isAgentChatOpen;

/**
 * Returns agent state and handlers used by the AI Studio page.
 */
export const useAiStudioAgentBridge = ({
  projectId = null,
  projectRouteRequested = false,
  sessionId,
  mode,
  selectedTool,
  expertCreateMode = "standard",
  activePulsePresetId = null,
  pulseSessionInstanceId = null,
  pulseWorkflowSession = null,
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
  restartPulse,
  trackAgentUiEvent,
}: UseAiStudioAgentBridgeParams) => {
  const bridgeRuntime = useMemo(
    () =>
      resolveCreateAgentBridgeRuntime({
        sessionId,
        expertCreateMode,
        activePulsePresetId,
        pulseSessionInstanceId,
      }),
    [activePulsePresetId, expertCreateMode, pulseSessionInstanceId, sessionId]
  );
  const orchestrationRuntimePolicy = useMemo(
    () =>
      resolveCreateAgentOrchestrationRuntimePolicy({
        expertCreateMode,
        activePulsePresetId,
        pulseSessionInstanceId,
      }),
    [activePulsePresetId, expertCreateMode, pulseSessionInstanceId]
  );
  const {
    isPulseCreateMode,
    hasStoredPulseSession,
    hasVisiblePulseSession,
    pulseRuntimeScopeKey,
    agentBridgeSessionKey,
    standardAgentSessionNamespace,
    pulseAgentSessionNamespace,
    resolvedStoredPulsePresetId,
  } = bridgeRuntime;
  const agentFlag =
    process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === undefined ||
    process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === "true";
  const directOpenAiBypassEnabledByConfig =
    process.env.NEXT_PUBLIC_STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED === "true";
  const [agentSessionEnabled, setAgentSessionEnabled] = useState<boolean>(agentFlag);
  const agentEnabled = agentFlag && agentSessionEnabled;
  const directOpenAiBypassEnabled =
    directOpenAiBypassEnabledByConfig && bridgeRuntime.kind === "standard";
  const agentBootstrapReady = Boolean(sessionId);
  const [standardChatModeEnabled, setStandardChatModeEnabledState] = useState(() => {
    if (typeof window === "undefined") return true;
    if (projectRouteRequested || projectId) return true;
    return readChatModeFromStorage(window.localStorage);
  });
  const [defaultStandardChatModeEnabled] = useState(standardChatModeEnabled);
  const chatModeEnabled = bridgeRuntime.effectiveChatMode(standardChatModeEnabled);

  const setChatModeEnabled = useCallback(
    (value: boolean) => {
      if (isPulseCreateMode) return;
      setStandardChatModeEnabledState(value);
      if (typeof window !== "undefined" && !projectRouteRequested && !projectId) {
        writeChatModeToStorage(value, window.localStorage);
      }
    },
    [isPulseCreateMode, projectId, projectRouteRequested]
  );

  const activeLiveRuntimeStateRef = useRef<{
    key: string;
    state: AgentBridgeRuntimeState;
  } | null>(null);
  const committedLiveRuntimeStateRef = useRef<{
    key: string;
    state: AgentBridgeRuntimeState;
  } | null>(null);
  const activeAgentRuntimeBinding = useMemo(() => {
    const loadRuntimeBinding = isPulseCreateMode
      ? loadPulseCreateAgentRuntimeBinding
      : loadStandardCreateAgentRuntimeBinding;
    return {
      buildAgentContext: async (context: AgentContext) =>
        (await loadRuntimeBinding()).buildAgentContext(context),
      sendAgentTurn: async (body: AgentApiRequest) =>
        (await loadRuntimeBinding()).sendAgentTurn(body),
      resolveTransportSuccess: async (response: AgentResponse) =>
        (await loadRuntimeBinding()).resolveTransportSuccess(response),
    };
  }, [isPulseCreateMode]);

  const activeAgent = useCreateAgentStateCore({
    enabled: agentEnabled,
    sessionNamespace: isPulseCreateMode
      ? pulseAgentSessionNamespace
      : standardAgentSessionNamespace,
    directOpenAiBypassEnabled:
      !isPulseCreateMode &&
      chatModeEnabled &&
      directOpenAiBypassEnabled &&
      bridgeRuntime.shouldMirrorAssistantPromptToSharedPrompt(selectedTool),
    requestRuntimeMode: isPulseCreateMode ? "pulse" : "standard",
    allowSessionNamespaceOverride: isPulseCreateMode,
    sessionNamespaceOverrideErrorText:
      "Standard agent cannot send to an override session namespace.",
    buildAgentContext: activeAgentRuntimeBinding.buildAgentContext,
    sendAgentTurn: activeAgentRuntimeBinding.sendAgentTurn,
    resolveTransportSuccess: activeAgentRuntimeBinding.resolveTransportSuccess,
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

  const [agentUiBusy, setAgentUiBusy] = useState(false);
  const agentUiBusyRef = useRef(false);
  const agentBusy = agentIsSending || agentUiBusy;
  const [agentBridgeRuntimeStateBySessionKey, setAgentBridgeRuntimeStateBySessionKey] = useState<
    Record<string, AgentBridgeRuntimeState>
  >({});
  const [agentBridgeHydrationRevision, setAgentBridgeHydrationRevision] = useState(0);
  const agentBridgeRuntimeStateBySessionKeyRef = useRef(agentBridgeRuntimeStateBySessionKey);
  useEffect(() => {
    agentBridgeRuntimeStateBySessionKeyRef.current = agentBridgeRuntimeStateBySessionKey;
  }, [agentBridgeRuntimeStateBySessionKey]);
  const createDefaultRuntimeState = useCallback(
    (options?: { forceChatModeEnabled?: boolean }) =>
      createDefaultAgentBridgeRuntimeState(
        options?.forceChatModeEnabled ?? defaultStandardChatModeEnabled
      ),
    [defaultStandardChatModeEnabled]
  );
  const activeAgentBridgeSessionUiState = useMemo(
    () =>
      agentBridgeRuntimeStateBySessionKey[agentBridgeSessionKey] ??
      createDefaultRuntimeState(bridgeRuntime.defaultRuntimeStateOptions),
    [
      agentBridgeRuntimeStateBySessionKey,
      agentBridgeSessionKey,
      createDefaultRuntimeState,
      bridgeRuntime.defaultRuntimeStateOptions,
    ]
  );
  const updateAgentBridgeSessionUiState = useCallback(
    (updater: (current: AgentBridgeRuntimeState) => AgentBridgeRuntimeState) => {
      setAgentBridgeRuntimeStateBySessionKey((current) => {
        const activeState =
          current[agentBridgeSessionKey] ??
          createDefaultRuntimeState(bridgeRuntime.defaultRuntimeStateOptions);
        const nextState = updater(activeState);
        if (nextState === activeState) return current;
        return {
          ...current,
          [agentBridgeSessionKey]: nextState,
        };
      });
    },
    [agentBridgeSessionKey, bridgeRuntime.defaultRuntimeStateOptions, createDefaultRuntimeState]
  );
  const updateAgentBridgeSessionUiStateField = useCallback(
    <Key extends keyof Omit<AgentBridgeRuntimeState, "messages" | "input" | "attachments">>(
      field: Key,
      value: SetStateAction<AgentBridgeRuntimeState[Key]>
    ) => {
      setAgentBridgeRuntimeStateBySessionKey((current) => {
        const pendingHydration = pendingRuntimeHydrationRef.current;
        const liveRuntimeState =
          pendingHydration?.key === agentBridgeSessionKey
            ? null
            : activeLiveRuntimeStateRef.current?.key === agentBridgeSessionKey
              ? activeLiveRuntimeStateRef.current.state
              : null;
        const activeState =
          liveRuntimeState ??
          current[agentBridgeSessionKey] ??
          createDefaultRuntimeState(bridgeRuntime.defaultRuntimeStateOptions);
        const nextValue = resolveStateActionValue(value, activeState[field]);
        if (activeState[field] === nextValue) return current;
        const nextState = {
          ...activeState,
          [field]: nextValue,
        };
        activeLiveRuntimeStateRef.current = {
          key: agentBridgeSessionKey,
          state: nextState,
        };
        if (
          current[agentBridgeSessionKey] &&
          isAgentBridgeRuntimeStateEqual(current[agentBridgeSessionKey], nextState)
        ) {
          return current;
        }
        return {
          ...current,
          [agentBridgeSessionKey]: nextState,
        };
      });
    },
    [agentBridgeSessionKey, bridgeRuntime.defaultRuntimeStateOptions, createDefaultRuntimeState]
  );
  const setLatestAgentPrompt: Dispatch<SetStateAction<string | null>> = useCallback(
    (value) => updateAgentBridgeSessionUiStateField("latestAgentPrompt", value),
    [updateAgentBridgeSessionUiStateField]
  );
  const setPromptOrigin: Dispatch<SetStateAction<PromptOrigin>> = useCallback(
    (value) => updateAgentBridgeSessionUiStateField("promptOrigin", value),
    [updateAgentBridgeSessionUiStateField]
  );
  const setIsAgentChatOpen: Dispatch<SetStateAction<boolean>> = useCallback(
    (value) => updateAgentBridgeSessionUiStateField("isAgentChatOpen", value),
    [updateAgentBridgeSessionUiStateField]
  );
  const { isAgentChatOpen, latestAgentPrompt, promptOrigin } = activeAgentBridgeSessionUiState;
  const pendingRuntimeHydrationRef = useRef<PendingRuntimeHydration | null>(null);
  const persistedAgentRuntimes = useMemo(
    () => ({
      standard: createPersistedAgentRuntimeSnapshot(
        agentBridgeRuntimeStateBySessionKey[`${sessionId ?? "none"}::standard`] ??
          createDefaultRuntimeState()
      ),
      pulsePresetId: hasStoredPulseSession ? resolvedStoredPulsePresetId : null,
      pulse: createPersistedAgentRuntimeSnapshot(
        hasStoredPulseSession
          ? (agentBridgeRuntimeStateBySessionKey[
              `${sessionId ?? "none"}::${pulseRuntimeScopeKey}`
            ] ?? createDefaultRuntimeState({ forceChatModeEnabled: true }))
          : createDefaultRuntimeState({ forceChatModeEnabled: true }),
        { forceChatModeEnabled: true }
      ),
    }),
    [
      agentBridgeRuntimeStateBySessionKey,
      createDefaultRuntimeState,
      hasStoredPulseSession,
      pulseRuntimeScopeKey,
      resolvedStoredPulsePresetId,
      sessionId,
    ]
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

  const resolvePulseSessionNamespace = useCallback(
    (presetId: string, nextPulseSessionInstanceId?: string) =>
      `ai-studio:${sessionId ?? "none"}::pulse:${presetId}:${nextPulseSessionInstanceId ?? "pending"}`,
    [sessionId]
  );

  useEffect(() => {
    const pulseSessionKeyPrefix = `${sessionId ?? "none"}::pulse:`;

    setAgentBridgeRuntimeStateBySessionKey((current) => {
      let changed = false;
      const nextEntries = Object.entries(current).filter(([key]) => {
        const isPulseEntry = key.startsWith(pulseSessionKeyPrefix);
        if (!isPulseEntry) return true;
        const shouldKeep =
          hasStoredPulseSession && key === `${sessionId ?? "none"}::${pulseRuntimeScopeKey}`;
        if (!shouldKeep) {
          changed = true;
        }
        return shouldKeep;
      });
      if (!changed) return current;
      return Object.fromEntries(nextEntries);
    });
  }, [hasStoredPulseSession, pulseRuntimeScopeKey, sessionId]);

  useEffect(() => {
    const storedRuntimeState =
      agentBridgeRuntimeStateBySessionKeyRef.current[agentBridgeSessionKey] ??
      createDefaultRuntimeState(bridgeRuntime.defaultRuntimeStateOptions);
    const liveRuntimeStateForActiveScope =
      activeLiveRuntimeStateRef.current?.key === agentBridgeSessionKey
        ? activeLiveRuntimeStateRef.current.state
        : null;
    const shouldPreserveLiveRuntimeState =
      liveRuntimeStateForActiveScope != null &&
      storedRuntimeState.messages.length === 0 &&
      liveRuntimeStateForActiveScope.messages.length > 0;
    const activeRuntimeState =
      shouldPreserveLiveRuntimeState && liveRuntimeStateForActiveScope
        ? liveRuntimeStateForActiveScope
        : storedRuntimeState;
    agentUiBusyRef.current = false;
    setAgentUiBusy(false);
    // eslint-disable-next-line react-hooks/immutability -- The hydration echo sentinel lives in a ref specifically so scope rehydration metadata does not trigger extra renders.
    pendingRuntimeHydrationRef.current = shouldPreserveLiveRuntimeState
      ? null
      : {
          key: agentBridgeSessionKey,
          state: activeRuntimeState,
          previousKey: committedLiveRuntimeStateRef.current?.key ?? null,
        };
    replaceMessages(activeRuntimeState.messages);
    setAgentInput(activeRuntimeState.input);
    setAgentAttachmentError(null);
    setAgentAttachments(activeRuntimeState.attachments);

    setLatestAgentPrompt(activeRuntimeState.latestAgentPrompt);
    setPromptOrigin(activeRuntimeState.promptOrigin);
    if (bridgeRuntime.shouldHydrateStandardChatMode) {
      setStandardChatModeEnabledState(activeRuntimeState.chatModeEnabled);
    }
    setIsAgentChatOpen(activeRuntimeState.isAgentChatOpen);
  }, [
    agentBridgeSessionKey,
    agentBridgeHydrationRevision,
    createDefaultRuntimeState,
    replaceMessages,
    setAgentAttachmentError,
    setAgentAttachments,
    setAgentInput,
    setAgentUiBusy,
    setIsAgentChatOpen,
    setLatestAgentPrompt,
    setPromptOrigin,
    bridgeRuntime.defaultRuntimeStateOptions,
    bridgeRuntime.shouldHydrateStandardChatMode,
  ]);

  const latestAssistantMessage = useMemo(
    () => [...agentMessages].reverse().find((msg) => msg.role === "assistant")?.content ?? null,
    [agentMessages]
  );
  const pulseArtifactPrompt =
    hasVisiblePulseSession &&
    typeof pulseWorkflowSession?.lastArtifact === "string" &&
    pulseWorkflowSession.lastArtifact.trim().length > 0
      ? pulseWorkflowSession.lastArtifact.trim()
      : null;
  const effectiveLatestAgentPrompt = pulseArtifactPrompt ?? latestAgentPrompt;
  const effectivePromptOrigin =
    pulseArtifactPrompt && hasVisiblePulseSession ? "agent" : promptOrigin;
  const liveRuntimeState = useMemo<AgentBridgeRuntimeState>(
    () => ({
      messages: agentMessages,
      input: agentInput,
      attachments: agentAttachments,
      latestAgentPrompt: effectiveLatestAgentPrompt,
      promptOrigin: effectivePromptOrigin,
      chatModeEnabled: bridgeRuntime.effectiveChatMode(chatModeEnabled),
      isAgentChatOpen,
    }),
    [
      agentAttachments,
      agentInput,
      agentMessages,
      chatModeEnabled,
      effectiveLatestAgentPrompt,
      effectivePromptOrigin,
      isAgentChatOpen,
      bridgeRuntime,
    ]
  );
  const activeLiveRuntimeState = useMemo<AgentBridgeRuntimeState>(
    () => ({
      messages: agentMessages,
      input: agentInput,
      attachments: agentAttachments,
      latestAgentPrompt,
      promptOrigin,
      chatModeEnabled: bridgeRuntime.effectiveChatMode(chatModeEnabled),
      isAgentChatOpen,
    }),
    [
      agentAttachments,
      agentInput,
      agentMessages,
      chatModeEnabled,
      isAgentChatOpen,
      bridgeRuntime,
      latestAgentPrompt,
      promptOrigin,
    ]
  );
  activeLiveRuntimeStateRef.current = {
    key: agentBridgeSessionKey,
    state: activeLiveRuntimeState,
  };

  useLayoutEffect(() => {
    const committedLiveRuntimeState = committedLiveRuntimeStateRef.current;
    if (
      committedLiveRuntimeState &&
      committedLiveRuntimeState.key !== agentBridgeSessionKey &&
      !isAgentBridgeRuntimeStateEqual(
        agentBridgeRuntimeStateBySessionKey[committedLiveRuntimeState.key] ??
          createDefaultRuntimeState(),
        committedLiveRuntimeState.state
      )
    ) {
      setAgentBridgeRuntimeStateBySessionKey((current) => {
        const existingState = current[committedLiveRuntimeState.key] ?? createDefaultRuntimeState();
        if (isAgentBridgeRuntimeStateEqual(existingState, committedLiveRuntimeState.state)) {
          return current;
        }
        return {
          ...current,
          [committedLiveRuntimeState.key]: committedLiveRuntimeState.state,
        };
      });
    }
  }, [
    agentBridgeRuntimeStateBySessionKey,
    agentBridgeSessionKey,
    createDefaultRuntimeState,
    setAgentBridgeRuntimeStateBySessionKey,
  ]);

  useLayoutEffect(() => {
    committedLiveRuntimeStateRef.current = {
      key: agentBridgeSessionKey,
      state: liveRuntimeState,
    };
  }, [agentBridgeSessionKey, liveRuntimeState]);

  useEffect(() => {
    const pendingHydration = pendingRuntimeHydrationRef.current;
    if (pendingHydration?.key === agentBridgeSessionKey) {
      const isHydratedEcho = isAgentBridgeRuntimeStateEqual(
        pendingHydration.state,
        liveRuntimeState
      );
      if (isHydratedEcho) {
        // eslint-disable-next-line react-hooks/immutability -- Clearing the hydration echo sentinel is ref-only bookkeeping and intentionally does not participate in render state.
        pendingRuntimeHydrationRef.current = null;
        return;
      }
      if (pendingHydration.previousKey && pendingHydration.previousKey !== agentBridgeSessionKey) {
        return;
      }

      pendingRuntimeHydrationRef.current = null;
    }

    updateAgentBridgeSessionUiState((current) => {
      const equal = isAgentBridgeRuntimeStateEqual(current, liveRuntimeState);
      if (equal) {
        return current;
      }
      return liveRuntimeState;
    });
  }, [
    agentAttachments,
    agentBridgeSessionKey,
    agentInput,
    agentMessages,
    chatModeEnabled,
    liveRuntimeState,
    effectivePromptOrigin,
    isAgentChatOpen,
    effectiveLatestAgentPrompt,
    updateAgentBridgeSessionUiState,
  ]);
  const stagedAgentPrompt = getStagedAgentPrompt(effectivePromptOrigin, effectiveLatestAgentPrompt);

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
    getOutputById: findOutputById,
    aspect,
    model,
    setOutputs,
    setActiveOutputId,
    lastAssistantMessage: latestAssistantMessage,
    setUiNotice,
    runtimePolicy: orchestrationRuntimePolicy,
    resolvePulseSessionNamespace,
  });

  const {
    handleExpandChat,
    handleAgentAddToGrid,
    handleClearAgentChat: clearAgentChatInteraction,
    handleCloseAgentChat,
  } = useAiStudioAgentInteractions({
    expertCreateMode,
    setLatestAgentPrompt,
    setPromptOrigin,
    trackAgentUiEvent,
    addAgentPromptReference,
    setIsAgentChatOpen,
    agentSessionEnabled,
    setAgentSessionEnabled,
    latestAgentPrompt: effectiveLatestAgentPrompt,
    resetAgentChat,
    resetAgentComposer,
    clearPulseRuntime,
  });

  const handleClearAgentChat = useCallback(() => {
    clearAgentChatInteraction();
    setAgentBridgeRuntimeStateBySessionKey((current) => {
      const nextRuntimeState = createDefaultRuntimeState(bridgeRuntime.defaultRuntimeStateOptions);
      const existingState = current[agentBridgeSessionKey] ?? createDefaultRuntimeState();
      if (isAgentBridgeRuntimeStateEqual(existingState, nextRuntimeState)) {
        return current;
      }
      return {
        ...current,
        [agentBridgeSessionKey]: nextRuntimeState,
      };
    });
  }, [
    agentBridgeSessionKey,
    bridgeRuntime.defaultRuntimeStateOptions,
    clearAgentChatInteraction,
    createDefaultRuntimeState,
  ]);

  const handlePulsePresetRestart = useCallback(
    async (preset: CreatePulseResolvedPreset) => {
      trackAgentUiEvent("studio_agent_pulse_restart_requested", {
        preset_id: preset.presetId,
        runtime_mode: preset.runtimeMode,
        activation_mode: preset.activationMode,
      });
      resetAgentChat();
      resetAgentComposer({ preserveAttachments: false });
      setLatestAgentPrompt(null);
      setPromptOrigin("manual");
      setPulseWorkflowSession(null);
      const restartedPulse = restartPulse?.() ?? null;
      const pulseSessionInstanceId =
        restartedPulse?.presetId === preset.presetId ? restartedPulse.sessionInstanceId : null;
      if (!pulseSessionInstanceId) {
        setUiNotice("Pulse restart could not create a fresh session. Start the Pulse again.");
        trackAgentUiEvent("studio_agent_pulse_restart_blocked_missing_session", {
          preset_id: preset.presetId,
        });
        return;
      }
      await handlePulsePresetStart(preset, {
        pulseSessionInstanceId,
      });
    },
    [
      handlePulsePresetStart,
      restartPulse,
      resetAgentChat,
      resetAgentComposer,
      setLatestAgentPrompt,
      setPromptOrigin,
      setPulseWorkflowSession,
      setUiNotice,
      trackAgentUiEvent,
    ]
  );

  const resetProjectAgentConversation = useCallback(() => {
    const sessionKeyPrefix = `${sessionId ?? "none"}::`;
    resetAgentChat();
    resetAgentComposer({ preserveInput: false, preserveAttachments: false });
    setAgentBridgeRuntimeStateBySessionKey((current) => {
      const nextEntries = Object.entries(current).filter(
        ([key]) => !key.startsWith(sessionKeyPrefix)
      );
      if (nextEntries.length === Object.keys(current).length) return current;
      return Object.fromEntries(nextEntries);
    });
    setStandardChatModeEnabledState(true);
    setPulseWorkflowSession(null);
    setAgentAttachmentError(null);
    setAgentAttachments([]);
  }, [
    resetAgentComposer,
    resetAgentChat,
    sessionId,
    setAgentAttachmentError,
    setAgentAttachments,
    setPulseWorkflowSession,
  ]);

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
      if (didUpdate) {
        const latestEditableAssistantId = [...agentMessages]
          .reverse()
          .find((message) => canUseAssistantMessageAsPrompt(message))?.id;
        if (latestEditableAssistantId === messageId) {
          setLatestAgentPrompt(commitContent);
          setPromptOrigin("agent");
          if (bridgeRuntime.shouldMirrorAssistantPromptToSharedPrompt(selectedTool)) {
            setSharedPrompt(commitContent);
          }
        }
        trackAgentUiEvent("studio_agent_message_edit_committed", {
          message_id: messageId,
          content_length: commitContent.length,
        });
      }
      return didUpdate;
    },
    [
      agentMessages,
      bridgeRuntime,
      selectedTool,
      setLatestAgentPrompt,
      setPromptOrigin,
      setSharedPrompt,
      trackAgentUiEvent,
      updateMessageById,
    ]
  );

  const hydrateFromSessionAgentSnapshot = useCallback(
    ({
      workspace,
      agentRuntimes,
    }: Pick<AiStudioSessionHydrationPayload, "workspace" | "agent" | "agentRuntimes">) => {
      const sessionKeyPrefix = `${sessionId ?? "none"}::`;
      const nextStateBySessionKey: Record<string, AgentBridgeRuntimeState> = {
        [`${sessionKeyPrefix}standard`]: createAgentBridgeRuntimeStateFromHydration(
          agentRuntimes.standard
        ),
      };
      const pulsePresetId =
        workspace.expertCreateMode === "pulse"
          ? (agentRuntimes.pulsePresetId ?? workspace.activePulsePresetId)
          : null;
      const restoredPulseSessionInstanceId =
        workspace.expertCreateMode === "pulse" ? workspace.pulseSessionInstanceId : null;
      if (pulsePresetId && restoredPulseSessionInstanceId) {
        nextStateBySessionKey[
          `${sessionKeyPrefix}pulse:${pulsePresetId}:${restoredPulseSessionInstanceId}`
        ] = createAgentBridgeRuntimeStateFromHydration(agentRuntimes.pulse, {
          forceChatModeEnabled: true,
        });
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
      setAgentBridgeHydrationRevision((current) => current + 1);
      setPulseWorkflowSession(
        pulsePresetId && restoredPulseSessionInstanceId
          ? (agentRuntimes.pulse.pulseWorkflowSession ?? null)
          : null
      );
      setAgentAttachmentError(null);
      setAgentAttachments([]);
    },
    [sessionId, setAgentAttachmentError, setAgentAttachments, setPulseWorkflowSession]
  );

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
    linkedPromptReferenceIds,
    isAgentDropActive,
    isAgentChatOpen,
    latestAgentPrompt: effectiveLatestAgentPrompt,
    promptOrigin: effectivePromptOrigin,
    persistedAgentRuntimes,
    chatModeEnabled,
    setChatModeEnabled,
    setPromptOrigin,
    stagedAgentPrompt,
    isPromptRefining,
    isReferencePromptEnhancing,
    describeInFlightCount,
    handleAgentInputChange,
    handleAgentSend,
    handlePulsePresetStart,
    handlePulsePresetRestart,
    handleAgentEnhanceSend,
    handleReferencePromptEnhance,
    resetProjectAgentConversation,
    hydrateFromSessionAgentSnapshot,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleAgentAttachmentDrop,
    handleRemoveAgentAttachment,
    handleClearAgentAttachments,
    handleAssistantMessageEdit,
    handleExpandChat,
    handleAgentAddToGrid,
    handleClearAgentChat,
    handleCloseAgentChat,
  };
};
