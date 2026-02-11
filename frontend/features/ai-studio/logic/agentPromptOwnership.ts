/**
 * Prompt ownership helpers for AI Studio agent workflows.
 * Keeps source-of-truth semantics (agent/manual/reference) explicit and testable.
 */

export type PromptOrigin = "agent" | "manual" | "reference";

const clean = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

/**
 * Normalizes an incoming prompt string and returns null for blank values.
 */
export const normalizePromptText = (value: string | null | undefined): string | null =>
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
