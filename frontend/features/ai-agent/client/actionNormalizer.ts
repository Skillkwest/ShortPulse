/**
 * Normalization helpers for agent action payloads.
 * Converts legacy snake_case keys and sanitizes prompt-bearing fields.
 */
import type { AgentActions } from "../../../prefabs/agent";
import { sanitizeGenerationPromptText } from "../../agent-core/promptText";

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/**
 * Normalize mixed-shape action payloads into a single typed structure.
 */
export const normalizeActions = (
  raw?: AgentActions | Record<string, unknown>
): AgentActions | undefined => {
  if (!raw) return undefined;
  const record = toRecord(raw);
  const applyPrompt = record.applyPrompt ?? record.apply_prompt ?? null;

  const cleanedApplyPrompt = sanitizeGenerationPromptText(
    typeof applyPrompt === "string" ? applyPrompt : null
  );
  return {
    applyPrompt: cleanedApplyPrompt,
  };
};
