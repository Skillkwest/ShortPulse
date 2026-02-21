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
  const referenceCard = record.referenceCard ?? record.reference_card ?? undefined;
  const variations = record.variations ?? undefined;
  const describeTargets = record.describeTargets ?? record.describe_targets ?? undefined;

  const cleanedApplyPrompt = sanitizeGenerationPromptText(
    typeof applyPrompt === "string" ? applyPrompt : null
  );
  const cleanedReferenceCardPrompt =
    referenceCard && typeof referenceCard === "object"
      ? sanitizeGenerationPromptText(
          (referenceCard as AgentActions["referenceCard"])?.prompt ?? null
        )
      : null;
  const cleanedReferenceCard =
    referenceCard &&
    typeof referenceCard === "object" &&
    (cleanedReferenceCardPrompt || cleanedApplyPrompt)
      ? {
          ...(referenceCard as AgentActions["referenceCard"]),
          prompt: cleanedReferenceCardPrompt ?? cleanedApplyPrompt ?? "",
        }
      : undefined;
  const cleanedVariations = Array.isArray(variations)
    ? (variations as string[])
        .map((entry) => sanitizeGenerationPromptText(entry))
        .filter((entry): entry is string => Boolean(entry))
    : undefined;

  return {
    applyPrompt: cleanedApplyPrompt,
    referenceCard: cleanedReferenceCard,
    variations: cleanedVariations?.length ? cleanedVariations : undefined,
    describeTargets: Array.isArray(describeTargets) ? (describeTargets as string[]) : undefined,
  };
};
