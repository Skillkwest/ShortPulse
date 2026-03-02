import { STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE } from "./studioAgentRouteOutcomes";
import { resolveSafetyDecision, resolveSafetyModality } from "./safetyPolicy/decisionEngine";
import type {
  SafetyCategoryId,
  SafetyEnvironment,
  SafetyModality,
  SafetyPolicyAction,
  SafetyProfileId,
} from "./safetyPolicy/types";

type StudioAgentSafetyClassification = "safe" | "needs_rewrite" | "refuse";

export type StudioAgentSafetyPostProcessOutcome = "pass" | "rewritten" | "refusal";
export type StudioAgentSafetyPostProcessSource = "model_output" | "describe_output";
export type StudioAgentSafetyDecisionMeta = {
  profileId: SafetyProfileId;
  modality: SafetyModality;
  category: SafetyCategoryId;
  action: SafetyPolicyAction;
  source: "profile" | "hard_floor" | "absolute_zero";
  hardFloorViolation: boolean;
};

export type StudioAgentSafetyPostProcessResult = {
  outcome: StudioAgentSafetyPostProcessOutcome;
  text: string;
  fallbackUsed: boolean;
  debugReason?: string;
  decision?: StudioAgentSafetyDecisionMeta;
};

const MAX_TEXT_LENGTH = 4000;
const DEFAULT_REWRITE_TIMEOUT_MS = 1200;

const EXPLICIT_REFUSAL_PATTERNS: RegExp[] = [
  /\b(?:porn|pornographic)\b/i,
  /\b(?:sexual\s+(?:intercourse|act|acts|activity|activities))\b/i,
  /\b(?:graphic\s+sexual)\b/i,
  /\b(?:explicit\s+sexual)\b/i,
  /\b(?:genitals?|penis|vagina)\b/i,
  /\b(?:ejaculat(?:e|ed|ing)|orgasm|masturbat(?:e|ed|ing))\b/i,
  /\b(?:child\s+sexual|minor\s+sexual)\b/i,
];

const EXPLICIT_REWRITE_PATTERNS: RegExp[] = [
  /\b(?:nsfw)\b/i,
  /\b(?:nude|naked|topless)\b/i,
  /\b(?:lingerie|cleavage)\b/i,
  /\b(?:sexy|sexualized|sensual|seductive|provocative|erotic)\b/i,
  /\b(?:scantily\s+clad|revealing\s+outfit)\b/i,
];

const SFW_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bnsfw\b/gi, "safe-for-work"],
  [/\b(?:nude|naked|topless)\b/gi, "fully clothed"],
  [/\blingerie\b/gi, "outfit"],
  [/\bcleavage\b/gi, "neckline"],
  [/\b(?:sexy|sexualized|sensual|seductive|provocative|erotic)\b/gi, "stylized"],
  [/\bscantily clad\b/gi, "fully dressed"],
  [/\brevealing outfit\b/gi, "outfit"],
];

const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);

const classifyStudioAgentSafetyText = (value: string): StudioAgentSafetyClassification => {
  const normalized = value.trim();
  if (!normalized.length) return "safe";
  if (normalized === STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE) return "safe";
  if (EXPLICIT_REFUSAL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "refuse";
  }
  if (EXPLICIT_REWRITE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "needs_rewrite";
  }
  return "safe";
};

const deterministicRewrite = (value: string): string => {
  let rewritten = value;
  for (const [pattern, replacement] of SFW_REPLACEMENTS) {
    rewritten = rewritten.replace(pattern, replacement);
  }
  return collapseWhitespace(rewritten);
};

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
    const normalized = collapseWhitespace(rewritten);
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
  enabled,
  debug = false,
  traceId,
  rewrite,
  rewriteTimeoutMs,
  profileId,
  environment,
  devAbsoluteZeroEnabled = false,
  modality,
}: {
  text: string | null | undefined;
  route: "studio-agent" | "describe-image";
  flow?: string;
  source: StudioAgentSafetyPostProcessSource;
  enabled: boolean;
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
}): Promise<StudioAgentSafetyPostProcessResult> => {
  const normalized = collapseWhitespace(typeof text === "string" ? text : "");
  if (!enabled || !normalized.length) {
    return { outcome: "pass", text: normalized, fallbackUsed: false };
  }
  const resolvedEnvironment: SafetyEnvironment =
    environment ?? (process.env.NODE_ENV === "production" ? "production" : "development");
  const resolvedModality = modality ?? resolveSafetyModality({ route, flow });

  const initialClassification = classifyStudioAgentSafetyText(normalized);
  const initialDecision = resolveSafetyDecision({
    classification: initialClassification,
    modality: resolvedModality,
    environment: resolvedEnvironment,
    profileId,
    devAbsoluteZeroEnabled,
  });
  const initialDecisionMeta: StudioAgentSafetyDecisionMeta = {
    profileId: initialDecision.profileId,
    modality: initialDecision.modality,
    category: initialDecision.category,
    action: initialDecision.action,
    source: initialDecision.source,
    hardFloorViolation: initialDecision.source === "hard_floor",
  };
  if (initialDecision.action === "allow") {
    return {
      outcome: "pass",
      text: normalized,
      fallbackUsed: false,
      decision: initialDecisionMeta,
    };
  }
  if (initialDecision.action === "refuse") {
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
    rewritten = deterministicRewrite(normalized);
    fallbackUsed = true;
  }

  const rewrittenClassification = classifyStudioAgentSafetyText(rewritten);
  const rewrittenDecision = resolveSafetyDecision({
    classification: rewrittenClassification,
    modality: resolvedModality,
    environment: resolvedEnvironment,
    profileId,
    devAbsoluteZeroEnabled,
  });
  const rewrittenDecisionMeta: StudioAgentSafetyDecisionMeta = {
    profileId: rewrittenDecision.profileId,
    modality: rewrittenDecision.modality,
    category: rewrittenDecision.category,
    action: rewrittenDecision.action,
    source: rewrittenDecision.source,
    hardFloorViolation: rewrittenDecision.source === "hard_floor",
  };
  if (rewrittenDecision.action === "allow") {
    return {
      outcome: "rewritten",
      text: rewritten,
      fallbackUsed,
      debugReason: debug ? "rewritten_safe" : undefined,
      decision: rewrittenDecisionMeta,
    };
  }

  if (rewrittenDecision.action === "rewrite") {
    const secondPass = deterministicRewrite(rewritten);
    fallbackUsed = true;
    const secondClassification = classifyStudioAgentSafetyText(secondPass);
    const secondDecision = resolveSafetyDecision({
      classification: secondClassification,
      modality: resolvedModality,
      environment: resolvedEnvironment,
      profileId,
      devAbsoluteZeroEnabled,
    });
    const secondDecisionMeta: StudioAgentSafetyDecisionMeta = {
      profileId: secondDecision.profileId,
      modality: secondDecision.modality,
      category: secondDecision.category,
      action: secondDecision.action,
      source: secondDecision.source,
      hardFloorViolation: secondDecision.source === "hard_floor",
    };
    if (secondDecision.action === "allow") {
      return {
        outcome: "rewritten",
        text: secondPass,
        fallbackUsed,
        debugReason: debug ? "rewritten_safe_second_pass" : undefined,
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

  return {
    outcome: "refusal",
    text: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
    fallbackUsed: true,
    debugReason: debug ? "rewrite_refusal_fallback" : undefined,
    decision: rewrittenDecisionMeta,
  };
};
