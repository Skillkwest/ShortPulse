/**
 * Shared text-safety evaluation primitives used by input and output safety stages.
 */
import { resolveSafetyDecision } from "./decisionEngine";
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

const FAMILY_EXPLICIT_PATTERNS: Array<{ category: SafetyCategoryId; patterns: RegExp[] }> = [
  {
    category: "sexual_explicit",
    patterns: [
      /\b(?:porn|pornographic|hardcore)\b/i,
      /\b(?:sexual\s+(?:intercourse|act|acts|activity|activities))\b/i,
      /\b(?:graphic\s+sexual|explicit\s+sexual)\b/i,
      /\b(?:genitals?|penis|vagina)\b/i,
      /\b(?:ejaculat(?:e|ed|ing)|orgasm|masturbat(?:e|ed|ing))\b/i,
      /\b(?:child\s+sexual|minor\s+sexual)\b/i,
    ],
  },
  {
    category: "violence_explicit",
    patterns: [
      /\b(?:gore|gory|dismember(?:ed|ment)|decapitat(?:e|ed|ion)|behead(?:ed|ing)?)\b/i,
      /\b(?:bloodbath|graphic\s+violence)\b/i,
      /\b(?:torture|execution|massacre)\b/i,
    ],
  },
  {
    category: "self_harm_explicit",
    patterns: [
      /\b(?:suicide|kill\s+myself|self[-\s]?harm|self[-\s]?injur(?:y|ing)|cutting)\b/i,
      /\b(?:overdose|hanging|wrist\s+slit)\b/i,
    ],
  },
  {
    category: "hate_explicit",
    patterns: [
      /\b(?:ethnic\s+cleansing|genocide|lynch(?:ing)?)\b/i,
      /\b(?:racial\s+slur|hate\s+crime)\b/i,
      /\b(?:nazi\s+propaganda|white\s+supremacy)\b/i,
    ],
  },
];

const FAMILY_SUGGESTIVE_PATTERNS: Array<{ category: SafetyCategoryId; patterns: RegExp[] }> = [
  {
    category: "sexual_suggestive",
    patterns: [
      /\b(?:nsfw)\b/i,
      /\b(?:nude|naked|topless)\b/i,
      /\b(?:lingerie|cleavage)\b/i,
      /\b(?:sexy|sexualized|sensual|seductive|provocative|erotic)\b/i,
      /\b(?:scantily\s+clad|revealing\s+outfit)\b/i,
    ],
  },
  {
    category: "violence_suggestive",
    patterns: [
      /\b(?:kill|murder|stab|shoot|violent|assault|attack)\b/i,
      /\b(?:blood|weapon|gun|knife|fight)\b/i,
    ],
  },
  {
    category: "self_harm_suggestive",
    patterns: [
      /\b(?:depressed\s+and\s+want\s+to\s+die|hurt\s+myself|end\s+my\s+life)\b/i,
      /\b(?:self\s+harm\s+thoughts?|suicidal\s+thoughts?)\b/i,
    ],
  },
  {
    category: "hate_suggestive",
    patterns: [
      /\b(?:hate\s+speech|racist|bigot(?:ed|ry)?|xenophobic)\b/i,
      /\b(?:demean(?:ing)?\s+(?:group|race|religion|gender))\b/i,
    ],
  },
];

const SFW_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bnsfw\b/gi, "safe-for-work"],
  [/\b(?:nude|naked|topless)\b/gi, "fully clothed"],
  [/\blingerie\b/gi, "outfit"],
  [/\bcleavage\b/gi, "neckline"],
  [/\b(?:sexy|sexualized|sensual|seductive|provocative|erotic)\b/gi, "stylized"],
  [/\bscantily clad\b/gi, "fully dressed"],
  [/\brevealing outfit\b/gi, "outfit"],
  [/\b(?:kill|murder|stab|shoot|violent|assault|attack)\b/gi, "conflict"],
  [/\b(?:blood|gore|dismemberment|decapitation|beheading)\b/gi, "intense scene"],
  [/\b(?:suicide|kill myself|self-harm|self harm|self injury|overdose)\b/gi, "wellness support"],
  [/\b(?:hate speech|racist|bigot|xenophobic|ethnic cleansing|genocide)\b/gi, "harmful language"],
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
