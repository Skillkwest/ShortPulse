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
import type {
  AgentAttachment,
  AgentAssistantMessageEditRequest,
  AgentContext,
  AgentMessage,
  AgentPulseWorkflowSession,
} from "../../../prefabs/agent";
import { getStagedAgentPrompt, type PromptOrigin } from "../logic/agentPromptOwnership";
import { useAiStudioAgentComposer } from "./useAiStudioAgentComposer";
import { useAiStudioAgentInteractions } from "./useAiStudioAgentInteractions";
import { useAiStudioAgentOrchestration } from "./useAiStudioAgentOrchestration";
import type { AgentModeHint } from "./agentOrchestration/types";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import { resolveAssistantMessageEditCommit } from "../../ai-agent/client/messageEditing";
import { resolveCreateAgentBridgeRuntime } from "./agentBridgeRuntime/createAgentBridgeRuntime";
import { resolveCreateAgentOrchestrationRuntimePolicy } from "./agentOrchestration/createAgentOrchestrationRuntimePolicy";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import { useCreateAgentBridgeActiveAgent } from "./agentBridgeRuntime/useCreateAgentBridgeActiveAgent";
import {
  buildHydratedCreateAgentRuntimeStateBySessionKey,
  buildPersistedCreateAgentRuntimes,
  type AgentBridgeRuntimeState,
} from "./agentBridgeRuntime/createAgentBridgePersistenceRuntime";
import {
  pruneInactivePulseBridgeRuntimeStates,
  resolvePulseAgentSessionNamespace,
  resolvePulseWorkflowArtifactPrompt,
} from "./agentBridgeRuntime/pulseBridgeRuntimeState";

type CreateAgentContextResolver = (params: {
  lastAssistantMessage: string | null;
  selectedOverride?: StudioOutput | null;
  modeHint?: AgentModeHint;
}) => AgentContext;

export type StandardCreateAgentBridgeRuntimeConfig = {
  kind: "standard";
  prompt: string;
  chatModeEnabled?: boolean;
  defaultChatModeEnabled?: boolean;
  setChatModeEnabled?: Dispatch<SetStateAction<boolean>>;
  getAgentContext: (params: {
    lastAssistantMessage: string | null;
    selectedOverride?: StudioOutput | null;
    modeHint?: AgentModeHint;
  }) => AgentContext;
};

export type PulseCreateAgentBridgeRuntimeConfig = {
  kind: "pulse";
  prompt: string;
  activePresetId?: string | null;
  sessionInstanceId?: string | null;
  workflowSession?: AgentPulseWorkflowSession | null;
  setWorkflowSession: Dispatch<SetStateAction<AgentPulseWorkflowSession | null>>;
  clearRuntime?: () => void;
  restart?: () => { presetId: string; sessionInstanceId: string } | null;
  getAgentContext: CreateAgentContextResolver;
};

export type CreateAgentBridgeRuntimeConfig =
  | StandardCreateAgentBridgeRuntimeConfig
  | PulseCreateAgentBridgeRuntimeConfig;

