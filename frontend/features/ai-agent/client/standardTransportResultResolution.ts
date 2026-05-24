/**
 * Standard Create response parser.
 * This module intentionally has no Pulse workflow-session handling.
 */
import type { AgentActions, AgentResponse } from "../../../prefabs/agent";
import { sanitizeGenerationPromptText } from "../../agent-core/promptText";
import { normalizeActions } from "./actionNormalizer";

export type StandardCreateAgentTransportSuccess = {
  actions: AgentActions | undefined;
  canonicalPrompt: string | null;
  assistantContent: string;
  assistantOutputPrompt: string | null;
};

export const resolveStandardCreateAgentTransportSuccess = (
  response: AgentResponse
): StandardCreateAgentTransportSuccess => {
  const actions = normalizeActions(response.actions);
  const canonicalPrompt = sanitizeGenerationPromptText(response.canonicalPrompt ?? null);
  const rawMessageText = typeof response.message === "string" ? response.message : "";
  const hasRawMessageText = rawMessageText.trim().length > 0;
  return {
    actions,
    canonicalPrompt,
    assistantContent: hasRawMessageText ? rawMessageText : "",
    assistantOutputPrompt: null,
  };
};
