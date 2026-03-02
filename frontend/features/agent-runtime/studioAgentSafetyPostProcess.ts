import { STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE } from "./studioAgentRouteOutcomes";
import { resolveSafetyModality } from "./safetyPolicy/decisionEngine";
import type {
  SafetyEnvironment,
  SafetyModality,
  SafetyPolicyDocumentV2,
  SafetyPostprocessMode,
} from "./safetyPolicy/types";
import {
  evaluateStudioAgentSafetyText,
  normalizeStudioAgentSafetyText,
  rewriteStudioAgentSafetyTextDeterministic,
  type StudioAgentSafetyDecisionMeta,
} from "./safetyPolicy/textSafetyEvaluator";

export type { StudioAgentSafetyDecisionMeta } from "./safetyPolicy/textSafetyEvaluator";

export type StudioAgentSafetyPostProcessOutcome = "pass" | "rewritten" | "refusal";
export type StudioAgentSafetyPostProcessSource = "model_output" | "describe_output";

export type StudioAgentSafetyPostProcessResult = {
  outcome: StudioAgentSafetyPostProcessOutcome;
  text: string;
  fallbackUsed: boolean;
  shadowWouldBlock?: boolean;
  debugReason?: string;
  decision?: StudioAgentSafetyDecisionMeta;
};

const DEFAULT_REWRITE_TIMEOUT_MS = 1200;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  await new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error("rewrite_timeout")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });

const maybeExternalRewrite = async ({
  text,
  route,
  flow,
  source,
  traceId,
  rewrite,
  timeoutMs,
}: {
  text: string;
  route: "studio-agent" | "describe-image";
  flow: string;
  source: StudioAgentSafetyPostProcessSource;
  traceId?: string;
  rewrite?: (args: {
    text: string;
    route: "studio-agent" | "describe-image";
    flow: string;
    source: StudioAgentSafetyPostProcessSource;
    traceId?: string;
  }) => Promise<string | null>;
  timeoutMs?: number;
}): Promise<string | null> => {
  if (!rewrite) return null;
  try {
    const rewritten = await withTimeout(
      rewrite({ text, route, flow, source, traceId }),
      timeoutMs ?? DEFAULT_REWRITE_TIMEOUT_MS
    );
    if (typeof rewritten !== "string") return null;
    const normalized = normalizeStudioAgentSafetyText(rewritten);
    return normalized.length ? normalized : null;
  } catch {
    return null;
  }
};

