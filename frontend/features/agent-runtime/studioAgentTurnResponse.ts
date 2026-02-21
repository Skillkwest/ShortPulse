import type { AgentContext, AgentMessage, AgentResponse } from "../../prefabs/agent";
import { resolveCanonicalPrompt } from "../ai-agent/logic/studioAgentCanonical";
import { sanitizeGenerationPromptText } from "../agent-core/promptText";
import {
  ensureStudioAgentApplyPromptContract,
  isStudioAgentRefusalResponse,
} from "./studioAgentResponseNormalization";

export const resolveStudioAgentTurnResponse = ({
  parsed,
  semanticStatus,
  nextCanonical,
  effectiveCanonical,
  context,
  messages,
}: {
  parsed: AgentResponse;
  semanticStatus: string | null;
  nextCanonical: string | null;
  effectiveCanonical: string | null;
  context: AgentContext;
  messages: AgentMessage[];
}): {
  parsed: AgentResponse;
  refusal: boolean;
  resolvedCanonical: string | null;
} => {
  const refusal = isStudioAgentRefusalResponse({
    status: semanticStatus,
    response: parsed,
  });

  if (refusal) {
    parsed = {
      message: parsed.message?.trim() || "I cannot help with that request.",
      actions: undefined,
    };
  } else {
    const fallbackPrompt =
      sanitizeGenerationPromptText(
        nextCanonical ??
          effectiveCanonical ??
          context.activePrompt ??
          messages[messages.length - 1]?.content ??
          ""
      ) ?? "";
    parsed = ensureStudioAgentApplyPromptContract({ parsed, fallbackPrompt });
  }

  const resolvedCanonical = refusal
    ? effectiveCanonical
    : resolveCanonicalPrompt(parsed.actions?.applyPrompt, nextCanonical, effectiveCanonical);

  return { parsed, refusal, resolvedCanonical };
};
