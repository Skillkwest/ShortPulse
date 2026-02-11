/**
 * Prompt ownership helpers for AI Studio agent workflows.
 * Keeps source-of-truth semantics (agent/manual/reference) explicit and testable.
 */

export type PromptOrigin = "agent" | "manual" | "reference";

const stripAspectRatioPhrases = (value: string): string => {
  const ratioToken = "\\d{1,2}\\s*:\\s*\\d{1,2}";
  const ratioPatterns = [
    new RegExp(
      `\\b(?:in|at|with|for)\\s+(?:an?\\s+)?(?:vertical|portrait|horizontal|landscape|square)\\s+${ratioToken}\\s+(?:frame|composition|ratio)\\b`,
      "gi"
    ),
    new RegExp(`\\b(?:vertical|portrait|horizontal|landscape|square)\\s+${ratioToken}\\b`, "gi"),
    new RegExp(`\\b(?:aspect\\s*ratio|ratio)\\s*(?:(?:of|is|:)\\s*)?${ratioToken}\\b`, "gi"),
    new RegExp(`\\b${ratioToken}\\s*(?:aspect\\s*ratio|ratio|frame|composition)\\b`, "gi"),
    /\baspect\s*ratio\b/gi,
    new RegExp(`\\b${ratioToken}\\b`, "gi"),
  ];

  let next = value;
  ratioPatterns.forEach((pattern) => {
    next = next.replace(pattern, " ");
  });

  return next
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?]){2,}/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const clean = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = stripAspectRatioPhrases(value).trim();
  return trimmed.length ? trimmed : null;
};

/**
 * Normalizes an incoming prompt string and returns null for blank values.
 */
export const normalizePromptText = (value: string | null | undefined): string | null =>
  clean(value);

/**
 * Removes aspect-ratio language (e.g. 9:16, 16:9) from prompt text.
 */
export const removeAspectRatioLanguage = (value: string | null | undefined): string | null =>
  clean(value);

/**
 * Returns the source badge shown in the inline prompt status block.
 */
export const resolvePromptSourceBadge = (
  origin: PromptOrigin
): "agent" | "manual" | "reference" => {
  if (origin === "agent") return "agent";
  if (origin === "reference") return "reference";
  return "manual";
};

/**
 * Returns the staged prompt preview when agent output is the active source.
 */
export const getStagedAgentPrompt = (
  origin: PromptOrigin,
  latestAgentPrompt: string | null
): string | null => {
  if (origin !== "agent") return null;
  return clean(latestAgentPrompt);
};
