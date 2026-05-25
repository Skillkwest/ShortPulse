/**
 * Standard Create response parser.
 * This module intentionally has no Pulse workflow-session handling.
 */
import type { AgentActions, AgentResponse } from "../../../prefabs/agent";
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
  const rawMessageText = typeof response.message === "string" ? response.message : "";
  const hasRawMessageText = rawMessageText.trim().length > 0;
  const shouldExposePromptOutput =
    response.outcome_class === "success_prompt" ||
    response.reason_code === "SUCCESS_PROMPT" ||
    (response.outcome_class == null && Boolean(actions?.applyPrompt?.trim()));
  const promptOutputText = shouldExposePromptOutput
    ? actions?.applyPrompt?.trim() || (hasRawMessageText ? rawMessageText.trim() : "")
    : "";
  return {
    actions,
    canonicalPrompt: null,
    assistantContent: hasRawMessageText ? rawMessageText : promptOutputText,
    assistantOutputPrompt: promptOutputText || null,
  };
};
