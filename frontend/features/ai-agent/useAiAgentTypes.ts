/**
 * Shared hook-local types/constants for useAiAgent.
 */
import type {
  AgentActions,
  AgentContext,
  AgentMessage,
  AgentPulseWorkflowSession,
  AgentResponse,
  AgentRuntimeMode,
} from "../../prefabs/agent";

export type UseAiAgentOptions = {
  initialMessages?: AgentMessage[];
  enabled?: boolean;
  conversationId?: string;
  sessionNamespace?: string;
  directOpenAiBypassEnabled?: boolean;
  runtimeMode?: AgentRuntimeMode;
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
