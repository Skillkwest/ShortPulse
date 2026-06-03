/**
 * Standard Create response contract.
 * Separates the visible assistant reply from any optional prompt artifact while
 * preserving the existing compatibility fields used by the shared agent state core.
 */
import type { AgentActions, AgentResponse } from "../../../prefabs/agent";
import { normalizeActions } from "./actionNormalizer";

export type StandardCreateAssistantReply = {
  text: string;
  source: "message" | "prompt_artifact_fallback";
};

export type StandardCreatePromptArtifact = {
  text: string;
  source: "apply_prompt";
};

export type StandardCreateResponseContract = {
  actions: AgentActions | undefined;
  workflowSession: null;
  conversationState: AgentResponse["conversationState"] | null;
  canonicalPrompt: string | null;
  assistantReply: StandardCreateAssistantReply;
  promptArtifact: StandardCreatePromptArtifact | null;
  assistantContent: string;
  assistantOutputPrompt: string | null;
};

const normalizeMessageText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const shouldExposePromptArtifact = ({
  response,
  normalizedApplyPrompt,
}: {
  response: AgentResponse;
  normalizedApplyPrompt: string;
}): boolean =>
  normalizedApplyPrompt.length > 0 &&
  (response.outcome_class === "success_prompt" ||
    response.reason_code === "SUCCESS_PROMPT" ||
    response.outcome_class == null);

/**
 * Resolve the Standard assistant reply and optional prompt artifact from one transport payload.
 */
export const resolveStandardCreateResponseContract = (
  response: AgentResponse
): StandardCreateResponseContract => {
  const actions = normalizeActions(response.actions);
  const messageText = normalizeMessageText(response.message);
  const normalizedApplyPrompt = actions?.applyPrompt?.trim() ?? "";
  const promptArtifactText = shouldExposePromptArtifact({ response, normalizedApplyPrompt })
    ? normalizedApplyPrompt
    : "";

  const assistantReply =
    messageText.length > 0
      ? {
          text: messageText,
          source: "message" as const,
        }
      : {
          text: promptArtifactText,
          source: "prompt_artifact_fallback" as const,
        };

  const promptArtifact =
    promptArtifactText.length > 0
      ? {
          text: promptArtifactText,
          source: "apply_prompt" as const,
        }
      : null;

  return {
    actions,
    workflowSession: null,
    conversationState: response.conversationState ?? null,
    canonicalPrompt: null,
    assistantReply,
    promptArtifact,
    // Compatibility bridge for the shared agent state core.
    assistantContent: assistantReply.text,
    assistantOutputPrompt: promptArtifact?.text ?? null,
  };
};
