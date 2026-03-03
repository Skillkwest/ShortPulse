/**
 * Shared text-safety evaluation primitives used by input and output safety stages.
 */
import { resolveSafetyDecision } from "./decisionEngine";
import {
  FAMILY_EXPLICIT_PATTERNS,
  FAMILY_SUGGESTIVE_PATTERNS,
  SFW_REPLACEMENTS,
} from "./textSafetyLexicon";
import type {
  SafetyCategoryId,
  SafetyEnvironment,
  SafetyModality,
  SafetyPolicyDocumentV2,
} from "./types";

export type StudioAgentSafetyClassification = SafetyCategoryId;

export type StudioAgentSafetyDecisionMeta = {
  profileId: "prod_safe_v1" | "staging_lenient" | "dev_absolute_zero";
  modality: SafetyModality;
  category: SafetyCategoryId;
  action: "allow" | "rewrite" | "refuse";
  source: "profile" | "hard_floor" | "absolute_zero";
  hardFloorViolation: boolean;
};

const MAX_TEXT_LENGTH = 4000;

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
  for (const familyPatterns of FAMILY_EXPLICIT_PATTERNS) {
    if (familyPatterns.patterns.some((pattern) => pattern.test(normalized))) {
      return familyPatterns.category;
    }
  }
  for (const familyPatterns of FAMILY_SUGGESTIVE_PATTERNS) {
    if (familyPatterns.patterns.some((pattern) => pattern.test(normalized))) {
      return familyPatterns.category;
    }
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
  policyDocument,
}: {
  text: string;
  modality: SafetyModality;
  profileId?: string | null;
  environment: SafetyEnvironment;
  devAbsoluteZeroEnabled?: boolean;
  refusalMessage?: string;
  policyDocument?: SafetyPolicyDocumentV2 | null;
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
    policyDocument,
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
