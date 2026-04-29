/**
 * Shared hook-local types/constants for useAiAgent.
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

export type UseAiAgentOptions = {
  initialMessages?: AgentMessage[];
  enabled?: boolean;
  conversationId?: string;
  sessionNamespace?: string;
  directOpenAiBypassEnabled?: boolean;
  sendAgentTurn?: (body: AgentApiRequest) => Promise<StudioAgentTransportResult>;
  resolveTransportSuccess?: (response: AgentResponse) => {
    actions: AgentActions | undefined;
    workflowSession: AgentPulseWorkflowSession | null;
    canonicalPrompt: string | null;
    assistantContent: string;
    assistantOutputPrompt: string | null;
  };
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
