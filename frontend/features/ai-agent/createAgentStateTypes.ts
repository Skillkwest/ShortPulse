/**
 * Shared hook-local types/constants for the Create agent state engine.
 */
import type {
  AgentActions,
  AgentApiRequest,
  AgentContext,
  AgentMessage,
  AgentPulseWorkflowSession,
  AgentResponse,
} from "../../prefabs/agent";
import type { StudioAgentTransportResult } from "./client/studioAgentTransport";

export type CreateAgentAssistantReply = {
  text: string;
  source?: string;
};

export type CreateAgentPromptArtifact = {
  text: string;
  source?: string;
} | null;

export type CreateAgentTransportSuccess = {
  actions: AgentActions | undefined;
  workflowSession: AgentPulseWorkflowSession | null;
  canonicalPrompt: string | null;
  assistantReply?: CreateAgentAssistantReply;
  promptArtifact?: CreateAgentPromptArtifact;
  assistantContent: string;
  assistantOutputPrompt: string | null;
};

export type CreateAgentStateOptions = {
  initialMessages?: AgentMessage[];
  enabled?: boolean;
  conversationId?: string;
  sessionNamespace?: string;
  sendAgentTurn?: (body: AgentApiRequest) => Promise<StudioAgentTransportResult>;
  resolveTransportSuccess?: (response: AgentResponse) => CreateAgentTransportSuccess;
};

export type SendParams = {
  text: string;
  payloadText?: string;
  previousPrompt?: string | null;
  context?: AgentContext;
  sessionNamespaceOverride?: string;
  isolateHistory?: boolean;
  skipUserEcho?: boolean;
  optimisticUserMessageId?: string | null;
};

export type SendResult = {
  response: AgentResponse | null;
  actions: AgentActions | undefined;
  workflowSession?: AgentPulseWorkflowSession | null;
  discarded?: boolean;
  errorText?: string | null;
  failureKind?: "transport_error";
};

// Stable default to prevent Fast Refresh issues.
export const EMPTY_MESSAGES: AgentMessage[] = [];
