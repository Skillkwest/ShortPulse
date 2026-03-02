/**
 * Shared text-safety evaluation primitives used by input and output safety stages.
 */
import { resolveSafetyDecision } from "./decisionEngine";
import type { SafetyEnvironment, SafetyModality } from "./types";

export type StudioAgentSafetyClassification = "safe" | "needs_rewrite" | "refuse";

export type StudioAgentSafetyDecisionMeta = {
  profileId: "prod_safe_v1" | "staging_lenient" | "dev_absolute_zero";
  modality: SafetyModality;
  category: "safe" | "sexual_suggestive" | "sexual_explicit";
  action: "allow" | "rewrite" | "refuse";
  source: "profile" | "hard_floor" | "absolute_zero";
  hardFloorViolation: boolean;
};

const MAX_TEXT_LENGTH = 4000;

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

export const normalizeStudioAgentSafetyText = (value: string): string =>
  value.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);

export const classifyStudioAgentSafetyText = ({
  text,
  refusalMessage,
}: {
  text: string;
  refusalMessage?: string;
}): StudioAgentSafetyClassification => {
  const normalized = text.trim();
  if (!normalized.length) return "safe";
  if (refusalMessage && normalized === refusalMessage) return "safe";
  if (EXPLICIT_REFUSAL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "refuse";
  }
  if (EXPLICIT_REWRITE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "needs_rewrite";
  }
  return "safe";
};

export const rewriteStudioAgentSafetyTextDeterministic = (value: string): string => {
  let rewritten = value;
  for (const [pattern, replacement] of SFW_REPLACEMENTS) {
    rewritten = rewritten.replace(pattern, replacement);
  }
  return normalizeStudioAgentSafetyText(rewritten);
};

export const evaluateStudioAgentSafetyText = ({
  text,
  modality,
  profileId,
  environment,
  devAbsoluteZeroEnabled,
  refusalMessage,
}: {
  text: string;
  modality: SafetyModality;
  profileId?: string | null;
  environment: SafetyEnvironment;
  devAbsoluteZeroEnabled?: boolean;
  refusalMessage?: string;
}): {
  normalizedText: string;
  classification: StudioAgentSafetyClassification;
  decision: StudioAgentSafetyDecisionMeta;
} => {
  const normalizedText = normalizeStudioAgentSafetyText(text);
  const classification = classifyStudioAgentSafetyText({
    text: normalizedText,
    refusalMessage,
  });
  const decision = resolveSafetyDecision({
    classification,
    modality,
    environment,
    profileId,
    devAbsoluteZeroEnabled,
  });
  return {
    normalizedText,
    classification,
    decision: {
      profileId: decision.profileId,
      modality: decision.modality,
      category: decision.category,
      action: decision.action,
      source: decision.source,
      hardFloorViolation: decision.source === "hard_floor",
    },
  };
};
