/**
 * Pulse Create agent runtime.
 * Owns Pulse-mode chat state, guided-workflow session capture when applicable,
 * preset kickoff, reusable prompt exposure, and Pulse transport binding.
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
  AgentPulseWorkflowSession,
} from "../../../prefabs/agent";
import { useCreateAgentStateCore } from "../../ai-agent/useCreateAgentStateCore";
import { resolveAssistantMessageEditCommit } from "../../ai-agent/client/messageEditing";
import { pulseCreateAgentRuntimeBinding } from "../hooks/createAgentRuntime/pulseCreateAgentRuntimeBinding";
import { resolveCreateAgentOrchestrationRuntimePolicy } from "../hooks/agentOrchestration/createAgentOrchestrationRuntimePolicy";
import type { AgentModeHint } from "../hooks/agentOrchestration/types";
import { runPulseCreateAgentSend } from "../hooks/agentOrchestration/runPulseCreateAgentSend";
import { runPulsePresetStartRuntime } from "../hooks/agentOrchestration/runPulsePresetStartRuntime";
import { usePulseWorkflowSessionReconciliation } from "../hooks/createPulsePageRuntime/usePulseWorkflowSessionReconciliation";
import { useAiStudioAgentComposer } from "../hooks/useAiStudioAgentComposer";
import { useAiStudioAgentInteractions } from "../hooks/useAiStudioAgentInteractions";
import { projectAgentAttachmentToComposerImageAttachment } from "../logic/composerImageAttachment";
import { isEphemeralLocalImageAttachment } from "../logic/ephemeralComposerImage";
import { getStagedAgentPrompt, type PromptOrigin } from "../logic/agentPromptOwnership";
import type { CreatePulseResolvedPreset } from "../components/create/createPulsePresets";
import type {
  AiStudioSessionAgentMessageV1,
  AiStudioSessionAgentV1,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import { resolvePulseWorkflowArtifactPrompt } from "../hooks/createAgentRuntime/pulseRuntimeState";
import type { PulseCreatePageAgentRuntime } from "./contracts";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";

type PulseCreateAgentContextResolver = (params: {
  lastAssistantMessage: string | null;
  selectedOverride?: StudioOutput | null;
  modeHint?: AgentModeHint;
  includeActiveOutput?: boolean;
}) => AgentContext;

type UsePulseCreateAgentRuntimeParams = {
  sessionId: string | null;
  mode: StudioMode;
  selectedTool: ToolId | null;
  prompt: string;
  activePresetSnapshot: CreatePulseResolvedPreset | null;
  activePresetId: string | null;
  sessionInstanceId: string | null;
  workflowSession: AgentPulseWorkflowSession | null;
  setWorkflowSession: Dispatch<SetStateAction<AgentPulseWorkflowSession | null>>;
  clearRuntime?: () => void;
  restartPulse?: () => { presetId: string; sessionInstanceId: string } | null;
  getAgentContext: PulseCreateAgentContextResolver;
  setPulseCreatePrompt: (value: string) => void;
  findOutputById: (id: string) => StudioOutput | null;
  resolvePanelOutputPreviewUrl: (id: string | null | undefined) => string | null;
  resolveInternalImageDropSource?: ResolveInternalReferenceDrop;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
  trackAgentUiEvent: (message: string, data?: Record<string, unknown>) => void;
};

const canUseAssistantMessageAsPrompt = (message: AgentMessage): boolean =>
  message.role === "assistant" &&
  message.canUseAsPrompt === true &&
  typeof message.outputPrompt === "string" &&
  message.outputPrompt.trim().length > 0;

const serializeMessageForSnapshot = (message: AgentMessage): AiStudioSessionAgentMessageV1 => {
  const attachments = message.attachments
    ?.filter((attachment) => !isEphemeralLocalImageAttachment(attachment))
    .map((attachment) => {
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
    });
  return {
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
    ...(attachments?.length ? { attachments } : {}),
  };
};

const resolveLinkedPromptReferenceIds = (attachments: AgentMessage["attachments"] = []): string[] =>
  Array.from(
    new Set(
      attachments
        .map((attachment) => attachment.referenceId)
        .filter((referenceId): referenceId is string => Boolean(referenceId))
    )
  );

const resolvePulseAgentSessionNamespace = ({
  sessionId,
  presetId,
  sessionInstanceId,
}: {
  sessionId: string | null;
  presetId: string | null;
  sessionInstanceId: string | null;
}) =>
  `ai-studio:${sessionId ?? "none"}::pulse:${presetId ?? "inactive"}:${sessionInstanceId ?? "inactive"}`;

/**
 * Returns the Pulse Create agent runtime.
 */
