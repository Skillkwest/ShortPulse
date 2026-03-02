/**
 * Prompt-adjacency helpers for AI Studio.
 * Keeps chat-off prompt routing and agent-output generate request parsing deterministic.
 */
import type { AgentOutputGenerateInput, AgentOutputGenerateRequest } from "../../ai-agent/types";
import { normalizePromptText } from "./agentPromptOwnership";

type ResolveChatOffCreatePromptParams = {
  agentInput: string;
  sharedPrompt: string;
  allowSharedPromptFallback: boolean;
};

const isAgentOutputPromptSource = (value: unknown): value is AgentOutputGenerateRequest["source"] =>
  value === "history" || value === "staged";

/**
 * Resolves the prompt used for chat-off create submits.
 */
export const resolveChatOffCreatePrompt = ({
  agentInput,
  sharedPrompt,
  allowSharedPromptFallback,
}: ResolveChatOffCreatePromptParams): string | null => {
  const trimmedAgentInput = agentInput.trim();
  if (trimmedAgentInput) return trimmedAgentInput;
  if (!allowSharedPromptFallback) return null;

  const trimmedSharedPrompt = sharedPrompt.trim();
  return trimmedSharedPrompt || null;
};

/**
 * Normalizes incoming generate requests from agent-output surfaces.
 */
export const normalizeAgentOutputGenerateRequest = (
  input: AgentOutputGenerateInput
): AgentOutputGenerateRequest | null => {
  if (typeof input === "string") {
    const legacyPrompt = normalizePromptText(input);
    if (!legacyPrompt) return null;
    return {
      messageId: "legacy-agent-output",
      prompt: legacyPrompt,
      source: "history",
    };
  }

  if (!input || typeof input !== "object") return null;

  const normalizedPrompt = normalizePromptText(input.prompt);
  const messageId = typeof input.messageId === "string" ? input.messageId.trim() : "";
  if (!normalizedPrompt || !messageId) return null;

  return {
    messageId,
    prompt: normalizedPrompt,
    source: isAgentOutputPromptSource(input.source) ? input.source : "history",
  };
};
