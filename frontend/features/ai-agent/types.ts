/**
 * Types for the AI Studio Agent collaboration layer.
 * Kept small so UI/state modules can reuse them without tight coupling.
 */
export type AgentMessageRole = "user" | "assistant" | "system" | "observation";

export type AgentMessage = {
  id?: string;
  role: AgentMessageRole;
  content: string;
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
  mode?: "enhance" | "image" | "video";
  references?: AgentReferenceSummary[];
  media?: AgentMediaPreview[];
  creditBalance?: number | null;
  selectedReferenceIds?: string[];
  focusedSource?: "image" | "prompt" | "agent-output";
  focusedReferenceId?: string | null;
  lastAssistantMessage?: string | null;
  modeHint?: "chat" | "enhance" | "describe";
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
};

export type AgentApiRequest = {
  messages: AgentMessage[];
  context?: AgentContext;
  conversationId?: string;
};