export const usePulseCreateAgentRuntime = ({
  sessionId,
  mode,
  selectedTool,
  prompt,
  activePresetSnapshot,
  activePresetId,
  sessionInstanceId,
  workflowSession,
  setWorkflowSession,
  clearRuntime,
  restartPulse,
  getAgentContext,
  setPulseCreatePrompt,
  findOutputById,
  resolvePanelOutputPreviewUrl,
  resolveInternalImageDropSource,
  setUiNotice,
  trackAgentUiEvent,
}: UsePulseCreateAgentRuntimeParams): PulseCreatePageAgentRuntime => {
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
  const preparedImageUrlCacheRef = useRef<Map<string, { safeUrl: string; expiresAtMs: number }>>(
    new Map()
  );
  const runtimePolicy = useMemo(
    () =>
      resolveCreateAgentOrchestrationRuntimePolicy({
        expertCreateMode: "pulse",
        activePulsePresetId: activePresetId,
        pulseSessionInstanceId: sessionInstanceId,
      }),
    [activePresetId, sessionInstanceId]
  );
  const agentSessionNamespace = resolvePulseAgentSessionNamespace({
    sessionId,
    presetId: activePresetId,
    sessionInstanceId,
  });

  const activeAgent = useCreateAgentStateCore({
    enabled: agentEnabled,
    sessionNamespace: agentSessionNamespace,
    requestRuntimeMode: "pulse",
    allowSessionNamespaceOverride: true,
    buildAgentContext: pulseCreateAgentRuntimeBinding.buildAgentContext,
    sendAgentTurn: pulseCreateAgentRuntimeBinding.sendAgentTurn,
    resolveTransportSuccess: pulseCreateAgentRuntimeBinding.resolveTransportSuccess,
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

  usePulseWorkflowSessionReconciliation({
    hasActivePulseSession: runtimePolicy.hasActivePulseSession,
    activeCreatePulsePresetId: activePresetId,
    activeCreatePulsePresetSnapshot: activePresetSnapshot,
    agentMessages,
    agentBusy,
    pulseWorkflowSession: workflowSession,
    setPulseWorkflowSession: setWorkflowSession,
  });

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
    maxImageAttachmentsPerDrop: 3,
  });
  const linkedPromptReferenceIds = useMemo(
    () => resolveLinkedPromptReferenceIds(agentAttachments),
    [agentAttachments]
  );
  const pulseArtifactPrompt = resolvePulseWorkflowArtifactPrompt({
    hasVisiblePulseSession: runtimePolicy.hasActivePulseSession,
    pulseWorkflowSession: workflowSession,
  });
  const effectiveLatestAgentPrompt = pulseArtifactPrompt ?? latestAgentPrompt;
  const effectivePromptOrigin =
    pulseArtifactPrompt && runtimePolicy.hasActivePulseSession ? "agent" : promptOrigin;
  const stagedAgentPrompt = getStagedAgentPrompt(effectivePromptOrigin, effectiveLatestAgentPrompt);
  const notifyBootstrapPending = useCallback(() => {
    setUiNotice("Pulse runtime is still starting. Try again in a moment.");
  }, [setUiNotice]);

  const resolvePulseSessionNamespace = useCallback(
    (presetId: string, nextSessionInstanceId?: string) =>
      resolvePulseAgentSessionNamespace({
        sessionId,
        presetId,
        sessionInstanceId: nextSessionInstanceId ?? sessionInstanceId,
      }),
    [sessionId, sessionInstanceId]
  );

  const handleAgentSend = useCallback(
    async (
      textOverride?: string,
      options?: { captureResult?: boolean; selectedOverride?: StudioOutput | null }
    ) =>
      runPulseCreateAgentSend({
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
        setPulseWorkflowSession: setWorkflowSession,
        selectedTool,
        setSharedPrompt: setPulseCreatePrompt,
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
      }),
    [
      agentAttachments,
      agentBootstrapReady,
      agentInput,
      agentIsSending,
      agentSessionEnabled,
      appendUserMessage,
      getAgentContext,
      notifyBootstrapPending,
      prompt,
      removeMessageById,
      runtimePolicy,
      selectedTool,
      sendToAgent,
      setAgentAttachmentError,
      setAgentAttachments,
      setAgentInput,
      setPulseCreatePrompt,
      setUiNotice,
      setWorkflowSession,
      trackAgentUiEvent,
      updateMessageById,
    ]
  );

  const handlePulsePresetStart = useCallback(
    async (
      preset: CreatePulseResolvedPreset,
      options?: {
        pulseSessionInstanceId?: string | null;
        deferWorkflowSessionCommit?: boolean;
        activationIsCurrent?: () => boolean;
      }
    ) => {
      const result = await runPulsePresetStartRuntime({
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
        setPulseWorkflowSession: setWorkflowSession,
        setSharedPrompt: setPulseCreatePrompt,
        setPromptOrigin,
        setAgentAttachmentError,
        trackAgentUiEvent,
        preset,
        options,
        notifyBootstrapPending,
      });
      if (result.status === "started") {
        resetAgentComposer({ preserveInput: false, preserveAttachments: false });
        setPulseCreatePrompt("");
        if (result.latestAgentPrompt) {
          setLatestAgentPrompt(result.latestAgentPrompt);
          setPromptOrigin("agent");
        } else {
          setLatestAgentPrompt(null);
          setPromptOrigin("manual");
        }
      }
      return result;
    },
    [
      agentBootstrapReady,
      agentIsSending,
      agentSessionEnabled,
      getAgentContext,
      notifyBootstrapPending,
      resetAgentComposer,
      resolvePulseSessionNamespace,
      runtimePolicy,
      selectedTool,
      sendToAgent,
      setAgentAttachmentError,
      setLatestAgentPrompt,
      setPromptOrigin,
      setPulseCreatePrompt,
      setWorkflowSession,
      trackAgentUiEvent,
    ]
  );

  const handlePulsePresetRestart = useCallback(
    async (
      preset: CreatePulseResolvedPreset,
      options?: { activationIsCurrent?: () => boolean }
    ) => {
      const { restartCreatePulsePreset } =
        await import("../hooks/createAgentRuntime/pulsePresetRestart");
      await restartCreatePulsePreset({
        preset,
        restartPulse,
        resetAgentChat,
        resetAgentComposer,
        setLatestAgentPrompt,
        setPromptOrigin,
        setPulseWorkflowSession: setWorkflowSession,
        setUiNotice,
        trackAgentUiEvent,
        startPulsePreset: handlePulsePresetStart,
        activationIsCurrent: options?.activationIsCurrent,
      });
    },
    [
      handlePulsePresetStart,
      restartPulse,
      resetAgentChat,
      resetAgentComposer,
      setUiNotice,
      setWorkflowSession,
      trackAgentUiEvent,
    ]
  );

  const { handleClearAgentChat } = useAiStudioAgentInteractions({
    setLatestAgentPrompt,
    setPromptOrigin,
    trackAgentUiEvent,
    resetAgentChat,
    resetAgentComposer,
    clearActiveRuntime: clearRuntime,
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
      latestAgentPrompt: effectiveLatestAgentPrompt,
      promptOrigin: effectivePromptOrigin,
      chatModeEnabled: true,
      pulseWorkflowSession: workflowSession,
    }),
    [agentInput, agentMessages, effectiveLatestAgentPrompt, effectivePromptOrigin, workflowSession]
  );

  const hydrateFromSessionAgentSnapshot = useCallback(
    ({
      workspace,
      agentRuntimes,
    }: Pick<AiStudioSessionHydrationPayload, "workspace" | "agent" | "agentRuntimes">) => {
      if (workspace.expertCreateMode !== "pulse") return;
      const workspacePresetId = workspace.activePulsePresetId ?? null;
      const runtimePresetId = agentRuntimes.pulsePresetId ?? null;
      const hasAuthorizedPulseRuntime =
        Boolean(workspacePresetId) &&
        Boolean(workspace.pulseSessionInstanceId) &&
        runtimePresetId === workspacePresetId;
      const pulseRuntime: AiStudioSessionHydrationPayload["agentRuntimes"]["pulse"] =
        hasAuthorizedPulseRuntime
          ? agentRuntimes.pulse
          : {
              messages: [],
              input: "",
              latestAgentPrompt: null,
              promptOrigin: "manual",
              chatModeEnabled: true,
              pulseWorkflowSession: null,
            };
      replaceMessages(pulseRuntime.messages);
      setAgentInput(pulseRuntime.input);
      setAgentAttachments([]);
      setAgentAttachmentError(null);
      setLatestAgentPrompt(pulseRuntime.latestAgentPrompt);
      setPromptOrigin(pulseRuntime.promptOrigin);
      setWorkflowSession(pulseRuntime.pulseWorkflowSession ?? null);
    },
    [
      replaceMessages,
      setAgentAttachmentError,
      setAgentAttachments,
      setAgentInput,
      setWorkflowSession,
    ]
  );

  const resetProjectAgentConversation = useCallback(() => {
    resetAgentChat();
    resetAgentComposer({ preserveInput: false, preserveAttachments: false });
    setLatestAgentPrompt(null);
    setPromptOrigin("manual");
    setWorkflowSession(null);
    setAgentAttachmentError(null);
    setAgentAttachments([]);
  }, [
    resetAgentChat,
    resetAgentComposer,
    setAgentAttachmentError,
    setAgentAttachments,
    setWorkflowSession,
  ]);

  useEffect(() => {
    resetAgentComposer({ preserveInput: true, preserveAttachments: false });
  }, [mode, resetAgentComposer, selectedTool, sessionId]);

  return {
    kind: "pulse",
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
    workflowSession,
    latestAgentPrompt: effectiveLatestAgentPrompt,
    promptOrigin: effectivePromptOrigin,
    setPromptOrigin,
    persistedAgentRuntime,
    stagedAgentPrompt,
    isPromptRefining: false,
    isReferencePromptEnhancing: false,
    describeInFlightCount: 0,
    handleAgentInputChange,
    handleAgentSend,
    handlePulsePresetStart,
    handlePulsePresetRestart,
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
