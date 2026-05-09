/**
 * AI Studio style prompt adapter logic.
 * Resolves model-family style phrasing for submission prompts while preserving
 * legacy formatting and tool gating semantics.
 */
import { getModelConfig } from "./pricing";
import type { PricingStrategyId } from "./pricingTypes";
import type { ToolId } from "../types";

export type StylePromptModelFamily = "nano_banana" | "seedream" | "generic";

type AppendStylePromptToSubmissionParams = {
  tool: ToolId | null;
  submissionPrompt: string;
  selectedStylePrompt: string | null | undefined;
  modelId: string | null | undefined;
  adapterEnabled: boolean;
};

const STYLE_PROMPT_ENABLED_TOOLS = new Set<ToolId>(["create", "text", "image", "edit"]);

const NANO_BANANA_STRATEGIES = new Set<PricingStrategyId>([
  "nano-banana-per-image",
  "nano-banana-2-per-image",
]);

const SEEDREAM_STRATEGIES = new Set<PricingStrategyId>([
  "seedream-per-image",
  "seedream-5-lite-per-image",
]);

const resolveNormalizedStylePrompt = (value: string | null | undefined): string => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s{2,}/g, " ");
};

const shouldAppendStylePromptForTool = (tool: ToolId | null): boolean => {
  if (!tool) return false;
  return STYLE_PROMPT_ENABLED_TOOLS.has(tool);
};

const resolveStylePromptLine = ({
  modelFamily,
  normalizedStylePrompt,
  adapterEnabled,
}: {
  modelFamily: StylePromptModelFamily;
  normalizedStylePrompt: string;
  adapterEnabled: boolean;
}): string => {
  if (!adapterEnabled || modelFamily === "generic") {
    return `Visual style reference: ${normalizedStylePrompt}`;
  }
  if (modelFamily === "nano_banana") {
    return `Visual style reference (treatment only): ${normalizedStylePrompt}. Preserve subject identity and base composition.`;
  }
  return `Visual style reference: ${normalizedStylePrompt}. Emphasize cohesive palette, lighting mood, and surface texture.`;
};

/**
 * Resolves model-family grouping for style prompt adaptation from pricing strategy.
 */
export const resolveStylePromptModelFamily = (
  modelId: string | null | undefined
): StylePromptModelFamily => {
  if (!modelId) return "generic";
  const pricingStrategy = getModelConfig(modelId)?.pricingStrategy;
  if (!pricingStrategy) return "generic";
  if (NANO_BANANA_STRATEGIES.has(pricingStrategy)) return "nano_banana";
  if (SEEDREAM_STRATEGIES.has(pricingStrategy)) return "seedream";
  return "generic";
};

/**
 * Returns true when model-family style adaptation is enabled at runtime.
 */
export const isStylePromptFamilyAdapterEnabled = (
  rawValue: string | undefined = process.env.NEXT_PUBLIC_AI_STUDIO_STYLE_FAMILY_ADAPTER_ENABLED
): boolean => rawValue !== "false";

/**
 * Appends style prompt text using model-family aware phrasing while preserving legacy formatting.
 */
export const appendStylePromptToSubmission = ({
  tool,
  submissionPrompt,
  selectedStylePrompt,
  modelId,
  adapterEnabled,
}: AppendStylePromptToSubmissionParams): string => {
  if (!shouldAppendStylePromptForTool(tool)) return submissionPrompt;
  const normalizedStylePrompt = resolveNormalizedStylePrompt(selectedStylePrompt);
  if (!normalizedStylePrompt.length) return submissionPrompt;
  const modelFamily = resolveStylePromptModelFamily(modelId);
  const stylePromptLine = resolveStylePromptLine({
    modelFamily,
    normalizedStylePrompt,
    adapterEnabled,
  });
  return submissionPrompt.trim().length
    ? `${submissionPrompt}\n\n${stylePromptLine}`
    : stylePromptLine;
};
