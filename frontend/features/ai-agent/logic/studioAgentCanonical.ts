/**
 * Canonical-prompt helpers for the AI Studio agent route.
 * Centralizes drift checks, explicit-edit detection, and canonical resolution.
 */

const STOPWORDS = new Set([
  "the",
  "and",
  "with",
  "from",
  "into",
  "onto",
  "over",
  "under",
  "a",
  "an",
  "of",
  "in",
  "on",
  "to",
  "for",
  "by",
  "at",
  "as",
  "is",
  "are",
  "was",
  "were",
]);

const significantTokens = (text: string, limit = 6): string[] => {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 4 && !STOPWORDS.has(token))
    .sort((a, b) => b.length - a.length)
    .slice(0, limit);
};

const normalizePromptForComparison = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Returns true when the updated prompt still preserves enough core context from canonical prompt.
 */
export const preservesContext = (canonical: string, updated: string): boolean => {
  const significant = significantTokens(canonical);
  if (!significant.length) return true;
  const updatedText = updated.toLowerCase();
  const present = significant.filter((token) => updatedText.includes(token));
  return present.length >= Math.max(3, Math.ceil(significant.length / 2));
};

/**
 * Returns true when the user's message appears to be an explicit edit/replace request.
 */
export const isExplicitEditRequest = (text: string): boolean => {
  const normalized = text.toLowerCase();
  return (
    /\b(remove|without|replace|swap|instead|change|convert|turn)\b/.test(normalized) ||
    /\bno\s+[a-z0-9]/.test(normalized) ||
    /\bmake\s+(it|this|the)\b/.test(normalized)
  );
};

/**
 * Returns true when canonical and updated prompt are effectively identical after normalization.
 */
export const isNoOpEditResponse = (canonical: string, updated: string): boolean => {
  return normalizePromptForComparison(canonical) === normalizePromptForComparison(updated);
};

/**
 * Decides whether an explicit edit should trigger a stronger retry pass.
 */
export const shouldRetryExplicitNoOp = ({
  userInput,
  effectiveCanonical,
  nextCanonical,
}: {
  userInput: string;
  effectiveCanonical?: string | null;
  nextCanonical?: string | null;
}): boolean => {
  if (!effectiveCanonical || !nextCanonical) return false;
  if (!isExplicitEditRequest(userInput)) return false;
  return isNoOpEditResponse(effectiveCanonical, nextCanonical);
};

/**
 * Returns the first non-empty canonical candidate, trimmed; otherwise null.
 */
export const resolveCanonicalPrompt = (
  ...candidates: Array<string | null | undefined>
): string | null => {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return null;
};