type UseAiStudioAgentBridgeParams = {
  sessionId: string | null;
  mode: StudioMode;
  selectedTool: ToolId | null;
  createAgentRuntime: CreateAgentBridgeRuntimeConfig;
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

type PendingRuntimeHydration = {
  key: string;
  state: AgentBridgeRuntimeState;
  previousKey: string | null;
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
  sessionId,
  mode,
  selectedTool,
  createAgentRuntime,
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
}: UseAiStudioAgentBridgeParams) => {
  const noopSetPulseWorkflowSession: Dispatch<SetStateAction<AgentPulseWorkflowSession | null>> =
    useCallback(() => {}, []);
  const expertCreateMode = createAgentRuntime.kind;
  const activePulsePresetId =
    createAgentRuntime.kind === "pulse" ? (createAgentRuntime.activePresetId ?? null) : null;
  const pulseSessionInstanceId =
    createAgentRuntime.kind === "pulse" ? (createAgentRuntime.sessionInstanceId ?? null) : null;
  const pulseWorkflowSession =
    createAgentRuntime.kind === "pulse" ? (createAgentRuntime.workflowSession ?? null) : null;
  const standardChatModeEnabled =
    createAgentRuntime.kind === "standard" ? (createAgentRuntime.chatModeEnabled ?? true) : true;
  const defaultStandardChatModeEnabled =
    createAgentRuntime.kind === "standard"
      ? (createAgentRuntime.defaultChatModeEnabled ?? standardChatModeEnabled)
      : true;
  const setStandardChatModeEnabled =
    createAgentRuntime.kind === "standard" ? createAgentRuntime.setChatModeEnabled : undefined;
  const activeCreatePrompt = createAgentRuntime.prompt;
  const getAgentContext = createAgentRuntime.getAgentContext;
  const setPulseWorkflowSession =
    createAgentRuntime.kind === "pulse"
      ? createAgentRuntime.setWorkflowSession
      : noopSetPulseWorkflowSession;
  const clearPulseRuntime =
    createAgentRuntime.kind === "pulse" ? createAgentRuntime.clearRuntime : undefined;
  const restartPulse = createAgentRuntime.kind === "pulse" ? createAgentRuntime.restart : undefined;

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
  const chatModeEnabled = bridgeRuntime.effectiveChatMode(standardChatModeEnabled);

  const setChatModeEnabled = useCallback(
    (value: boolean) => {
      if (isPulseCreateMode) return;
      setStandardChatModeEnabled?.(value);
    },
    [isPulseCreateMode, setStandardChatModeEnabled]
  );

  const activeLiveRuntimeStateRef = useRef<{
    key: string;
    state: AgentBridgeRuntimeState;
  } | null>(null);
  const hydratedAgentBridgeSessionKeyRef = useRef(agentBridgeSessionKey);
  const committedLiveRuntimeStateRef = useRef<{
    key: string;
    state: AgentBridgeRuntimeState;
  } | null>(null);
  const activeAgent = useCreateAgentBridgeActiveAgent({
    bridgeRuntime,
    agentEnabled,
    chatModeEnabled,
    directOpenAiBypassEnabled,
    selectedTool,
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
    () =>
      buildPersistedCreateAgentRuntimes({
        agentBridgeRuntimeStateBySessionKey,
        createDefaultRuntimeState,
        hasStoredPulseSession,
        pulseRuntimeScopeKey,
        resolvedStoredPulsePresetId,
        sessionId,
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
      resolvePulseAgentSessionNamespace({
        sessionId,
        presetId,
        pulseSessionInstanceId: nextPulseSessionInstanceId,
      }),
    [sessionId]
  );

  useEffect(() => {
    setAgentBridgeRuntimeStateBySessionKey((current) => {
      return pruneInactivePulseBridgeRuntimeStates({
        current,
        sessionId,
        hasStoredPulseSession,
        pulseRuntimeScopeKey,
      });
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
      setStandardChatModeEnabled?.(activeRuntimeState.chatModeEnabled);
    }
    setIsAgentChatOpen(activeRuntimeState.isAgentChatOpen);
    hydratedAgentBridgeSessionKeyRef.current = agentBridgeSessionKey;
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
    setStandardChatModeEnabled,
  ]);

  const isComposerHydratedForActiveScope =
    hydratedAgentBridgeSessionKeyRef.current === agentBridgeSessionKey;
  const visibleAgentMessages = isComposerHydratedForActiveScope
    ? agentMessages
    : activeAgentBridgeSessionUiState.messages;
  const visibleAgentInput = isComposerHydratedForActiveScope
    ? agentInput
    : activeAgentBridgeSessionUiState.input;
  const visibleAgentAttachments = isComposerHydratedForActiveScope
    ? agentAttachments
    : activeAgentBridgeSessionUiState.attachments;
  const handleVisibleAgentInputChange = useCallback(
    (value: string) => {
      if (isComposerHydratedForActiveScope) {
        handleAgentInputChange(value);
        return;
      }
      setAgentAttachmentError(null);
      updateAgentBridgeSessionUiState((current) => {
        if (current.input === value) return current;
        return {
          ...current,
          input: value,
        };
      });
    },
    [
      handleAgentInputChange,
      isComposerHydratedForActiveScope,
      setAgentAttachmentError,
      updateAgentBridgeSessionUiState,
    ]
  );
  const visibleLinkedPromptReferenceIds = useMemo(
    () =>
      Array.from(
        new Set(
          visibleAgentAttachments
            .map((attachment) => attachment.referenceId)
            .filter((referenceId): referenceId is string => Boolean(referenceId))
        )
      ),
    [visibleAgentAttachments]
  );
  const latestAssistantMessage = useMemo(
    () =>
      [...visibleAgentMessages].reverse().find((msg) => msg.role === "assistant")?.content ?? null,
    [visibleAgentMessages]
  );
  const pulseArtifactPrompt = resolvePulseWorkflowArtifactPrompt({
    hasVisiblePulseSession,
    pulseWorkflowSession,
  });
  const effectiveLatestAgentPrompt = pulseArtifactPrompt ?? latestAgentPrompt;
  const effectivePromptOrigin =
    pulseArtifactPrompt && hasVisiblePulseSession ? "agent" : promptOrigin;
  const liveRuntimeState = useMemo<AgentBridgeRuntimeState>(
    () => ({
      messages: visibleAgentMessages,
      input: visibleAgentInput,
      attachments: visibleAgentAttachments,
      latestAgentPrompt: effectiveLatestAgentPrompt,
      promptOrigin: effectivePromptOrigin,
      chatModeEnabled: bridgeRuntime.effectiveChatMode(chatModeEnabled),
      isAgentChatOpen,
    }),
    [
      chatModeEnabled,
      effectiveLatestAgentPrompt,
      effectivePromptOrigin,
      isAgentChatOpen,
      bridgeRuntime,
      visibleAgentAttachments,
      visibleAgentInput,
      visibleAgentMessages,
    ]
  );
  const activeLiveRuntimeState = useMemo<AgentBridgeRuntimeState>(
    () => ({
      messages: visibleAgentMessages,
      input: visibleAgentInput,
      attachments: visibleAgentAttachments,
      latestAgentPrompt,
      promptOrigin,
      chatModeEnabled: bridgeRuntime.effectiveChatMode(chatModeEnabled),
      isAgentChatOpen,
    }),
    [
      chatModeEnabled,
      isAgentChatOpen,
      bridgeRuntime,
      latestAgentPrompt,
      promptOrigin,
      visibleAgentAttachments,
      visibleAgentInput,
      visibleAgentMessages,
    ]
  );
  if (isComposerHydratedForActiveScope) {
    activeLiveRuntimeStateRef.current = {
      key: agentBridgeSessionKey,
      state: activeLiveRuntimeState,
    };
  }

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
    agentInput: visibleAgentInput,
    setAgentInput,
    agentAttachments: visibleAgentAttachments,
    setAgentAttachments,
    setAgentAttachmentError,
    prompt: activeCreatePrompt,
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
    clearActiveRuntime: bridgeRuntime.kind === "pulse" ? clearPulseRuntime : undefined,
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
    async (preset: Parameters<typeof handlePulsePresetStart>[0]) => {
      const { restartCreatePulsePreset } = await import("./agentBridgeRuntime/pulsePresetRestart");
      await restartCreatePulsePreset({
        preset,
        restartPulse,
        resetAgentChat,
        resetAgentComposer,
        setLatestAgentPrompt,
        setPromptOrigin,
        setPulseWorkflowSession,
        setUiNotice,
        trackAgentUiEvent,
        startPulsePreset: handlePulsePresetStart,
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
    setStandardChatModeEnabled?.(true);
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
    setStandardChatModeEnabled,
  ]);

  useEffect(() => {
    resetAgentComposer({ preserveInput: true, preserveAttachments: false });
  }, [mode, resetAgentComposer, selectedTool, sessionId]);

  const handleAssistantMessageEdit = useCallback(
    ({ messageId, content }: AgentAssistantMessageEditRequest): boolean => {
      const targetMessage = visibleAgentMessages.find(
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
        const latestEditableAssistantId = [...visibleAgentMessages]
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
      bridgeRuntime,
      selectedTool,
      setLatestAgentPrompt,
      setPromptOrigin,
      setSharedPrompt,
      trackAgentUiEvent,
      updateMessageById,
      visibleAgentMessages,
    ]
  );

  const hydrateFromSessionAgentSnapshot = useCallback(
    ({
      workspace,
      agentRuntimes,
    }: Pick<AiStudioSessionHydrationPayload, "workspace" | "agent" | "agentRuntimes">) => {
      const sessionKeyPrefix = `${sessionId ?? "none"}::`;
      const { nextStateBySessionKey, restoredPulseWorkflowSession } =
        buildHydratedCreateAgentRuntimeStateBySessionKey({
          workspace,
          agentRuntimes,
          sessionId,
        });

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
      setPulseWorkflowSession(restoredPulseWorkflowSession ?? null);
      setAgentAttachmentError(null);
      setAgentAttachments([]);
    },
    [sessionId, setAgentAttachmentError, setAgentAttachments, setPulseWorkflowSession]
  );

  return {
    agentEnabled,
    agentBootstrapReady,
    directOpenAiBypassEnabled,
    agentMessages: visibleAgentMessages,
    agentError,
    agentIsSending,
    agentUiBusy,
    agentBusy,
    agentInput: visibleAgentInput,
    agentAttachmentError,
    agentAttachments: visibleAgentAttachments,
    linkedPromptReferenceIds: visibleLinkedPromptReferenceIds,
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
    handleAgentInputChange: handleVisibleAgentInputChange,
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
