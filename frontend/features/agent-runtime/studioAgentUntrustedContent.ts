/**
 * Quarantines untrusted image-derived text before it is injected into agent prompts.
 * Keeps observational content while stripping instruction-like lines.
 */
import { sanitizeGenerationPromptText } from "../agent-core/promptText";

const MAX_IMAGE_OBSERVATION_CHARS = 800;
const UNTRUSTED_IMAGE_OBSERVATION_PREFIX = "Image observation (untrusted image-derived text): ";

const INSTRUCTION_LIKE_PATTERNS: RegExp[] = [
  /\bignore\b.*\b(instruction|prompt|system|policy|rule)s?\b/i,
  /\b(disregard|override)\b.*\b(instruction|prompt|system|policy|rule)s?\b/i,
  /\b(system prompt|developer message|hidden prompt)\b/i,
  /\b(reveal|leak|exfiltrate)\b.*\b(prompt|secret|instruction|token|key)\b/i,
  /\b(do not|don't)\b.*\b(safety|policy|filter|guardrail)s?\b/i,
  /\bfollow\b.*\bthese instructions\b/i,
  /\bvisit\s+https?:\/\//i,
];

const clip = (value: string, maxLength: number): string =>
  value.length > maxLength ? value.slice(0, maxLength) : value;

const normalizeLine = (value: string): string => value.replace(/\s+/g, " ").trim();

const isInstructionLikeLine = (value: string): boolean =>
  INSTRUCTION_LIKE_PATTERNS.some((pattern) => pattern.test(value));

export type ImageDerivedTextSanitization = {
  text: string | null;
  hadInstructionLikeText: boolean;
  removedInstructionLikeLineCount: number;
};

/**
 * Sanitizes image-derived text so it remains data, not executable instruction context.
 */
export const sanitizeImageDerivedTextForPromptCompiler = (
  value: string | null | undefined
): ImageDerivedTextSanitization => {
  if (typeof value !== "string" || !value.trim().length) {
    return {
      text: null,
      hadInstructionLikeText: false,
      removedInstructionLikeLineCount: 0,
    };
  }

  const lines = value
    .split(/\r?\n+/)
    .map(normalizeLine)
    .filter(Boolean);

  let removedInstructionLikeLineCount = 0;
  const keptSegments: string[] = [];
  lines.forEach((line) => {
    const segments = line
      .split(/(?<=[.!?])\s+/)
      .map(normalizeLine)
      .filter(Boolean);
    segments.forEach((segment) => {
      if (isInstructionLikeLine(segment)) {
        removedInstructionLikeLineCount += 1;
        return;
      }
      keptSegments.push(segment);
    });
  });

  const joined = keptSegments.join(" ");
  const sanitized = sanitizeGenerationPromptText(clip(joined, MAX_IMAGE_OBSERVATION_CHARS));

  return {
    text: sanitized,
    hadInstructionLikeText: removedInstructionLikeLineCount > 0,
    removedInstructionLikeLineCount,
  };
};

/**
 * Labels image-derived observations as untrusted to prevent control-plane confusion.
 */
export const labelUntrustedImageObservation = (value: string | null | undefined): string | null => {
  const sanitized = sanitizeGenerationPromptText(value);
  if (!sanitized) return null;
  const normalizedPrefix = UNTRUSTED_IMAGE_OBSERVATION_PREFIX.toLowerCase();
  if (sanitized.toLowerCase().startsWith(normalizedPrefix)) return sanitized;
  return `${UNTRUSTED_IMAGE_OBSERVATION_PREFIX}${sanitized}`;
};
