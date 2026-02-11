/**
 * Types for the AI Studio Agent collaboration layer.
 * Shared by UI prefabs, feature logic, and API handlers.
 */
export type AgentMessageRole = "user" | "assistant" | "system" | "observation";

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

export type AgentActions = {
  applyPrompt?: string | null;
  variations?: string[];
  describeTargets?: string[];
  questions?: string[];
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
  canonicalPrompt?: string | null;
};

export type AgentApiRequest = {
  messages: AgentMessage[];
  context?: AgentContext;
  conversationId?: string;
  canonicalPrompt?: string | null;
};
