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

const META_PREFIX_PATTERN =
  /^\s*(?:summary|change summary|changes made|what changed|edit summary)\s*:/i;

const META_SENTENCE_PATTERNS: RegExp[] = [
  /\b(?:the|this)\s+prompt\b/i,
  /\b(?:the|this)\s+version\b/i,
  /\bprompt\s+now\s+includes\b/i,
  /\bnow\s+includes\b/i,
  /\btransformed\s+the\s+prompt\b/i,
  /\bupdated\s+the\s+prompt\b/i,
  /\b(?:has|have)\s+been\s+described\s+in\s+detail\b/i,
  /\bchanges?\s+(?:made|applied)\b/i,
];

const stripMetaPromptLanguage = (value: string): string => {
  const normalized = value.replace(/\r\n/g, "\n");
  const paragraphs = normalized.split(/\n{2,}/);
  const cleanedParagraphs = paragraphs
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      if (META_PREFIX_PATTERN.test(paragraph)) return "";
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      const kept = sentences
        .map((sentence) => sentence.trim())
        .filter(Boolean)
        .filter(
          (sentence) =>
            !META_PREFIX_PATTERN.test(sentence) &&
            !META_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentence))
        );
      return kept.join(" ").trim();
    })
    .filter(Boolean);

  return cleanedParagraphs.join("\n\n").trim();
};

/**
 * Normalizes an incoming prompt string and returns null for blank values.
 */
export const normalizePromptText = (value: string | null | undefined): string | null =>
  sanitizeGenerationPromptText(value);

/**
 * Removes aspect-ratio language (e.g. 9:16, 16:9) from prompt text.
 */
export const removeAspectRatioLanguage = (value: string | null | undefined): string | null =>
  clean(value);

/**
 * Removes metadata-like recap text from model-generated prompts.
 * Example tails removed: "Summary: ...", "The prompt now includes ...", "have been described in detail."
 */
export const sanitizeGenerationPromptText = (value: string | null | undefined): string | null => {
  const cleaned = clean(value);
  if (!cleaned) return null;
  const withoutMeta = stripMetaPromptLanguage(cleaned);
  return withoutMeta.length ? withoutMeta : null;
};

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
