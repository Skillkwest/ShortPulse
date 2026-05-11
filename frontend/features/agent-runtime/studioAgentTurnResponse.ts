import type { AgentContext, AgentMessage, AgentResponse } from "../../prefabs/agent";
import { resolveCanonicalPrompt } from "../ai-agent/logic/studioAgentCanonical";
import { sanitizeGenerationPromptText } from "../agent-core/promptText";
import {
  ensureStudioAgentApplyPromptContract,
  isStudioAgentRefusalResponse,
} from "./studioAgentResponseNormalization";
import { STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE } from "./studioAgentRouteOutcomes";

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
  const pulseActive = Boolean(context.pulse);
  const workflowPulseActive =
    context.pulse?.runtimeMode === "workflow_gpt" || context.pulse?.pulseKind === "guided_workflow";
  const customPulseReadyForArtifact =
    pulseActive && !workflowPulseActive && semanticStatus?.toLowerCase() === "ready";

  if (refusal) {
    parsed = {
      message: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
      actions: undefined,
    };
  } else if (customPulseReadyForArtifact) {
    parsed = ensureStudioAgentApplyPromptContract({
      parsed,
      fallbackPrompt:
        sanitizeGenerationPromptText(nextCanonical ?? effectiveCanonical ?? null) ??
        sanitizeGenerationPromptText(parsed.message ?? null) ??
        "",
    });
  } else if (pulseActive) {
    const displayMessage = typeof parsed.message === "string" ? parsed.message.trim() : "";
    parsed.message =
      displayMessage ||
      sanitizeGenerationPromptText(nextCanonical ?? effectiveCanonical ?? null) ||
      "";
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
    : pulseActive
      ? resolveCanonicalPrompt(
          parsed.actions?.applyPrompt ?? null,
          customPulseReadyForArtifact ? nextCanonical : null,
          effectiveCanonical
        )
      : resolveCanonicalPrompt(parsed.actions?.applyPrompt, nextCanonical, effectiveCanonical);

  return { parsed, refusal, resolvedCanonical };
};
