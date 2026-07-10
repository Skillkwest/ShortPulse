/**
 * Shared text-safety evaluation primitives used by input and output safety stages.
 */
import { resolveSafetyDecision } from "./decisionEngine";
import {
  FAMILY_EXPLICIT_PATTERNS,
  FAMILY_SUGGESTIVE_PATTERNS,
  SFW_REPLACEMENTS,
  hasAmbiguousAgeSexualSignal,
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
const NEGATED_EXPLICIT_CONSTRAINT_PATTERNS = [/\bno\s+gore\b/gi, /\bwithout\s+gore\b/gi];

const maskNegatedExplicitConstraints = (value: string): string => {
  let masked = value;
  for (const pattern of NEGATED_EXPLICIT_CONSTRAINT_PATTERNS) {
    masked = masked.replace(pattern, "non-graphic");
  }
  return masked;
};

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
  if (hasAmbiguousAgeSexualSignal(normalized)) return "sexual_explicit";
  const classificationText = maskNegatedExplicitConstraints(normalized);
  for (const familyPatterns of FAMILY_EXPLICIT_PATTERNS) {
    if (familyPatterns.patterns.some((pattern) => pattern.test(classificationText))) {
      return familyPatterns.category;
    }
  }
  for (const familyPatterns of FAMILY_SUGGESTIVE_PATTERNS) {
    if (familyPatterns.patterns.some((pattern) => pattern.test(classificationText))) {
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