export const postProcessStudioAgentSafetyText = async ({
  text,
  route,
  flow = "unknown",
  source,
  mode,
  debug = false,
  traceId,
  rewrite,
  rewriteTimeoutMs,
  profileId,
  environment,
  devAbsoluteZeroEnabled = false,
  modality,
  policyDocument,
}: {
  text: string | null | undefined;
  route: "studio-agent" | "describe-image";
  flow?: string;
  source: StudioAgentSafetyPostProcessSource;
  mode: SafetyPostprocessMode;
  debug?: boolean;
  traceId?: string;
  rewrite?: (args: {
    text: string;
    route: "studio-agent" | "describe-image";
    flow: string;
    source: StudioAgentSafetyPostProcessSource;
    traceId?: string;
  }) => Promise<string | null>;
  rewriteTimeoutMs?: number;
  profileId?: string | null;
  environment?: SafetyEnvironment;
  devAbsoluteZeroEnabled?: boolean;
  modality?: SafetyModality;
  policyDocument?: SafetyPolicyDocumentV2 | null;
}): Promise<StudioAgentSafetyPostProcessResult> => {
  const normalized = normalizeStudioAgentSafetyText(typeof text === "string" ? text : "");
  if (mode === "off" || !normalized.length) {
    return { outcome: "pass", text: normalized, fallbackUsed: false };
  }
  const resolvedEnvironment: SafetyEnvironment =
    environment ?? (process.env.NODE_ENV === "production" ? "production" : "development");
  const resolvedModality = modality ?? resolveSafetyModality({ route, flow });

  const initialEvaluation = evaluateStudioAgentSafetyText({
    text: normalized,
    modality: resolvedModality,
    profileId,
    environment: resolvedEnvironment,
    devAbsoluteZeroEnabled,
    refusalMessage: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
    policyDocument,
  });
  const initialDecisionMeta = initialEvaluation.decision;
  if (initialDecisionMeta.action === "allow") {
    return {
      outcome: "pass",
      text: normalized,
      fallbackUsed: false,
      decision: initialDecisionMeta,
    };
  }
  if (initialDecisionMeta.action === "refuse") {
    if (mode === "shadow") {
      return {
        outcome: "pass",
        text: normalized,
        fallbackUsed: false,
        shadowWouldBlock: true,
        debugReason: debug ? "shadow_classification_refusal" : undefined,
        decision: initialDecisionMeta,
      };
    }
    return {
      outcome: "refusal",
      text: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
      fallbackUsed: false,
      debugReason: debug ? "classification_refusal" : undefined,
      decision: initialDecisionMeta,
    };
  }

  const externalRewrite = await maybeExternalRewrite({
    text: normalized,
    route,
    flow,
    source,
    traceId,
    rewrite,
    timeoutMs: rewriteTimeoutMs,
  });
  let fallbackUsed = false;
  let rewritten = externalRewrite;
  if (!rewritten) {
    rewritten = rewriteStudioAgentSafetyTextDeterministic(normalized);
    fallbackUsed = true;
  }

  const rewrittenEvaluation = evaluateStudioAgentSafetyText({
    text: rewritten,
    modality: resolvedModality,
    profileId,
    environment: resolvedEnvironment,
    devAbsoluteZeroEnabled,
    refusalMessage: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
    policyDocument,
  });
  const rewrittenDecisionMeta = rewrittenEvaluation.decision;
  if (rewrittenDecisionMeta.action === "allow") {
    if (mode === "shadow") {
      return {
        outcome: "pass",
        text: normalized,
        fallbackUsed,
        shadowWouldBlock: true,
        debugReason: debug ? "shadow_rewritten_safe" : undefined,
        decision: rewrittenDecisionMeta,
      };
    }
    return {
      outcome: "rewritten",
      text: rewritten,
      fallbackUsed,
      debugReason: debug ? "rewritten_safe" : undefined,
      decision: rewrittenDecisionMeta,
    };
  }

  if (rewrittenDecisionMeta.action === "rewrite") {
    const secondPass = rewriteStudioAgentSafetyTextDeterministic(rewritten);
    fallbackUsed = true;
    const secondEvaluation = evaluateStudioAgentSafetyText({
      text: secondPass,
      modality: resolvedModality,
      profileId,
      environment: resolvedEnvironment,
      devAbsoluteZeroEnabled,
      refusalMessage: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
      policyDocument,
    });
    const secondDecisionMeta = secondEvaluation.decision;
    if (secondDecisionMeta.action === "allow") {
      if (mode === "shadow") {
        return {
          outcome: "pass",
          text: normalized,
          fallbackUsed,
          shadowWouldBlock: true,
          debugReason: debug ? "shadow_rewritten_safe_second_pass" : undefined,
          decision: secondDecisionMeta,
        };
      }
      return {
        outcome: "rewritten",
        text: secondPass,
        fallbackUsed,
        debugReason: debug ? "rewritten_safe_second_pass" : undefined,
        decision: secondDecisionMeta,
      };
    }
    if (mode === "shadow") {
      return {
        outcome: "pass",
        text: normalized,
        fallbackUsed: true,
        shadowWouldBlock: true,
        debugReason: debug ? "shadow_rewrite_refusal_fallback" : undefined,
        decision: secondDecisionMeta,
      };
    }
    return {
      outcome: "refusal",
      text: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
      fallbackUsed: true,
      debugReason: debug ? "rewrite_refusal_fallback" : undefined,
      decision: secondDecisionMeta,
    };
  }

  if (mode === "shadow") {
    return {
      outcome: "pass",
      text: normalized,
      fallbackUsed: true,
      shadowWouldBlock: true,
      debugReason: debug ? "shadow_rewrite_refusal_fallback" : undefined,
      decision: rewrittenDecisionMeta,
    };
  }
  return {
    outcome: "refusal",
    text: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
    fallbackUsed: true,
    debugReason: debug ? "rewrite_refusal_fallback" : undefined,
    decision: rewrittenDecisionMeta,
  };
};
