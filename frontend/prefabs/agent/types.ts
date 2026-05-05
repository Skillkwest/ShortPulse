/**
 * Types for the AI Studio Agent collaboration layer.
 * Shared by UI prefabs, feature logic, and API handlers.
 */
import type { AgentDecision, AgentOutcomeClass, AgentReasonCode } from "./outcomeContract";

export type AgentMessageRole = "user" | "assistant" | "system" | "observation";
export type AgentApiMessageRole = "user" | "assistant";
export type AgentRuntimeMode = "standard" | "pulse";

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

export type AgentMessageAttachment = AgentAttachment;

export type AgentMessage = {
  id?: string;
  role: AgentMessageRole;
  content: string;
  attachments?: AgentMessageAttachment[];
  outputPrompt?: string | null;
  canUseAsPrompt?: boolean;
  outcomeClass?: AgentOutcomeClass | null;
  reasonCode?: AgentReasonCode | null;
  decision?: AgentDecision | null;
};

export type AgentAttachment = {
  id: string;
  kind: "image" | "prompt";
  referenceId?: string | null;
  text?: string | null;
  imageUrl?: string | null;
  imageFallbackUrls?: string[];
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

export type AgentPulseWorkflowStatus = "idle" | "running" | "awaiting_input" | "completed";

export type AgentPulseWorkflowSession = {
  presetId: string;
  status: AgentPulseWorkflowStatus;
  currentStepIndex?: number | null;
  currentStepLabel?: string | null;
  currentStepPrompt?: string | null;
  collectedInputs: string[];
  lastArtifact?: string | null;
  finalArtifactSource?: "apply_prompt" | "chat_reply" | null;
};

export type AgentPulseRuntimeContext = {
  presetId: string;
  label: string;
  instructions: string;
  description?: string | null;
  // Legacy persisted values may still arrive from older snapshots or saved presets.
  // Runtime boundaries normalize active Pulses to workflow_gpt / activate_and_start / chat_reply.
  runtimeMode?: "prompt_editor" | "workflow_gpt";
  activationMode?: "activate_only" | "activate_and_start";
  starterAssistantMessage?: string | null;
  workflowStageHints?: string[] | null;
  outputMode?: "apply_prompt" | "chat_reply";
  artifactTarget?: "image_prompt" | "video_prompt" | "storyboard" | "text_artifact";
  memoryPolicy?: "session";
  source?: "builtin" | "custom";
  workflowSession?: AgentPulseWorkflowSession | null;
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
  pulse?: AgentPulseRuntimeContext | null;
};

export type AgentApiContext = Omit<AgentContext, "media"> & {
  media?: AgentApiMediaPreview[];
};

export type AgentActions = {
  applyPrompt?: string | null;
};

export type AgentResponse = {
  message: string;
  actions?: AgentActions;
  workflowSession?: AgentPulseWorkflowSession | null;
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
  fallback_reason?: string;
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
  clientSessionNamespace?: string | null;
  runtimeMode?: AgentRuntimeMode;
  traceId?: string;
  /**
   * @deprecated Backward-compatibility alias for older clients.
   * Server ignores this when `clientSessionKey` is present.
   */
  conversationId?: string;
  canonicalPrompt?: string | null;
};
