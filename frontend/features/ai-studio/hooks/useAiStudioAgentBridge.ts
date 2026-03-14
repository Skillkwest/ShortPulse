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
  trackAgentUiEvent: (message: string, data?: Record<string, unknown>) => void;
};

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
  trackAgentUiEvent,
}: UseAiStudioAgentBridgeParams) => {
  const agentFlag =
    process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === undefined ||
    process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === "true";
  const [agentSessionEnabled, setAgentSessionEnabled] = useState<boolean>(agentFlag);
  const agentEnabled = agentFlag && agentSessionEnabled;
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
    sessionNamespace: `ai-studio:${sessionId ?? "none"}:${selectedTool ?? "none"}:${mode}`,
  });

  const [agentUiBusy, setAgentUiBusy] = useState(false);
  const agentUiBusyRef = useRef(false);
  const agentBusy = agentIsSending || agentUiBusy;
  const [agentActions, setAgentActions] = useState<AgentActions | undefined>(undefined);
  const [isAgentChatOpen, setIsAgentChatOpen] = useState(false);
  const [latestAgentPrompt, setLatestAgentPrompt] = useState<string | null>(null);
  const [promptOrigin, setPromptOrigin] = useState<PromptOrigin>("manual");

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
    markAttachmentDelivery,
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
    handleAgentEnhanceSend,
    handleReferencePromptEnhance,
    handleAgentDescribeTargets,
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
    markAttachmentDelivery,
    prompt,
    latestAgentPrompt,
    setLatestAgentPrompt,
    setAgentActions,
    selectedTool,
    setSharedPrompt,
    setPromptOrigin,
    sendToAgent,
    appendUserMessage,
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
    handleAgentSelectVariation,
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
    setAgentInput,
    addAgentPromptReference,
    setIsAgentChatOpen,
    agentSessionEnabled,
    setAgentSessionEnabled,
    latestAgentPrompt,
    agentActions,
    resetAgentChat,
    resetAgentComposer,
    setAgentActions,
  });

  useEffect(() => {
    resetAgentComposer({ preserveInput: true, preserveAttachments: false });
    setLatestAgentPrompt(null);
    setPromptOrigin("manual");
    setAgentActions(undefined);
    setIsAgentChatOpen(false);
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
      setAgentActions(undefined);
      setAgentAttachmentError(null);
      setAgentAttachments([]);
    },
    [
      replaceMessages,
      setAgentInput,
      setPromptOrigin,
      setChatModeEnabled,
      setAgentAttachmentError,
      setAgentAttachments,
    ]
  );

  return {
    agentEnabled,
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
    handleAgentEnhanceSend,
    handleReferencePromptEnhance,
    handleAgentDescribeTargets,
    hydrateFromSessionAgentSnapshot,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleAgentAttachmentDrop,
    handleRemoveAgentAttachment,
    handleClearAgentAttachments,
    handleAgentApplyPrompt,
    handleAgentSelectVariation,
    handleAssistantMessageEdit,
    handleExpandChat,
    handleAgentAddToGrid,
    handleClearAgentChat,
    handleCloseAgentChat,
  };
};
