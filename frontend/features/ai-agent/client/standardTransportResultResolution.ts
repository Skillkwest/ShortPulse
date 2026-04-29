/**
 * Standard Create response parser.
 * This module intentionally has no Pulse workflow-session handling.
 */
import type { AgentActions, AgentResponse } from "../../../prefabs/agent";
import { sanitizeGenerationPromptText } from "../../agent-core/promptText";
import { normalizeActions } from "./actionNormalizer";

export type StandardCreateAgentTransportSuccess = {
  actions: AgentActions | undefined;
  workflowSession: null;
  canonicalPrompt: string | null;
  assistantContent: string;
  assistantOutputPrompt: string | null;
};

export const resolveStandardCreateAgentTransportSuccess = (
  response: AgentResponse
): StandardCreateAgentTransportSuccess => {
  const actions = normalizeActions(response.actions);
  const canonicalPrompt = sanitizeGenerationPromptText(
    response.canonicalPrompt ?? actions?.applyPrompt ?? null
  );
  const applyPromptText = sanitizeGenerationPromptText(actions?.applyPrompt ?? null) ?? "";
  const messageText = typeof response.message === "string" ? response.message.trim() : "";
  return {
    actions,
    workflowSession: null,
    canonicalPrompt,
    assistantContent: applyPromptText || messageText,
    assistantOutputPrompt: applyPromptText || null,
  };
};
