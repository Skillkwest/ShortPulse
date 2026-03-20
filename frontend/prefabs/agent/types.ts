/**
 * Types for the AI Studio Agent collaboration layer.
 * Shared by UI prefabs, feature logic, and API handlers.
 */
import type { AgentDecision, AgentOutcomeClass, AgentReasonCode } from "./outcomeContract";

export type AgentMessageRole = "user" | "assistant" | "system" | "observation";
export type AgentApiMessageRole = "user" | "assistant";

export type AgentAttachmentDeliveryStatus = "pending" | "preparing" | "ready" | "failed";

export type AgentOutputPromptSource = "history" | "staged";

export type AgentOutputGenerateRequest = {
  messageId: string;
  prompt: string;
  source: AgentOutputPromptSource;
};

export type AgentOutputGenerateInput = AgentOutputGenerateRequest | string;

export type AgentOutputBubbleMediaState = {
  outputId?: string;
  thumbnailUrl?: string | null;
  state: "idle" | "pending" | "ready" | "failed";
};

export type AgentAssistantMessageEditRequest = {
  messageId: string;
  content: string;
};

export type AgentMessage = {
  id?: string;
  role: AgentMessageRole;
  content: string;
};

export type AgentAttachment = {
  id: string;
  kind: "image" | "prompt";
  referenceId?: string | null;
  text?: string | null;
  imageUrl?: string | null;
  aspect?: string | null;
  deliveryStatus?: AgentAttachmentDeliveryStatus;
  deliveryError?: string | null;
};

export type AgentReferenceSummary = {
  id: string;
  kind: "image" | "video" | "prompt";
  promptSnippet?: string | null;
  aspect?: string | null;
  caption?: string | null;
};

export type AgentMediaPreview = {
  id: string;
  kind: "image" | "video";
  dataUrl?: string;
  url?: string;
  thumbnailAlt?: string | null;
};

export type AgentApiMediaPreview = {
  id: string;
  kind: "image";
  url: string;
  thumbnailAlt?: string | null;
};

export type AgentContext = {
  activePrompt?: string | null;
  modelId?: string | null;
  mode?: "text" | "image" | "video";
  references?: AgentReferenceSummary[];
  media?: AgentMediaPreview[];
  creditBalance?: number | null;
  selectedReferenceIds?: string[];
  focusedSource?: "image" | "prompt" | "agent-output";
  focusedReferenceId?: string | null;
  lastAssistantMessage?: string | null;
  modeHint?: "chat" | "text" | "describe" | "reference";
};

export type AgentApiContext = Omit<AgentContext, "media"> & {
  media?: AgentApiMediaPreview[];
};

export type AgentActions = {
  applyPrompt?: string | null;
  variations?: string[];
  describeTargets?: string[];
  referenceCard?: {
    title?: string;
    prompt: string;
  };
};

export type AgentResponse = {
  message: string;
  actions?: AgentActions;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  /**
   * Additive machine-readable outcome fields.
   * During rollout, callers should prefer these fields when present and
   * gracefully fallback to legacy message/error heuristics when absent.
   */
  decision?: AgentDecision;
  outcome_class?: AgentOutcomeClass;
  reason_code?: AgentReasonCode;
  retryable?: boolean;
  canonicalPrompt?: string | null;
  traceId?: string;
};

export type AgentApiMessage = {
  role: AgentApiMessageRole;
  content: string;
};

export type AgentApiRequest = {
  messages: AgentApiMessage[];
  context?: AgentApiContext;
  clientSessionKey: string;
  traceId?: string;
  /**
   * @deprecated Backward-compatibility alias for older clients.
   * Server ignores this when `clientSessionKey` is present.
   */
  conversationId?: string;
  canonicalPrompt?: string | null;
};
