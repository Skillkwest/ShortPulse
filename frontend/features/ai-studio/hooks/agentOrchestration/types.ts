/**
 * Shared types for AI Studio agent orchestration hooks.
 * Keeps high-churn hook modules focused on behavior orchestration.
 */
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  AgentActions,
  AgentApiMessage,
  AgentAttachment,
  AgentContext,
  AgentMessage,
  AgentResponse,
  AgentPulseWorkflowSession,
} from "../../../../prefabs/agent";
import type { PromptOrigin } from "../../logic/agentPromptOwnership";
import type { StudioOutput, ToolId } from "../../types";
import type { CreateAgentOrchestrationRuntimePolicy } from "./createAgentOrchestrationRuntimePolicy";

export type AgentModeHint = "chat" | "text" | "describe" | "reference";

export type AgentSendOptions = {
  captureResult?: boolean;
  selectedOverride?: StudioOutput | null;
  modeHint?: AgentModeHint;
};

export type AgentSendToAgent = (params: {
  text: string;
  payloadText?: string;
  previousPrompt?: string | null;
  memoryMessages?: AgentApiMessage[];
  context?: AgentContext;
  sessionNamespaceOverride?: string;
  isolateHistory?: boolean;
  skipUserEcho?: boolean;
  optimisticUserMessageId?: string | null;
}) => Promise<{
  response: AgentResponse | null;
  actions: AgentActions | undefined;
  workflowSession?: AgentPulseWorkflowSession | null;
  discarded?: boolean;
  errorText?: string | null;
  failureKind?: "transport_error";
}>;

export type UseAiStudioAgentOrchestrationParams = {
  agentIsSending: boolean;
  agentBootstrapReady: boolean;
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
  setPulseWorkflowSession: Dispatch<SetStateAction<AgentPulseWorkflowSession | null>>;
  selectedTool: ToolId | null;
  setSharedPrompt: (value: string) => void;
  setPromptOrigin: Dispatch<SetStateAction<PromptOrigin>>;
  sendToAgent: AgentSendToAgent;
  appendUserMessage: (text: string, attachments?: AgentAttachment[]) => string | null;
  updateMessageById: (
    messageId: string,
    updater: (message: AgentMessage) => AgentMessage
  ) => boolean;
  removeMessageById: (messageId: string) => boolean;
  getAgentContext: (params: {
    lastAssistantMessage: string | null;
    selectedOverride?: StudioOutput | null;
    modeHint?: AgentModeHint;
    includeActiveOutput?: boolean;
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
  runtimePolicy: CreateAgentOrchestrationRuntimePolicy;
  resolvePulseSessionNamespace?: (presetId: string, pulseSessionInstanceId?: string) => string;
};
