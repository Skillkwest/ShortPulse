/**
 * Shared types for AI Studio agent orchestration hooks.
 * Keeps high-churn hook modules focused on behavior orchestration.
 */
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  AgentActions,
  AgentAttachment,
  AgentContext,
  AgentMessage,
} from "../../../../prefabs/agent";
import type { PromptOrigin } from "../../logic/agentPromptOwnership";
import type { StudioOutput, ToolId } from "../../types";

export type AgentModeHint = "chat" | "text" | "describe" | "reference";

export type AgentSendOptions = {
  captureResult?: boolean;
  selectedOverride?: StudioOutput | null;
  modeHint?: AgentModeHint;
};

export type UseAiStudioAgentOrchestrationParams = {
  agentIsSending: boolean;
  agentUiBusyRef: MutableRefObject<boolean>;
  setAgentUiBusy: Dispatch<SetStateAction<boolean>>;
  agentSessionEnabled: boolean;
  setAgentSessionEnabled: Dispatch<SetStateAction<boolean>>;
  agentInput: string;
  setAgentInput: Dispatch<SetStateAction<string>>;
  agentAttachments: AgentAttachment[];
  setAgentAttachments: Dispatch<SetStateAction<AgentAttachment[]>>;
  setAgentAttachmentError: Dispatch<SetStateAction<string | null>>;
  prompt: string;
  latestAgentPrompt: string | null;
  setLatestAgentPrompt: Dispatch<SetStateAction<string | null>>;
  setAgentActions: Dispatch<SetStateAction<AgentActions | undefined>>;
  selectedTool: ToolId | null;
  setSharedPrompt: (value: string) => void;
  setPromptOrigin: Dispatch<SetStateAction<PromptOrigin>>;
  sendToAgent: (params: {
    text: string;
    payloadText?: string;
    previousPrompt?: string | null;
    context?: AgentContext;
    skipUserEcho?: boolean;
    optimisticUserMessageId?: string | null;
  }) => Promise<{ response: unknown; actions: AgentActions | undefined }>;
  appendUserMessage: (text: string, attachments?: AgentAttachment[]) => string | null;
  updateMessageById: (
    messageId: string,
    updater: (message: AgentMessage) => AgentMessage
  ) => boolean;
  getAgentContext: (params: {
    lastAssistantMessage: string | null;
    selectedOverride?: StudioOutput | null;
    modeHint?: AgentModeHint;
  }) => AgentContext;
  trackAgentUiEvent: (message: string, data?: Record<string, unknown>) => void;
  addAgentPromptReference: (promptText: string, title?: string) => void;
  editReferenceText: string;
  setEditReferenceText: (value: string) => void;
  videoReferenceText: string;
  setVideoReferenceText: (value: string) => void;
  getOutputById: (id: string) => StudioOutput | null;
  aspect: string;
  model: string | null;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setActiveOutputId: Dispatch<SetStateAction<string | null>>;
  lastAssistantMessage: string | null;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
};
