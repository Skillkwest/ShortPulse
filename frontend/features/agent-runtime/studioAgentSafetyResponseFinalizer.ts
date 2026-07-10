/**
 * Shared output-safety finalizer for Standard and Pulse agent responses.
 * It owns safety text processing only; workflow, persistence, and route envelopes stay mode-owned.
 */
import type { AgentResponse } from "../../prefabs/agent";
import {
  postProcessStudioAgentSafetyText,
  type StudioAgentSafetyDecisionMeta,
  type StudioAgentSafetyPostProcessOutcome,
  type StudioAgentSafetyRoute,
} from "./studioAgentSafetyPostProcess";
import { STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE } from "./studioAgentRouteOutcomes";
import type {
  SafetyEnvironment,
  SafetyModality,
  SafetyPolicyDocumentV2,
  SafetyPostprocessMode,
} from "./safetyPolicy/types";

export type StudioAgentSafetyFinalization = {
  response: AgentResponse;
  refusal: boolean;
  canonicalPrompt: string | null;
  outcome: StudioAgentSafetyPostProcessOutcome;
  fallbackUsed: boolean;
  forcedRefusal: boolean;
  debugReason?: string;
  decisionAction: StudioAgentSafetyDecisionMeta["action"] | null;
  decisionCategory: StudioAgentSafetyDecisionMeta["category"] | null;
  decisionSource: StudioAgentSafetyDecisionMeta["source"] | null;
  hardFloorViolation: boolean;
};

const mergeOutcome = (
  current: StudioAgentSafetyPostProcessOutcome,
  next: StudioAgentSafetyPostProcessOutcome
): StudioAgentSafetyPostProcessOutcome => {
  if (current === "refusal" || next === "refusal") return "refusal";
  if (current === "rewritten" || next === "rewritten") return "rewritten";
  return "pass";
};

/** Applies the active output policy to prompt artifacts and visible assistant text. */
export const finalizeStudioAgentResponseSafety = async ({
  response,
  refusal,
  canonicalPrompt,
  fallbackCanonicalPrompt,
  route,
  flow,
  mode,
  debug,
  traceId,
  profileId,
  environment,
  devAbsoluteZeroEnabled,
  modality,
  policyDocument,
}: {
  response: AgentResponse;
  refusal: boolean;
  canonicalPrompt: string | null;
  fallbackCanonicalPrompt: string | null;
  route: StudioAgentSafetyRoute;
  flow: string;
  mode: SafetyPostprocessMode;
  debug: boolean;
  traceId?: string;
  profileId?: string | null;
  environment: SafetyEnvironment;
  devAbsoluteZeroEnabled: boolean;
  modality: SafetyModality;
  policyDocument: SafetyPolicyDocumentV2;
}): Promise<StudioAgentSafetyFinalization> => {
  let finalResponse = response;
  let finalRefusal = refusal;
  let finalCanonicalPrompt = canonicalPrompt;
  let outcome: StudioAgentSafetyPostProcessOutcome = "pass";
  let fallbackUsed = false;
  let forcedRefusal = false;
  let debugReason: string | undefined;
  let decisionAction: StudioAgentSafetyDecisionMeta["action"] | null = null;
  let decisionCategory: StudioAgentSafetyDecisionMeta["category"] | null = null;
  let decisionSource: StudioAgentSafetyDecisionMeta["source"] | null = null;
  let hardFloorViolation = false;

  const register = (result: Awaited<ReturnType<typeof postProcessStudioAgentSafetyText>>) => {
    outcome = mergeOutcome(outcome, result.outcome);
    fallbackUsed = fallbackUsed || result.fallbackUsed;
    debugReason = debug && result.debugReason ? result.debugReason : debugReason;
    if (!result.decision) return;
    if (result.decision.action !== "allow" || !decisionAction) {
      decisionAction = result.decision.action;
    }
    if (result.decision.category !== "safe" || !decisionCategory) {
      decisionCategory = result.decision.category;
    }
    if (result.decision.source !== "profile" || !decisionSource) {
      decisionSource = result.decision.source;
    }
    hardFloorViolation = hardFloorViolation || result.decision.hardFloorViolation;
  };

  if (!finalRefusal && mode !== "off") {
    const applyPrompt = finalResponse.actions?.applyPrompt?.trim() ?? "";
    if (applyPrompt) {
      const result = await postProcessStudioAgentSafetyText({
        text: applyPrompt,
        route,
        flow,
        source: "model_output",
        mode,
        debug,
        traceId,
        profileId,
        environment,
        devAbsoluteZeroEnabled,
        modality,
        policyDocument,
      });
      register(result);
      if (result.outcome === "refusal") {
        finalRefusal = true;
        forcedRefusal = true;
      } else if (result.outcome === "rewritten") {
        finalResponse = {
          ...finalResponse,
          actions: { ...(finalResponse.actions ?? {}), applyPrompt: result.text },
        };
        finalCanonicalPrompt = result.text;
      }
    }

    if (!finalRefusal) {
      const result = await postProcessStudioAgentSafetyText({
        text: finalResponse.message,
        route,
        flow,
        source: "model_output",
        mode,
        debug,
        traceId,
        profileId,
        environment,
        devAbsoluteZeroEnabled,
        modality,
        policyDocument,
      });
      register(result);
      if (result.outcome === "refusal") {
        finalRefusal = true;
        forcedRefusal = true;
      } else if (result.outcome === "rewritten") {
        finalResponse = { ...finalResponse, message: result.text };
      }
    }
  }

  if (finalRefusal && forcedRefusal) {
    finalResponse = { message: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE, actions: undefined };
    finalCanonicalPrompt = fallbackCanonicalPrompt;
  }

  return {
    response: finalResponse,
    refusal: finalRefusal,
    canonicalPrompt: finalCanonicalPrompt,
    outcome,
    fallbackUsed,
    forcedRefusal,
    debugReason,
    decisionAction,
    decisionCategory,
    decisionSource,
    hardFloorViolation,
  };
};
