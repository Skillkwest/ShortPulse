/**
 * Prompt ownership helpers for AI Studio agent workflows.
 * Keeps source-of-truth semantics (agent/manual/reference) explicit and testable.
 */
import {
  normalizePromptText as normalizePromptTextShared,
  removeAspectRatioLanguage as removeAspectRatioLanguageShared,
  sanitizeGenerationPromptText as sanitizeGenerationPromptTextShared,
} from "../../agent-core/promptText";

export type PromptOrigin = "agent" | "manual" | "reference";

/**
 * Normalizes an incoming prompt string and returns null for blank values.
 */
export const normalizePromptText = (value: string | null | undefined): string | null =>
  normalizePromptTextShared(value);

/**
 * Removes aspect-ratio language (e.g. 9:16, 16:9) from prompt text.
 */
export const removeAspectRatioLanguage = (value: string | null | undefined): string | null =>
  removeAspectRatioLanguageShared(value);

/**
 * Removes metadata-like recap text from model-generated prompts.
 */
export const sanitizeGenerationPromptText = (value: string | null | undefined): string | null =>
  sanitizeGenerationPromptTextShared(value);

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
  return normalizePromptTextShared(latestAgentPrompt);
};
